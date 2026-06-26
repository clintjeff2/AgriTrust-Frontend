"use client";

import { useState, useEffect } from "react";

/**
 * Returns the current network connectivity status.
 *
 * Reads `navigator.onLine` on mount and subscribes to the browser's
 * `online`/`offline` events so the value stays in sync without polling.
 * Server-renders as `true` (optimistic default) to avoid hydration mismatches.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    // SSR-safe: navigator is undefined on the server
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Sync with real state immediately on mount (handles race between
    // render and event registration)
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
