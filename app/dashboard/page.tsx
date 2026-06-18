"use client";

import { FleetCanvasGrid } from "@/src/components/dashboard/FleetCanvasGrid";
import { useFleetData } from "@/src/hooks/useFleetData";

export default function DashboardPage() {
  const data = useFleetData(10000, 1000, 10);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Fleet Asset Manager
            </h1>
            <p className="text-sm text-slate-500">
              High-density canvas grid —{" "}
              {data.assets.length.toLocaleString()} assets at 60fps
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live
            </span>
            <span>
              Updated {new Date(data.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <FleetCanvasGrid
          data={data}
          totalAssets={data.assets.length}
          height={600}
        />
      </main>
    </div>
  );
}
