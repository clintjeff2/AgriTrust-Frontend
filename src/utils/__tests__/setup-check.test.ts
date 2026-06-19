import { describe, it, expect } from "vitest";

describe("Setup Check", () => {
  it("should have working test environment", () => {
    expect(true).toBe(true);
  });

  it("should support BigInt", () => {
    const big = 10_000_000n;
    expect(big.toString()).toBe("10000000");
  });

  it("should support string operations", () => {
    const str = "test";
    expect(str.toUpperCase()).toBe("TEST");
  });
});
