import { describe, it, expect } from "vitest";
import { Decimal } from "../arithmetic";

/**
 * Performance benchmarks to verify the Decimal class meets
 * the requirement of 10,000 operations per second on mobile devices.
 * 
 * These tests measure operation throughput and ensure arithmetic
 * is fast enough for interactive price calculators.
 */

describe("Decimal Performance Benchmarks", () => {
  const OPERATIONS_TARGET = 10_000; // 10k ops/sec target
  const TOLERANCE = 1.5; // Allow 1.5x slower on test environment

  describe("basic operation throughput", () => {
    it("performs 10,000 additions in under 1 second", () => {
      const a = new Decimal("12345600000", 7);
      const b = new Decimal("5000000", 7);
      
      const start = performance.now();
      for (let i = 0; i < OPERATIONS_TARGET; i++) {
        a.add(b);
      }
      const elapsed = performance.now() - start;
      
      console.log(`  10k additions: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(1000 * TOLERANCE);
    });

    it("performs 10,000 subtractions in under 1 second", () => {
      const a = new Decimal("12345600000", 7);
      const b = new Decimal("5000000", 7);
      
      const start = performance.now();
      for (let i = 0; i < OPERATIONS_TARGET; i++) {
        a.sub(b);
      }
      const elapsed = performance.now() - start;
      
      console.log(`  10k subtractions: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(1000 * TOLERANCE);
    });

    it("performs 10,000 multiplications in under 1 second", () => {
      const a = new Decimal("12345600", 7); // Smaller values for mul
      const b = new Decimal("10000000", 7);
      
      const start = performance.now();
      for (let i = 0; i < OPERATIONS_TARGET; i++) {
        a.mul(b);
      }
      const elapsed = performance.now() - start;
      
      console.log(`  10k multiplications: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(1000 * TOLERANCE);
    });

    it("performs 10,000 divisions in under 1 second", () => {
      const a = new Decimal("12345600000", 7);
      const b = new Decimal("10000000", 7);
      
      const start = performance.now();
      for (let i = 0; i < OPERATIONS_TARGET; i++) {
        a.div(b);
      }
      const elapsed = performance.now() - start;
      
      console.log(`  10k divisions: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(1000 * TOLERANCE);
    });

    it("performs 10,000 comparisons in under 1 second", () => {
      const a = new Decimal("12345600000", 7);
      const b = new Decimal("12345600001", 7);
      
      const start = performance.now();
      for (let i = 0; i < OPERATIONS_TARGET; i++) {
        a.compareTo(b);
      }
      const elapsed = performance.now() - start;
      
      console.log(`  10k comparisons: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(1000 * TOLERANCE);
    });

    it("performs 10,000 format operations in under 1 second", () => {
      const a = new Decimal("12345600000", 7);
      
      const start = performance.now();
      for (let i = 0; i < OPERATIONS_TARGET; i++) {
        a.format(2);
      }
      const elapsed = performance.now() - start;
      
      console.log(`  10k format operations: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(1000 * TOLERANCE);
    });
  });

  describe("complex operation chains", () => {
    it("handles 1,000 multi-step calculations efficiently", () => {
      const basePrice = new Decimal("12345600000", 7);
      const quality = new Decimal("5000000", 7);
      const transport = new Decimal("2345000", 7);
      const insurance = new Decimal("1000000", 7);
      
      const start = performance.now();
      for (let i = 0; i < 1_000; i++) {
        basePrice
          .add(quality)
          .sub(transport)
          .sub(insurance)
          .format(2);
      }
      const elapsed = performance.now() - start;
      
      console.log(`  1k multi-step calculations: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(100 * TOLERANCE);
    });

    it("handles 100 complex payout breakdowns efficiently", () => {
      const basePrice = new Decimal("12345600000", 7);
      const adjustments = [
        new Decimal("5000000", 7),
        new Decimal("-2345000", 7),
        new Decimal("-1000000", 7),
        new Decimal("1500000", 7),
        new Decimal("-500000", 7),
      ];
      
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        let total = basePrice;
        for (const adj of adjustments) {
          if (adj.toString().startsWith("-")) {
            const positive = new Decimal(adj.toString().slice(1), 7);
            total = total.sub(positive);
          } else {
            total = total.add(adj);
          }
        }
        total.format(7);
      }
      const elapsed = performance.now() - start;
      
      console.log(`  100 complex breakdowns: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(50 * TOLERANCE);
    });
  });

  describe("conversion performance", () => {
    it("performs 10,000 fromSoroban conversions efficiently", () => {
      const raw = 12345600000n;
      
      const start = performance.now();
      for (let i = 0; i < OPERATIONS_TARGET; i++) {
        Decimal.fromSoroban(raw, 7);
      }
      const elapsed = performance.now() - start;
      
      console.log(`  10k fromSoroban: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(1000 * TOLERANCE);
    });

    it("performs 10,000 toSoroban conversions efficiently", () => {
      const decimal = new Decimal("12345600000", 7);
      
      const start = performance.now();
      for (let i = 0; i < OPERATIONS_TARGET; i++) {
        decimal.toSoroban();
      }
      const elapsed = performance.now() - start;
      
      console.log(`  10k toSoroban: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(1000 * TOLERANCE);
    });

    it("performs 10,000 fromString conversions efficiently", () => {
      const str = "1234.56";
      
      const start = performance.now();
      for (let i = 0; i < OPERATIONS_TARGET; i++) {
        Decimal.fromString(str, 7);
      }
      const elapsed = performance.now() - start;
      
      console.log(`  10k fromString: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(1000 * TOLERANCE);
    });
  });

  describe("memory efficiency", () => {
    it("creates 100,000 Decimal instances without significant memory issues", () => {
      const decimals: Decimal[] = [];
      
      const start = performance.now();
      for (let i = 0; i < 100_000; i++) {
        decimals.push(new Decimal(i.toString(), 7));
      }
      const elapsed = performance.now() - start;
      
      console.log(`  100k instance creation: ${elapsed.toFixed(2)}ms`);
      expect(decimals.length).toBe(100_000);
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe("realistic UI scenarios", () => {
    it("simulates 100 price panel updates per second", () => {
      const prices = Array.from({ length: 100 }, (_, i) => 
        new Decimal((10000000 + i * 100000).toString(), 7)
      );
      
      const start = performance.now();
      for (const price of prices) {
        price.format(2);
        price.format(7);
      }
      const elapsed = performance.now() - start;
      
      console.log(`  100 price panel updates: ${elapsed.toFixed(2)}ms`);
      // Should complete in under 10ms for smooth 100fps updates
      expect(elapsed).toBeLessThan(10 * TOLERANCE);
    });

    it("simulates 50 payout breakdown calculations per second", () => {
      const basePrice = new Decimal("12345600000", 7);
      const adjustments = [
        new Decimal("5000000", 7),
        new Decimal("2345000", 7),
        new Decimal("1000000", 7),
      ];
      
      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        let total = basePrice;
        for (const adj of adjustments) {
          total = total.add(adj);
        }
        total.format(2);
        total.format(7);
      }
      const elapsed = performance.now() - start;
      
      console.log(`  50 payout breakdowns: ${elapsed.toFixed(2)}ms`);
      // Should complete in under 20ms for smooth 50fps updates
      expect(elapsed).toBeLessThan(20 * TOLERANCE);
    });

    it("handles interactive price calculator input", () => {
      // Simulate user typing "1234.56" and seeing updates
      const inputs = ["1", "12", "123", "1234", "1234.", "1234.5", "1234.56"];
      
      const start = performance.now();
      for (const input of inputs) {
        const decimal = Decimal.fromString(input, 7);
        decimal.format(2);
      }
      const elapsed = performance.now() - start;
      
      console.log(`  7 interactive inputs: ${elapsed.toFixed(2)}ms`);
      // Should complete instantly (< 1ms)
      expect(elapsed).toBeLessThan(1 * TOLERANCE);
    });
  });

  describe("worst-case scenarios", () => {
    it("handles very large numbers efficiently", () => {
      const large = new Decimal("170141183460469231731687303715884105727", 7);
      const small = new Decimal("1", 7);
      
      const start = performance.now();
      for (let i = 0; i < 1_000; i++) {
        large.add(small);
        large.sub(small);
        large.compareTo(small);
      }
      const elapsed = performance.now() - start;
      
      console.log(`  1k large number operations: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(100 * TOLERANCE);
    });

    it("handles deep calculation chains efficiently", () => {
      let result = new Decimal("10000000", 7); // Start with 1.0
      
      const start = performance.now();
      // Chain 100 operations
      for (let i = 0; i < 100; i++) {
        result = result.add(new Decimal("100000", 7));
      }
      result.format(7);
      const elapsed = performance.now() - start;
      
      console.log(`  100-deep operation chain: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(10 * TOLERANCE);
    });
  });
});
