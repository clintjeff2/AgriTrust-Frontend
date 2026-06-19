/**
 * Decimal Arithmetic Usage Examples
 * 
 * This file demonstrates common usage patterns for the Decimal
 * precision system in AgriTrust-Frontend.
 */

import { Decimal } from '../src/utils/arithmetic';
import {
  formatSorobanValue,
  toSorobanValue,
  addSorobanValues,
  subtractSorobanValues,
  multiplySorobanValues,
  divideSorobanValues,
  percentageOf,
} from '../src/utils/number_scaler';

// =============================================================================
// Example 1: Basic Arithmetic Operations
// =============================================================================

export function example1_BasicArithmetic() {
  console.log('Example 1: Basic Arithmetic Operations\n');

  // Create Decimals from strings
  const a = Decimal.fromString("100.50", 7);
  const b = Decimal.fromString("25.25", 7);

  // Addition
  const sum = a.add(b);
  console.log(`${a.format(2)} + ${b.format(2)} = ${sum.format(2)}`);
  // Output: 100.50 + 25.25 = 125.75

  // Subtraction
  const diff = a.sub(b);
  console.log(`${a.format(2)} - ${b.format(2)} = ${diff.format(2)}`);
  // Output: 100.50 - 25.25 = 75.25

  // Multiplication
  const product = a.mul(Decimal.fromString("2", 7));
  console.log(`${a.format(2)} × 2 = ${product.format(2)}`);
  // Output: 100.50 × 2 = 201.00

  // Division
  const quotient = a.div(Decimal.fromString("4", 7));
  console.log(`${a.format(2)} ÷ 4 = ${quotient.format(2)}`);
  // Output: 100.50 ÷ 4 = 25.12
}

// =============================================================================
// Example 2: Soroban Conversions
// =============================================================================

export function example2_SorobanConversions() {
  console.log('\nExample 2: Soroban Conversions\n');

  // Convert user input to Soroban format
  const userInput = "1234.56";
  const sorobanValue = toSorobanValue(userInput);
  console.log(`User input "${userInput}" → Soroban: ${sorobanValue}`);
  // Output: User input "1234.56" → Soroban: 12345600000

  // Convert Soroban value to display
  const displayValue = formatSorobanValue(sorobanValue, 2);
  console.log(`Soroban ${sorobanValue} → Display: ${displayValue}`);
  // Output: Soroban 12345600000 → Display: 1,234.56

  // Detailed view (7 decimals)
  const detailedValue = formatSorobanValue(sorobanValue, 7);
  console.log(`Soroban ${sorobanValue} → Detailed: ${detailedValue}`);
  // Output: Soroban 12345600000 → Detailed: 1,234.5600000
}

// =============================================================================
// Example 3: Trade Settlement Calculation
// =============================================================================

export function example3_TradeSettlement() {
  console.log('\nExample 3: Trade Settlement Calculation\n');

  // Base price
  const basePrice = Decimal.fromString("1234.56", 7);
  console.log(`Base price: ${basePrice.format(2)}`);

  // Apply adjustments
  const qualityBonus = Decimal.fromString("0.50", 7);
  const transportFee = Decimal.fromString("0.2345", 7);
  const insuranceFee = Decimal.fromString("0.10", 7);

  // Calculate settlement
  let settlement = basePrice;
  settlement = settlement.add(qualityBonus);
  console.log(`+ Quality bonus: ${settlement.format(2)}`);

  settlement = settlement.sub(transportFee);
  console.log(`- Transport fee: ${settlement.format(2)}`);

  settlement = settlement.sub(insuranceFee);
  console.log(`- Insurance fee: ${settlement.format(2)}`);

  console.log(`\nFinal settlement: ${settlement.format(2)}`);
  console.log(`Detailed: ${settlement.format(7)}`);
  
  // Output:
  // Base price: 1,234.56
  // + Quality bonus: 1,235.06
  // - Transport fee: 1,234.83
  // - Insurance fee: 1,234.73
  // Final settlement: 1,234.73
  // Detailed: 1,234.7255000
}

// =============================================================================
// Example 4: Escrow Deposit Accumulation
// =============================================================================

