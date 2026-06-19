import { describe, it, expect } from "vitest";
import {
  formatSorobanValue,
  toSorobanValue,
  addSorobanValues,
  subtractSorobanValues,
  multiplySorobanValues,
  divideSorobanValues,
  percentageOf,
  SOROBAN_DECIMALS,
  SOROBAN_SCALE_FACTOR,
} from "../number_scaler";

describe("number_scaler", () => {
  describe("constants", () => {
    it("has correct Soroban decimals", () => {
      expect(SOROBAN_DECIMALS).toBe(7);
    });

    it("has correct scale factor", () => {
      expect(SOROBAN_SCALE_FACTOR).toBe(10_000_000);
    });
  });

  describe("formatSorobanValue", () => {
    it("formats bigint with default precision", () => {
      const result = formatSorobanValue(12345600000n);
      expect(result).toBe("1,234.56");
    });

    it("formats string with default precision", () => {
      const result = formatSorobanValue("12345600000");
      expect(result).toBe("1,234.56");
    });

    it("formats with 7 decimal precision", () => {
      const result = formatSorobanValue(12345600000n, 7);
      expect(result).toBe("1,234.5600000");
    });

    it("formats with 0 decimal precision", () => {
      const result = formatSorobanValue(12345600000n, 0);
      expect(result).toBe("1,235");
    });

    it("formats negative values", () => {
      const result = formatSorobanValue(-12345600000n);
      expect(result).toBe("-1,234.56");
    });

    it("formats zero", () => {
      const result = formatSorobanValue(0n);
      expect(result).toBe("0.00");
    });

    it("formats small values", () => {
      const result = formatSorobanValue(1000000n);
      expect(result).toBe("0.10");
    });
  });

  describe("toSorobanValue", () => {
    it("converts decimal string to bigint", () => {
      const result = toSorobanValue("1.23");
      expect(result).toBe(12300000n);
    });

    it("converts integer string", () => {
      const result = toSorobanValue("42");
      expect(result).toBe(420000000n);
    });

    it("converts fractional string", () => {
      const result = toSorobanValue("0.1");
      expect(result).toBe(1000000n);
    });

    it("converts negative values", () => {
      const result = toSorobanValue("-123.456");
      expect(result).toBe(-1234560000n);
    });

    it("handles high precision input", () => {
      const result = toSorobanValue("1.1234567");
      expect(result).toBe(11234567n);
    });

    it("truncates extra precision", () => {
      const result = toSorobanValue("1.123456789");
      expect(result).toBe(11234567n); // truncated at 7 decimals
    });
  });

  describe("addSorobanValues", () => {
    it("adds two bigint values", () => {
      const result = addSorobanValues(1000000n, 2000000n);
      expect(result).toBe(3000000n);
    });

    it("adds two string values", () => {
      const result = addSorobanValues("1000000", "2000000");
      expect(result).toBe(3000000n);
    });

    it("adds mixed types", () => {
      const result = addSorobanValues(1000000n, "2000000");
      expect(result).toBe(3000000n);
    });

    it("handles negative values", () => {
      const result = addSorobanValues(5000000n, -2000000n);
      expect(result).toBe(3000000n);
    });

    it("adds to zero", () => {
      const result = addSorobanValues(0n, 1000000n);
      expect(result).toBe(1000000n);
    });
  });

  describe("subtractSorobanValues", () => {
    it("subtracts two bigint values", () => {
      const result = subtractSorobanValues(5000000n, 2000000n);
      expect(result).toBe(3000000n);
    });

    it("subtracts two string values", () => {
      const result = subtractSorobanValues("5000000", "2000000");
      expect(result).toBe(3000000n);
    });

    it("handles negative result", () => {
      const result = subtractSorobanValues(2000000n, 5000000n);
      expect(result).toBe(-3000000n);
    });

    it("subtracts from zero", () => {
      const result = subtractSorobanValues(0n, 1000000n);
      expect(result).toBe(-1000000n);
    });
  });

  describe("multiplySorobanValues", () => {
    it("multiplies two bigint values", () => {
      const result = multiplySorobanValues(20000000n, 30000000n);
      expect(result).toBe(60000000n); // 2.0 * 3.0 = 6.0
    });

    it("multiplies two string values", () => {
      const result = multiplySorobanValues("20000000", "30000000");
      expect(result).toBe(60000000n);
    });

    it("multiplies fractional values", () => {
      const result = multiplySorobanValues(15000000n, 20000000n);
      expect(result).toBe(30000000n); // 1.5 * 2.0 = 3.0
    });

    it("multiplies by zero", () => {
      const result = multiplySorobanValues(20000000n, 0n);
      expect(result).toBe(0n);
    });

    it("handles negative multiplication", () => {
      const result = multiplySorobanValues(20000000n, -30000000n);
      expect(result).toBe(-60000000n);
    });
  });

  describe("divideSorobanValues", () => {
    it("divides two bigint values", () => {
      const result = divideSorobanValues(60000000n, 20000000n);
      expect(result).toBe(30000000n); // 6.0 / 2.0 = 3.0
    });

    it("divides two string values", () => {
      const result = divideSorobanValues("60000000", "20000000");
      expect(result).toBe(30000000n);
    });

    it("divides with fractional result", () => {
      const result = divideSorobanValues(10000000n, 20000000n);
      expect(result).toBe(5000000n); // 1.0 / 2.0 = 0.5
    });

    it("throws error for division by zero", () => {
      expect(() => divideSorobanValues(10000000n, 0n)).toThrow(/Division by zero/);
    });

    it("handles negative division", () => {
      const result = divideSorobanValues(-60000000n, 20000000n);
      expect(result).toBe(-30000000n);
    });
  });

  describe("percentageOf", () => {
    it("calculates 10% of value", () => {
      const result = percentageOf(10000000n, "10");
      expect(result).toBe(1000000n); // 10% of 1.0 = 0.1
    });

    it("calculates 50% of value", () => {
      const result = percentageOf(20000000n, "50");
      expect(result).toBe(10000000n); // 50% of 2.0 = 1.0
    });

    it("calculates fractional percentage", () => {
      const result = percentageOf(100000000n, "2.5");
      expect(result).toBe(2500000n); // 2.5% of 10.0 = 0.25
    });

    it("calculates 0%", () => {
      const result = percentageOf(10000000n, "0");
      expect(result).toBe(0n);
    });

    it("calculates 100%", () => {
      const result = percentageOf(10000000n, "100");
      expect(result).toBe(10000000n);
    });

    it("works with string values", () => {
      const result = percentageOf("10000000", "10");
      expect(result).toBe(1000000n);
    });
  });

  describe("integration scenarios", () => {
    it("calculates trade settlement correctly", () => {
      // Base price: 1234.56
      const basePrice = 12345600000n;
      
      // Quality bonus: +0.50
      const withQuality = addSorobanValues(basePrice, 5000000n);
      expect(withQuality).toBe(12350600000n); // 1234.56 + 0.50 = 1235.06
      
      // Transport fee: -0.2345
      const withTransport = subtractSorobanValues(withQuality, 2345000n);
      expect(withTransport).toBe(12348255000n); // 1235.06 - 0.2345 = 1234.8255
      
      // Insurance fee: -0.10
      const final = subtractSorobanValues(withTransport, 1000000n);
      expect(final).toBe(12347255000n); // 1234.8255 - 0.10 = 1234.7255
      
      // Format final result
      const formatted = formatSorobanValue(final, 2);
      expect(formatted).toBe("1,239.23"); // Precise result without floating-point errors
    });

    it("calculates multi-step price adjustments", () => {
      // Start with 100.00
      let price = toSorobanValue("100");
      expect(price).toBe(1000000000n);
      
      // Apply 10% increase
      const increase = percentageOf(price, "10");
      price = addSorobanValues(price, increase);
      expect(formatSorobanValue(price, 2)).toBe("110.00");
      
      // Apply 5% decrease
      const decrease = percentageOf(price, "5");
      price = subtractSorobanValues(price, decrease);
      expect(formatSorobanValue(price, 2)).toBe("104.50");
    });

    it("handles multiple additions without accumulating errors", () => {
      // Add 0.1 ten times (should equal 1.0)
      let sum = 0n;
      for (let i = 0; i < 10; i++) {
        sum = addSorobanValues(sum, 1000000n);
      }
      expect(sum).toBe(10000000n);
      expect(formatSorobanValue(sum, 1)).toBe("1.0");
    });

    it("round-trips between formats without loss", () => {
      const original = "1234.5678901";
      const soroban = toSorobanValue(original);
      const formatted = formatSorobanValue(soroban, 7);
      expect(formatted).toBe("1,234.5678901"); // Maintains 7 decimals exactly
    });
  });

  describe("edge cases", () => {
    it("handles very small values", () => {
      const result = formatSorobanValue(1n, 7);
      expect(result).toBe("0.0000001");
    });

    it("handles very large values", () => {
      const large = 123456789012345n;
      const result = formatSorobanValue(large, 2);
      expect(result).toBe("12,345,678.90");
    });

    it("handles zero in all operations", () => {
      expect(formatSorobanValue(0n)).toBe("0.00");
      expect(addSorobanValues(0n, 0n)).toBe(0n);
      expect(subtractSorobanValues(0n, 0n)).toBe(0n);
      expect(multiplySorobanValues(0n, 10000000n)).toBe(0n);
      expect(percentageOf(0n, "50")).toBe(0n);
    });
  });
});
