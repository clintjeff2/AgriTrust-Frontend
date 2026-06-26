"use client";

import { useState, useTransition } from "react";
import { useWallet } from "@/src/hooks/useWallet";

type WalletProvider = "metamask" | "walletconnect" | "freighter" | null;

export function WalletConnector({ provider }: { provider?: WalletProvider }) {
  const wallet = useWallet();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isBusy = isPending || wallet.status === "connecting" || wallet.status === "approving" || wallet.status === "reconnecting";

  const handleConnect = () => {
    setError(null);
    startTransition(() => {
      void wallet.connect(provider).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Wallet connection failed");
      });
    });
  };

  const handleDisconnect = () => {
    startTransition(() => wallet.disconnect());
  };

  return (
    <div className="flex flex-col gap-2">
      {wallet.account ? (
        <button type="button" onClick={handleDisconnect} disabled={isBusy} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900">
          Disconnect wallet
        </button>
      ) : (
        <button type="button" onClick={handleConnect} disabled={isBusy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
          {isBusy ? wallet.status === "approving" ? "Approve in wallet…" : "Connecting wallet…" : "Connect wallet"}
        </button>
      )}
      <span className="text-xs text-zinc-500" aria-live="polite">Wallet status: {wallet.status}</span>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
