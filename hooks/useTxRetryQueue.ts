/**
 * Transaction Retry Queue Hook
 * Recovers pending transactions after page refresh or unexpected navigation.
 * Checks the Soroban ledger for transaction status on app initialization.
 */

import { useEffect, useState, useCallback } from "react";
import * as txStateStore from "@/services/txStateStore";
import type { TxEntry } from "@/services/txStateStore";

const RECOVERY_TIMEOUT_MS = 5000;
const TX_STATUS_API = "/api/v1/blockchain/tx-status";

export interface RecoveredTransaction extends TxEntry {
  checked: boolean;
}

export interface UseTxRetryQueueReturn {
  recoveredTransactions: RecoveredTransaction[];
  isRecovering: boolean;
  dismissTransaction: (operationId: string) => void;
  retryTransaction: (operationId: string) => Promise<void>;
  dismissAll: () => void;
}

/**
 * Check transaction status against the Soroban ledger
 */
async function checkTransactionStatus(
  txHash: string
): Promise<"confirmed" | "not_found" | "error"> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${TX_STATUS_API}?hash=${txHash}`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      // Assume API returns { status: "confirmed" | "pending" | "not_found" }
      if (data.status === "confirmed") {
        return "confirmed";
      }
      return "not_found";
    }

    return "error";
  } catch (error) {
    console.error(`Failed to check transaction status for ${txHash}:`, error);
    return "error";
  }
}

/**
 * Main hook for transaction recovery
 */
export function useTxRetryQueue(): UseTxRetryQueueReturn {
  const [recoveredTransactions, setRecoveredTransactions] = useState<
    RecoveredTransaction[]
  >([]);
  const [isRecovering, setIsRecovering] = useState(true);

  // Recovery effect - runs once on mount
  useEffect(() => {
    let isMounted = true;
    const recoveryStartTime = Date.now();

    async function recoverPendingTransactions() {
      try {
        const pending = txStateStore.getPending();

        if (pending.length === 0) {
          setIsRecovering(false);
          return;
        }

        const recoveryPromises = pending.map(async (entry) => {
          // Handle transactions in "preparing" state (interrupted before signing)
          if (entry.status === "preparing" && !entry.txHash) {
            // Cancel this entry with a warning
            txStateStore.update(entry.operationId, {
              status: "failed",
              metadata: {
                ...entry.metadata,
                errorMessage: "Transaction interrupted before signing",
              },
            });

            return {
              ...entry,
              checked: true,
              status: "failed" as const,
            };
          }

          // For transactions with txHash, check on-chain status
          if (entry.txHash) {
            // Check if recovery timeout has been exceeded
            const elapsed = Date.now() - recoveryStartTime;
            if (elapsed > RECOVERY_TIMEOUT_MS) {
              return {
                ...entry,
                checked: false,
                status: "unknown" as const,
              };
            }

            const status = await checkTransactionStatus(entry.txHash);

            if (status === "confirmed") {
              txStateStore.update(entry.operationId, { status: "confirmed" });
              return {
                ...entry,
                status: "confirmed" as const,
                checked: true,
              };
            } else if (status === "not_found") {
              // Transaction not found - might need retry
              return {
                ...entry,
                checked: true,
                status: "pending_confirmation" as const,
              };
            } else {
              // Error checking status
              return {
                ...entry,
                checked: true,
                status: "unknown" as const,
              };
            }
          }

          return {
            ...entry,
            checked: false,
          };
        });

        const results = await Promise.all(recoveryPromises);

        if (isMounted) {
          setRecoveredTransactions(results);
          setIsRecovering(false);
        }
      } catch (error) {
        console.error("Error recovering pending transactions:", error);
        if (isMounted) {
          setIsRecovering(false);
        }
      }
    }

    recoverPendingTransactions();

    return () => {
      isMounted = false;
    };
  }, []);

  const dismissTransaction = useCallback((operationId: string) => {
    setRecoveredTransactions((prev) =>
      prev.filter((tx) => tx.operationId !== operationId)
    );
    txStateStore.remove(operationId);
  }, []);

  const retryTransaction = useCallback(async (operationId: string) => {
    const entry = txStateStore.get(operationId);
    if (!entry) {
      console.warn(`Transaction ${operationId} not found`);
      return;
    }

    // For now, just mark as failed and remove from recovered list
    // In a real implementation, this would re-submit the transaction
    txStateStore.update(operationId, { status: "failed" });
    setRecoveredTransactions((prev) =>
      prev.filter((tx) => tx.operationId !== operationId)
    );
  }, []);

  const dismissAll = useCallback(() => {
    recoveredTransactions.forEach((tx) => {
      txStateStore.remove(tx.operationId);
    });
    setRecoveredTransactions([]);
  }, [recoveredTransactions]);

  return {
    recoveredTransactions,
    isRecovering,
    dismissTransaction,
    retryTransaction,
    dismissAll,
  };
}
