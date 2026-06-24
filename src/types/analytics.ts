/**
 * Type definitions for the analytics transformation cache system.
 *
 * Cache keys are deterministic hashes of (transformationName + inputHash +
 * parameters), generated via FNV-1a.  Each cached entry tracks access
 * metadata for LRU eviction decisions.
 */

/** Shape of a cached transformation result. */
export interface CacheEntry<T = unknown> {
  /** Deterministic cache key (FNV-1a hex digest). */
  key: string;
  /** The cached transformation result. */
  value: T;
  /** Unix-ms timestamp of when this entry was created. */
  createdAt: number;
  /** Unix-ms timestamp of the most recent access. */
  accessTimestamp: number;
  /** Number of times this entry has been read from cache. */
  accessCount: number;
  /** Approximate byte size of the serialized value. */
  byteSize: number;
}

/** A transformation function that takes input data and optional parameters. */
export type TransformationFn<TInput, TOutput, TParams = unknown> = (
  input: TInput,
  params?: TParams,
) => TOutput;

/** Metadata returned alongside a cache lookup. */
export interface CacheLookupResult<T = unknown> {
  /** Whether the result came from cache (true) or was freshly computed (false). */
  hit: boolean;
  /** The transformation result. */
  value: T;
  /** The cache entry if the result was cached; null otherwise. */
  entry: CacheEntry<T> | null;
}

/** Options for configuring the transformation cache. */
export interface TransformationCacheOptions {
  /** Maximum total byte size of cached entries. Default: 50 MB. */
  maxBytes?: number;
  /** Fraction of entries to evict when the byte budget is exceeded. Default: 0.2. */
  evictionRatio?: number;
}

/** Statistics exposed by the transformation cache for monitoring. */
export interface TransformationCacheStats {
  /** Total number of entries currently in the cache. */
  entryCount: number;
  /** Total approximate byte size of all cached entries. */
  totalBytes: number;
  /** Number of cache hits since creation. */
  hits: number;
  /** Number of cache misses since creation. */
  misses: number;
  /** Number of entries evicted since creation. */
  evictions: number;
  /** Cache hit rate as a value between 0 and 1. */
  hitRate: number;
}
