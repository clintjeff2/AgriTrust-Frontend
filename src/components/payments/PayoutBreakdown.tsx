"use client";

import { Decimal } from "@/src/utils/arithmetic";
import { formatSorobanValue } from "@/src/utils/number_scaler";

/**
 * Represents a line item in a payout breakdown.
 */
export interface PayoutLineItem {
  label: string;
  /** Raw Soroban i128 value (as bigint or string) */
  amount: bigint | string;
  /** Item type: addition or deduction */
  type: "addition" | "deduction";
  /** Optional description */
  description?: string;
}

/**
 * Props for PayoutBreakdown component.
 */
export interface PayoutBreakdownProps {
  /** Base price in Soroban i128 format */
  basePrice: bigint | string;
  /** Array of adjustments (quality, transport, insurance, etc.) */
  adjustments: PayoutLineItem[];
  /** Display precision (default: 2 for UI, 7 for detailed view) */
  precision?: 2 | 7;
  /** Optional title */
  title?: string;
  /** Optional CSS class */
  className?: string;
}

/**
 * PayoutBreakdown displays escrow payout breakdowns with precise decimal arithmetic.
 * 
 * Uses arbitrary-precision Decimal class to avoid floating-point rounding errors.
 * All calculations are performed using string-based arithmetic with exact precision.
 * 
 * @example
 * <PayoutBreakdown
 *   basePrice={12345600000n}
 *   adjustments={[
 *     { label: "Quality Bonus", amount: 5000000n, type: "addition" },
 *     { label: "Transport Fee", amount: 2000000n, type: "deduction" }
 *   ]}
 *   precision={2}
 * />
 */
export default function PayoutBreakdown({
  basePrice,
  adjustments,
  precision = 2,
  title = "Payout Breakdown",
  className = "",
}: PayoutBreakdownProps) {
  // Convert base price to Decimal for calculation
  const basePriceStr = typeof basePrice === "bigint" ? basePrice.toString() : basePrice;
  let runningTotal = new Decimal(basePriceStr, 7);

  // Calculate final total using precise decimal arithmetic
  const calculatedAdjustments = adjustments.map((item) => {
    const amountStr = typeof item.amount === "bigint" ? item.amount.toString() : item.amount;
    const decimal = new Decimal(amountStr, 7);

    if (item.type === "addition") {
      runningTotal = runningTotal.add(decimal);
    } else {
      runningTotal = runningTotal.sub(decimal);
    }

    return {
      ...item,
      formattedAmount: decimal.format(precision),
    };
  });

  const formattedBasePrice = new Decimal(basePriceStr, 7).format(precision);
  const formattedTotal = runningTotal.format(precision);

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      {/* Header */}
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>

      {/* Base Price */}
      <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Base Price
        </span>
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          {formattedBasePrice} tokens
        </span>
      </div>

      {/* Adjustments */}
      {calculatedAdjustments.length > 0 && (
        <div className="mb-3 space-y-2">
          {calculatedAdjustments.map((item, index) => (
            <div
              key={index}
              className="flex items-start justify-between"
              title={item.description}
            >
              <div className="flex-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {item.label}
                </span>
                {item.description && (
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-500">
                    {item.description}
                  </p>
                )}
              </div>
              <span
                className={`ml-4 text-sm font-medium ${
                  item.type === "addition"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {item.type === "addition" ? "+" : "-"}
                {item.formattedAmount} tokens
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      <div className="flex items-center justify-between border-t-2 border-gray-300 pt-3 dark:border-gray-600">
        <span className="text-base font-semibold text-gray-900 dark:text-white">
          Final Payout
        </span>
        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
          {formattedTotal} tokens
        </span>
      </div>

      {/* Precision indicator */}
      {precision === 7 && (
        <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <span className="font-medium">Detailed View:</span> Showing all 7
            decimal places for exact on-chain precision.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Example usage component demonstrating trade settlement calculations.
 */
export function TradeSettlementExample() {
  const basePrice = 12345600000n; // 1234.56 tokens

  const adjustments: PayoutLineItem[] = [
    {
      label: "Quality Adjustment",
      amount: 5000000n, // +0.50 tokens
      type: "addition",
      description: "Premium quality produce bonus",
    },
    {
      label: "Transport Deduction",
      amount: 2345000n, // -0.2345 tokens
      type: "deduction",
      description: "Shipping and handling fees",
    },
    {
      label: "Insurance Fee",
      amount: 1000000n, // -0.10 tokens
      type: "deduction",
      description: "Escrow insurance coverage",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Standard UI precision (2 decimals) */}
      <PayoutBreakdown
        basePrice={basePrice}
        adjustments={adjustments}
        precision={2}
        title="Settlement Summary"
      />

      {/* Detailed breakdown (7 decimals) */}
      <PayoutBreakdown
        basePrice={basePrice}
        adjustments={adjustments}
        precision={7}
        title="Detailed On-Chain Settlement"
      />
    </div>
  );
}
