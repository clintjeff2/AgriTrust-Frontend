/**
 * Canonical contract-event store, backed by a lightweight external store
 * (subscribe / getSnapshot) so it plugs straight into React's
 * `useSyncExternalStore` with no extra state library.
 *
 * It listens to a {@link LedgerReconciler}: each canonical `event` is ingested,
 * and each `reconciled` batch drops the orphaned events while re-asserting the
 * retained canonical ones. The snapshot reference is stable between changes, as
 * `useSyncExternalStore` requires.
 */

import type { LedgerReconciler } from "@/src/services/ledgerReconciler";
import type {
  ReconciledEvent,
  ReconciliationBatch,
} from "@/src/types/events";

export interface EventStoreState {
  /** Canonical events, ordered by ledger sequence then id. */
  events: ReconciledEvent[];
  /** Highest canonical ledger sequence applied. */
  latestSequence: number;
  /** Unix ms of the last reconciliation, or null if none yet. */
  lastReconciledAt: number | null;
  /** Total events discarded as orphaned over the store's lifetime. */
  orphanedCount: number;
}

export interface EventStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): EventStoreState;
  getServerSnapshot(): EventStoreState;
  ingest(event: ReconciledEvent): void;
  applyReconciliation(batch: ReconciliationBatch): void;
  /** Wire this store to a reconciler. Idempotent; returns an unsubscribe. */
  attachReconciler(reconciler: LedgerReconciler): () => void;
  reset(): void;
}

const EMPTY_SNAPSHOT: EventStoreState = {
  events: [],
  latestSequence: 0,
  lastReconciledAt: null,
  orphanedCount: 0,
};

function bySequenceThenId(a: ReconciledEvent, b: ReconciledEvent): number {
  return a.ledgerSequence - b.ledgerSequence || a.id.localeCompare(b.id);
}

export function createEventStore(): EventStore {
  const byId = new Map<string, ReconciledEvent>();
  const listeners = new Set<() => void>();
  const attachments = new Map<LedgerReconciler, () => void>();

  let latestSequence = 0;
  let lastReconciledAt: number | null = null;
  let orphanedCount = 0;
  let snapshot: EventStoreState = EMPTY_SNAPSHOT;

  function rebuildSnapshot(): void {
    snapshot = {
      events: Array.from(byId.values()).sort(bySequenceThenId),
      latestSequence,
      lastReconciledAt,
      orphanedCount,
    };
  }

  function emitChange(): void {
    rebuildSnapshot();
    for (const listener of listeners) listener();
  }

  function ingest(event: ReconciledEvent): void {
    if (!event.canonical) {
      byId.delete(event.id);
    } else {
      byId.set(event.id, event);
      if (event.ledgerSequence > latestSequence) {
        latestSequence = event.ledgerSequence;
      }
    }
    emitChange();
  }

  function applyReconciliation(batch: ReconciliationBatch): void {
    for (const orphan of batch.orphaned) {
      if (byId.delete(orphan.id)) orphanedCount += 1;
    }
    for (const kept of batch.retained) {
      byId.set(kept.id, { ...kept, canonical: true });
    }
    latestSequence = batch.latestSequence;
    lastReconciledAt = batch.at;
    emitChange();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    getServerSnapshot() {
      return EMPTY_SNAPSHOT;
    },
    ingest,
    applyReconciliation,
    attachReconciler(reconciler) {
      const existing = attachments.get(reconciler);
      if (existing) return existing;

      const onEvent = (event: ReconciledEvent) => ingest(event);
      const onReconciled = (batch: ReconciliationBatch) =>
        applyReconciliation(batch);

      reconciler.on("event", onEvent);
      reconciler.on("reconciled", onReconciled);

      const detach = () => {
        reconciler.off("event", onEvent);
        reconciler.off("reconciled", onReconciled);
        attachments.delete(reconciler);
      };
      attachments.set(reconciler, detach);
      return detach;
    },
    reset() {
      byId.clear();
      latestSequence = 0;
      lastReconciledAt = null;
      orphanedCount = 0;
      snapshot = EMPTY_SNAPSHOT;
      emitChange();
    },
  };
}

/** Shared store wired to the default reconciler by the hook/stream. */
export const defaultEventStore = createEventStore();
