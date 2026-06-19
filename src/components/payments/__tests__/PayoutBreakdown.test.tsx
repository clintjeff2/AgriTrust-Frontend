import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PayoutBreakdown, { PayoutLineItem } from "../PayoutBreakdown";

describe("PayoutBreakdown", () => {
  const basePrice = 12345600000n; // 1234.56 tokens

  const sampleAdjustments: PayoutLineItem[] = [
    {
      label: "Quality Adjustment",
      amount: 5000000n, // +0.50
      type: "addition",
      description: "Premium quality produce bonus",
    },
    {
      label: "Transport Deduction",
      amount: 2345000n, // -0.2345
      type: "deduction",
      description: "Shipping and handling fees",
    },
    {
      label: "Insurance Fee",
      amount: 1000000n, // -0.10
      type: "deduction",
      description: "Escrow insurance coverage",
    },
  ];

  describe("rendering", () => {
    it("renders title correctly", () => {
      render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={[]}
          title="Test Settlement"
        />
      );
      expect(screen.getByText("Test Settlement")).toBeInTheDocument();
    });

    it("displays base price with 2 decimal precision", () => {
      render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={[]}
          precision={2}
        />
      );
      expect(screen.getByText(/1,234\.56 tokens/)).toBeInTheDocument();
    });

    it("displays base price with 7 decimal precision", () => {
      render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={[]}
          precision={7}
        />
      );
      expect(screen.getByText(/1,234\.5600000 tokens/)).toBeInTheDocument();
    });

    it("renders all adjustment line items", () => {
      render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={sampleAdjustments}
          precision={2}
        />
      );

      expect(screen.getByText("Quality Adjustment")).toBeInTheDocument();
      expect(screen.getByText("Transport Deduction")).toBeInTheDocument();
      expect(screen.getByText("Insurance Fee")).toBeInTheDocument();
    });

    it("shows descriptions in title attribute", () => {
      render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={sampleAdjustments}
          precision={2}
        />
      );

      const qualityItem = screen.getByText("Quality Adjustment").closest("div");
      expect(qualityItem).toHaveAttribute("title", "Premium quality produce bonus");
    });

    it("displays precision indicator for 7 decimals", () => {
      render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={[]}
          precision={7}
        />
      );
      expect(
        screen.getByText(/Showing all 7 decimal places/)
      ).toBeInTheDocument();
    });

    it("does not display precision indicator for 2 decimals", () => {
      render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={[]}
          precision={2}
        />
      );
      expect(
        screen.queryByText(/Showing all 7 decimal places/)
      ).not.toBeInTheDocument();
    });
  });

  describe("arithmetic accuracy", () => {
    it("calculates final payout correctly with additions", () => {
      const adjustments: PayoutLineItem[] = [
        { label: "Bonus", amount: 5000000n, type: "addition" },
      ];

      render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={adjustments}
          precision={2}
        />
      );

      // 1234.56 + 0.50 = 1235.06
      expect(screen.getByText(/1,235\.06 tokens/)).toBeInTheDocument();
    });

    it("calculates final payout correctly with deductions", () => {
      const adjustments: PayoutLineItem[] = [
        { label: "Fee", amount: 5000000n, type: "deduction" },
      ];

      render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={adjustments}
          precision={2}
        />
      );

      // 1234.56 - 0.50 = 1234.06
      expect(screen.getByText(/1,234\.06 tokens/)).toBeInTheDocument();
    });

    it("calculates complex multi-step settlement accurately", () => {
      render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={sampleAdjustments}
          precision={2}
        />
      );

      // 1234.56 + 0.50 - 0.2345 - 0.10 = 1234.7255
      // Rounded to 2 decimals: 1234.73
      expect(screen.getByText(/1,234\.73 tokens/)).toBeInTheDocument();
    });

    it("maintains precision with 7 decimal display", () => {
      render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={sampleAdjustments}
          precision={7}
        />
      );

      // Exact result: 1234.7255000
      expect(screen.getByText(/1,234\.7255000 tokens/)).toBeInTheDocument();
    });

    it("handles negative base price", () => {
      render(
        <PayoutBreakdown
          basePrice={-10000000n}
          adjustments={[]}
          precision={2}
        />
      );

      expect(screen.getByText(/-1\.00 tokens/)).toBeInTheDocument();
    });

    it("handles zero base price", () => {
      render(
        <PayoutBreakdown
          basePrice={0n}
          adjustments={[]}
          precision={2}
        />
      );

      expect(screen.getByText(/0\.00 tokens/)).toBeInTheDocument();
    });
  });

  describe("adjustment formatting", () => {
    it("formats additions with plus sign and green color", () => {
      const adjustments: PayoutLineItem[] = [
        { label: "Bonus", amount: 5000000n, type: "addition" },
      ];

      const { container } = render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={adjustments}
          precision={2}
        />
      );

      const additionText = screen.getByText(/\+0\.50 tokens/);
      expect(additionText).toBeInTheDocument();
      expect(additionText).toHaveClass("text-green-600");
    });

    it("formats deductions with minus sign and red color", () => {
      const adjustments: PayoutLineItem[] = [
        { label: "Fee", amount: 5000000n, type: "deduction" },
      ];

      const { container } = render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={adjustments}
          precision={2}
        />
      );

      const deductionText = screen.getByText(/-0\.50 tokens/);
      expect(deductionText).toBeInTheDocument();
      expect(deductionText).toHaveClass("text-red-600");
    });
  });

  describe("string value support", () => {
    it("accepts string values for base price", () => {
      render(
        <PayoutBreakdown
          basePrice="12345600000"
          adjustments={[]}
          precision={2}
        />
      );

      expect(screen.getByText(/1,234\.56 tokens/)).toBeInTheDocument();
    });

    it("accepts string values for adjustments", () => {
      const adjustments: PayoutLineItem[] = [
        { label: "Bonus", amount: "5000000", type: "addition" },
      ];

      render(
        <PayoutBreakdown
          basePrice="12345600000"
          adjustments={adjustments}
          precision={2}
        />
      );

      expect(screen.getByText(/1,235\.06 tokens/)).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles empty adjustments array", () => {
      render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={[]}
          precision={2}
        />
      );

      expect(screen.getByText(/1,234\.56 tokens/)).toBeInTheDocument();
    });

    it("handles very small values", () => {
      render(
        <PayoutBreakdown
          basePrice={1n}
          adjustments={[]}
          precision={7}
        />
      );

      expect(screen.getByText(/0\.0000001 tokens/)).toBeInTheDocument();
    });

    it("handles very large values", () => {
      const large = 123456789012345n;
      render(
        <PayoutBreakdown
          basePrice={large}
          adjustments={[]}
          precision={2}
        />
      );

      expect(screen.getByText(/12,345,678\.90 tokens/)).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(
        <PayoutBreakdown
          basePrice={basePrice}
          adjustments={[]}
          className="custom-class"
        />
      );

      const root = container.firstChild;
      expect(root).toHaveClass("custom-class");
    });
  });

  describe("no floating-point errors", () => {
    it("avoids 0.1 + 0.2 rounding error", () => {
      const adjustments: PayoutLineItem[] = [
        { label: "A", amount: 1000000n, type: "addition" }, // 0.1
        { label: "B", amount: 2000000n, type: "addition" }, // 0.2
      ];

      render(
        <PayoutBreakdown
          basePrice={0n}
          adjustments={adjustments}
          precision={1}
        />
      );

      // Should be exactly 0.3, not 0.30000000000000004
      expect(screen.getByText(/0\.3 tokens/)).toBeInTheDocument();
    });

    it("handles accumulated rounding correctly", () => {
      // Multiple small deductions
      const adjustments: PayoutLineItem[] = [
        { label: "Fee 1", amount: 1111111n, type: "deduction" },
        { label: "Fee 2", amount: 2222222n, type: "deduction" },
        { label: "Fee 3", amount: 3333333n, type: "deduction" },
      ];

      render(
        <PayoutBreakdown
          basePrice={100000000n} // 10.0
          adjustments={adjustments}
          precision={7}
        />
      );

      // 10.0 - 0.1111111 - 0.2222222 - 0.3333333 = 9.3333334
      expect(screen.getByText(/9\.3333334 tokens/)).toBeInTheDocument();
    });
  });
});
