"use client";

import { Suspense, useEffect, useState } from "react";
import { InternationalizedText } from "@/src/components/common/InternationalizedText";

function useLoadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const chunks = entries.filter((e) =>
      e.name.includes("/chunks/") || e.name.includes("/_next/static/chunks/"),
    );
    if (chunks.length > 0) {
      const loaded = chunks.filter((e) => e.responseEnd > 0).length;
      const initialProgress = Math.min((loaded / Math.max(chunks.length, 1)) * 100, 100);
      // Yield to avoid synchronous setState in effect
      Promise.resolve().then(() => setProgress(initialProgress));
    }
    const timer = setInterval(() => {
      setProgress((p) => Math.min(p + 5, 95));
    }, 200);
    return () => clearInterval(timer);
  }, []);

  return progress;
}

function ProgressBar() {
  const progress = useLoadingProgress();

  return (
    <div className="fixed top-0 left-0 z-50 h-1 w-full bg-zinc-200 dark:bg-zinc-800">
      <div
        className="h-full bg-emerald-500 transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function LoadingBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <>
          <ProgressBar />
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="space-y-4 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
              <InternationalizedText as="p" id="common.loadingSection" className="text-sm text-zinc-500" />
            </div>
          </div>
        </>
      }
    >
      {children}
    </Suspense>
  );
}
