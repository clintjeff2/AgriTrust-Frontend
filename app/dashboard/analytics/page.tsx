"use client";

import dynamic from "next/dynamic";

const TelemetryChart = dynamic(
  () => import("./_components/TelemetryChart").then((m) => ({ default: m.TelemetryChart })),
  { ssr: false, loading: () => <div className="h-[380px] animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" /> },
);

const YieldHistogram = dynamic(
  () => import("./_components/YieldHistogram").then((m) => ({ default: m.YieldHistogram })),
  { ssr: false, loading: () => <div className="h-[380px] animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" /> },
);

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TelemetryChart />
        <YieldHistogram />
      </div>
    </div>
  );
}
