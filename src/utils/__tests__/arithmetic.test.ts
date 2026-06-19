import { describe, it, expect } from "vitest";
import { Decimal } from "../arithmetic";

describe("Decimal", () => {
  describe("constructor", () => {
    it("creates Decimal from valid integer string", () => {
      const decimal = new Decimal("10000000", 7);
      expect(decimal.toString()).toBe("10000000");
      expect(decimal.getScale()).toBe(7);
    });

    it("handles negative values", () => {
      const decimal = new Decimal("-5000000", 7);
      expect(decimal.toString()).toBe("-5000000");
    });

    it("throws error for invalid value", () => {
      expect(() => new Decimal("12.34", 7)).toThrow(/Invalid decimal value/);
      expect(() => new Decimal("abc", 7)).toThrow(/Invalid decimal value/);
      expect(() => new Decimal("12.34.56", 7)).toThrow(/Invalid decimal value/);
    });
  });

  describe("fromSoroban", () => {
    it("converts bigint to Decimal", () => {
      const decimal = Decimal.fromSoroban(10_000_000n, 7);
      expect(decimal.toString()).toBe("10000000");
      expect(decimal.getScale()).toBe(7);
    });

    it("handles large values", () => {
      const decimal = Decimal.fromSoroban(123_456_789_012_345n, 7);
      expect(decimal.toString()).toBe("123456789012345");
    });

    it("handles negative values", () => {
      const decimal = Decimal.fromSoroban(-5_000_000n, 7);
      expect(decimal.toString()).toBe("-5000000");
    });
  });

  describe("fromString", () => {
    it("converts decimal string to scaled integer", () => {
      const decimal = Decimal.fromString("1.23", 7);
      expect(decimal.toString()).toBe("12300000");
    });

    it("handles integer strings without decimal point", () => {
      const decimal = Decimal.fromString("42", 7);
      expect(decimal.toString()).toBe("420000000");
    });

    it("handles values with leading zeros", () => {
      const decimal = Decimal.fromString("0.1", 7);
      expect(decimal.toString()).toBe("1000000");
    });

    it("handles negative values", () => {
      const decimal = Decimal.fromString("-123.456", 7);
      expect(decimal.toString()).toBe("-1234560000");
    });

    it("pads short fractional parts", () => {
      const decimal = Decimal.fromString("1.1", 7);
      expect(decimal.toString()).toBe("11000000");
    });

    it("truncates long fractional parts", () => {
      const decimal = Decimal.fromString("1.123456789", 7);
      expect(decimal.toString()).toBe("11234567"); // truncated at 7 decimals
    });
  });

  describe("toSoroban", () => {
    it("converts Decimal to bigint", () => {
      const decimal = new Decimal("10000000", 7);
      expect(decimal.toSoroban()).toBe(10_000_000n);
    });

    it("handles large values", () => {
      const decimal = new Decimal("123456789012345", 7);
      expect(decimal.toSoroban()).toBe(123_456_789_012_345n);
    });

    it("handles negative values", () => {
      const decimal = new Decimal("-5000000", 7);
      expect(decimal.toSoroban()).toBe(-5_000_000n);
    });
  });

  describe("format", () => {
    it("formats with default 2 decimal places", () => {
      const decimal = new Decimal("12345600000", 7);
      expect(decimal.format()).toBe("1,234.56");
    });

    it("formats with 7 decimal places", () => {
      const decimal = new Decimal("12345600000", 7);
      expect(decimal.format(7)).toBe("1,234.5600000");
    });

    it("formats with 0 decimal places", () => {
      const decimal = new Decimal("12345600000", 7);
      expect(decimal.format(0)).toBe("1,235"); // rounds up
    });

    it("handles rounding up at 5", () => {
      const decimal = new Decimal("12345000000", 7); // 1234.5
      expect(decimal.format(0)).toBe("1,235");
    });

    it("handles rounding down below 5", () => {
      const decimal = new Decimal("12344999999", 7); // 1234.4999999
      expect(decimal.format(0)).toBe("1,234");
    });

    it("handles carry-over during rounding", () => {
      const decimal = new Decimal("9999950000", 7); // 999.995
      expect(decimal.format(2)).toBe("1,000.00");
    });

    it("formats negative values", () => {
      const decimal = new Decimal("-12345600000", 7);
      expect(decimal.format(2)).toBe("-1,234.56");
    });

    it("formats small values", () => {
      const decimal = new Decimal("1000000", 7);
      expect(decimal.format(2)).toBe("0.10");
    });

    it("formats zero", () => {
      const decimal = new Decimal("0", 7);
      expect(decimal.format(2)).toBe("0.00");
    });
  });

  describe("add", () => {
    it("adds two positive decimals", () => {
      const a = new Decimal("1000000", 7); // 0.1
      const b = new Decimal("2000000", 7); // 0.2
      const result = a.add(b);
      expect(result.toString()).toBe("3000000"); // 0.3
      expect(result.format(1)).toBe("0.3");
    });

    it("adds negative decimals", () => {
      const a = new Decimal("-1000000", 7);
      const b = new Decimal("-2000000", 7);
      const result = a.add(b);
      expect(result.toString()).toBe("-3000000");
    });

    it("adds positive and negative", () => {
      const a = new Decimal("5000000", 7);
      const b = new Decimal("-2000000", 7);
      const result = a.add(b);
      expect(result.toString()).toBe("3000000");
    });

    it("throws error for scale mismatch", () => {
      const a = new Decimal("1000000", 7);
      const b = new Decimal("1000000", 6);
      expect(() => a.add(b)).toThrow(/Scale mismatch/);
    });
  });

  describe("sub", () => {
    it("subtracts two decimals", () => {
      const a = new Decimal("5000000", 7); // 0.5
      const b = new Decimal("2000000", 7); // 0.2
      const result = a.sub(b);
      expect(result.toString()).toBe("3000000"); // 0.3
    });

    it("handles negative result", () => {
      const a = new Decimal("2000000", 7);
      const b = new Decimal("5000000", 7);
      const result = a.sub(b);
      expect(result.toString()).toBe("-3000000");
    });

    it("throws error for scale mismatch", () => {
      const a = new Decimal("5000000", 7);
      const b = new Decimal("2000000", 6);
      expect(() => a.sub(b)).toThrow(/Scale mismatch/);
    });
  });

  describe("mul", () => {
    it("multiplies two decimals", () => {
      const a = new Decimal("20000000", 7); // 2.0
      const b = new Decimal("30000000", 7); // 3.0
      const result = a.mul(b);
      expect(result.toString()).toBe("60000000"); // 6.0
    });

    it("multiplies fractional values", () => {
      const a = new Decimal("12345600", 7); // 1.23456
      const b = new Decimal("10000000", 7); // 1.0
      const result = a.mul(b);
      expect(result.format(5)).toBe("1.23456");
    });

    it("handles negative multiplication", () => {
      const a = new Decimal("20000000", 7);
      const b = new Decimal("-30000000", 7);
      const result = a.mul(b);
      expect(result.toString()).toBe("-60000000");
    });

    it("multiplies by zero", () => {
      const a = new Decimal("20000000", 7);
      const b = new Decimal("0", 7);
      const result = a.mul(b);
      expect(result.toString()).toBe("0");
    });

    it("throws error for scale mismatch", () => {
      const a = new Decimal("20000000", 7);
      const b = new Decimal("30000000", 6);
      expect(() => a.mul(b)).toThrow(/Scale mismatch/);
    });
  });

  describe("div", () => {
    it("divides two decimals", () => {
      const a = new Decimal("60000000", 7); // 6.0
      const b = new Decimal("20000000", 7); // 2.0
      const result = a.div(b);
      expect(result.toString()).toBe("30000000"); // 3.0
    });

    it("divides with fractional result", () => {
      const a = new Decimal("10000000", 7); // 1.0
      const b = new Decimal("20000000", 7); // 2.0
      const result = a.div(b);
      expect(result.format(1)).toBe("0.5");
    });

    it("throws error for division by zero", () => {
      const a = new Decimal("10000000", 7);
      const b = new Decimal("0", 7);
      expect(() => a.div(b)).toThrow(/Division by zero/);
    });

    it("handles negative division", () => {
      const a = new Decimal("-60000000", 7);
      const b = new Decimal("20000000", 7);
      const result = a.div(b);
      expect(result.toString()).toBe("-30000000");
    });

    it("throws error for scale mismatch", () => {
      const a = new Decimal("60000000", 7);
      const b = new Decimal("20000000", 6);
      expect(() => a.div(b)).toThrow(/Scale mismatch/);
    });
  });

  describe("compareTo", () => {
    it("returns 0 for equal decimals", () => {
      const a = new Decimal("10000000", 7);
      const b = new Decimal("10000000", 7);
      expect(a.compareTo(b)).toBe(0);
    });

    it("returns -1 when first is less", () => {
      const a = new Decimal("10000000", 7);
      const b = new Decimal("20000000", 7);
      expect(a.compareTo(b)).toBe(-1);
    });

    it("returns 1 when first is greater", () => {
      const a = new Decimal("20000000", 7);
      const b = new Decimal("10000000", 7);
      expect(a.compareTo(b)).toBe(1);
    });

    it("handles negative values", () => {
      const a = new Decimal("-10000000", 7);
      const b = new Decimal("10000000", 7);
      expect(a.compareTo(b)).toBe(-1);
    });
  });

  describe("comparison methods", () => {
    it("equals works correctly", () => {
      const a = new Decimal("10000000", 7);
      const b = new Decimal("10000000", 7);
      const c = new Decimal("20000000", 7);
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });

    it("lt works correctly", () => {
      const a = new Decimal("10000000", 7);
      const b = new Decimal("20000000", 7);
      expect(a.lt(b)).toBe(true);
      expect(b.lt(a)).toBe(false);
    });

    it("lte works correctly", () => {
      const a = new Decimal("10000000", 7);
      const b = new Decimal("10000000", 7);
      const c = new Decimal("20000000", 7);
      expect(a.lte(b)).toBe(true);
      expect(a.lte(c)).toBe(true);
      expect(c.lte(a)).toBe(false);
    });

    it("gt works correctly", () => {
      const a = new Decimal("20000000", 7);
      const b = new Decimal("10000000", 7);
      expect(a.gt(b)).toBe(true);
      expect(b.gt(a)).toBe(false);
    });

    it("gte works correctly", () => {
      const a = new Decimal("20000000", 7);
      const b = new Decimal("20000000", 7);
      const c = new Decimal("10000000", 7);
      expect(a.gte(b)).toBe(true);
      expect(a.gte(c)).toBe(true);
      expect(c.gte(a)).toBe(false);
    });
  });

  describe("floating-point edge cases", () => {
    it("avoids 0.1 + 0.2 rounding error", () => {
      const a = Decimal.fromString("0.1", 7);
      const b = Decimal.fromString("0.2", 7);
      const result = a.add(b);
      expect(result.format(1)).toBe("0.3");
      expect(result.format(7)).toBe("0.3000000");
      // In vanilla JS: 0.1 + 0.2 = 0.30000000000000004
    });

    it("avoids multiplication artifacts", () => {
      const a = Decimal.fromString("123.456", 7);
      const b = Decimal.fromString("10", 7); // 1e7 / 1e6
      const result = a.mul(b);
      expect(result.format(2)).toBe("1,234.56");
      // In vanilla JS: 123.456 * 1e7 produces floating-point artifacts
    });

    it("handles accumulated rounding in complex calculation", () => {
      // Base price + quality - transport - insurance
      const basePrice = Decimal.fromString("1234.56", 7);
      const quality = Decimal.fromString("0.5", 7);
      const transport = Decimal.fromString("0.2345", 7);
      const insurance = Decimal.fromString("0.1", 7);

      const result = basePrice
        .add(quality)
        .sub(transport)
        .sub(insurance);

      expect(result.format(7)).toBe("1,234.7255000");
      expect(result.format(2)).toBe("1,234.73");
    });
  });

  describe("round-trip conversion", () => {
    it("maintains precision through Soroban round-trip", () => {
      const original = 12345600000n;
      const decimal = Decimal.fromSoroban(original, 7);
      const converted = decimal.toSoroban();
      expect(converted).toBe(original);
    });

    it("maintains precision through string round-trip", () => {
      const original = "1234.56";
      const decimal = Decimal.fromString(original, 7);
      const formatted = decimal.format(2);
      expect(formatted).toBe("1,234.56");
    });

    it("handles many round-trips", () => {
      let value = 10000000n; // 1.0
      for (let i = 0; i < 100; i++) {
        const decimal = Decimal.fromSoroban(value, 7);
        value = decimal.toSoroban();
      }
      expect(value).toBe(10000000n);
    });
  });

  describe("large value handling", () => {
    it("handles maximum safe i128 values", () => {
      // i128 max is approximately 1.7e38
      const large = "170141183460469231731687303715884105727";
      const decimal = new Decimal(large, 7);
      expect(decimal.toString()).toBe(large);
    });

    it("performs arithmetic on large values", () => {
      const a = new Decimal("100000000000000", 7); // 10,000,000
      const b = new Decimal("200000000000000", 7); // 20,000,000
      const result = a.add(b);
      expect(result.toString()).toBe("300000000000000");
    });
  });

  describe("zero and boundary cases", () => {
    it("handles zero correctly", () => {
      const zero = new Decimal("0", 7);
      expect(zero.format(2)).toBe("0.00");
      expect(zero.format(7)).toBe("0.0000000");
    });

    it("handles adding zero", () => {
      const a = new Decimal("10000000", 7);
      const zero = new Decimal("0", 7);
      const result = a.add(zero);
      expect(result.toString()).toBe("10000000");
    });

    it("handles subtracting zero", () => {
      const a = new Decimal("10000000", 7);
      const zero = new Decimal("0", 7);
      const result = a.sub(zero);
      expect(result.toString()).toBe("10000000");
    });

    it("handles multiplying by zero", () => {
      const a = new Decimal("10000000", 7);
      const zero = new Decimal("0", 7);
      const result = a.mul(zero);
      expect(result.toString()).toBe("0");
    });
  });
});
