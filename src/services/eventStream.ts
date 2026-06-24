/**
 * SSE consumer for the Soroban RPC contract-event stream.
 *
 * Incoming events are piped through a {@link LedgerReconciler} before being
 * dispatched, so orphaned-block events are filtered out and reorgs are
 * reconciled. The stream re-emits the reconciler's `event` / `reconciled`
 * channels, and `addEventListener` delegates to the underlying EventSource so
 * any pre-existing raw SSE listeners keep working unchanged.
 */

import EventEmitter from "eventemitter3";
import {
  LedgerReconciler,
  defaultReconciler,
} from "@/src/services/ledgerReconciler";
import type { ContractEvent } from "@/src/types/events";

/** Minimal EventSource surface, so a fake can be injected in tests/SSR. */
export interface EventSourceLike {
  addEventListener(
    type: string,
    listener: (event: MessageEvent) => void
  ): void;
  removeEventListener(
    type: string,
    listener: (event: MessageEvent) => void
  ): void;
  close(): void;
  readyState?: number;
}

export interface EventStreamOptions {
  url: string;
  reconciler?: LedgerReconciler;
  /** Factory for the underlying SSE connection. Defaults to `new EventSource`. */
  eventSourceFactory?: (url: string) => EventSourceLike;
  withCredentials?: boolean;
  /** SSE event name carrying contract events. Default "message". */
  eventChannel?: string;
  /** SSE event name carrying reorg signals. Default "reorg". */
  reorgChannel?: string;
}

interface StreamEvents {
  event: (event: ReturnType<LedgerReconciler["push"]>) => void;
  reconciled: (...args: unknown[]) => void;
  error: (error: Error) => void;
  open: () => void;
}

interface ReorgSignal {
  latestSequence: number;
  forkedAncestorSequence: number;
}

/** Normalizes a raw SSE payload into a ContractEvent, or null if invalid. */
export function parseContractEvent(raw: unknown): ContractEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const txHash = typeof r.txHash === "string" ? r.txHash : null;
  const ledgerSequence =
    typeof r.ledgerSequence === "number" ? r.ledgerSequence : null;
  // ledgerSequence + txHash are mandatory for unambiguous block identification.
  if (!txHash || ledgerSequence === null) return null;

  const eventIndex = typeof r.eventIndex === "number" ? r.eventIndex : 0;
  return {
    id: typeof r.id === "string" ? r.id : `${txHash}-${eventIndex}`,
    contractId: typeof r.contractId === "string" ? r.contractId : "",
    txHash,
    ledgerSequence,
    type: typeof r.type === "string" ? r.type : "contract",
    data: "data" in r ? r.data : r.value,
    ledgerCloseTime:
      typeof r.ledgerCloseTime === "number" ? r.ledgerCloseTime : undefined,
  };
}

export class ContractEventStream extends EventEmitter<StreamEvents> {
  private readonly reconciler: LedgerReconciler;
  private readonly eventChannel: string;
  private readonly reorgChannel: string;
  private source: EventSourceLike | null = null;

  constructor(private readonly options: EventStreamOptions) {
    super();
    this.reconciler = options.reconciler ?? defaultReconciler;
    this.eventChannel = options.eventChannel ?? "message";
    this.reorgChannel = options.reorgChannel ?? "reorg";

    // Forward the reconciler's output so consumers can listen on the stream.
    this.reconciler.on("event", (event) => this.emit("event", event));
    this.reconciler.on("reconciled", (batch) =>
      this.emit("reconciled", batch)
    );
  }

  /** Opens the SSE connection. Returns false if SSE is unavailable. */
  connect(): boolean {
    if (this.source) return true;

    const factory =
      this.options.eventSourceFactory ??
      (typeof EventSource !== "undefined"
        ? (url: string) =>
            new EventSource(url, {
              withCredentials: this.options.withCredentials,
            }) as unknown as EventSourceLike
        : null);

    if (!factory) {
      this.emit("error", new Error("EventSource is not available"));
      return false;
    }

    const source = factory(this.options.url);
    this.source = source;
    source.addEventListener(this.eventChannel, this.handleMessage);
    source.addEventListener(this.reorgChannel, this.handleReorg);
    source.addEventListener("error", this.handleError);
    return true;
  }

  private handleMessage = (event: MessageEvent): void => {
    const parsed = this.safeParse(event.data);
    if (parsed === undefined) return;
    const contractEvent = parseContractEvent(parsed);
    if (!contractEvent) return;
    // Auto-reconcile if the stream rewound without an explicit reorg signal.
    if (this.reconciler.detectReorg(contractEvent.ledgerSequence)) {
      this.reconciler.reconcile(
        contractEvent.ledgerSequence,
        contractEvent.ledgerSequence - 1
      );
    }
    this.reconciler.push(contractEvent);
  };

  private handleReorg = (event: MessageEvent): void => {
    const parsed = this.safeParse(event.data) as ReorgSignal | undefined;
    if (
      !parsed ||
      typeof parsed.latestSequence !== "number" ||
      typeof parsed.forkedAncestorSequence !== "number"
    ) {
      return;
    }
    this.reconciler.reconcile(
      parsed.latestSequence,
      parsed.forkedAncestorSequence
    );
  };

  private handleError = (): void => {
    this.emit("error", new Error("SSE connection error"));
  };

  private safeParse(data: unknown): unknown {
    if (typeof data !== "string") return data;
    try {
      return JSON.parse(data);
    } catch {
      return undefined;
    }
  }

  /**
   * Registers a raw listener on the underlying EventSource — for pre-existing
   * SSE consumers that should keep receiving events untouched.
   */
  addEventListener(
    type: string,
    listener: (event: MessageEvent) => void
  ): void {
    this.source?.addEventListener(type, listener);
  }

  removeEventListener(
    type: string,
    listener: (event: MessageEvent) => void
  ): void {
    this.source?.removeEventListener(type, listener);
  }

  /** Closes the SSE connection and detaches handlers. */
  close(): void {
    if (!this.source) return;
    this.source.removeEventListener(this.eventChannel, this.handleMessage);
    this.source.removeEventListener(this.reorgChannel, this.handleReorg);
    this.source.removeEventListener("error", this.handleError);
    this.source.close();
    this.source = null;
  }
}
