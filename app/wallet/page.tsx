"use client";

import dynamic from "next/dynamic";

const SorobanTxPanel = dynamic(
  () => import("./_components/SorobanTxPanel").then((m) => ({ default: m.SorobanTxPanel })),
  { ssr: false, loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" /> },
);

const StellarBalanceCard = dynamic(
  () => import("./_components/StellarBalanceCard").then((m) => ({ default: m.StellarBalanceCard })),
  { ssr: false, loading: () => <div className="h-[200px] animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" /> },
);

export default function WalletPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Wallet</h1>
      <p className="text-zinc-500">
        Manage your Stellar account and submit Soroban transactions.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StellarBalanceCard />
        <SorobanTxPanel />
      </div>
    </div>
  );
}
