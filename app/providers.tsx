"use client";

import { type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { WalletProvider } from "@/components/providers/WalletContext";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { LocaleProvider } from "@/src/hooks/useLocale";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <WalletProvider>
          <AuthProvider>{children}</AuthProvider>
        </WalletProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
