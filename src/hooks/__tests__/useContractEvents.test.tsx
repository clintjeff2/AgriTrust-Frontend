import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useContractEvents } from "@/src/hooks/useContractEvents";
import { createEventStore } from "@/src/stores/eventStore";
import { LedgerReconciler } from "@/src/services/ledgerReconciler";
import type { ContractEvent } from "@/src/types/events";

function makeEvent(
  ledgerSequence: number,
  over: Partial<ContractEvent> = {}
): ContractEvent {
  return {
    id: over.id ?? `tx-${ledgerSequence}`,
    contractId: over.contractId ?? "C1",
    txHash: over.txHash ?? `tx-${ledgerSequence}`,
    ledgerSequence,
    type: over.type ?? "cert_status_changed",
    data: over.data ?? {},
  };
}

describe("useContractEvents", () => {
  it("reflects canonical events pushed through the reconciler", () => {
    const store = createEventStore();
    const reconciler = new LedgerReconciler();
    const { result } = renderHook(() =>
      useContractEvents({ store, reconciler })
    );

    expect(result.current.events).toHaveLength(0);

    act(() => {
      reconciler.push(makeEvent(1));
      reconciler.push(makeEvent(2));
    });

    expect(result.current.events.map((e) => e.ledgerSequence)).toEqual([1, 2]);
    expect(result.current.latestSequence).toBe(2);
  });

  it("drops orphaned events after a reorg", () => {
    const store = createEventStore();
    const reconciler = new LedgerReconciler();
    const { result } = renderHook(() =>
      useContractEvents({ store, reconciler })
    );

    act(() => {
      for (let s = 1; s <= 5; s++) reconciler.push(makeEvent(s));
    });
    expect(result.current.events).toHaveLength(5);

    act(() => {
      reconciler.reconcile(5, 3);
    });
    expect(result.current.events.map((e) => e.ledgerSequence)).toEqual([
      1, 2, 3,
    ]);
    expect(result.current.lastReconciledAt).not.toBeNull();
  });

  it("filters by contractId and type", () => {
    const store = createEventStore();
    const reconciler = new LedgerReconciler();
    const { result } = renderHook(() =>
      useContractEvents({ store, reconciler, contractId: "C2", type: "minted" })
    );

    act(() => {
      reconciler.push(makeEvent(1, { id: "a", contractId: "C1" }));
      reconciler.push(
        makeEvent(2, { id: "b", contractId: "C2", type: "minted" })
      );
      reconciler.push(
        makeEvent(3, { id: "c", contractId: "C2", type: "burned" })
      );
    });

    expect(result.current.events.map((e) => e.id)).toEqual(["b"]);
  });
});
