/**
 * Analytics transformation cache — a memoisation layer that decorates data
 * transformation functions with an LRU-backed, memory-bounded cache.
 *
 * Cache keys are deterministic hashes of (transformationName + inputHash +
 * parameters), computed via the existing FNV-1a implementation in
 * `src/utils/hash.ts`.  Each wrapped function checks the cache before
 * computing; on a cache miss the result is stored and returned.
 *
 * Cache performance metrics (hits, misses, evictions, byte size) are
 * reported to `PerformanceObserver` when available.
 */

import { LruCache } from "@/src/utils/lruCache";
import { hashString } from "@/src/utils/hash";
import type {
  CacheLookupResult,
  TransformationCacheOptions,
  TransformationCacheStats,
  TransformationFn,
} from "@/src/types/analytics";

// ── singleton cache ─────────────────────────────────────────────────────

let cache: LruCache<unknown> | null = null;

/** Running counts for cache performance monitoring. */
let hitCounter = 0;
let missCounter = 0;
let evictionCounter = 0;

function getCache(options?: TransformationCacheOptions): LruCache<unknown> {
  if (!cache) {
    cache = new LruCache<unknown>({
      maxBytes: options?.maxBytes,
      evictionRatio: options?.evictionRatio,
    });
  }
  return cache;
}

/** Reports cache metrics to PerformanceObserver (if available). */
function reportPerformanceMetrics(stats: TransformationCacheStats): void {
  try {
    if (
      typeof PerformanceObserver !== "undefined" &&
      typeof performance !== "undefined"
    ) {
      // Use User Timing marks to make metrics visible in dev tools.
      const prefix = "agritrust-cache";
      performance.mark(`${prefix}-hits`, {
        detail: { hits: stats.hits },
      } as unknown as PerformanceMarkOptions);
      performance.mark(`${prefix}-misses`, {
        detail: { misses: stats.misses },
      } as unknown as PerformanceMarkOptions);
      performance.mark(`${prefix}-bytes`, {
        detail: { totalBytes: stats.totalBytes },
      } as unknown as PerformanceMarkOptions);
    }
  } catch {
    // Silently ignore — performance API is best-effort instrumentation.
  }
}

/** Reset the cache and counters for testing. */
export function _resetTransformationCacheForTests(): void {
  cache = null;
  hitCounter = 0;
  missCounter = 0;
  evictionCounter = 0;
}

// ── key generation ──────────────────────────────────────────────────────

/**
 * Build a deterministic cache key from the transformation name and its
 * input/parameter hash.
 *
 * Format: `{transformationName}-{fnv1a(inputHash + paramsHash)}`
 */
export function computeCacheKey(
  transformationName: string,
  inputHash: string,
  paramsHash?: string,
): string {
  const seed = paramsHash
    ? hashString(`${inputHash}:${paramsHash}`)
    : hashString(inputHash);
  return `${transformationName}-${seed.toString(16)}`;
}

/**
 * Hash an arbitrary value for use as part of a cache key.  Uses JSON
 * serialisation + FNV-1a.  Falls back to `String(input)` when the value
 * cannot be JSON-serialised (e.g. circular references, BigInt).
 */
export function hashInput(input: unknown): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(input);
  } catch {
    serialized = String(input);
  }
  return hashString(serialized).toString(16);
}

// ── cache decorator ─────────────────────────────────────────────────────

/**
 * Wrap a transformation function so its results are cached in the shared
 * LRU cache.  On cache hit the stored value is returned immediately; on
 * miss the transformation is computed, stored, and returned.
 *
 * @param name       - Unique name for this transformation (used in cache keys).
 * @param fn         - The transformation to decorate.
 * @param cacheOpts  - Optional cache sizing parameters.
 */
export function wrapTransformation<TInput, TOutput, TParams = unknown>(
  name: string,
  fn: TransformationFn<TInput, TOutput, TParams>,
  cacheOpts?: TransformationCacheOptions,
): TransformationFn<TInput, TOutput, TParams> {
  const store = getCache(cacheOpts);

  return (input: TInput, params?: TParams): TOutput => {
    const inputHash = hashInput(input);
    const paramsHash = params !== undefined ? hashInput(params) : undefined;
    const key = computeCacheKey(name, inputHash, paramsHash);

    const cached = store.get(key);
    if (cached !== undefined) {
      hitCounter++;
      return cached as TOutput;
    }

    missCounter++;
    const result = fn(input, params);
    const preSize = store.byteSize;
    store.set(key, result);
    // If byte size didn't increase, the entry was evicted or not stored.
    if (store.byteSize <= preSize && !store.has(key)) {
      evictionCounter++;
    }
    return result;
  };
}

// ── invalidation ────────────────────────────────────────────────────────

/**
 * Invalidate all cache entries whose key starts with the given
 * `transformationName`.  When omitted, all entries are cleared.
 *
 * @param transformationName  - Optional transformation name prefix.
 * @param paramPattern        - Optional naive substring match within the key.
 */
export function invalidateCache(
  transformationName?: string,
  paramPattern?: string,
): number {
  const store = cache;
  if (!store) return 0;

  if (!transformationName) {
    const count = store.size;
    store.clear();
    return count;
  }

  let removed = 0;
  const allKeys = [...store.lruOrder()];

  for (const key of allKeys) {
    if (!key.startsWith(transformationName)) continue;
    if (paramPattern && !key.includes(paramPattern)) continue;
    if (store.delete(key)) removed++;
  }

  return removed;
}

// ── lookup (without mutation) ───────────────────────────────────────────

/**
 * Look up a transformation by key (name + inputHash + paramsHash) without
 * triggering a computation on miss.  On hit, returns the cached value and
 * metadata; on miss, returns hit:false with a null value.
 */
export function lookupTransformation<T = unknown>(
  transformationName: string,
  inputHash: string,
  paramsHash?: string,
): CacheLookupResult<T> | null {
  const store = cache;
  if (!store) return null;

  const key = computeCacheKey(transformationName, inputHash, paramsHash);
  const value = store.peek(key);

  if (value !== undefined) {
    // Build metadata from the cache — entry is available via entries().
    const entries = store.entries();
    const found = entries.find((e) => e.key === key);
    return {
      hit: true,
      value: value as T,
      entry: found
        ? {
            key: found.key,
            value: found.value as T,
            byteSize: found.byteSize,
            accessCount: found.accessCount,
            createdAt: found.createdAt,
            accessTimestamp: found.accessTimestamp,
          }
        : null,
    };
  }

  return {
    hit: false,
    value: null as unknown as T,
    entry: null,
  };
}

// ── stats ───────────────────────────────────────────────────────────────

/** Return current cache usage statistics for monitoring / dashboards. */
export function getCacheStats(): TransformationCacheStats {
  const store = cache;
  if (!store) {
    return {
      entryCount: 0,
      totalBytes: 0,
      hits: hitCounter,
      misses: missCounter,
      evictions: evictionCounter,
      hitRate: hitCounter + missCounter > 0
        ? hitCounter / (hitCounter + missCounter)
        : 0,
    };
  }

  const total = hitCounter + missCounter;

  const stats: TransformationCacheStats = {
    entryCount: store.size,
    totalBytes: store.byteSize,
    hits: hitCounter,
    misses: missCounter,
    evictions: evictionCounter,
    hitRate: total > 0 ? hitCounter / total : 0,
  };

  // Best-effort performance observer reporting.
  reportPerformanceMetrics(stats);

  return stats;
}
