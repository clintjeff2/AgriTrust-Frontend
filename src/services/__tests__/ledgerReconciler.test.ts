import { describe, it, expect, vi } from "vitest";
import {
  LedgerReconciler,
  EVENT_WINDOW_SIZE,
} from "@/src/services/ledgerReconciler";
import type { ContractEvent, ReconciliationBatch } from "@/src/types/events";

function makeEvent(
  ledgerSequence: number,
  over: Partial<ContractEvent> = {}
): ContractEvent {
  return {
    id: over.id ?? `tx-${ledgerSequence}-0`,
    contractId: over.contractId ?? "C1",
    txHash: over.txHash ?? `tx-${ledgerSequence}`,
    ledgerSequence,
    type: over.type ?? "cert_status_changed",
    data: over.data ?? { status: "verified" },
    ledgerCloseTime: over.ledgerCloseTime,
  };
}

describe("LedgerReconciler.push", () => {
  it("ingests canonical events and tracks the highest sequence", () => {
    const r = new LedgerReconciler();
    const reconciled = r.push(makeEvent(1));
    expect(reconciled?.canonical).toBe(true);
    r.push(makeEvent(2));
    expect(r.size).toBe(2);
    expect(r.latestSequence).toBe(2);
  });

  it("ignores duplicate event ids (redelivery)", () => {
    const r = new LedgerReconciler();
    expect(r.push(makeEvent(1, { id: "dup" }))).not.toBeNull();
    expect(r.push(makeEvent(1, { id: "dup" }))).toBeNull();
    expect(r.size).toBe(1);
  });

  it("emits an 'event' for each canonical event", () => {
    const r = new LedgerReconciler();
    const spy = vi.fn();
    r.on("event", spy);
    r.push(makeEvent(1));
    r.push(makeEvent(2));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("caps the sliding window at the configured size", () => {
    const r = new LedgerReconciler({ windowSize: 3 });
    for (let s = 1; s <= 5; s++) r.push(makeEvent(s));
    expect(r.size).toBe(3);
    // Oldest evicted; their ids no longer tracked.
    expect(r.has("tx-1-0")).toBe(false);
    expect(r.has("tx-5-0")).toBe(true);
  });

  it("uses a 1000-event window by default", () => {
    expect(EVENT_WINDOW_SIZE).toBe(1000);
  });
});

describe("LedgerReconciler.reconcile — reorg scenarios", () => {
  // Scenario 1: shallow tail reorg — the last two ledgers are orphaned.
  it("scenario 1: removes the orphaned tail and retains the common prefix", () => {
    const r = new LedgerReconciler();
    for (let s = 1; s <= 5; s++) r.push(makeEvent(s));

    const batch = r.reconcile(5, 3);

    expect(batch.orphaned.map((e) => e.ledgerSequence)).toEqual([4, 5]);
    expect(batch.orphaned.every((e) => e.canonical === false)).toBe(true);
    expect(batch.retained.map((e) => e.ledgerSequence)).toEqual([1, 2, 3]);
    expect(r.snapshot().map((e) => e.ledgerSequence)).toEqual([1, 2, 3]);
    expect(r.has("tx-4-0")).toBe(false);
    expect(r.latestSequence).toBe(5);
  });

  // Scenario 2: deep reorg — a long orphaned segment is discarded.
  it("scenario 2: discards a deep orphaned segment", () => {
    const r = new LedgerReconciler();
    for (let s = 1; s <= 10; s++) r.push(makeEvent(s));

    const batch = r.reconcile(10, 2);

    expect(batch.orphaned).toHaveLength(8); // seq 3..10
    expect(batch.retained.map((e) => e.ledgerSequence)).toEqual([1, 2]);
    expect(r.size).toBe(2);
  });

  // Scenario 3: reorg then canonical replacement — phantom removed, replacement kept.
  it("scenario 3: replaces orphaned events with the canonical chain", () => {
    const r = new LedgerReconciler();
    for (let s = 1; s <= 5; s++) r.push(makeEvent(s));

    // Ledgers 4 and 5 are orphaned by a reorg back to ancestor 3.
    r.reconcile(5, 3);
    expect(r.snapshot().map((e) => e.ledgerSequence)).toEqual([1, 2, 3]);

    // Canonical replacements for 4 and 5 arrive (distinct tx hashes/ids).
    r.push(makeEvent(4, { id: "tx-4b-0", txHash: "tx-4b" }));
    r.push(makeEvent(5, { id: "tx-5b-0", txHash: "tx-5b" }));

    const seqs = r.snapshot().map((e) => e.ledgerSequence);
    expect(seqs).toEqual([1, 2, 3, 4, 5]);
    // The phantom (orphaned) events are gone; the replacements are present.
    expect(r.has("tx-4-0")).toBe(false);
    expect(r.has("tx-4b-0")).toBe(true);
  });

  it("is a no-op when the ancestor is at/above the tip (nothing orphaned)", () => {
    const r = new LedgerReconciler();
    for (let s = 1; s <= 5; s++) r.push(makeEvent(s));
    const batch = r.reconcile(6, 5);
    expect(batch.orphaned).toHaveLength(0);
    expect(batch.retained).toHaveLength(5);
    expect(r.size).toBe(5);
  });

  it("emits a 'reconciled' batch", () => {
    const r = new LedgerReconciler();
    for (let s = 1; s <= 4; s++) r.push(makeEvent(s));
    const spy = vi.fn<(batch: ReconciliationBatch) => void>();
    r.on("reconciled", spy);

    r.reconcile(4, 2);

    expect(spy).toHaveBeenCalledTimes(1);
    const batch = spy.mock.calls[0][0];
    expect(batch.forkedAncestorSequence).toBe(2);
    expect(batch.orphaned).toHaveLength(2);
  });

  it("detectReorg flags a rewound sequence once events exist", () => {
    const r = new LedgerReconciler();
    expect(r.detectReorg(1)).toBe(false); // empty window
    r.push(makeEvent(5));
    expect(r.detectReorg(3)).toBe(true); // 3 <= highest (5)
    expect(r.detectReorg(6)).toBe(false); // moving forward, not a reorg
  });
});
