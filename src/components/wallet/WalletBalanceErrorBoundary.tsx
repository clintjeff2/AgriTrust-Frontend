"use client";

import { type ReactNode } from "react";
import { WalletOperationErrorBoundary } from "./WalletOperationErrorBoundary";

export function WalletBalanceErrorBoundary({ children }: { children: ReactNode }) {
  return <WalletOperationErrorBoundary operation="balance">{children}</WalletOperationErrorBoundary>;
}
