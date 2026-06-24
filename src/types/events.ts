/**
 * Soroban contract event types for the ledger reconciliation layer.
 *
 * Every event carries `ledgerSequence` and `txHash` so an event can be tied
 * unambiguously to the block that produced it — the basis for detecting and
 * discarding events from orphaned blocks after a ledger reorganization.
 */

/** Identifying metadata for a closed ledger. */
export interface LedgerMeta {
  ledgerSequence: number;
  /** Unix seconds the ledger closed. */
  ledgerCloseTime?: number;
  /** Ledger hash, when the RPC provides it. */
  ledgerHash?: string;
}

/** A single decoded contract event from the Soroban RPC stream. */
export interface ContractEvent {
  /** Stable unique id, e.g. `${txHash}-${eventIndex}` or the RPC paging id. */
  id: string;
  contractId: string;
  txHash: string;
  ledgerSequence: number;
  /** Event topic/type, e.g. "cert_status_changed". */
  type: string;
  /** Decoded event payload. */
  data: unknown;
  /** Unix seconds the producing ledger closed. */
  ledgerCloseTime?: number;
}

/**
 * A contract event after passing through the reconciler. `canonical` is false
 * for events that belonged to an orphaned chain segment and were discarded.
 * (`ledgerSequence` is inherited from {@link ContractEvent}; it is restated in
 * the intersection to match the reconciliation contract.)
 */
export type ReconciledEvent = ContractEvent & {
  ledgerSequence: number;
  canonical: boolean;
};

/**
 * Payload emitted on the reconciler's `reconciled` channel when a reorg is
 * processed. Listeners drop the `orphaned` events (phantom updates) and keep
 * the re-emitted `retained` canonical events.
 */
export interface ReconciliationBatch {
  /** New canonical tip sequence. */
  latestSequence: number;
  /** Last sequence common to both chains; everything ≤ this is untouched. */
  forkedAncestorSequence: number;
  /** Events removed because they came from the orphaned chain segment. */
  orphaned: ReconciledEvent[];
  /** Canonical events re-emitted so consumers can reassert correct state. */
  retained: ReconciledEvent[];
  /** Unix ms the reconciliation completed. */
  at: number;
}

/** Events emitted by the reconciler/stream EventEmitter. */
export interface ReconcilerEvents {
  /** A single canonical event passed through. */
  event: (event: ReconciledEvent) => void;
  /** A reorg was reconciled. */
  reconciled: (batch: ReconciliationBatch) => void;
}
