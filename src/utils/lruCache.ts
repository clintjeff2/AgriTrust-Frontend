/**
 * Generic LRU (Least-Recently-Used) Cache with configurable byte-budget
 * enforcement.  Built on a doubly-linked list + Map for O(1) get/set/delete
 * on both access order and key lookup.
 *
 * Eviction is triggered after insertion when the total byte size exceeds
 * `maxBytes`.  A configurable fraction (`evictionRatio`) of the least-
 * recently-used entries are removed to bring the cache back under budget.
 */

export interface LruCacheOptions<T> {
  /** Maximum total byte size of stored values. Default: 50 MB. */
  maxBytes?: number;
  /**
   * Fraction of entries to evict when the byte budget is exceeded (0–1).
   * Default: 0.2 (20 %).
   */
  evictionRatio?: number;
  /** Per-item size function.  Defaults to a JSON-length estimate. */
  sizeOf?: (value: T) => number;
}

/** Internal node for the doubly-linked list. */
interface Node<T> {
  key: string;
  value: T;
  byteSize: number;
  accessCount: number;
  createdAt: number;
  accessTimestamp: number;
  prev: Node<T> | null;
  next: Node<T> | null;
}

import { estimateBytes } from "@/src/utils/ringBuffer";

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const DEFAULT_EVICTION_RATIO = 0.2;

export interface LruCacheEntry<T> {
  key: string;
  value: T;
  byteSize: number;
  accessCount: number;
  createdAt: number;
  accessTimestamp: number;
}

export class LruCache<T> {
  private readonly map = new Map<string, Node<T>>();
  /** Doubly-linked list sentinel: head = MRU, tail = LRU. */
  private head: Node<T> | null = null;
  private tail: Node<T> | null = null;

  private totalBytes = 0;

  private readonly maxBytes: number;
  private readonly evictionRatio: number;
  private readonly sizeOf: (value: T) => number;

  constructor(options: LruCacheOptions<T> = {}) {
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.evictionRatio = clamp(options.evictionRatio ?? DEFAULT_EVICTION_RATIO);
    this.sizeOf = options.sizeOf ?? estimateBytes;
  }

  // ── public API ────────────────────────────────────────────────────────

  get size(): number {
    return this.map.size;
  }

  get byteSize(): number {
    return this.totalBytes;
  }

  /** Retrieve a value and move it to the MRU position. */
  get(key: string): T | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;

    // Move to head (MRU).
    this.detach(node);
    this.attachToHead(node);

    node.accessTimestamp = Date.now();
    node.accessCount += 1;
    return node.value;
  }

  /**
   * Peek at a value without updating its access position or timestamp.
   * Useful for cache inspection (e.g. computing key existence).
   */
  peek(key: string): T | undefined {
    return this.map.get(key)?.value;
  }

  /** Add or update a value, moving it to the MRU position. */
  set(key: string, value: T): void {
    const byteSize = this.sizeOf(value);
    const existing = this.map.get(key);

    if (existing) {
      // Update in-place.
      this.totalBytes -= existing.byteSize;
      existing.value = value;
      existing.byteSize = byteSize;
      existing.accessTimestamp = Date.now();
      existing.accessCount += 1;
      this.totalBytes += byteSize;

      this.detach(existing);
      this.attachToHead(existing);
    } else {
      const node: Node<T> = {
        key,
        value,
        byteSize,
        accessCount: 1,
        createdAt: Date.now(),
        accessTimestamp: Date.now(),
        prev: null,
        next: null,
      };

      this.map.set(key, node);
      this.attachToHead(node);
      this.totalBytes += byteSize;
    }

    // Enforce byte budget.
    if (this.totalBytes > this.maxBytes) {
      this.evictIfNeeded();
    }
  }

  /** Delete a key. Returns true if the key existed. */
  delete(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;

    this.detach(node);
    this.map.delete(key);
    this.totalBytes -= node.byteSize;
    if (this.totalBytes < 0) this.totalBytes = 0;
    return true;
  }

  /** Check whether the cache contains a key (does NOT update access order). */
  has(key: string): boolean {
    return this.map.has(key);
  }

  /** Remove all entries. */
  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
    this.totalBytes = 0;
  }

  /**
   * Return a snapshot of all metadata entries (values are not included for
   * memory safety).  Iteration order is insertion order (oldest → newest),
   * matching Map's iteration guarantee based on the map, NOT access-recent
   * order — the linked list tracks recency independently.
   */
  entries(): LruCacheEntry<T>[] {
    const result: LruCacheEntry<T>[] = [];
    for (const { key, value, byteSize, accessCount, createdAt,
      accessTimestamp } of this.map.values()) {
      result.push({ key, value, byteSize, accessCount, createdAt, accessTimestamp });
    }
    return result;
  }

  /**
   * Returns keys in LRU order (least-recently-used first) for inspection
   * or manual invalidation.  Traverses the linked list from tail → head.
   */
  lruOrder(): string[] {
    const keys: string[] = [];
    let node = this.tail;
    while (node) {
      keys.push(node.key);
      node = node.prev;
    }
    return keys;
  }

  // ── private helpers ───────────────────────────────────────────────────

  private evictIfNeeded(): void {
    if (this.totalBytes <= this.maxBytes || this.tail === null) return;

    // How many entries to evict.  At least 1, at most all.
    const evictCount = Math.max(
      1,
      Math.ceil(this.map.size * this.evictionRatio),
    );

    let evicted = 0;
    let node: Node<T> | null = this.tail;

    while (evicted < evictCount && node && this.totalBytes > this.maxBytes) {
      const prev: Node<T> | null = node.prev;
      this.map.delete(node.key);
      this.totalBytes -= node.byteSize;
      evicted++;
      node = prev;
    }

    // Clamp negative bytes.
    if (this.totalBytes < 0) this.totalBytes = 0;

    // Re-link the new tail.
    if (node) {
      node.next = null;
      this.tail = node;
    } else {
      // All entries were evicted.
      this.head = null;
      this.tail = null;
    }
  }

  /** Detach a node from the doubly-linked list. */
  private detach(node: Node<T>): void {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (this.head === node) this.head = node.next;
    if (this.tail === node) this.tail = node.prev;
    node.prev = null;
    node.next = null;
  }

  /** Attach a node at the head (MRU) of the doubly-linked list. */
  private attachToHead(node: Node<T>): void {
    node.next = this.head;
    node.prev = null;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }
}

function clamp(ratio: number): number {
  if (ratio <= 0) return 0;
  if (ratio >= 1) return 1;
  return ratio;
}
