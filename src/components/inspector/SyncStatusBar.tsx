"use client";

import { useOfflineSync } from "@/src/hooks/useOfflineSync";
import { useLocale } from "@/src/hooks/useLocale";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SyncStatusBar() {
  const { t } = useLocale();
  const { isOnline, isSyncing, pendingCount, totalCount, syncedCount, storageUsage } =
    useOfflineSync();

  const syncPercent =
    totalCount > 0 ? Math.round((syncedCount / totalCount) * 100) : 100;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Online / sync status row */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              isOnline ? "bg-green-500" : "bg-yellow-400"
            }`}
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isOnline ? (isSyncing ? t("sync.syncing") : t("sync.online")) : t("sync.offline")}
          </span>
        </div>
        {pendingCount > 0 && (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            {t("sync.pending", { count: pendingCount })}
          </span>
        )}
      </div>

      {/* Record sync progress */}
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{t("sync.recordsSynced")}</span>
        <span>
          {t("sync.progress", { synced: syncedCount, total: totalCount, percent: syncPercent })}
        </span>
      </div>
      <div
        className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
        role="progressbar"
        aria-valuenow={syncPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("sync.recordsSynced")}
      >
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-300"
          style={{ width: `${syncPercent}%` }}
        />
      </div>

      {/* Storage utilization */}
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{t("sync.storageUsed")}</span>
        <span>
          {t("sync.storageValue", {
            used: formatBytes(storageUsage.used),
            total: formatBytes(storageUsage.total),
            percent: storageUsage.percent.toFixed(1),
          })}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
        role="progressbar"
        aria-valuenow={Math.round(storageUsage.percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("sync.storageUsed")}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            storageUsage.percent > 90
              ? "bg-red-500"
              : storageUsage.percent > 75
              ? "bg-yellow-400"
              : "bg-blue-500"
          }`}
          style={{ width: `${Math.min(storageUsage.percent, 100)}%` }}
        />
      </div>

      {storageUsage.percent > 95 && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {t("sync.storageFull")}
        </p>
      )}
    </div>
  );
}
