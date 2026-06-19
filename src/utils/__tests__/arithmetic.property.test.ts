import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { Decimal } from "../arithmetic";

/**
 * Property-based tests using fast-check to verify Decimal arithmetic
 * with randomized inputs following Soroban i128 constraints.
 */

// Arbitrary for valid Soroban i128 values (7 decimals)
// Using safe range to avoid BigInt overflow
const sorobanI128 = () =>
  fc.bigInt({ min: -9_999_999_999_999_999n, max: 9_999_999_999_999_999n });

const sorobanI128String = () =>
  sorobanI128().map((n) => n.toString());

describe("Decimal Property-Based Tests", () => {
  describe("round-trip conversions", () => {
    it("fromSoroban -> toSoroban preserves value", () => {
      fc.assert(
        fc.property(sorobanI128(), (raw) => {
          const decimal = Decimal.fromSoroban(raw, 7);
          const converted = decimal.toSoroban();
          expect(converted).toBe(raw);
        }),
        { numRuns: 1000 }
      );
    });

    it("fromString -> toSoroban -> format preserves reasonable precision", () => {
      fc.assert(
        fc.property(
          fc.double({ min: -999999.9999999, max: 999999.9999999, noNaN: true }),
          (num) => {
            const str = num.toFixed(7);
            const decimal = Decimal.fromString(str, 7);
            const soroban = decimal.toSoroban();
            const backToDecimal = Decimal.fromSoroban(soroban, 7);
            const formatted = backToDecimal.format(7);
            
            // Remove commas for comparison
            const normalizedFormatted = formatted.replace(/,/g, "");
            const normalizedOriginal = parseFloat(str).toFixed(7);
            
            // Should match within rounding tolerance
            expect(parseFloat(normalizedFormatted)).toBeCloseTo(
              parseFloat(normalizedOriginal),
              6
            );
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe("addition properties", () => {
    it("addition is commutative: a + b = b + a", () => {
      fc.assert(
        fc.property(sorobanI128String(), sorobanI128String(), (a, b) => {
          const decA = new Decimal(a, 7);
          const decB = new Decimal(b, 7);
          
          const sum1 = decA.add(decB);
          const sum2 = decB.add(decA);
          
          expect(sum1.equals(sum2)).toBe(true);
        }),
        { numRuns: 1000 }
      );
    });

    it("addition is associative: (a + b) + c = a + (b + c)", () => {
      fc.assert(
        fc.property(
          sorobanI128String(),
          sorobanI128String(),
          sorobanI128String(),
          (a, b, c) => {
            const decA = new Decimal(a, 7);
            const decB = new Decimal(b, 7);
            const decC = new Decimal(c, 7);
            
            const sum1 = decA.add(decB).add(decC);
            const sum2 = decA.add(decB.add(decC));
            
            expect(sum1.equals(sum2)).toBe(true);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("adding zero is identity: a + 0 = a", () => {
      fc.assert(
        fc.property(sorobanI128String(), (a) => {
          const decA = new Decimal(a, 7);
          const zero = new Decimal("0", 7);
          
          const result = decA.add(zero);
          
          expect(result.equals(decA)).toBe(true);
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("subtraction properties", () => {
    it("subtracting self equals zero: a - a = 0", () => {
      fc.assert(
        fc.property(sorobanI128String(), (a) => {
          const decA = new Decimal(a, 7);
          const zero = new Decimal("0", 7);
          
          const result = decA.sub(decA);
          
          expect(result.equals(zero)).toBe(true);
        }),
        { numRuns: 1000 }
      );
    });

    it("subtracting zero is identity: a - 0 = a", () => {
      fc.assert(
        fc.property(sorobanI128String(), (a) => {
          const decA = new Decimal(a, 7);
          const zero = new Decimal("0", 7);
          
          const result = decA.sub(zero);
          
          expect(result.equals(decA)).toBe(true);
        }),
        { numRuns: 1000 }
      );
    });

    it("subtraction reverses addition: (a + b) - b = a", () => {
      fc.assert(
        fc.property(sorobanI128String(), sorobanI128String(), (a, b) => {
          const decA = new Decimal(a, 7);
          const decB = new Decimal(b, 7);
          
          const result = decA.add(decB).sub(decB);
          
          expect(result.equals(decA)).toBe(true);
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("multiplication properties", () => {
    it("multiplication is commutative: a * b = b * a", () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: -100000000n, max: 100000000n }),
          fc.bigInt({ min: -100000000n, max: 100000000n }),
          (a, b) => {
            const decA = new Decimal(a.toString(), 7);
            const decB = new Decimal(b.toString(), 7);
            
            const prod1 = decA.mul(decB);
            const prod2 = decB.mul(decA);
            
            expect(prod1.equals(prod2)).toBe(true);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("multiplying by one is identity: a * 1 = a", () => {
      fc.assert(
        fc.property(sorobanI128String(), (a) => {
          const decA = new Decimal(a, 7);
          const one = new Decimal("10000000", 7); // 1.0 in 7 decimals
          
          const result = decA.mul(one);
          
          expect(result.equals(decA)).toBe(true);
        }),
        { numRuns: 1000 }
      );
    });

    it("multiplying by zero gives zero: a * 0 = 0", () => {
      fc.assert(
        fc.property(sorobanI128String(), (a) => {
          const decA = new Decimal(a, 7);
          const zero = new Decimal("0", 7);
          
          const result = decA.mul(zero);
          
          expect(result.equals(zero)).toBe(true);
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("division properties", () => {
    it("dividing by one is identity: a / 1 = a", () => {
      fc.assert(
        fc.property(sorobanI128String(), (a) => {
          const decA = new Decimal(a, 7);
          const one = new Decimal("10000000", 7); // 1.0
          
          const result = decA.div(one);
          
          expect(result.equals(decA)).toBe(true);
        }),
        { numRuns: 1000 }
      );
    });

    it("dividing self gives one: a / a = 1 (for non-zero)", () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 1n, max: 9_999_999_999_999_999n }),
          (a) => {
            const decA = new Decimal(a.toString(), 7);
            const one = new Decimal("10000000", 7); // 1.0
            
            const result = decA.div(decA);
            
            expect(result.equals(one)).toBe(true);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("division reverses multiplication: (a * b) / b = a (for reasonable values)", () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: -100000000n, max: 100000000n }),
          fc.bigInt({ min: 10000n, max: 100000000n }),
          (a, b) => {
            const decA = new Decimal(a.toString(), 7);
            const decB = new Decimal(b.toString(), 7);
            
            const result = decA.mul(decB).div(decB);
            
            expect(result.equals(decA)).toBe(true);
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  describe("comparison properties", () => {
    it("reflexivity: a = a", () => {
      fc.assert(
        fc.property(sorobanI128String(), (a) => {
          const decA = new Decimal(a, 7);
          expect(decA.equals(decA)).toBe(true);
          expect(decA.compareTo(decA)).toBe(0);
        }),
        { numRuns: 1000 }
      );
    });

    it("symmetry: if a < b then b > a", () => {
      fc.assert(
        fc.property(sorobanI128String(), sorobanI128String(), (a, b) => {
          const decA = new Decimal(a, 7);
          const decB = new Decimal(b, 7);
          
          if (decA.lt(decB)) {
            expect(decB.gt(decA)).toBe(true);
          }
        }),
        { numRuns: 1000 }
      );
    });

    it("transitivity: if a <= b and b <= c then a <= c", () => {
      fc.assert(
        fc.property(
          sorobanI128String(),
          sorobanI128String(),
          sorobanI128String(),
          (a, b, c) => {
            const decA = new Decimal(a, 7);
            const decB = new Decimal(b, 7);
            const decC = new Decimal(c, 7);
            
            if (decA.lte(decB) && decB.lte(decC)) {
              expect(decA.lte(decC)).toBe(true);
            }
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("trichotomy: exactly one of a < b, a = b, a > b", () => {
      fc.assert(
        fc.property(sorobanI128String(), sorobanI128String(), (a, b) => {
          const decA = new Decimal(a, 7);
          const decB = new Decimal(b, 7);
          
          const lt = decA.lt(decB);
          const eq = decA.equals(decB);
          const gt = decA.gt(decB);
          
          const count = [lt, eq, gt].filter(Boolean).length;
          expect(count).toBe(1);
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("format preserves value (within precision)", () => {
    it("formatting and parsing back preserves value", () => {
      fc.assert(
        fc.property(sorobanI128(), (raw) => {
          const decimal = Decimal.fromSoroban(raw, 7);
          const formatted = decimal.format(7);
          
          // Remove commas
          const cleaned = formatted.replace(/,/g, "");
          
          // Parse back
          const reparsed = Decimal.fromString(cleaned, 7);
          
          expect(reparsed.equals(decimal)).toBe(true);
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("large computation chains", () => {
    it("multiple operations maintain consistency", () => {
      fc.assert(
        fc.property(
          fc.array(fc.bigInt({ min: -10000000n, max: 10000000n }), { minLength: 5, maxLength: 10 }),
          (values) => {
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
        ),
        { numRuns: 500 }
      );
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
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 1000, noNaN: true }),
          (num) => {
            const str = num.toFixed(6);
            const decimal = Decimal.fromString(str, 7);
            const ten = Decimal.fromString("10", 7);
            
            const result = decimal.mul(ten);
            const formatted = result.format(5);
            
            // Should be a clean number without artifacts
            expect(formatted).toMatch(/^-?\d{1,3}(,\d{3})*\.\d{5}$/);
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});
