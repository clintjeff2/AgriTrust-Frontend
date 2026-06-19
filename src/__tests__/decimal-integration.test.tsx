import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Decimal } from "@/src/utils/arithmetic";
import {
  formatSorobanValue,
  toSorobanValue,
  addSorobanValues,
} from "@/src/utils/number_scaler";
import PayoutBreakdown, {
  PayoutLineItem,
} from "@/src/components/payments/PayoutBreakdown";
import PricePanel from "@/src/components/payments/PricePanel";

/**
 * Integration tests verifying end-to-end decimal precision
 * across the entire application stack.
 */

describe("Decimal Arithmetic Integration", () => {
  describe("end-to-end trade settlement workflow", () => {
    it("calculates accurate settlement from user input to display", () => {
      // Step 1: User inputs base price as string
      const basePriceInput = "1234.56";
      const basePriceSoroban = toSorobanValue(basePriceInput);
      expect(basePriceSoroban).toBe(12345600000n);

      // Step 2: System applies adjustments
      const qualityBonus = toSorobanValue("0.50");
      const transportFee = toSorobanValue("0.2345");
      const insuranceFee = toSorobanValue("0.10");

      // Step 3: Calculate settlement on-chain
      let settlement = basePriceSoroban;
      settlement = addSorobanValues(settlement, qualityBonus);
      settlement = addSorobanValues(settlement, -transportFee);
      settlement = addSorobanValues(settlement, -insuranceFee);

      // Step 4: Display to user
      const formatted = formatSorobanValue(settlement, 2);
      expect(formatted).toBe("1,234.73");

      // Step 5: Detailed view
      const detailed = formatSorobanValue(settlement, 7);
      expect(detailed).toBe("1,234.7255000");

      // Verify no floating-point errors accumulated
      // In vanilla JS: 1234.56 + 0.5 - 0.2345 - 0.1 would have artifacts
      const expectedSoroban = 12347255000n;
      expect(settlement).toBe(expectedSoroban);
    });

    it("renders complete payout breakdown accurately", () => {
      const basePrice = toSorobanValue("1234.56");
      const adjustments: PayoutLineItem[] = [
        {
          label: "Quality Bonus",
          amount: toSorobanValue("0.50"),
          type: "addition",
        },
        {
          label: "Transport Fee",
          amount: toSorobanValue("0.2345"),
          type: "deduction",
        },
        {
          label: "Insurance Fee",
          amount: toSorobanValue("0.10"),
          type: "deduction",
        },
      ];

      render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={adjustments}
          precision={2}
        />
      );

      // Verify all values are displayed correctly
      expect(screen.getByText(/1,234\.56 tokens/)).toBeInTheDocument(); // Base
      expect(screen.getByText(/\+0\.50 tokens/)).toBeInTheDocument(); // Quality
      expect(screen.getByText(/-0\.23 tokens/)).toBeInTheDocument(); // Transport (rounded)
      expect(screen.getByText(/-0\.10 tokens/)).toBeInTheDocument(); // Insurance
      expect(screen.getByText(/1,234\.73 tokens/)).toBeInTheDocument(); // Final
    });

    it("renders price panel with accurate percentage change", () => {
      const currentPrice = toSorobanValue("1234.56");
      const previousPrice = toSorobanValue("1200.00");

      render(
        <PricePanel
          price={currentPrice}
          previousPrice={previousPrice}
          assetName="Coffee Beans"
        />
      );

      // Verify price and change are displayed
      expect(screen.getByText("1,234.56")).toBeInTheDocument();
      expect(screen.getByText(/\+2\.88%/)).toBeInTheDocument();
    });
  });

  describe("multi-step escrow calculations", () => {
    it("handles complex escrow deposit workflow", () => {
      // Initial balance
      let balance = toSorobanValue("5000.00");

      // User makes multiple deposits
      const deposits = ["100.00", "250.50", "75.25"];

      for (const deposit of deposits) {
        const depositAmount = toSorobanValue(deposit);
        balance = addSorobanValues(balance, depositAmount);
      }

      // Final balance should be exact
      const expectedBalance = toSorobanValue("5425.75");
      expect(balance).toBe(expectedBalance);

      // Display should be accurate
      const formatted = formatSorobanValue(balance, 2);
      expect(formatted).toBe("5,425.75");
    });

    it("accumulates pending deposits without rounding errors", () => {
      const deposits = [
        toSorobanValue("0.1"),
        toSorobanValue("0.1"),
        toSorobanValue("0.1"),
        toSorobanValue("0.1"),
        toSorobanValue("0.1"),
        toSorobanValue("0.1"),
        toSorobanValue("0.1"),
        toSorobanValue("0.1"),
        toSorobanValue("0.1"),
        toSorobanValue("0.1"),
      ];

      let total = 0n;
      for (const deposit of deposits) {
        total = addSorobanValues(total, deposit);
      }

      // Should equal exactly 1.0, not 0.9999999999 or 1.0000000001
      expect(total).toBe(10000000n);
      expect(formatSorobanValue(total, 1)).toBe("1.0");
    });
  });

  describe("price calculation scenarios", () => {
    it("handles percentage-based fee calculations", () => {
      const baseAmount = toSorobanValue("1000.00");

      // Calculate 2.5% fee
      const feePercentage = Decimal.fromString("2.5", 7);
      const hundred = Decimal.fromString("100", 7);
      const baseDecimal = Decimal.fromSoroban(baseAmount, 7);

      const fee = baseDecimal.mul(feePercentage).div(hundred);
      const feeSoroban = fee.toSoroban();

      // 2.5% of 1000 = 25
      expect(formatSorobanValue(feeSoroban, 2)).toBe("25.00");

      // Subtract fee from base
      const final = baseDecimal.sub(fee);
      expect(final.format(2)).toBe("975.00");
    });

    it("calculates compound adjustments accurately", () => {
      let price = Decimal.fromString("100.00", 7);

      // Apply 10% increase
      const ten = Decimal.fromString("10", 7);
      const hundred = Decimal.fromString("100", 7);
      const increase = price.mul(ten).div(hundred);
      price = price.add(increase);
      expect(price.format(2)).toBe("110.00");

      // Apply 5% decrease
      const five = Decimal.fromString("5", 7);
      const decrease = price.mul(five).div(hundred);
      price = price.sub(decrease);
      expect(price.format(2)).toBe("104.50");

      // Apply 2% increase
      const two = Decimal.fromString("2", 7);
      const finalIncrease = price.mul(two).div(hundred);
      price = price.add(finalIncrease);
      expect(price.format(2)).toBe("106.59");
    });
  });

  describe("edge cases in real workflow", () => {
    it("handles very small transaction amounts", () => {
      const microPayment = toSorobanValue("0.0000001");
      expect(microPayment).toBe(1n);
      expect(formatSorobanValue(microPayment, 7)).toBe("0.0000001");
    });

    it("handles very large escrow balances", () => {
      const largeBalance = toSorobanValue("999999999.9999999");
      expect(formatSorobanValue(largeBalance, 2)).toBe("1,000,000,000.00");
    });

    it("handles zero-value transactions", () => {
      const zero = toSorobanValue("0");
      expect(zero).toBe(0n);
      expect(formatSorobanValue(zero, 2)).toBe("0.00");
    });

    it("handles negative adjustments (refunds)", () => {
      const balance = toSorobanValue("100.00");
      const refund = toSorobanValue("-25.50");

      const balanceDecimal = Decimal.fromSoroban(balance, 7);
      const refundDecimal = Decimal.fromSoroban(refund, 7);
      const final = balanceDecimal.add(refundDecimal);

      expect(final.format(2)).toBe("74.50");
    });
  });

  describe("cross-component consistency", () => {
    it("shows consistent values across PricePanel and PayoutBreakdown", () => {
      const price = toSorobanValue("1234.56");

      // Render both components with same value
      const { container: priceContainer } = render(
        <PricePanel price={price} assetName="Test" precision={2} />
      );

      const { container: payoutContainer } = render(
        <PayoutBreakdown basePrice={price} adjustments={[]} precision={2} />
      );

      // Both should display the same formatted value
      const priceText = priceContainer.textContent;
      const payoutText = payoutContainer.textContent;

      expect(priceText).toContain("1,234.56");
      expect(payoutText).toContain("1,234.56");
    });

    it("maintains precision through component updates", () => {
      const initialPrice = toSorobanValue("100.00");
      const adjustment = toSorobanValue("0.33");

      let currentPrice = initialPrice;
      for (let i = 0; i < 3; i++) {
        currentPrice = addSorobanValues(currentPrice, adjustment);
      }

      // 100 + 0.33 + 0.33 + 0.33 = 100.99
      const { rerender } = render(
        <PricePanel price={currentPrice} assetName="Test" precision={2} />
      );

      expect(screen.getByText("100.99")).toBeInTheDocument();

      // Update with another adjustment
      const updatedPrice = addSorobanValues(currentPrice, adjustment);
      rerender(<PricePanel price={updatedPrice} assetName="Test" precision={2} />);

      // 100.99 + 0.33 = 101.32
      expect(screen.getByText("101.32")).toBeInTheDocument();
    });
  });

  describe("floating-point comparison", () => {
    it("demonstrates superiority over vanilla JavaScript arithmetic", () => {
      // Vanilla JS (would have errors)
      const vanillaResult = 0.1 + 0.2;
      expect(vanillaResult).not.toBe(0.3); // Fails with floating-point
      expect(vanillaResult).toBe(0.30000000000000004);

      // Decimal arithmetic (precise)
      const decimalA = Decimal.fromString("0.1", 7);
      const decimalB = Decimal.fromString("0.2", 7);
      const decimalResult = decimalA.add(decimalB);
      const expected = Decimal.fromString("0.3", 7);

      expect(decimalResult.equals(expected)).toBe(true);
      expect(decimalResult.format(1)).toBe("0.3");
    });

    it("maintains precision through multiple operations", () => {
      // Vanilla JS accumulates errors
      let vanillaSum = 0;
      for (let i = 0; i < 10; i++) {
        vanillaSum += 0.1;
      }
      expect(vanillaSum).not.toBe(1.0);
      expect(vanillaSum).toBeCloseTo(1.0, 10); // Close but not exact

      // Decimal arithmetic stays exact
      let decimalSum = Decimal.fromString("0", 7);
      const pointOne = Decimal.fromString("0.1", 7);
      for (let i = 0; i < 10; i++) {
        decimalSum = decimalSum.add(pointOne);
      }
      const one = Decimal.fromString("1.0", 7);
      expect(decimalSum.equals(one)).toBe(true);
      expect(decimalSum.format(1)).toBe("1.0");
    });
  });
});
