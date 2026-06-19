# Decimal Precision System

## Overview

This document describes the arbitrary-precision decimal arithmetic system implemented to solve floating-point rounding errors in on-chain trade settlements. The system ensures exact precision for Soroban i128 7-decimal values.

## Problem Statement

Standard JavaScript floating-point arithmetic causes display inaccuracies:

```javascript
// ❌ Floating-point errors
0.1 + 0.2 === 0.30000000000000004  // true
123.456 * 1e7 === 1234560000.0000002  // true

// Multi-step calculations accumulate errors
let settlement = 1234.56;
settlement += 0.5;      // Quality bonus
settlement -= 0.2345;   // Transport fee
settlement -= 0.1;      // Insurance
// Result: 1234.7254999999999 (not 1234.7255)
```

These rounding errors cause price panels to show values that differ from actual on-chain settlements, eroding user trust.

## Solution: Decimal Class

### Architecture

The `Decimal` class implements string-based arbitrary-precision arithmetic:

- **Internal representation**: Scaled integer as string (e.g., `"12345600000"` with scale 7 = 1234.56)
- **Operations**: Addition, subtraction, multiplication, division using BigInt
- **Precision**: Exact to 7 decimal places (Soroban standard)
- **Performance**: 10,000+ operations per second

### Key Files

```
src/utils/
├── arithmetic.ts              # Core Decimal class
├── number_scaler.ts           # Soroban conversion utilities
└── __tests__/
    ├── arithmetic.test.ts            # Unit tests
    ├── arithmetic.property.test.ts   # Property-based tests
    ├── arithmetic.benchmark.test.ts  # Performance tests
    └── number_scaler.test.ts         # Utility tests

src/components/payments/
├── PayoutBreakdown.tsx        # Escrow payout display
├── PricePanel.tsx             # Price display with change %
└── __tests__/
    ├── PayoutBreakdown.test.tsx
    └── PricePanel.test.tsx

src/components/inventory/
└── InventoryCard.tsx          # Updated to use Decimal
```

## Usage

### Basic Operations

```typescript
import { Decimal } from '@/src/utils/arithmetic';

// Create from Soroban raw value
const price = Decimal.fromSoroban(12345600000n, 7); // 1234.56

// Create from string
const amount = Decimal.fromString("123.45", 7);

// Arithmetic operations
const sum = price.add(amount);
const diff = price.sub(amount);
const product = price.mul(amount);
const quotient = price.div(amount);

// Comparison
if (price.gt(amount)) {
  console.log("Price is greater");
}

// Format for display
console.log(price.format(2));  // "1,234.56"
console.log(price.format(7));  // "1,234.5600000"

// Convert back to Soroban
const raw = price.toSoroban();  // 12345600000n
```

### Soroban Utilities

```typescript
import {
  formatSorobanValue,
  toSorobanValue,
  addSorobanValues,
  subtractSorobanValues,
  multiplySorobanValues,
  divideSorobanValues,
  percentageOf,
} from '@/src/utils/number_scaler';

// Format Soroban value for display
const formatted = formatSorobanValue(12345600000n, 2);  // "1,234.56"

// Convert user input to Soroban
const soroban = toSorobanValue("123.45");  // 1234500000n

// Perform operations
const sum = addSorobanValues(10000000n, 5000000n);  // 15000000n (1.5)

// Calculate percentage
const fee = percentageOf(100000000n, "2.5");  // 2500000n (0.25)
```

### Components

#### PayoutBreakdown

Displays escrow payout breakdowns with line-item adjustments:

```tsx
import PayoutBreakdown from '@/src/components/payments/PayoutBreakdown';

<PayoutBreakdown
  basePrice={12345600000n}
  adjustments={[
    {
      label: "Quality Bonus",
      amount: 5000000n,
      type: "addition",
      description: "Premium quality produce"
    },
    {
      label: "Transport Fee",
      amount: 2345000n,
      type: "deduction",
      description: "Shipping and handling"
    }
  ]}
  precision={2}  // or 7 for detailed view
  title="Settlement Summary"
/>
```

#### PricePanel

Displays asset prices with change percentage:

```tsx
import PricePanel from '@/src/components/payments/PricePanel';

<PricePanel
  price={12345600000n}
  previousPrice={12000000000n}
  assetName="Coffee Beans"
  precision={2}
  unit="tokens"
/>
```

## Technical Specifications

### Precision

- **Display**: 2 decimals for user-facing UI
- **Detailed**: 7 decimals for breakdown views
- **On-chain**: 7 decimals (Soroban i128: 1.0000000 = 10_000_000)

### Performance

Target: **10,000 operations per second** on mobile devices

Benchmarks (measured):
- Additions: ~10,000 ops in <100ms
- Multiplications: ~10,000 ops in <100ms
- Format operations: ~10,000 ops in <100ms
- Multi-step calculations: ~1,000 ops in <10ms

### Invariants

1. **Exactness**: All arithmetic maintains exact precision
2. **Associativity**: (a + b) + c = a + (b + c)
3. **Commutativity**: a + b = b + a
4. **Round-trip**: `fromSoroban(x).toSoroban() === x`
5. **No artifacts**: No floating-point rounding errors

## Testing

### Test Coverage

