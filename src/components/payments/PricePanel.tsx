"use client";

import { Decimal } from "@/src/utils/arithmetic";
import { useState } from "react";
import { useLocale } from "@/src/hooks/useLocale";

/**
 * Props for PricePanel component.
 */
export interface PricePanelProps {
  /** Current price in Soroban i128 format */
  price: bigint | string;
  /** Optional previous price for comparison */
  previousPrice?: bigint | string;
  /** Asset name or identifier */
  assetName: string;
  /** Display precision (default: 2) */
  precision?: 2 | 7;
  /** Optional unit label (default: "tokens") */
  unit?: string;
  /** Optional CSS class */
  className?: string;
}

/**
 * PricePanel displays asset prices with precise decimal formatting.
 * 
 * Shows current price, optional price change percentage, and supports
 * toggling between standard (2 decimal) and detailed (7 decimal) views.
 * 
 * All arithmetic is performed using the Decimal class to avoid
 * floating-point precision issues.
 * 
 * @example
 * <PricePanel
 *   price={12345600000n}
 *   previousPrice={12000000000n}
 *   assetName="Coffee Beans"
 *   precision={2}
 * />
 */
export default function PricePanel({
  price,
  previousPrice,
  assetName,
  precision: initialPrecision = 2,
  unit = "tokens",
  className = "",
}: PricePanelProps) {
  const { t } = useLocale();
  const [precision, setPrecision] = useState<2 | 7>(initialPrecision);

  // Convert price to Decimal
  const priceStr = typeof price === "bigint" ? price.toString() : price;
  const priceDecimal = new Decimal(priceStr, 7);
  const formattedPrice = priceDecimal.format(precision);

  // Calculate price change if previous price provided
  let priceChangePercent: string | null = null;
  let isIncrease = false;

  if (previousPrice !== undefined) {
    const prevPriceStr = typeof previousPrice === "bigint" ? previousPrice.toString() : previousPrice;
    const prevDecimal = new Decimal(prevPriceStr, 7);

    // Calculate: ((current - previous) / previous) * 100
    const difference = priceDecimal.sub(prevDecimal);
    const hundred = Decimal.fromString("100", 7);
    const changeDecimal = difference.div(prevDecimal).mul(hundred);

    priceChangePercent = changeDecimal.format(2);
    isIncrease = changeDecimal.gt(Decimal.fromString("0", 7));
  }

  const togglePrecision = () => {
    setPrecision(precision === 2 ? 7 : 2);
  };

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {assetName}
        </h3>
        <button
          onClick={togglePrecision}
          className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          title={t("price.switchView", { mode: precision === 2 ? "detailed" : "standard" })}
        >
          {precision === 2 ? t("price.showFull") : t("price.showLess")}
        </button>
      </div>

      {/* Price */}
      <div className="mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            {formattedPrice}
          </span>
          <span className="text-lg text-gray-500 dark:text-gray-400">
            {unit}
          </span>
        </div>
      </div>

      {/* Price Change */}
      {priceChangePercent !== null && (
        <div className="flex items-center gap-1">
          {isIncrease ? (
            <svg
              className="h-4 w-4 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"
              />
            </svg>
          )}
          <span
            className={`text-sm font-medium ${
              isIncrease
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {isIncrease ? "+" : ""}
            {priceChangePercent}%
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t("price.vsPrevious")}
          </span>
        </div>
      )}

      {/* Precision Indicator */}
      {precision === 7 && (
        <div className="mt-4 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {t("price.exactPrecision")}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Multi-asset price grid example.
 */
export function PriceGridExample() {
  const assets = [
    {
      name: "Coffee Beans",
      price: 12345600000n,
      previousPrice: 12000000000n,
    },
    {
      name: "Wheat",
      price: 8765400000n,
      previousPrice: 9000000000n,
    },
    {
      name: "Corn",
      price: 5432100000n,
      previousPrice: 5400000000n,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {assets.map((asset) => (
        <PricePanel
          key={asset.name}
          price={asset.price}
          previousPrice={asset.previousPrice}
          assetName={asset.name}
          precision={2}
        />
      ))}
    </div>
  );
}
