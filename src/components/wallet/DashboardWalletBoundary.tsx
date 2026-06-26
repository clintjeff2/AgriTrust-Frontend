"use client";

import { type ReactNode } from "react";
import { SuspenseBoundary } from "@/src/components/common/SuspenseBoundary";
import { useWallet } from "@/src/hooks/useWallet";
import { WalletBalanceErrorBoundary } from "./WalletBalanceErrorBoundary";
import { WalletHistoryErrorBoundary } from "./WalletHistoryErrorBoundary";
import { WalletSigningErrorBoundary } from "./WalletSigningErrorBoundary";

export function DashboardWalletBoundary({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const isReconnecting = wallet.status === "reconnecting";

  return (
    <SuspenseBoundary key={wallet.status} timeoutMs={30_000} fallback={<WalletStateFallback status={wallet.status} preserveVisibleData={isReconnecting} />}>
      <WalletSigningErrorBoundary>
        <WalletBalanceErrorBoundary>
          <WalletHistoryErrorBoundary>{children}</WalletHistoryErrorBoundary>
        </WalletBalanceErrorBoundary>
      </WalletSigningErrorBoundary>
    </SuspenseBoundary>
  );
}

function WalletStateFallback({ status, preserveVisibleData }: { status: string; preserveVisibleData: boolean }) {
  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
      <span className="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
      {preserveVisibleData ? "Reconnecting wallet without hiding certification data…" : `Wallet is ${status}…`}
    </div>
  );
}
