import { describe, it, expect, vi } from "vitest";
import {
  ContractEventStream,
  parseContractEvent,
  type EventSourceLike,
} from "@/src/services/eventStream";
import { LedgerReconciler } from "@/src/services/ledgerReconciler";

class FakeEventSource implements EventSourceLike {
  private listeners: Record<string, Array<(e: MessageEvent) => void>> = {};
  closed = false;

  addEventListener(type: string, listener: (e: MessageEvent) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }
  removeEventListener(type: string, listener: (e: MessageEvent) => void): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter(
      (l) => l !== listener
    );
  }
  close(): void {
    this.closed = true;
  }
  emit(type: string, data: unknown): void {
    (this.listeners[type] ?? []).forEach((l) =>
      l({ data } as MessageEvent)
    );
  }
}

function setup(channelOverrides = {}) {
  const fake = new FakeEventSource();
  const reconciler = new LedgerReconciler();
  const stream = new ContractEventStream({
    url: "https://rpc.test/events",
    reconciler,
    eventSourceFactory: () => fake,
    ...channelOverrides,
  });
  stream.connect();
  return { fake, reconciler, stream };
}

const eventPayload = (seq: number, over = {}) =>
  JSON.stringify({
    id: `tx-${seq}-0`,
    contractId: "C1",
    txHash: `tx-${seq}`,
    ledgerSequence: seq,
    type: "cert_status_changed",
    data: { status: "verified" },
    ...over,
  });

describe("parseContractEvent", () => {
  it("requires txHash and ledgerSequence", () => {
    expect(parseContractEvent({ txHash: "x" })).toBeNull();
    expect(parseContractEvent({ ledgerSequence: 1 })).toBeNull();
    expect(parseContractEvent("nope")).toBeNull();
  });

  it("derives an id from txHash + index when absent", () => {
    const parsed = parseContractEvent({
      txHash: "abc",
      ledgerSequence: 7,
      eventIndex: 2,
    });
    expect(parsed?.id).toBe("abc-2");
  });
});

describe("ContractEventStream", () => {
  it("pipes SSE messages through the reconciler and re-emits 'event'", () => {
    const { fake, reconciler, stream } = setup();
    const onEvent = vi.fn();
    stream.on("event", onEvent);

    fake.emit("message", eventPayload(1));
    fake.emit("message", eventPayload(2));

    expect(reconciler.size).toBe(2);
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it("ignores malformed or incomplete payloads", () => {
    const { fake, reconciler } = setup();
    fake.emit("message", "{not json");
    fake.emit("message", JSON.stringify({ ledgerSequence: 1 })); // no txHash
    expect(reconciler.size).toBe(0);
  });

  it("reconciles on an explicit reorg signal", () => {
    const { fake, reconciler, stream } = setup();
    const onReconciled = vi.fn();
    stream.on("reconciled", onReconciled);

    for (let s = 1; s <= 5; s++) fake.emit("message", eventPayload(s));
    fake.emit(
      "reorg",
      JSON.stringify({ latestSequence: 5, forkedAncestorSequence: 3 })
    );

    expect(onReconciled).toHaveBeenCalledTimes(1);
    expect(reconciler.snapshot().map((e) => e.ledgerSequence)).toEqual([
      1, 2, 3,
    ]);
  });

  it("auto-reconciles when the stream rewinds without a reorg signal", () => {
    const { fake, reconciler } = setup();
    for (let s = 1; s <= 5; s++) fake.emit("message", eventPayload(s));
    // A message for an already-passed sequence (different tx) signals a rewind.
    fake.emit("message", eventPayload(3, { id: "tx-3b-0", txHash: "tx-3b" }));
    // Orphaned 4 and 5 dropped; canonical 3b ingested.
    const seqs = reconciler.snapshot().map((e) => e.ledgerSequence);
    expect(seqs).toEqual([1, 2, 3]);
    expect(reconciler.has("tx-3b-0")).toBe(true);
    expect(reconciler.has("tx-4-0")).toBe(false);
  });

  it("delegates raw addEventListener to the underlying EventSource", () => {
    const { fake, stream } = setup();
    const raw = vi.fn();
    stream.addEventListener("heartbeat", raw);
    fake.emit("heartbeat", "ping");
    expect(raw).toHaveBeenCalledTimes(1);
  });

  it("closes the underlying source", () => {
    const { fake, stream } = setup();
    stream.close();
    expect(fake.closed).toBe(true);
  });
});
