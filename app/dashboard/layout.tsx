import { type ReactNode } from "react";
import { LoadingBoundary } from "@/components/loading/LoadingBoundary";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <span className="text-lg font-semibold">AgriTrust Dashboard</span>
          <div className="flex gap-4 text-sm">
            <a href="/dashboard" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">Overview</a>
            <a href="/dashboard/analytics" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">Analytics</a>
            <a href="/dashboard/maps" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">Maps</a>
            <a href="/wallet" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">Wallet</a>
            <a href="/settings/devices" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">Devices</a>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <LoadingBoundary>{children}</LoadingBoundary>
      </main>
    </div>
  );
}
