/**
 * Fixed-size ring buffer with optional byte-budget enforcement.
 *
 * Backed by a pre-allocated array with head/count pointers, so `push` is O(1)
 * amortized. When the buffer is full the oldest item is overwritten. An
 * optional `maxBytes` budget (with a per-item `sizeOf`) evicts additional old
 * items so total retained memory stays bounded — used by the reconciler to cap
 * the 1000-event window at ~5MB.
 */

export interface RingBufferOptions<T> {
  /** Maximum total bytes retained. Oldest items are evicted to stay under it. */
  maxBytes?: number;
  /** Per-item size estimate in bytes. Defaults to a JSON-length estimate. */
  sizeOf?: (item: T) => number;
}

/** Rough byte estimate for an arbitrary value (2 bytes/char, JSON-encoded). */
export function estimateBytes(value: unknown): number {
  try {
    return JSON.stringify(value).length * 2;
  } catch {
    return 0;
  }
}

export class RingBuffer<T> {
  private readonly store: Array<T | undefined>;
  private head = 0;
  private count = 0;
  private bytes = 0;

  private readonly maxBytes: number;
  private readonly sizeOf: (item: T) => number;

  constructor(
    public readonly capacity: number,
    options: RingBufferOptions<T> = {}
  ) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("RingBuffer capacity must be a positive integer");
    }
    this.store = new Array<T | undefined>(capacity);
    this.maxBytes = options.maxBytes ?? Number.POSITIVE_INFINITY;
    this.sizeOf = options.sizeOf ?? estimateBytes;
  }

  get size(): number {
    return this.count;
  }

  get byteSize(): number {
    return this.bytes;
  }

  get isFull(): boolean {
    return this.count === this.capacity;
  }

  private indexAt(offset: number): number {
    return (this.head + offset) % this.capacity;
  }

  /**
   * Appends an item. Evicts the oldest item(s) when at capacity or over the
   * byte budget. Returns the evicted items (oldest first), if any.
   */
  push(item: T): T[] {
    const evicted: T[] = [];

    if (this.count === this.capacity) {
      const removed = this.shift();
      if (removed !== undefined) evicted.push(removed);
    }

    const tail = this.indexAt(this.count);
    this.store[tail] = item;
    this.count += 1;
    this.bytes += this.sizeOf(item);

    // Enforce the byte budget, but always keep at least the just-pushed item.
    while (this.bytes > this.maxBytes && this.count > 1) {
      const removed = this.shift();
      if (removed === undefined) break;
      evicted.push(removed);
    }

    return evicted;
  }

  /** Removes and returns the oldest item, or undefined when empty. */
  shift(): T | undefined {
    if (this.count === 0) return undefined;
    const item = this.store[this.head] as T;
    this.store[this.head] = undefined;
    this.head = this.indexAt(1);
    this.count -= 1;
    this.bytes -= this.sizeOf(item);
    if (this.bytes < 0) this.bytes = 0;
    return item;
  }

  /** The oldest item without removing it. */
  peekOldest(): T | undefined {
    return this.count === 0 ? undefined : (this.store[this.head] as T);
  }

  /** The newest item without removing it. */
  peekNewest(): T | undefined {
    return this.count === 0
      ? undefined
      : (this.store[this.indexAt(this.count - 1)] as T);
  }

  /** Items in insertion order (oldest → newest). */
  toArray(): T[] {
    const out: T[] = new Array(this.count);
    for (let i = 0; i < this.count; i++) {
      out[i] = this.store[this.indexAt(i)] as T;
    }
    return out;
  }

  /**
   * Removes every item matching `predicate`, preserving the order of the rest.
   * Returns the removed items.
   */
  dropMatching(predicate: (item: T) => boolean): T[] {
    if (this.count === 0) return [];
    const all = this.toArray();
    const removed: T[] = [];
    const kept: T[] = [];
    for (const item of all) {
      (predicate(item) ? removed : kept).push(item);
    }
    if (removed.length > 0) this.replaceAll(kept);
    return removed;
  }

  /** Replaces the entire contents (respecting capacity/byte limits). */
  replaceAll(items: T[]): void {
    this.clear();
    for (const item of items) this.push(item);
  }

  clear(): void {
    this.store.fill(undefined);
    this.head = 0;
    this.count = 0;
    this.bytes = 0;
  }
}
