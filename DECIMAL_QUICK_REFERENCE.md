# Decimal Arithmetic - Quick Reference Card

## 📥 Import

```typescript
import { Decimal } from '@/src/utils/arithmetic';
import { formatSorobanValue, toSorobanValue } from '@/src/utils/number_scaler';
```

## 🎨 Create Decimals

```typescript
// From string
const a = Decimal.fromString("123.45", 7);

// From Soroban i128
const b = Decimal.fromSoroban(12345600000n, 7);

// From constructor (scaled integer)
const c = new Decimal("12345600000", 7);
```

## ➕ Arithmetic

```typescript
const a = Decimal.fromString("100", 7);
const b = Decimal.fromString("25", 7);

a.add(b)    // 125
a.sub(b)    // 75
a.mul(b)    // 2500
a.div(b)    // 4
```

## 📊 Comparison

```typescript
a.equals(b)  // false
a.lt(b)      // false (less than)
a.lte(b)     // false (less than or equal)
a.gt(b)      // true (greater than)
a.gte(b)     // true (greater than or equal)
a.compareTo(b) // 1 (returns -1, 0, or 1)
```

## 💱 Conversions

```typescript
// To Soroban
const soroban = decimal.toSoroban();  // bigint

// Format for display
const ui = decimal.format(2);        // "1,234.56"
const detailed = decimal.format(7);  // "1,234.5600000"

// Get raw value
const raw = decimal.toString();      // "12345600000"
```

## 🔧 Utility Functions

```typescript
// Format Soroban value
formatSorobanValue(12345600000n, 2)  // "1,234.56"

// User input → Soroban
toSorobanValue("123.45")  // 1234500000n

// Percentage
percentageOf(10000000n, "10")  // 1000000n (10% of 1.0)
```

## 🎯 Common Patterns

### Trade Settlement
```typescript
const basePrice = Decimal.fromString("1234.56", 7);
const final = basePrice
  .add(Decimal.fromString("0.50", 7))
  .sub(Decimal.fromString("0.23", 7));
console.log(final.format(2));  // "1,234.83"
```

### Accumulate Deposits
```typescript
let balance = Decimal.fromString("0", 7);
for (const deposit of deposits) {
  balance = balance.add(Decimal.fromString(deposit, 7));
}
```

### Calculate Fee (2.5%)
```typescript
const amount = Decimal.fromString("100", 7);
const rate = Decimal.fromString("2.5", 7);
const hundred = Decimal.fromString("100", 7);
const fee = amount.mul(rate).div(hundred);
```

### Price Change %
```typescript
const current = Decimal.fromSoroban(currentPrice, 7);
const previous = Decimal.fromSoroban(previousPrice, 7);
const hundred = Decimal.fromString("100", 7);
const change = current.sub(previous).div(previous).mul(hundred);
```

## 🚫 Don't Do This

```typescript
// ❌ Don't use Number
const bad = Number(value) + Number(other);

// ❌ Don't use toFixed
const bad = value.toFixed(2);

// ❌ Don't mix scales
const a = new Decimal("100", 7);
const b = new Decimal("100", 6);
a.add(b);  // Throws error!

// ❌ Don't divide by zero
a.div(Decimal.fromString("0", 7));  // Throws error!
```

## ✅ Do This Instead

```typescript
// ✅ Use Decimal
const good = Decimal.fromString(value, 7)
  .add(Decimal.fromString(other, 7));

// ✅ Use format
const good = decimal.format(2);

// ✅ Same scale
const a = new Decimal("100", 7);
const b = new Decimal("100", 7);
a.add(b);  // ✅

// ✅ Check before divide
if (!divisor.equals(Decimal.fromString("0", 7))) {
  result = dividend.div(divisor);
}
```

## 🎨 Component Usage

### PayoutBreakdown
```tsx
<PayoutBreakdown
  basePrice={12345600000n}
  adjustments={[
    { label: "Bonus", amount: 5000000n, type: "addition" },
    { label: "Fee", amount: 2000000n, type: "deduction" }
  ]}
  precision={2}
/>
```

### PricePanel
```tsx
<PricePanel
  price={12345600000n}
  previousPrice={12000000000n}
  assetName="Coffee Beans"
  precision={2}
/>
```

## 📏 Constants

```typescript
import { SOROBAN_DECIMALS, SOROBAN_SCALE_FACTOR } from '@/src/utils/number_scaler';

SOROBAN_DECIMALS     // 7
SOROBAN_SCALE_FACTOR // 10_000_000
```

## 🐛 Common Errors

### "Invalid decimal value"
```typescript
// ❌ Wrong
new Decimal("12.34", 7)

// ✅ Right
Decimal.fromString("12.34", 7)
```

### "Scale mismatch"
```typescript
// ❌ Wrong
const a = new Decimal("100", 7);
const b = new Decimal("100", 6);
a.add(b);

// ✅ Right (same scale)
const a = new Decimal("100", 7);
const b = new Decimal("100", 7);
a.add(b);
```

### "Division by zero"
```typescript
// ❌ Wrong
a.div(Decimal.fromString("0", 7));

// ✅ Right (check first)
const zero = Decimal.fromString("0", 7);
if (!divisor.equals(zero)) {
  result = a.div(divisor);
}
```

## 🎓 Learn More

- **Full Guide**: `DECIMAL_PRECISION.md`
- **Examples**: `examples/decimal-usage-examples.ts`
- **Tests**: `src/utils/__tests__/arithmetic.test.ts`

## 🧪 Test Your Code

```bash
npm test arithmetic.test.ts
npm test -- --coverage
```

## 🎉 Remember

**Before**: `0.1 + 0.2 = 0.30000000000000004` ❌

**After**: `Decimal.fromString("0.1").add(Decimal.fromString("0.2")).format() = "0.30"` ✅

---

**Keep this card handy while coding!** 📌