export function example4_EscrowDeposits() {
  console.log('\nExample 4: Escrow Deposit Accumulation\n');

  // Initial balance
  let balance = toSorobanValue("5000.00");
  console.log(`Initial balance: ${formatSorobanValue(balance, 2)}`);

  // Multiple deposits
  const deposits = ["100.00", "250.50", "75.25"];
  
  for (const depositStr of deposits) {
    const deposit = toSorobanValue(depositStr);
    balance = addSorobanValues(balance, deposit);
    console.log(`+ Deposit ${formatSorobanValue(deposit, 2)}: Balance = ${formatSorobanValue(balance, 2)}`);
  }

  console.log(`\nFinal balance: ${formatSorobanValue(balance, 2)}`);
  
  // Output:
  // Initial balance: 5,000.00
  // + Deposit 100.00: Balance = 5,100.00
  // + Deposit 250.50: Balance = 5,350.50
  // + Deposit 75.25: Balance = 5,425.75
  // Final balance: 5,425.75
}

// =============================================================================
// Example 5: Percentage Calculations
// =============================================================================

export function example5_PercentageCalculations() {
  console.log('\nExample 5: Percentage Calculations\n');

  const amount = toSorobanValue("1000.00");
  console.log(`Base amount: ${formatSorobanValue(amount, 2)}`);

  // Calculate 2.5% fee
  const fee = percentageOf(amount, "2.5");
  console.log(`2.5% fee: ${formatSorobanValue(fee, 2)}`);

  // Calculate final amount after fee
  const final = subtractSorobanValues(amount, fee);
  console.log(`After fee: ${formatSorobanValue(final, 2)}`);

  // Calculate 10% bonus
  const bonus = percentageOf(amount, "10");
  console.log(`10% bonus: ${formatSorobanValue(bonus, 2)}`);

  // Calculate final amount with bonus
  const withBonus = addSorobanValues(amount, bonus);
  console.log(`With bonus: ${formatSorobanValue(withBonus, 2)}`);
  
  // Output:
  // Base amount: 1,000.00
  // 2.5% fee: 25.00
  // After fee: 975.00
  // 10% bonus: 100.00
  // With bonus: 1,100.00
}

// =============================================================================
// Example 6: Price Change Percentage
// =============================================================================

export function example6_PriceChangePercentage() {
  console.log('\nExample 6: Price Change Percentage\n');

  const currentPrice = Decimal.fromString("1234.56", 7);
  const previousPrice = Decimal.fromString("1200.00", 7);

  console.log(`Current price: ${currentPrice.format(2)}`);
  console.log(`Previous price: ${previousPrice.format(2)}`);

  // Calculate percentage change: ((current - previous) / previous) * 100
  const difference = currentPrice.sub(previousPrice);
  const hundred = Decimal.fromString("100", 7);
  const changePercent = difference.div(previousPrice).mul(hundred);

  console.log(`Change: ${changePercent.format(2)}%`);
  
  // Output:
  // Current price: 1,234.56
  // Previous price: 1,200.00
  // Change: +2.88%
}

// =============================================================================
// Example 7: Avoiding Floating-Point Errors
// =============================================================================

export function example7_AvoidingFloatingPointErrors() {
  console.log('\nExample 7: Avoiding Floating-Point Errors\n');

  // Vanilla JavaScript (has errors)
  console.log('Vanilla JavaScript:');
  const vanillaResult = 0.1 + 0.2;
  console.log(`0.1 + 0.2 = ${vanillaResult}`);
  console.log(`Expected: 0.3, Got: ${vanillaResult}`);
  console.log(`Equal to 0.3? ${vanillaResult === 0.3}`);

  // Using Decimal (precise)
  console.log('\nUsing Decimal:');
  const a = Decimal.fromString("0.1", 7);
  const b = Decimal.fromString("0.2", 7);
  const decimalResult = a.add(b);
  const expected = Decimal.fromString("0.3", 7);
  
  console.log(`0.1 + 0.2 = ${decimalResult.format(1)}`);
  console.log(`Equal to 0.3? ${decimalResult.equals(expected)}`);
  
  // Output:
  // Vanilla JavaScript:
  // 0.1 + 0.2 = 0.30000000000000004
  // Expected: 0.3, Got: 0.30000000000000004
  // Equal to 0.3? false
  //
  // Using Decimal:
  // 0.1 + 0.2 = 0.3
  // Equal to 0.3? true
}

