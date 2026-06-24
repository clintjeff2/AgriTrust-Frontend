"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  defaultReconciler,
  type LedgerReconciler,
} from "@/src/services/ledgerReconciler";
import { defaultEventStore, type EventStore } from "@/src/stores/eventStore";
import type { ReconciledEvent } from "@/src/types/events";

export interface UseContractEventsOptions {
  /** Override the store (tests). Defaults to the shared singleton. */
  store?: EventStore;
  /** Override the reconciler (tests). Defaults to the shared singleton. */
  reconciler?: LedgerReconciler;
  /** Only return events for this contract. */
  contractId?: string;
  /** Only return events of this type. */
  type?: string;
  /** Skip wiring/reading when false. Defaults to true. */
  enabled?: boolean;
}

export interface UseContractEventsResult {
  /** Canonical events (filtered), ordered by ledger sequence. */
  events: ReconciledEvent[];
  latestSequence: number;
  lastReconciledAt: number | null;
  orphanedCount: number;
}

/**
 * Subscribes UI to the reconciled, canonical contract-event stream. Orphaned
 * events from forked ledgers never reach the returned list, and reorgs update
 * it atomically. The store↔reconciler wiring is idempotent and persists for the
 * app's lifetime so events keep accumulating even while no component is mounted.
 */
export function useContractEvents(
  options: UseContractEventsOptions = {}
): UseContractEventsResult {
  const {
    store = defaultEventStore,
    reconciler = defaultReconciler,
    contractId,
    type,
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;
    // Idempotent: attaches listeners once even across many mounted consumers.
    store.attachReconciler(reconciler);
  }, [store, reconciler, enabled]);

  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );

  const events = useMemo(() => {
    let list = snapshot.events;
    if (contractId) list = list.filter((e) => e.contractId === contractId);
    if (type) list = list.filter((e) => e.type === type);
    return list;
  }, [snapshot.events, contractId, type]);

  return {
    events,
    latestSequence: snapshot.latestSequence,
    lastReconciledAt: snapshot.lastReconciledAt,
    orphanedCount: snapshot.orphanedCount,
  };
}
