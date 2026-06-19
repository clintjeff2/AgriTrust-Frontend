/**
 * Number scaling utilities for Soroban 7-decimal precision.
 * 
 * Provides convenience functions for common scaling operations
 * using the Decimal class for precision-safe arithmetic.
 */

import { Decimal } from './arithmetic';

/** Default Soroban decimal places */
export const SOROBAN_DECIMALS = 7;

/** Scaling factor for Soroban (10^7) */
export const SOROBAN_SCALE_FACTOR = 10_000_000;

/**
 * Formats a Soroban i128 value as a human-readable string.
 * 
 * @param rawValue - Raw i128 value from Soroban (as bigint or string)
 * @param decimals - Display decimal places (default: 2)
 * @param locale - Locale for formatting (default: "en-US")
 * @returns Formatted string (e.g., "1,234.56")
 * 
 * @example
 * formatSorobanValue(12345600000n) // "1,234.56"
 * formatSorobanValue("12345600000", 7) // "1,234.5600000"
 */
export function formatSorobanValue(
  rawValue: bigint | string,
  decimals: number = 2,
  locale: string = "en-US"
): string {
  const valueStr = typeof rawValue === 'bigint' ? rawValue.toString() : rawValue;
  const decimal = new Decimal(valueStr, SOROBAN_DECIMALS);
  return decimal.format(decimals, locale);
}

/**
 * Converts a human-readable decimal string to a Soroban i128 value.
 * 
 * @param humanValue - Decimal string (e.g., "123.45")
 * @returns Raw i128 value as bigint
 * 
 * @example
 * toSorobanValue("1.23") // 12300000n
 * toSorobanValue("0.1") // 1000000n
 */
export function toSorobanValue(humanValue: string): bigint {
  const decimal = Decimal.fromString(humanValue, SOROBAN_DECIMALS);
  return decimal.toSoroban();
}

/**
 * Safely adds two Soroban values with precision.
 * 
 * @param a - First value (bigint or string)
 * @param b - Second value (bigint or string)
 * @returns Sum as bigint
 * 
 * @example
 * addSorobanValues(1000000n, 2000000n) // 3000000n (0.1 + 0.2 = 0.3)
 */
export function addSorobanValues(
  a: bigint | string,
  b: bigint | string
): bigint {
  const aStr = typeof a === 'bigint' ? a.toString() : a;
  const bStr = typeof b === 'bigint' ? b.toString() : b;
  
  const decimalA = new Decimal(aStr, SOROBAN_DECIMALS);
  const decimalB = new Decimal(bStr, SOROBAN_DECIMALS);
  
  return decimalA.add(decimalB).toSoroban();
}

/**
 * Safely subtracts two Soroban values with precision.
 * 
 * @param a - First value (bigint or string)
 * @param b - Second value (bigint or string)
 * @returns Difference as bigint
 */
export function subtractSorobanValues(
  a: bigint | string,
  b: bigint | string
): bigint {
  const aStr = typeof a === 'bigint' ? a.toString() : a;
  const bStr = typeof b === 'bigint' ? b.toString() : b;
  
  const decimalA = new Decimal(aStr, SOROBAN_DECIMALS);
  const decimalB = new Decimal(bStr, SOROBAN_DECIMALS);
  
  return decimalA.sub(decimalB).toSoroban();
}

/**
 * Safely multiplies two Soroban values with precision.
 * 
 * @param a - First value (bigint or string)
 * @param b - Second value (bigint or string)
 * @returns Product as bigint
 */
export function multiplySorobanValues(
  a: bigint | string,
  b: bigint | string
): bigint {
  const aStr = typeof a === 'bigint' ? a.toString() : a;
  const bStr = typeof b === 'bigint' ? b.toString() : b;
  
  const decimalA = new Decimal(aStr, SOROBAN_DECIMALS);
  const decimalB = new Decimal(bStr, SOROBAN_DECIMALS);
  
  return decimalA.mul(decimalB).toSoroban();
}

/**
 * Safely divides two Soroban values with precision.
 * 
 * @param a - Dividend (bigint or string)
 * @param b - Divisor (bigint or string)
 * @returns Quotient as bigint
 * @throws Error if divisor is zero
 */
export function divideSorobanValues(
  a: bigint | string,
  b: bigint | string
): bigint {
  const aStr = typeof a === 'bigint' ? a.toString() : a;
  const bStr = typeof b === 'bigint' ? b.toString() : b;
  
  const decimalA = new Decimal(aStr, SOROBAN_DECIMALS);
  const decimalB = new Decimal(bStr, SOROBAN_DECIMALS);
  
  return decimalA.div(decimalB).toSoroban();
}

/**
 * Calculates a percentage of a Soroban value.
 * 
 * @param value - Base value (bigint or string)
 * @param percentage - Percentage (e.g., 5 for 5%, as decimal string)
 * @returns Result as bigint
 * 
 * @example
 * percentageOf(10000000n, "10") // 1000000n (10% of 1.0 = 0.1)
 */
export function percentageOf(
  value: bigint | string,
  percentage: string
): bigint {
  const valueStr = typeof value === 'bigint' ? value.toString() : value;
  const decimalValue = new Decimal(valueStr, SOROBAN_DECIMALS);
  const percentageDecimal = Decimal.fromString(percentage, SOROBAN_DECIMALS);
  const hundred = Decimal.fromString("100", SOROBAN_DECIMALS);
  
  return decimalValue.mul(percentageDecimal).div(hundred).toSoroban();
}
