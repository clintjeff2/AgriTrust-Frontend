"use client";

import { useEffect, useState, useCallback } from "react";
import type { PendingDeposit } from "@/hooks/useSorobanEscrow";

interface EscrowDisplayData {
  balance: string;
  milestoneStatus: string;
  certificationValid: boolean;
  pendingDeposits: PendingDeposit[];
}

interface InventoryCardProps {
  /** The escrow data to display, including any optimistic pending deposits. */
  data: EscrowDisplayData | undefined;
  /** Whether the data is currently loading. */
  isLoading: boolean;
  /** Any error that occurred while fetching escrow data. */
  error: Error | null;
  /** Whether a deposit is currently in progress. */
  isDepositing: boolean;
  /** Callback to trigger a new deposit. */
  onDeposit?: (amount: string) => void;
}

/** Custom event detail for escrow deposit failures. */
interface EscrowDepositFailedDetail {
  amount: string;
  error: string;
  optimisticId: string;
}

/**
 * InventoryCard displays escrow balance, milestone status, certification validity,
 * and a list of pending (optimistically applied) deposits with a pulsing animation.
 *
 * It listens for the `escrow-deposit-failed` custom event to display error feedback.
 */
export default function InventoryCard({
  data,
  isLoading,
  error,
  isDepositing,
  onDeposit,
}: InventoryCardProps) {
  const [failedDepositMessage, setFailedDepositMessage] = useState<string | null>(null);

  // Listen for deposit failure events dispatched by the rollbackFn.
  const handleDepositFailed = useCallback((event: Event) => {
    const detail = (event as CustomEvent<EscrowDepositFailedDetail>).detail;
    setFailedDepositMessage(
      `Deposit of ${detail.amount} failed: ${detail.error}`
    );
    // Auto-dismiss after 8 seconds.
    setTimeout(() => setFailedDepositMessage(null), 8000);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("escrow-deposit-failed", handleDepositFailed);
    return () => {
      window.removeEventListener("escrow-deposit-failed", handleDepositFailed);
    };
  }, [handleDepositFailed]);

  // ----- Loading state -----
  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-600" />
          <div className="h-8 w-24 rounded bg-gray-200 dark:bg-gray-600" />
          <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-600" />
        </div>
      </div>
    );
  }

  // ----- Error state -----
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">
          Failed to load escrow data
        </p>
        <p className="mt-1 text-xs text-red-500 dark:text-red-500">
          {error.message}
        </p>
      </div>
    );
  }

  // ----- Empty state -----
  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 shadow-sm dark:border-gray-600 dark:bg-gray-800/50">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No escrow data available. Connect a wallet to view your inventory.
        </p>
      </div>
    );
  }

  const pendingCount = data.pendingDeposits.length;
  const totalPending = data.pendingDeposits.reduce(
    (sum, d) => sum + Number(d.amount),
    0
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Escrow Inventory
        </h3>
        {data.certificationValid ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
            Certified
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            Pending Certification
          </span>
        )}
      </div>

      {/* Balance */}
      <div className="mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Balance</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">
          {Number(data.balance).toLocaleString()} tokens
        </p>
      </div>

      {/* Milestone Status */}
      <div className="mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Milestone Status
        </p>
        <p className="mt-1 text-sm font-medium capitalize text-gray-900 dark:text-white">
          {data.milestoneStatus}
        </p>
      </div>

      {/* Failed deposit toast */}

      {/* Pending Deposits */}
      {pendingCount > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Pending Deposits
            </p>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              {pendingCount}
            </span>
          </div>

          <ul className="space-y-2">
            {data.pendingDeposits.map((deposit) => (
              <li
                key={deposit.optimisticId}
                className="flex items-center justify-between rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2 animate-pulse-border dark:border-amber-600 dark:bg-amber-900/20"
                title={`Optimistic ID: ${deposit.optimisticId}`}
              >
                <div className="flex items-center gap-2">
                  {/* Pulsing dot indicator */}
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                  </span>
                  <span className="text-sm font-medium text-amber-900 dark:text-amber-300">
                    +{Number(deposit.amount).toLocaleString()} tokens
                  </span>
                </div>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {new Date(deposit.timestamp).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>

          {totalPending > 0 && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Total pending: +{totalPending.toLocaleString()} tokens
              {isDepositing && (
                <span className="ml-1 inline-block animate-pulse">
                  &hellip;
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Failed deposit message */}
      {failedDepositMessage && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-700 dark:bg-red-900/20">
          <div className="flex items-start gap-2">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Deposit Failed
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                {failedDepositMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Action */}
      {onDeposit && (
        <button
          type="button"
          onClick={() => onDeposit("100")}
          disabled={isDepositing}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {isDepositing ? "Processing Deposit..." : "Deposit 100 Tokens"}
        </button>
      )}
    </div>
  );
}
