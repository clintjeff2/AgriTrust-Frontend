"use client";

import { type ReactNode } from "react";
import { useWallet } from "@/components/providers/WalletContext";
import { useLocale } from "@/src/hooks/useLocale";
import { InternationalizedText } from "@/src/components/common/InternationalizedText";

export function AccountGuard({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const { isSwitching, account } = useWallet();

  if (isSwitching) {
    return (
      <div
        role="status"
        aria-label={t("account.switching")}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      >
        <div className="w-full max-w-md space-y-4 p-6">
          <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
          <div className="h-24 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <InternationalizedText
          as="p"
          id="account.connectPrompt"
          className="text-muted-foreground"
        />
      </div>
    );
  }

  return <>{children}</>;
}
