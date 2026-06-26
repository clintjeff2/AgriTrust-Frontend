"use client";

import { type ReactNode } from "react";
import { WalletOperationErrorBoundary } from "./WalletOperationErrorBoundary";

export function WalletSigningErrorBoundary({ children }: { children: ReactNode }) {
  return <WalletOperationErrorBoundary operation="signing">{children}</WalletOperationErrorBoundary>;
}
