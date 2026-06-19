import { describe, it, expect } from "vitest";
import { Decimal } from "../arithmetic";

/**
 * Property-based style tests using randomized inputs to verify Decimal arithmetic.
 * These tests generate random values and verify mathematical properties hold.
 * 
 * Note: Using built-in randomization instead of fast-check to avoid additional dependencies.
 */

// Helper to generate random BigInt in range
function randomBigInt(min: bigint, max: bigint): bigint {
  const range = max - min;
  const bits = range.toString(2).length;
  let result: bigint;
  do {
    result = BigInt(Math.floor(Math.random() * Number(2n ** BigInt(bits))));
  } while (result > range);
  return min + result;
}

// Generate random Soroban i128 values (7 decimals)
function randomSorobanValue(): string {
  const value = randomBigInt(-9_999_999_999_999_999n, 9_999_999_999_999_999n);
  return value.toString();
}

describe("Decimal Property-Based Tests", () => {
  const NUM_RUNS = 100; // Run each property 100 times

  describe("round-trip conversions", () => {
    it("fromSoroban -> toSoroban preserves value", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const raw = randomBigInt(-9_999_999_999_999_999n, 9_999_999_999_999_999n);
        const decimal = Decimal.fromSoroban(raw, 7);
        const converted = decimal.toSoroban();
        expect(converted).toBe(raw);
      }
    });

    it("fromString -> toSoroban -> format preserves reasonable precision", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const num = (Math.random() - 0.5) * 1_000_000; // -500k to +500k
        const str = num.toFixed(7);
        const decimal = Decimal.fromString(str, 7);
        const soroban = decimal.toSoroban();
        const backToDecimal = Decimal.fromSoroban(soroban, 7);
        const formatted = backToDecimal.format(7);
        
        // Remove commas for comparison
        const normalizedFormatted = formatted.replace(/,/g, "");
        const normalizedOriginal = parseFloat(str).toFixed(7);
        
        // Should match within rounding tolerance
        expect(Math.abs(parseFloat(normalizedFormatted) - parseFloat(normalizedOriginal))).toBeLessThan(0.000001);
      }
    });
  });

  describe("addition properties", () => {
    it("addition is commutative: a + b = b + a", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const a = randomSorobanValue();
        const b = randomSorobanValue();
        
        const decA = new Decimal(a, 7);
        const decB = new Decimal(b, 7);
        
        const sum1 = decA.add(decB);
        const sum2 = decB.add(decA);
        
        expect(sum1.equals(sum2)).toBe(true);
      }
    });

    it("addition is associative: (a + b) + c = a + (b + c)", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const a = randomSorobanValue();
        const b = randomSorobanValue();
        const c = randomSorobanValue();
        
        const decA = new Decimal(a, 7);
        const decB = new Decimal(b, 7);
        const decC = new Decimal(c, 7);
        
        const sum1 = decA.add(decB).add(decC);
        const sum2 = decA.add(decB.add(decC));
        
        expect(sum1.equals(sum2)).toBe(true);
      }
    });

    it("adding zero is identity: a + 0 = a", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const a = randomSorobanValue();
        const decA = new Decimal(a, 7);
        const zero = new Decimal("0", 7);
        
        const result = decA.add(zero);
        
        expect(result.equals(decA)).toBe(true);
      }
    });
  });

  describe("subtraction properties", () => {
    it("subtracting self equals zero: a - a = 0", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const a = randomSorobanValue();
        const decA = new Decimal(a, 7);
        const zero = new Decimal("0", 7);
        
        const result = decA.sub(decA);
        
        expect(result.equals(zero)).toBe(true);
      }
    });

    it("subtracting zero is identity: a - 0 = a", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const a = randomSorobanValue();
        const decA = new Decimal(a, 7);
        const zero = new Decimal("0", 7);
        
        const result = decA.sub(zero);
        
        expect(result.equals(decA)).toBe(true);
      }
    });

    it("subtraction reverses addition: (a + b) - b = a", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const a = randomSorobanValue();
        const b = randomSorobanValue();
        
        const decA = new Decimal(a, 7);
        const decB = new Decimal(b, 7);
        
        const result = decA.add(decB).sub(decB);
        
        expect(result.equals(decA)).toBe(true);
      }
    });
  });

  describe("multiplication properties", () => {
    it("multiplication is commutative: a * b = b * a", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        // Use smaller values to avoid overflow
        const a = randomBigInt(-100000000n, 100000000n);
        const b = randomBigInt(-100000000n, 100000000n);
        
        const decA = new Decimal(a.toString(), 7);
        const decB = new Decimal(b.toString(), 7);
        
        const prod1 = decA.mul(decB);
        const prod2 = decB.mul(decA);
        
        expect(prod1.equals(prod2)).toBe(true);
      }
    });

    it("multiplying by one is identity: a * 1 = a", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const a = randomSorobanValue();
        const decA = new Decimal(a, 7);
        const one = new Decimal("10000000", 7); // 1.0 in 7 decimals
        
        const result = decA.mul(one);
        
        expect(result.equals(decA)).toBe(true);
      }
    });

    it("multiplying by zero gives zero: a * 0 = 0", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const a = randomSorobanValue();
        const decA = new Decimal(a, 7);
        const zero = new Decimal("0", 7);
        
        const result = decA.mul(zero);
        
        expect(result.equals(zero)).toBe(true);
      }
    });
  });

  describe("division properties", () => {
    it("dividing by one is identity: a / 1 = a", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const a = randomSorobanValue();
        const decA = new Decimal(a, 7);
        const one = new Decimal("10000000", 7); // 1.0
        
        const result = decA.div(one);
        
        expect(result.equals(decA)).toBe(true);
      }
    });

    it("dividing self gives one: a / a = 1 (for non-zero)", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const a = randomBigInt(1n, 9_999_999_999_999_999n);
        const decA = new Decimal(a.toString(), 7);
        const one = new Decimal("10000000", 7); // 1.0
        
        const result = decA.div(decA);
        
        expect(result.equals(one)).toBe(true);
      }
    });

    it("division reverses multiplication: (a * b) / b = a (for reasonable values)", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const a = randomBigInt(-100000000n, 100000000n);
        const b = randomBigInt(10000n, 100000000n); // Avoid division by small numbers
        
        const decA = new Decimal(a.toString(), 7);
        const decB = new Decimal(b.toString(), 7);
        
        const result = decA.mul(decB).div(decB);
        
        expect(result.equals(decA)).toBe(true);
      }
    });
  });

  describe("comparison properties", () => {
    it("reflexivity: a = a", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const a = randomSorobanValue();
        const decA = new Decimal(a, 7);
        expect(decA.equals(decA)).toBe(true);
        expect(decA.compareTo(decA)).toBe(0);
      }
    });

    it("symmetry: if a < b then b > a", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const a = randomSorobanValue();
        const b = randomSorobanValue();
        
        const decA = new Decimal(a, 7);
        const decB = new Decimal(b, 7);
        
        if (decA.lt(decB)) {
          expect(decB.gt(decA)).toBe(true);
        }
      }
    });

    it("transitivity: if a <= b and b <= c then a <= c", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const values = [
          randomBigInt(-1_000_000_000n, 1_000_000_000n),
          randomBigInt(-1_000_000_000n, 1_000_000_000n),
          randomBigInt(-1_000_000_000n, 1_000_000_000n),
        ].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
        
        const decA = new Decimal(values[0].toString(), 7);
        const decB = new Decimal(values[1].toString(), 7);
        const decC = new Decimal(values[2].toString(), 7);
        
        if (decA.lte(decB) && decB.lte(decC)) {
          expect(decA.lte(decC)).toBe(true);
        }
      }
    });

    it("trichotomy: exactly one of a < b, a = b, a > b", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const a = randomSorobanValue();
        const b = randomSorobanValue();
        
        const decA = new Decimal(a, 7);
        const decB = new Decimal(b, 7);
        
        const lt = decA.lt(decB);
        const eq = decA.equals(decB);
        const gt = decA.gt(decB);
        
        const count = [lt, eq, gt].filter(Boolean).length;
        expect(count).toBe(1);
      }
    });
  });

  describe("format preserves value (within precision)", () => {
    it("formatting and parsing back preserves value", () => {
      for (let i = 0; i < NUM_RUNS; i++) {
        const raw = randomBigInt(-9_999_999_999_999_999n, 9_999_999_999_999_999n);
        const decimal = Decimal.fromSoroban(raw, 7);
        const formatted = decimal.format(7);
        
        // Remove commas
        const cleaned = formatted.replace(/,/g, "");
        
        // Parse back
        const reparsed = Decimal.fromString(cleaned, 7);
        
        expect(reparsed.equals(decimal)).toBe(true);
      }
    });
  });

  describe("large computation chains", () => {
    it("multiple operations maintain consistency", () => {
      for (let run = 0; run < 10; run++) {
        const values = Array.from({ length: 10 }, () => 
          randomBigInt(-10000000n, 10000000n)
        );
        
        let result = new Decimal("0", 7);
        
        // Add all values
        for (const val of values) {
          const dec = new Decimal(val.toString(), 7);
          result = result.add(dec);
        }
        
        // Subtract all values
        for (const val of values) {
          const dec = new Decimal(val.toString(), 7);
          result = result.sub(dec);
        }
        
        // Should end up at zero
        const zero = new Decimal("0", 7);
        expect(result.equals(zero)).toBe(true);
      }
    });
  });

  describe("no floating-point artifacts", () => {
    it("0.1 + 0.2 = 0.3 exactly", () => {
      const a = Decimal.fromString("0.1", 7);
      const b = Decimal.fromString("0.2", 7);
      const expected = Decimal.fromString("0.3", 7);
      
      const result = a.add(b);
      
      expect(result.equals(expected)).toBe(true);
      expect(result.format(1)).toBe("0.3");
    });

    it("multiplication doesn't produce artifacts", () => {
      for (let i = 0; i < 50; i++) {
        const num = Math.random() * 1000 + 1;
        const str = num.toFixed(6);
        const decimal = Decimal.fromString(str, 7);
        const ten = Decimal.fromString("10", 7);
        
        const result = decimal.mul(ten);
        const formatted = result.format(5);
        
        // Should be a clean number without artifacts
        expect(formatted).toMatch(/^-?\d{1,3}(,\d{3})*\.\d{5}$/);
      }
    });
  });
});
