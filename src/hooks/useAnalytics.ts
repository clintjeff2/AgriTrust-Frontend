/**
 * React hook for consuming analytics data transformations with automatic
 * cache management.  Exposes the cached transformation functions and cache
 * invalidation controls for React components (dashboard analytics pages).
 *
 * Cache statistics are refreshed on invalidate calls and are reactive
 * (re-render) thanks to `useState`.
 */

import { useCallback, useState } from "react";
import {
  aggregate,
  filter,
  sort,
} from "@/src/services/analytics/transformations";
import {
  invalidateCache,
  getCacheStats,
} from "@/src/services/analytics/transformationCache";
import type { TransformationCacheStats } from "@/src/types/analytics";

export interface UseAnalyticsReturn {
  /** Cached aggregation function. */
  aggregate: typeof aggregate;
  /** Cached filter function. */
  filter: typeof filter;
  /** Cached sort function. */
  sort: typeof sort;
  /** Invalidate cache entries for a given transformation name. */
  invalidate: (transformationName?: string, paramPattern?: string) => number;
  /** Current cache usage statistics (reactive). */
  stats: TransformationCacheStats;
}

export function useAnalytics(): UseAnalyticsReturn {
  const [stats, setStats] = useState<TransformationCacheStats>(() =>
    getCacheStats(),
  );

  const refreshStats = useCallback(() => {
    setStats(getCacheStats());
  }, []);

  const invalidate = useCallback(
    (transformationName?: string, paramPattern?: string) => {
      const count = invalidateCache(transformationName, paramPattern);
      refreshStats();
      return count;
    },
    [refreshStats],
  );

  return {
    aggregate,
    filter,
    sort,
    invalidate,
    stats,
  };
}