- **Unit tests**: 70+ tests for core arithmetic
- **Property-based tests**: 1,000+ randomized inputs per property
- **Integration tests**: End-to-end workflow verification
- **Performance benchmarks**: 10,000 ops/sec validation
- **Component tests**: UI rendering and interaction

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test arithmetic.test.ts

# Run property-based tests (takes longer)
npm test arithmetic.property.test.ts

# Run performance benchmarks
npm test arithmetic.benchmark.test.ts
```

### Property-Based Testing

Uses `fast-check` to verify mathematical properties with randomized inputs:

```typescript
// Example: Addition is commutative
fc.assert(
  fc.property(sorobanI128(), sorobanI128(), (a, b) => {
    const decA = new Decimal(a.toString(), 7);
    const decB = new Decimal(b.toString(), 7);
    expect(decA.add(decB).equals(decB.add(decA))).toBe(true);
  }),
  { numRuns: 1000 }
);
```

## Migration Guide

### Updating Existing Code

**Before:**
```typescript
const balance = Number(data.balance);
const deposit = Number(deposit.amount);
const total = balance + deposit;
display.textContent = total.toFixed(2);
```

**After:**
```typescript
import { Decimal } from '@/src/utils/arithmetic';

const balance = Decimal.fromString(data.balance, 7);
const deposit = Decimal.fromString(deposit.amount, 7);
const total = balance.add(deposit);
display.textContent = total.format(2);
```

### Common Patterns

#### Accumulating values

```typescript
// ❌ Before
let sum = 0;
for (const item of items) {
  sum += Number(item.amount);
}

// ✅ After
let sum = Decimal.fromString("0", 7);
for (const item of items) {
  const amount = Decimal.fromString(item.amount, 7);
  sum = sum.add(amount);
}
```

#### Percentage calculations

```typescript
// ❌ Before
const fee = price * 0.025;  // 2.5% fee

// ✅ After
const price = Decimal.fromString(priceStr, 7);
const percentage = Decimal.fromString("2.5", 7);
const hundred = Decimal.fromString("100", 7);
const fee = price.mul(percentage).div(hundred);
```

## Best Practices

### Do's

✅ Use `Decimal` for all financial calculations
✅ Format with appropriate precision (2 for UI, 7 for detailed)
✅ Validate user input before converting to Decimal
✅ Use `fromSoroban` for on-chain values
✅ Test edge cases (zero, negative, very large/small)

### Don'ts

❌ Don't mix Decimal with Number arithmetic
❌ Don't use `toFixed()` on Number types
❌ Don't assume locale formatting (use `format()`)
❌ Don't perform division without considering precision
❌ Don't skip validation of user input strings

## Examples

### Trade Settlement

```typescript
const basePrice = Decimal.fromString("1234.56", 7);
const qualityBonus = Decimal.fromString("0.50", 7);
const transportFee = Decimal.fromString("0.2345", 7);
const insuranceFee = Decimal.fromString("0.10", 7);

const settlement = basePrice
  .add(qualityBonus)
  .sub(transportFee)
  .sub(insuranceFee);

console.log(settlement.format(2));   // "1,234.73"
console.log(settlement.format(7));   // "1,234.7255000"
```

### Escrow Deposits

```typescript
let balance = Decimal.fromSoroban(escrowBalance, 7);

for (const deposit of pendingDeposits) {
  const amount = Decimal.fromString(deposit.amount, 7);
  balance = balance.add(amount);
}

const formatted = balance.format(2);  // Display to user
const soroban = balance.toSoroban();   // Send to chain
```

### Price Change Percentage

```typescript
const current = Decimal.fromSoroban(currentPrice, 7);
const previous = Decimal.fromSoroban(previousPrice, 7);

const difference = current.sub(previous);
const hundred = Decimal.fromString("100", 7);
const changePercent = difference.div(previous).mul(hundred);

console.log(changePercent.format(2) + "%");  // "+2.88%"
```

## Troubleshooting

### Common Issues

**Issue**: `Invalid decimal value: "12.34"`
- **Cause**: Passing decimal string to constructor (expects scaled integer)
- **Fix**: Use `Decimal.fromString("12.34", 7)` instead

**Issue**: `Scale mismatch: 7 !== 6`
- **Cause**: Mixing Decimals with different scales
- **Fix**: Ensure all Decimals use same scale (7 for Soroban)

**Issue**: `Division by zero`
- **Cause**: Dividing by zero Decimal
- **Fix**: Check divisor before division:
  ```typescript
  if (!divisor.equals(Decimal.fromString("0", 7))) {
    result = dividend.div(divisor);
  }
  ```

## Performance Optimization

### Tips

1. **Reuse Decimal instances** when possible (they're immutable)
2. **Batch calculations** before formatting
3. **Cache formatted strings** for display
4. **Use appropriate precision** (don't format to 7 decimals if displaying 2)

### Measurement

```typescript
const start = performance.now();
for (let i = 0; i < 10000; i++) {
  // Your operation
}
const elapsed = performance.now() - start;
console.log(`10k operations: ${elapsed}ms`);
```

## References

- [Soroban Documentation](https://soroban.stellar.org/)
- [IEEE 754 Floating Point Issues](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html)
- [Arbitrary Precision Arithmetic](https://en.wikipedia.org/wiki/Arbitrary-precision_arithmetic)
- [fast-check Documentation](https://fast-check.dev/)

## Support

For issues or questions:
1. Check this documentation
2. Review test files for examples
3. Open an issue in the repository
