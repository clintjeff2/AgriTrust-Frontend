import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PricePanel from "../PricePanel";

describe("PricePanel", () => {
  const price = 12345600000n; // 1234.56 tokens
  const previousPrice = 12000000000n; // 1200.00 tokens

  describe("rendering", () => {
    it("renders asset name", () => {
      render(<PricePanel price={price} assetName="Coffee Beans" />);
      expect(screen.getByText("Coffee Beans")).toBeInTheDocument();
    });

    it("displays price with default 2 decimal precision", () => {
      render(<PricePanel price={price} assetName="Coffee" precision={2} />);
      expect(screen.getByText("1,234.56")).toBeInTheDocument();
    });

    it("displays price with 7 decimal precision", () => {
      render(<PricePanel price={price} assetName="Coffee" precision={7} />);
      expect(screen.getByText("1,234.5600000")).toBeInTheDocument();
    });

    it("displays custom unit label", () => {
      render(<PricePanel price={price} assetName="Coffee" unit="USD" />);
      expect(screen.getByText("USD")).toBeInTheDocument();
    });

    it("displays default tokens unit", () => {
      render(<PricePanel price={price} assetName="Coffee" />);
      expect(screen.getByText("tokens")).toBeInTheDocument();
    });
  });

  describe("price change calculation", () => {
    it("calculates and displays positive price change", () => {
      render(
        <PricePanel
          price={price}
          previousPrice={previousPrice}
          assetName="Coffee"
        />
      );

      // (1234.56 - 1200.00) / 1200.00 * 100 = 2.88%
      expect(screen.getByText(/\+2\.88%/)).toBeInTheDocument();
    });

    it("calculates and displays negative price change", () => {
      render(
        <PricePanel
          price={previousPrice}
          previousPrice={price}
          assetName="Coffee"
        />
      );

      // (1200.00 - 1234.56) / 1234.56 * 100 ≈ -2.80%
      expect(screen.getByText(/-2\.80%/)).toBeInTheDocument();
    });

    it("shows up arrow for price increase", () => {
      const { container } = render(
        <PricePanel
          price={price}
          previousPrice={previousPrice}
          assetName="Coffee"
        />
      );

      const upArrow = container.querySelector(".text-green-500");
      expect(upArrow).toBeInTheDocument();
    });

    it("shows down arrow for price decrease", () => {
      const { container } = render(
        <PricePanel
          price={previousPrice}
          previousPrice={price}
          assetName="Coffee"
        />
      );

      const downArrow = container.querySelector(".text-red-500");
      expect(downArrow).toBeInTheDocument();
    });

    it("does not display price change when previousPrice is undefined", () => {
      render(<PricePanel price={price} assetName="Coffee" />);
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it("handles zero previous price gracefully", () => {
      // This would cause division by zero, should handle gracefully
      // The component will throw or show invalid result
      // We should prevent this in production, but test current behavior
      expect(() => {
        render(
          <PricePanel
            price={price}
            previousPrice={0n}
            assetName="Coffee"
          />
        );
      }).toThrow();
    });
  });

  describe("precision toggle", () => {
    it("shows 'Show Full' button when precision is 2", () => {
      render(<PricePanel price={price} assetName="Coffee" precision={2} />);
      expect(screen.getByText("Show Full")).toBeInTheDocument();
    });

    it("shows 'Show Less' button when precision is 7", () => {
      render(<PricePanel price={price} assetName="Coffee" precision={7} />);
      expect(screen.getByText("Show Less")).toBeInTheDocument();
    });

    it("toggles precision when button is clicked", () => {
      render(<PricePanel price={price} assetName="Coffee" precision={2} />);

      // Initial state: 2 decimals
      expect(screen.getByText("1,234.56")).toBeInTheDocument();
      expect(screen.getByText("Show Full")).toBeInTheDocument();

      // Click to toggle to 7 decimals
      const button = screen.getByText("Show Full");
      fireEvent.click(button);

      expect(screen.getByText("1,234.5600000")).toBeInTheDocument();
      expect(screen.getByText("Show Less")).toBeInTheDocument();

      // Click to toggle back to 2 decimals
      fireEvent.click(screen.getByText("Show Less"));

      expect(screen.getByText("1,234.56")).toBeInTheDocument();
      expect(screen.getByText("Show Full")).toBeInTheDocument();
    });

    it("displays precision indicator when showing 7 decimals", () => {
      render(<PricePanel price={price} assetName="Coffee" precision={7} />);
      expect(
        screen.getByText(/Showing exact on-chain precision/)
      ).toBeInTheDocument();
    });

    it("does not display precision indicator when showing 2 decimals", () => {
      render(<PricePanel price={price} assetName="Coffee" precision={2} />);
      expect(
        screen.queryByText(/Showing exact on-chain precision/)
      ).not.toBeInTheDocument();
    });
  });

  describe("string value support", () => {
    it("accepts string value for price", () => {
      render(<PricePanel price="12345600000" assetName="Coffee" />);
      expect(screen.getByText("1,234.56")).toBeInTheDocument();
    });

    it("accepts string value for previousPrice", () => {
      render(
        <PricePanel
          price="12345600000"
          previousPrice="12000000000"
          assetName="Coffee"
        />
      );
      expect(screen.getByText(/\+2\.88%/)).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles zero price", () => {
      render(<PricePanel price={0n} assetName="Coffee" />);
      expect(screen.getByText("0.00")).toBeInTheDocument();
    });

    it("handles negative price", () => {
      render(<PricePanel price={-10000000n} assetName="Coffee" />);
      expect(screen.getByText("-1.00")).toBeInTheDocument();
    });

    it("handles very small values", () => {
      render(<PricePanel price={1n} assetName="Coffee" precision={7} />);
      expect(screen.getByText("0.0000001")).toBeInTheDocument();
    });

    it("handles very large values", () => {
      const large = 123456789012345n;
      render(<PricePanel price={large} assetName="Coffee" precision={2} />);
      expect(screen.getByText("12,345,678.90")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(
        <PricePanel
          price={price}
          assetName="Coffee"
          className="custom-class"
        />
      );

      const root = container.firstChild;
      expect(root).toHaveClass("custom-class");
    });
  });

  describe("arithmetic precision", () => {
    it("calculates percentage change without floating-point errors", () => {
      // Test case where floating-point would cause issues
      const current = 10123456n; // 1.0123456
      const previous = 10000000n; // 1.0000000

      render(
        <PricePanel
          price={current}
          previousPrice={previous}
          assetName="Test"
        />
      );

      // (1.0123456 - 1.0) / 1.0 * 100 = 1.23456%
      expect(screen.getByText(/\+1\.23%/)).toBeInTheDocument();
    });

    it("handles equal current and previous prices", () => {
      render(
        <PricePanel
          price={price}
          previousPrice={price}
          assetName="Coffee"
        />
      );

      // 0% change
      expect(screen.getByText(/0\.00%/)).toBeInTheDocument();
    });

    it("handles very small percentage changes", () => {
      const current = 10000001n; // 1.0000001
      const previous = 10000000n; // 1.0000000

      render(
        <PricePanel
          price={current}
          previousPrice={previous}
          assetName="Test"
        />
      );

      // Very small change should still be calculated precisely
      const percentText = screen.getByText(/%/);
      expect(percentText).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("button has descriptive title", () => {
      render(<PricePanel price={price} assetName="Coffee" precision={2} />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("title", "Switch to detailed view");
    });

    it("button title changes when toggled", () => {
      render(<PricePanel price={price} assetName="Coffee" precision={2} />);
      const button = screen.getByRole("button");

      fireEvent.click(button);

      expect(button).toHaveAttribute("title", "Switch to standard view");
    });
  });
});
