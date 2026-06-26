"use client";

import { type ReactNode } from "react";
import { WalletOperationErrorBoundary } from "./WalletOperationErrorBoundary";

export function WalletHistoryErrorBoundary({ children }: { children: ReactNode }) {
  return <WalletOperationErrorBoundary operation="history">{children}</WalletOperationErrorBoundary>;
}
