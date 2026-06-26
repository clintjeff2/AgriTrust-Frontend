"use client";

import { type ReactNode } from "react";
import { ErrorBoundary } from "@/src/components/common/SuspenseBoundary";
import { ErrorFallback } from "@/src/components/common/ErrorFallback";

type WalletOperation = "signing" | "balance" | "history";

const COPY: Record<WalletOperation, { title: string; description: string }> = {
  signing: {
    title: "Wallet signature failed",
    description: "Review the request in your wallet and try signing again.",
  },
  balance: {
    title: "Wallet balance unavailable",
    description: "We could not refresh your wallet balance. Existing dashboard data is still visible.",
  },
  history: {
    title: "Wallet history unavailable",
    description: "We could not load wallet history for this session.",
  },
};

export function WalletOperationErrorBoundary({ operation, children }: { operation: WalletOperation; children: ReactNode }) {
  const copy = COPY[operation];

  return (
    <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} resetErrorBoundary={reset} title={copy.title} description={copy.description} />}>
      {children}
    </ErrorBoundary>
  );
}
