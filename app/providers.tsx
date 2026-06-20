"use client";

import { type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { WalletProvider } from "@/components/providers/WalletContext";
import { AuthProvider } from "@/components/providers/AuthProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <AuthProvider>{children}</AuthProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}
