/**
 * Analytics data transformation functions.
 *
 * These functions perform aggregation, filtering, and sorting on large
 * arrays of analytics data.  They are decorated with the LRU
 * transformation cache to bound memory usage.
 */

import { wrapTransformation } from "@/src/services/analytics/transformationCache";

// ── types ────────────────────────────────────────────────────────────────

export interface AnalyticsRecord {
  id: string;
  timestamp: number;
  value: number;
  category: string;
  region: string;
  tags: string[];
}

export interface AggregationResult {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  byCategory: Record<string, { count: number; sum: number }>;
}

export interface FilterParams {
  category?: string;
  region?: string;
  tag?: string;
  minValue?: number;
  maxValue?: number;
  startTime?: number;
  endTime?: number;
}

export interface SortParams {
  field: "timestamp" | "value" | "category" | "region";
  direction: "asc" | "desc";
}

// ── transformation implementations ───────────────────────────────────────

function aggregateRecords(
  records: AnalyticsRecord[],
): AggregationResult {
  if (records.length === 0) {
    return {
      count: 0,
      sum: 0,
      avg: 0,
      min: 0,
      max: 0,
      byCategory: {},
    };
  }

  const byCategory: Record<string, { count: number; sum: number }> = {};
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const r of records) {
    sum += r.value;
    if (r.value < min) min = r.value;
    if (r.value > max) max = r.value;

    if (!byCategory[r.category]) {
      byCategory[r.category] = { count: 0, sum: 0 };
    }
    byCategory[r.category].count += 1;
    byCategory[r.category].sum += r.value;
  }

  return {
    count: records.length,
    sum,
    avg: sum / records.length,
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
    byCategory,
  };
}

function filterRecords(
  records: AnalyticsRecord[],
  params?: FilterParams,
): AnalyticsRecord[] {
  if (!params) return records;
  return records.filter((r) => {
    if (params.category !== undefined && r.category !== params.category) return false;
    if (params.region !== undefined && r.region !== params.region) return false;
    if (params.tag !== undefined && !r.tags.includes(params.tag)) return false;
    if (params.minValue !== undefined && r.value < params.minValue) return false;
    if (params.maxValue !== undefined && r.value > params.maxValue) return false;
    if (params.startTime !== undefined && r.timestamp < params.startTime) return false;
    if (params.endTime !== undefined && r.timestamp > params.endTime) return false;
    return true;
  });
}

function sortRecords(
  records: AnalyticsRecord[],
  params?: SortParams,
): AnalyticsRecord[] {
  if (!params) return records;
  const { field, direction } = params;
  const multiplier = direction === "asc" ? 1 : -1;

  return [...records].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal) * multiplier;
    }
    if (aVal < bVal) return -1 * multiplier;
    if (aVal > bVal) return 1 * multiplier;
    return 0;
  });
}

// ── cached wrappers ──────────────────────────────────────────────────────

/**
 * Aggregate analytics records.  Cached by (records hash + params).
 */
export const aggregate = wrapTransformation<AnalyticsRecord[], AggregationResult>(
  "aggregate",
  aggregateRecords,
);

/**
 * Filter analytics records by criteria.  Cached by (records hash + filter params).
 */
export const filter = wrapTransformation<AnalyticsRecord[], AnalyticsRecord[], FilterParams>(
  "filter",
  filterRecords,
);

/**
 * Sort analytics records by field + direction.  Cached by (records hash + sort params).
 */
export const sort = wrapTransformation<AnalyticsRecord[], AnalyticsRecord[], SortParams>(
  "sort",
  sortRecords,
);

// ── raw (uncached) exports for testing ───────────────────────────────────

export const _raw = {
  aggregateRecords,
  filterRecords,
  sortRecords,
};
