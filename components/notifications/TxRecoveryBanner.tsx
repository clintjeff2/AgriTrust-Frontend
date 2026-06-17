/**
 * Transaction Recovery Banner Component
 * Displays recovered pending transactions after page refresh
 */

"use client";

import { useState } from "react";
import { useTxRetryQueue } from "@/hooks/useTxRetryQueue";
import type { RecoveredTransaction } from "@/hooks/useTxRetryQueue";

function TransactionStatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    preparing: "bg-gray-200 text-gray-800",
    broadcasting: "bg-blue-200 text-blue-800",
    pending_confirmation: "bg-yellow-200 text-yellow-800",
    confirmed: "bg-green-200 text-green-800",
    failed: "bg-red-200 text-red-800",
    unknown: "bg-gray-300 text-gray-700",
  };

  const color = statusColors[status] || statusColors.unknown;

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${color}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function TransactionItem({
  tx,
  onDismiss,
  onRetry,
}: {
  tx: RecoveredTransaction;
  onDismiss: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900">
            {tx.metadata.operationType || "Transaction"}
          </span>
          <TransactionStatusBadge status={tx.status} />
        </div>
        {tx.txHash && (
          <p className="text-xs text-gray-600 font-mono truncate max-w-md">
            {tx.txHash}
          </p>
        )}
        {!tx.txHash && tx.status === "preparing" && (
          <p className="text-xs text-gray-500">
            Interrupted before signing
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {tx.status === "pending_confirmation" && tx.txHash && (
          <button
            onClick={() => onRetry(tx.operationId)}
            className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
          >
            Retry
          </button>
        )}
        <button
          onClick={() => onDismiss(tx.operationId)}
          className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function TxRecoveryBanner() {
  const {
    recoveredTransactions,
    isRecovering,
    dismissTransaction,
    retryTransaction,
    dismissAll,
  } = useTxRetryQueue();

  const [isExpanded, setIsExpanded] = useState(false);

  // Don't show banner if no recovered transactions or still recovering
  if (isRecovering || recoveredTransactions.length === 0) {
    return null;
  }

  const pendingCount = recoveredTransactions.filter(
    (tx) =>
      tx.status === "broadcasting" ||
      tx.status === "pending_confirmation" ||
      tx.status === "preparing"
  ).length;

  const confirmedCount = recoveredTransactions.filter(
    (tx) => tx.status === "confirmed"
  ).length;

  return (
    <div className="bg-blue-50 border-b border-blue-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  {pendingCount > 0 && (
                    <>
                      {pendingCount} pending transaction
                      {pendingCount !== 1 ? "s" : ""} recovered
                    </>
                  )}
                  {confirmedCount > 0 && pendingCount === 0 && (
                    <>
                      {confirmedCount} transaction
                      {confirmedCount !== 1 ? "s" : ""} confirmed
                    </>
                  )}
                </p>
                {!isExpanded && (
                  <p className="text-xs text-blue-700">
                    Click Review to see details
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
              >
                {isExpanded ? "Hide" : "Review"}
              </button>
              <button
                onClick={dismissAll}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
              >
                Dismiss All
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-3 space-y-2">
              {recoveredTransactions.map((tx) => (
                <TransactionItem
                  key={tx.operationId}
                  tx={tx}
                  onDismiss={dismissTransaction}
                  onRetry={retryTransaction}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
