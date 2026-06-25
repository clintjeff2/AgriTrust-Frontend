/**
 * Unit tests for the generic LRU cache.
 *
 * All byte-budget tests use a deterministic `sizeOf` stub so tests are
 * not fragile to JSON serialisation changes across environments.
 */

import { describe, it, expect } from "vitest";
import { LruCache } from "@/src/utils/lruCache";

/** Simplified byte estimator: every value counts as 1 byte. */
function unitSizeOf(_value: unknown): number {
  return 1;
}

describe("LruCache", () => {
  describe("basic operations", () => {
    it("starts empty", () => {
      const cache = new LruCache<number>();
      expect(cache.size).toBe(0);
      expect(cache.byteSize).toBe(0);
    });

    it("get returns undefined for missing keys", () => {
      const cache = new LruCache<number>();
      expect(cache.get("a")).toBeUndefined();
      expect(cache.peek("a")).toBeUndefined();
    });

    it("set and get a single entry", () => {
      const cache = new LruCache<number>();
      cache.set("a", 42);
      expect(cache.size).toBe(1);
      expect(cache.get("a")).toBe(42);
    });

    it("has returns correct presence", () => {
      const cache = new LruCache<number>();
      expect(cache.has("a")).toBe(false);
      cache.set("a", 1);
      expect(cache.has("a")).toBe(true);
      cache.delete("a");
      expect(cache.has("a")).toBe(false);
    });

    it("delete removes entry", () => {
      const cache = new LruCache<number>();
      cache.set("a", 1);
      expect(cache.delete("a")).toBe(true);
      expect(cache.delete("a")).toBe(false);
      expect(cache.size).toBe(0);
    });

    it("clear empties the cache", () => {
      const cache = new LruCache<number>();
      cache.set("a", 1);
      cache.set("b", 2);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.byteSize).toBe(0);
    });

    it("peek does not update access order", () => {
      const cache = new LruCache<number>({ sizeOf: unitSizeOf, maxBytes: 100 });
      cache.set("a", 1);
      cache.set("b", 2);
      cache.peek("a");
      // Peek should NOT move 'a' to MRU head.
      const order = cache.lruOrder();
      expect(order[0]).toBe("a"); // 'a' should still be LRU
    });
  });

  describe("LRU eviction order", () => {
    it("evicts least-recently-used entries when byte budget exceeded", () => {
      // Each entry = 1 byte; maxBytes = 2 means 3 entries trigger eviction
      const cache = new LruCache<string>({
        maxBytes: 2,
        evictionRatio: 0.34,
        sizeOf: unitSizeOf,
      });

      cache.set("a", "first");
      cache.set("b", "second");
      cache.set("c", "third"); // exceeds budget → eviction

      // ceil(2 * 0.34) = 1 evicted; 'a' is LRU
      // After evicting 'a', total is 2 bytes, under budget
      expect(cache.size).toBe(2);
      expect(cache.has("a")).toBe(false);
      expect(cache.has("b")).toBe(true);
      expect(cache.has("c")).toBe(true);
    });

    it("moves accessed entries to MRU position", () => {
      const cache = new LruCache<string>({
        maxBytes: 2,
        evictionRatio: 0.34,
        sizeOf: unitSizeOf,
      });

      cache.set("a", "first");
      cache.set("b", "second");
      cache.get("a"); // access 'a' → moves to MRU
      cache.set("c", "third"); // should evict 'b' (now LRU)

      expect(cache.has("a")).toBe(true);
      expect(cache.has("b")).toBe(false);
      expect(cache.has("c")).toBe(true);
    });

    it("updates access count on get", () => {
      const cache = new LruCache<string>({ sizeOf: unitSizeOf });
      cache.set("a", "value");
      cache.get("a");
      cache.get("a");

      const entries = cache.entries();
      expect(entries).toHaveLength(1);
      expect(entries[0].accessCount).toBe(3); // 1 (from set) + 2 (from gets)
    });

    it("lruOrder returns keys from LRU to MRU", () => {
      const cache = new LruCache<number>({ sizeOf: unitSizeOf, maxBytes: 100 });
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // LRU order should be: a, b, c (oldest first)
      const order = cache.lruOrder();
      expect(order).toEqual(["a", "b", "c"]);

      // Access 'a' → moves to MRU
      cache.get("a");
      const order2 = cache.lruOrder();
      expect(order2).toEqual(["b", "c", "a"]);
    });
  });

  describe("byte budget enforcement", () => {
    it("tracks byte size correctly with custom sizeOf", () => {
      const cache = new LruCache<number>({
        maxBytes: 100,
        sizeOf: () => 42,
      });
      cache.set("a", 1);
      expect(cache.byteSize).toBe(42);
    });

    it("evicts entries from tail until under budget", () => {
      const cache = new LruCache<number>({
        maxBytes: 3,
        evictionRatio: 0.5,
        sizeOf: unitSizeOf,
      });

      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      cache.set("d", 4);
      cache.set("e", 5);

      // ceil(5 * 0.5) = 3 evictions max, stops when under 3 bytes
      // After 2 evictions (a, b), total = 3 bytes, stops
      expect(cache.byteSize).toBeLessThanOrEqual(3);
    });

    it("eviction removes oldest entries first", () => {
      const cache = new LruCache<string>({
        maxBytes: 2,
        evictionRatio: 0.34,
        sizeOf: unitSizeOf,
      });

      cache.set("a", "hello");
      cache.set("b", "hello");
      cache.set("c", "hello"); // exceeds 2 bytes → evict 'a' (LRU)

      expect(cache.has("a")).toBe(false);
      expect(cache.has("b")).toBe(true);
      expect(cache.has("c")).toBe(true);
    });
  });

  describe("eviction ratio", () => {
    it("respects custom eviction ratio", () => {
      const cache = new LruCache<string>({
        maxBytes: 2,
        evictionRatio: 0.75, // aggressive eviction
        sizeOf: unitSizeOf,
      });

      cache.set("a", "x");
      cache.set("b", "y");
      cache.set("c", "z");

      // With ratio 0.75 and 3 entries, ceil(3 * 0.75) = 3 evictions
      // But stops early if under budget. After 1 eviction (a), 2 bytes, under.
      expect(cache.size).toBeLessThanOrEqual(2);
    });
  });

  describe("custom sizeOf", () => {
    it("uses custom size function", () => {
      const cache = new LruCache<number[]>({
        maxBytes: 10,
        sizeOf: (arr) => arr.length, // 1 byte per element
      });

      cache.set("small", [1, 2]); // 2 bytes
      cache.set("large", Array.from({ length: 20 }, (_, i) => i)); // 20 bytes → triggers eviction

      // The 20-element array on its own exceeds 10 bytes; eviction will try to help.
      // 'large' is MRU after insertion, so small gets evicted.
      expect(cache.has("large")).toBe(true);
    });
  });

  describe("concurrent updates", () => {
    it("handles updating an existing key", () => {
      const cache = new LruCache<number>();
      cache.set("a", 1);
      cache.set("a", 2);
      expect(cache.size).toBe(1);
      expect(cache.get("a")).toBe(2);
    });

    it("updates byte size on overwrite", () => {
      const cache = new LruCache<string>({ sizeOf: (s) => s.length });
      cache.set("a", "short");
      const beforeBytes = cache.byteSize;
      cache.set("a", "a much longer string value here");
      const afterBytes = cache.byteSize;
      expect(afterBytes).not.toBe(beforeBytes);
      expect(afterBytes).toBeGreaterThan(beforeBytes);
    });
  });

  describe("stress / correctness", () => {
    it("handles 1000 insertions without error", () => {
      const cache = new LruCache<number>({
        maxBytes: 500,
        sizeOf: unitSizeOf,
      });
      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, i);
      }
      expect(cache.byteSize).toBeLessThanOrEqual(500);
      expect(cache.size).toBeLessThan(1000); // some must have been evicted
    });

    it("get is O(1) - 10,000 lookups complete quickly", () => {
      const cache = new LruCache<number>({ sizeOf: unitSizeOf, maxBytes: 50 * 1024 * 1024 });
      for (let i = 0; i < 10_000; i++) {
        cache.set(`key-${i}`, i);
      }

      const start = performance.now();
      for (let i = 0; i < 10_000; i++) {
        cache.get(`key-${i}`);
      }
      const elapsed = performance.now() - start;

      // 10,000 lookups should be well under 100ms
      expect(elapsed).toBeLessThan(100);
    });
  });
});
