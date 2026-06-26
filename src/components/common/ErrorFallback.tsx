"use client";

import { useState } from "react";

export interface ErrorFallbackProps {
  error?: Error | null;
  resetErrorBoundary?: () => void;
  title?: string;
  description?: string;
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
  title = "Something went wrong",
  description = "We could not complete this wallet operation.",
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm opacity-80">{error?.message ?? description}</p>
        </div>
        {resetErrorBoundary ? (
          <button type="button" onClick={resetErrorBoundary} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">
            Retry
          </button>
        ) : null}
      </div>

      {isDevelopment && error?.stack ? (
        <div className="mt-3">
          <button type="button" onClick={() => setShowDetails((value) => !value)} className="text-xs font-medium underline underline-offset-2">
            {showDetails ? "Hide" : "Show"} stack trace
          </button>
          {showDetails ? <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-black/80 p-3 text-xs text-white">{error.stack}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}
