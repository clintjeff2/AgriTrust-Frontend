"use client";

import dynamic from "next/dynamic";
import { InternationalizedText } from "@/src/components/common/InternationalizedText";

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
      <InternationalizedText as="h1" id="wallet.title" className="text-2xl font-bold" />
      <InternationalizedText as="p" id="wallet.subtitle" className="text-zinc-500" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StellarBalanceCard />
        <SorobanTxPanel />
      </div>
    </div>
  );
}
