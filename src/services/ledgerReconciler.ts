/**
 * Ledger reconciliation layer.
 *
 * Soroban can briefly fork/reorganize, so the SSE event stream may deliver
 * events from blocks that end up orphaned — producing phantom certification
 * status updates. This reconciler keeps a sliding window of recent events
 * (a ring buffer capped at 1000 events / ~5MB) and, on a reorg signal, removes
 * the events belonging to the orphaned chain segment and re-emits the canonical
 * ones so consumers can reassert correct state.
 *
 * Emits (via eventemitter3):
 *   - "event"      → a single canonical event passed through
 *   - "reconciled" → a {@link ReconciliationBatch} after a reorg is processed
 */

import EventEmitter from "eventemitter3";
import { RingBuffer } from "@/src/utils/ringBuffer";
import type {
  ContractEvent,
  ReconciledEvent,
  ReconciliationBatch,
  ReconcilerEvents,
} from "@/src/types/events";

/** Sliding-window size: last 1000 events. */
export const EVENT_WINDOW_SIZE = 1000;
/** Memory budget for the window: 5MB. */
export const MAX_BUFFER_BYTES = 5 * 1024 * 1024;

export interface LedgerReconcilerOptions {
  windowSize?: number;
  maxBytes?: number;
}

export class LedgerReconciler extends EventEmitter<ReconcilerEvents> {
  private readonly buffer: RingBuffer<ReconciledEvent>;
  /** Event ids currently in the window, for O(1) dedupe. */
  private readonly ids = new Set<string>();
  private highestSequence = 0;

  constructor(options: LedgerReconcilerOptions = {}) {
    super();
    this.buffer = new RingBuffer<ReconciledEvent>(
      options.windowSize ?? EVENT_WINDOW_SIZE,
      { maxBytes: options.maxBytes ?? MAX_BUFFER_BYTES }
    );
  }

  /** Number of events currently retained in the window. */
  get size(): number {
    return this.buffer.size;
  }

  /** Approximate bytes retained in the window. */
  get byteSize(): number {
    return this.buffer.byteSize;
  }

  /** Highest canonical ledger sequence observed. */
  get latestSequence(): number {
    return this.highestSequence;
  }

  /**
   * Ingests a stream event. Duplicates (same id, e.g. a redelivery) are
   * ignored. Returns the reconciled (canonical) event, or null if it was a
   * duplicate.
   */
  push(event: ContractEvent): ReconciledEvent | null {
    if (this.ids.has(event.id)) return null;

    const reconciled: ReconciledEvent = { ...event, canonical: true };
    const evicted = this.buffer.push(reconciled);
    this.ids.add(reconciled.id);
    for (const old of evicted) this.ids.delete(old.id);

    if (event.ledgerSequence > this.highestSequence) {
      this.highestSequence = event.ledgerSequence;
    }

    this.emit("event", reconciled);
    return reconciled;
  }

  /**
   * Heuristic reorg signal: an incoming ledger sequence at or below the highest
   * already seen, while the window holds events, indicates the chain rewound.
   */
  detectReorg(incomingSequence: number): boolean {
    return incomingSequence <= this.highestSequence && this.buffer.size > 0;
  }

  /**
   * Reconciles after a reorg. Events newer than `forkedAncestorSequence` (the
   * last common ancestor) are treated as orphaned: removed from the window and
   * marked `canonical: false`. Remaining canonical events are re-emitted in the
   * batch so consumers can drop phantom updates and reassert correct state.
   * The new canonical events for the replacement chain arrive subsequently via
   * {@link push}.
   */
  reconcile(
    latestSequence: number,
    forkedAncestorSequence: number
  ): ReconciliationBatch {
    const orphaned = this.buffer
      .dropMatching((e) => e.ledgerSequence > forkedAncestorSequence)
      .map((e) => ({ ...e, canonical: false }));

    for (const e of orphaned) this.ids.delete(e.id);

    const retained = this.buffer.toArray();
    this.highestSequence = latestSequence;

    const batch: ReconciliationBatch = {
      latestSequence,
      forkedAncestorSequence,
      orphaned,
      retained,
      at: Date.now(),
    };

    this.emit("reconciled", batch);
    return batch;
  }

  /** Whether an event id is currently in the window. */
  has(id: string): boolean {
    return this.ids.has(id);
  }

  /** Current window contents, oldest → newest. */
  snapshot(): ReconciledEvent[] {
    return this.buffer.toArray();
  }

  /** Resets all state. */
  reset(): void {
    this.buffer.clear();
    this.ids.clear();
    this.highestSequence = 0;
  }
}

/** Shared reconciler used by the default event stream and store wiring. */
export const defaultReconciler = new LedgerReconciler();
