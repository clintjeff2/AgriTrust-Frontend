import { describe, it, expect, vi } from "vitest";
import { createEventStore } from "@/src/stores/eventStore";
import { LedgerReconciler } from "@/src/services/ledgerReconciler";
import type { ReconciledEvent } from "@/src/types/events";

function ev(
  ledgerSequence: number,
  over: Partial<ReconciledEvent> = {}
): ReconciledEvent {
  return {
    id: over.id ?? `tx-${ledgerSequence}`,
    contractId: over.contractId ?? "C1",
    txHash: over.txHash ?? `tx-${ledgerSequence}`,
    ledgerSequence,
    type: over.type ?? "cert_status_changed",
    data: over.data ?? {},
    canonical: over.canonical ?? true,
  };
}

describe("eventStore", () => {
  it("ingests canonical events ordered by sequence", () => {
    const store = createEventStore();
    store.ingest(ev(2));
    store.ingest(ev(1));
    const snap = store.getSnapshot();
    expect(snap.events.map((e) => e.ledgerSequence)).toEqual([1, 2]);
    expect(snap.latestSequence).toBe(2);
  });

  it("returns a stable snapshot reference until something changes", () => {
    const store = createEventStore();
    store.ingest(ev(1));
    const a = store.getSnapshot();
    const b = store.getSnapshot();
    expect(a).toBe(b);
    store.ingest(ev(2));
    expect(store.getSnapshot()).not.toBe(a);
  });

  it("notifies subscribers on change", () => {
    const store = createEventStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    store.ingest(ev(1));
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    store.ingest(ev(2));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("applies a reconciliation batch: drops orphaned, keeps retained", () => {
    const store = createEventStore();
    store.ingest(ev(4, { id: "orphan-4" }));
    store.ingest(ev(5, { id: "orphan-5" }));

    store.applyReconciliation({
      latestSequence: 5,
      forkedAncestorSequence: 3,
      orphaned: [
        ev(4, { id: "orphan-4", canonical: false }),
        ev(5, { id: "orphan-5", canonical: false }),
      ],
      retained: [ev(1, { id: "keep-1" }), ev(2, { id: "keep-2" })],
      at: 123,
    });

    const snap = store.getSnapshot();
    expect(snap.events.map((e) => e.id)).toEqual(["keep-1", "keep-2"]);
    expect(snap.orphanedCount).toBe(2);
    expect(snap.lastReconciledAt).toBe(123);
  });

  it("attachReconciler is idempotent and wires push/reconcile through", () => {
    const store = createEventStore();
    const reconciler = new LedgerReconciler();

    const detachA = store.attachReconciler(reconciler);
    const detachB = store.attachReconciler(reconciler);
    expect(detachA).toBe(detachB); // same attachment, no double listeners

    reconciler.push({
      id: "tx-1",
      contractId: "C1",
      txHash: "tx-1",
      ledgerSequence: 1,
      type: "x",
      data: {},
    });
    // Ingested exactly once despite two attach calls.
    expect(store.getSnapshot().events).toHaveLength(1);

    detachA();
    reconciler.push({
      id: "tx-2",
      contractId: "C1",
      txHash: "tx-2",
      ledgerSequence: 2,
      type: "x",
      data: {},
    });
    expect(store.getSnapshot().events).toHaveLength(1); // detached, not ingested
  });

  it("reflects a reorg end-to-end via the reconciler", () => {
    const store = createEventStore();
    const reconciler = new LedgerReconciler();
    store.attachReconciler(reconciler);

    for (let s = 1; s <= 5; s++) {
      reconciler.push({
        id: `tx-${s}`,
        contractId: "C1",
        txHash: `tx-${s}`,
        ledgerSequence: s,
        type: "x",
        data: {},
      });
    }
    expect(store.getSnapshot().events).toHaveLength(5);

    reconciler.reconcile(5, 3);
    expect(store.getSnapshot().events.map((e) => e.ledgerSequence)).toEqual([
      1, 2, 3,
    ]);
  });
});