// =============================================================================
// Example 8: Comparison Operations
// =============================================================================

export function example8_ComparisonOperations() {
  console.log('\nExample 8: Comparison Operations\n');

  const price1 = Decimal.fromString("100.50", 7);
  const price2 = Decimal.fromString("99.99", 7);
  const price3 = Decimal.fromString("100.50", 7);

  console.log(`price1: ${price1.format(2)}`);
  console.log(`price2: ${price2.format(2)}`);
  console.log(`price3: ${price3.format(2)}`);

  console.log(`\nComparisons:`);
  console.log(`price1 > price2: ${price1.gt(price2)}`);
  console.log(`price1 < price2: ${price1.lt(price2)}`);
  console.log(`price1 == price3: ${price1.equals(price3)}`);
  console.log(`price1 >= price3: ${price1.gte(price3)}`);
  console.log(`price2 <= price1: ${price2.lte(price1)}`);
  
  // Output:
  // price1: 100.50
  // price2: 99.99
  // price3: 100.50
  // Comparisons:
  // price1 > price2: true
  // price1 < price2: false
  // price1 == price3: true
  // price1 >= price3: true
  // price2 <= price1: true
}

// =============================================================================
// Example 9: Compound Interest Calculation
// =============================================================================

export function example9_CompoundInterest() {
  console.log('\nExample 9: Compound Interest Calculation\n');

  const principal = Decimal.fromString("1000.00", 7);
  const rate = Decimal.fromString("5", 7); // 5% per period
  const hundred = Decimal.fromString("100", 7);
  const periods = 3;

  console.log(`Principal: ${principal.format(2)}`);
  console.log(`Rate: ${rate.format(2)}% per period`);
  console.log(`Periods: ${periods}\n`);

  let amount = principal;
  for (let i = 1; i <= periods; i++) {
    const interest = amount.mul(rate).div(hundred);
    amount = amount.add(interest);
    console.log(`Period ${i}: ${amount.format(2)} (interest: ${interest.format(2)})`);
  }

  const totalInterest = amount.sub(principal);
  console.log(`\nTotal interest earned: ${totalInterest.format(2)}`);
  
  // Output:
  // Principal: 1,000.00
  // Rate: 5.00% per period
  // Periods: 3
  //
  // Period 1: 1,050.00 (interest: 50.00)
  // Period 2: 1,102.50 (interest: 52.50)
  // Period 3: 1,157.62 (interest: 55.12)
  //
  // Total interest earned: 157.62
}

// =============================================================================
// Example 10: Multi-Currency Conversion
// =============================================================================

export function example10_CurrencyConversion() {
  console.log('\nExample 10: Multi-Currency Conversion\n');

  const amountUSD = Decimal.fromString("100.00", 7);
  const exchangeRate = Decimal.fromString("1.18", 7); // 1 USD = 1.18 EUR

  console.log(`Amount (USD): ${amountUSD.format(2)}`);
  console.log(`Exchange rate: 1 USD = ${exchangeRate.format(2)} EUR`);

  const amountEUR = amountUSD.mul(exchangeRate);
  console.log(`Amount (EUR): ${amountEUR.format(2)}`);

  // Convert back
  const backToUSD = amountEUR.div(exchangeRate);
  console.log(`\nConverted back to USD: ${backToUSD.format(2)}`);
  console.log(`Matches original? ${backToUSD.equals(amountUSD)}`);
  
  // Output:
  // Amount (USD): 100.00
  // Exchange rate: 1 USD = 1.18 EUR
  // Amount (EUR): 118.00
  //
  // Converted back to USD: 100.00
  // Matches original? true
}

// =============================================================================
// Run All Examples
// =============================================================================

export function runAllExamples() {
  example1_BasicArithmetic();
  example2_SorobanConversions();
  example3_TradeSettlement();
  example4_EscrowDeposits();
  example5_PercentageCalculations();
  example6_PriceChangePercentage();
  example7_AvoidingFloatingPointErrors();
  example8_ComparisonOperations();
  example9_CompoundInterest();
  example10_CurrencyConversion();
}

// Uncomment to run examples:
// runAllExamples();
