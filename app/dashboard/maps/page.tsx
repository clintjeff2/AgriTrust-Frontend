"use client";

import dynamic from "next/dynamic";

const FarmMap = dynamic(
  () => import("./_components/FarmMap").then((m) => ({ default: m.FarmMap })),
  { ssr: false, loading: () => <div className="h-[460px] animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" /> },
);

const YieldHeatmap = dynamic(
  () => import("./_components/YieldHeatmap").then((m) => ({ default: m.YieldHeatmap })),
  { ssr: false, loading: () => <div className="h-[460px] animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" /> },
);

export default function MapsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Farm Maps</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FarmMap />
        <YieldHeatmap />
      </div>
    </div>
  );
}
