/**
 * Benchmark tests for the LRU cache decorator.
 *
 * Verifies:
 *   - <0.5ms average lookup time for 10,000 entries
 *   - Cache hit rate tracking
 *   - Eviction behaviour under byte pressure
 */

import { describe, it, expect } from "vitest";
import { LruCache } from "@/src/utils/lruCache";

function unitSizeOf(_value: unknown): number {
  return 1;
}

describe("LruCache benchmarks", () => {
  it("average lookup under 0.5ms for 10,000 entries", () => {
    const cache = new LruCache<number>({ sizeOf: unitSizeOf, maxBytes: 50 * 1024 * 1024 });
    const ITERATIONS = 10_000;
    const WARMUP = 100;

    // Fill cache
    for (let i = 0; i < ITERATIONS; i++) {
      cache.set(`key-${i}`, i);
    }

    // Warmup
    for (let i = 0; i < WARMUP; i++) {
      cache.get(`key-${i}`);
    }

    // Timed batch lookup
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      cache.get(`key-${i}`);
    }
    const elapsed = performance.now() - start;

    // Average per lookup
    const avgPerLookup = elapsed / ITERATIONS;
    // Should be under 0.5ms average (CI environments vary in timing resolution)
    expect(avgPerLookup).toBeLessThan(0.5);
  });

  it("byte budget enforcement keeps memory bounded", () => {
    const MB = 1024 * 1024;
    const cache = new LruCache<{ data: number[] }>({
      maxBytes: 1 * MB,
      evictionRatio: 0.2,
      sizeOf: (entry) => JSON.stringify(entry).length * 2,
    });

    // Insert large entries that would vastly exceed 1 MB
    for (let i = 0; i < 200; i++) {
      cache.set(`large-${i}`, {
        data: Array.from({ length: 500 }, (_, j) => j),
      });
    }

    // Total byte size must be within budget
    expect(cache.byteSize).toBeLessThanOrEqual(1 * MB);
  });

  it("cache access count incremented on repeated access", () => {
    const cache = new LruCache<number>({ maxBytes: 50 * 1024 * 1024 });

    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    cache.get("a");
    cache.get("a");

    const entries = cache.entries();
    const a = entries.find((e) => e.key === "a")!;
    // set = accessCount 1, then 3 get calls → total 4
    expect(a.accessCount).toBe(4);
  });
});
