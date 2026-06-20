"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  processSyncQueue,
  getPendingSyncCount,
  getStorageUsage,
  getTotalAuditCount,
  getSyncedAuditCount,
} from "@/src/services/indexedDbStore";

export interface OfflineSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  totalCount: number;
  syncedCount: number;
  storageUsage: { used: number; total: number; percent: number };
}

export function useOfflineSync() {
  const [state, setState] = useState<OfflineSyncState>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    totalCount: 0,
    syncedCount: 0,
    storageUsage: { used: 0, total: 50 * 1024 * 1024, percent: 0 },
  });

  // Prevent concurrent sync runs
  const isSyncingRef = useRef(false);

  const refreshStats = useCallback(async () => {
    const [pendingCount, storageUsage, totalCount, syncedCount] =
      await Promise.all([
        getPendingSyncCount(),
        getStorageUsage(),
        getTotalAuditCount(),
        getSyncedAuditCount(),
      ]);
    setState((prev) => ({
      ...prev,
      pendingCount,
      storageUsage,
      totalCount,
      syncedCount,
    }));
  }, []);

  const runSync = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setState((prev) => ({ ...prev, isSyncing: true }));
    try {
      await processSyncQueue();
      await refreshStats();
    } finally {
      isSyncingRef.current = false;
      setState((prev) => ({ ...prev, isSyncing: false }));
    }
  }, [refreshStats]);

  useEffect(() => {
    refreshStats();

    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
      runSync();
    };
    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (navigator.onLine) runSync();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [runSync, refreshStats]);

  return { ...state, refreshStats, runSync };
}
