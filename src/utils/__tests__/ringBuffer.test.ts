import { describe, it, expect } from "vitest";
import { RingBuffer, estimateBytes } from "@/src/utils/ringBuffer";

describe("RingBuffer", () => {
  it("rejects a non-positive capacity", () => {
    expect(() => new RingBuffer(0)).toThrow();
    expect(() => new RingBuffer(-1)).toThrow();
  });

  it("pushes and reports contents oldest → newest", () => {
    const rb = new RingBuffer<number>(3);
    rb.push(1);
    rb.push(2);
    rb.push(3);
    expect(rb.toArray()).toEqual([1, 2, 3]);
    expect(rb.size).toBe(3);
    expect(rb.isFull).toBe(true);
    expect(rb.peekOldest()).toBe(1);
    expect(rb.peekNewest()).toBe(3);
  });

  it("overwrites the oldest item when at capacity", () => {
    const rb = new RingBuffer<number>(3);
    rb.push(1);
    rb.push(2);
    rb.push(3);
    const evicted = rb.push(4);
    expect(evicted).toEqual([1]);
    expect(rb.toArray()).toEqual([2, 3, 4]);
  });

  it("wraps correctly across many pushes", () => {
    const rb = new RingBuffer<number>(3);
    for (let i = 1; i <= 10; i++) rb.push(i);
    expect(rb.toArray()).toEqual([8, 9, 10]);
  });

  it("shifts the oldest item", () => {
    const rb = new RingBuffer<number>(3);
    rb.push(1);
    rb.push(2);
    expect(rb.shift()).toBe(1);
    expect(rb.toArray()).toEqual([2]);
    expect(rb.shift()).toBe(2);
    expect(rb.shift()).toBeUndefined();
  });

  it("enforces a byte budget by evicting oldest items", () => {
    const rb = new RingBuffer<number>(100, {
      maxBytes: 25,
      sizeOf: () => 10,
    });
    rb.push(1); // 10
    rb.push(2); // 20
    rb.push(3); // 30 > 25 → evict oldest → 20
    expect(rb.size).toBe(2);
    expect(rb.byteSize).toBe(20);
    expect(rb.toArray()).toEqual([2, 3]);
  });

  it("drops matching items and preserves order of the rest", () => {
    const rb = new RingBuffer<number>(5);
    [1, 2, 3, 4, 5].forEach((n) => rb.push(n));
    const removed = rb.dropMatching((n) => n % 2 === 0);
    expect(removed).toEqual([2, 4]);
    expect(rb.toArray()).toEqual([1, 3, 5]);
  });

  it("replaceAll resets to the given items", () => {
    const rb = new RingBuffer<number>(5);
    [1, 2, 3].forEach((n) => rb.push(n));
    rb.replaceAll([9, 8]);
    expect(rb.toArray()).toEqual([9, 8]);
    expect(rb.size).toBe(2);
  });

  it("clears", () => {
    const rb = new RingBuffer<number>(3);
    rb.push(1);
    rb.clear();
    expect(rb.size).toBe(0);
    expect(rb.byteSize).toBe(0);
    expect(rb.toArray()).toEqual([]);
  });
});

describe("estimateBytes", () => {
  it("estimates ~2 bytes per JSON character", () => {
    expect(estimateBytes({ a: 1 })).toBe(JSON.stringify({ a: 1 }).length * 2);
  });

  it("returns 0 for unserializable values", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(estimateBytes(circular)).toBe(0);
  });
});
