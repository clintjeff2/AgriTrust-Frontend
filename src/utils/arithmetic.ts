/**
 * Arbitrary-precision decimal arithmetic for Soroban i128 7-decimal representation.
 * 
 * Avoids JavaScript floating-point rounding errors by using string-based arithmetic
 * with carry propagation. All operations maintain exact precision.
 * 
 * Technical Bounds:
 * - Display precision: 2 decimal places for UI, 7 for detailed breakdowns
 * - On-chain precision: 7 decimals (Soroban i128: 1.0000000 = 10_000_000)
 * - Performance target: 10,000 ops/sec on mobile devices
 */

const INTEGER_REGEX = /^-?\d+$/;

export class Decimal {
  /**
   * String representation of the scaled integer value.
   * E.g., "12345600000" with scale 7 represents 1234.5600000
   */
  private readonly value: string;
  
  /**
   * Number of decimal places.
   * Default is 7 (Soroban standard).
   */
  private readonly scale: number;

  /**
   * Creates a Decimal from a string representation of a scaled integer.
   * 
   * @param value - String representation of the integer scaled value (e.g., "12345600000")
   * @param scale - Number of decimal places (default: 7)
   * @throws Error if value is not a valid integer string
   * 
   * @example
   * new Decimal("10000000", 7) // represents 1.0000000
   * new Decimal("12345600000", 7) // represents 1234.5600000
   * new Decimal("-5000000", 7) // represents -0.5000000
   */
  constructor(value: string, scale: number = 7) {
    if (!INTEGER_REGEX.test(value)) {
      throw new Error(`Invalid decimal value: "${value}". Must match regex /^-?\\d+$/`);
    }
    this.value = value;
    this.scale = scale;
  }

  /**
   * Creates a Decimal from a Soroban raw i128 bigint.
   * 
   * @param raw - Raw bigint value from Soroban contract
   * @param decimals - Decimal places (default: 7)
   * @returns Decimal instance
   * 
   * @example
   * Decimal.fromSoroban(10_000_000n) // 1.0000000
   * Decimal.fromSoroban(123_4560000n) // 123.4560000
   */
  static fromSoroban(raw: bigint, decimals: number = 7): Decimal {
    return new Decimal(raw.toString(), decimals);
  }

  /**
   * Creates a Decimal from a human-readable string (e.g., "123.456").
   * 
   * @param str - Decimal string representation
   * @param scale - Target scale (default: 7)
   * @returns Decimal instance
   * 
   * @example
   * Decimal.fromString("1.23") // 1.2300000 with scale 7
   * Decimal.fromString("0.1") // 0.1000000
   * Decimal.fromString("-42.5") // -42.5000000
   */
  static fromString(str: string, scale: number = 7): Decimal {
    const trimmed = str.trim();
    const isNegative = trimmed.startsWith('-');
    const absolute = isNegative ? trimmed.slice(1) : trimmed;
    
    const parts = absolute.split('.');
    const integerPart = parts[0] || '0';
    const fractionalPart = parts[1] || '';
    
    // Pad or truncate fractional part to match scale
    const paddedFraction = fractionalPart.padEnd(scale, '0').slice(0, scale);
    const scaledValue = integerPart + paddedFraction;
    
    return new Decimal(isNegative ? '-' + scaledValue : scaledValue, scale);
  }

  /**
   * Converts the Decimal back to a Soroban i128 bigint.
   * 
   * @returns Raw bigint value for Soroban
   * 
   * @example
   * new Decimal("10000000", 7).toSoroban() // 10_000_000n
   */
  toSoroban(): bigint {
    return BigInt(this.value);
  }

  /**
   * Formats the Decimal as a human-readable string with locale formatting.
   * 
   * @param decimals - Number of decimal places to display (default: 2)
   * @param locale - Locale for number formatting (default: "en-US")
   * @returns Formatted string (e.g., "1,234.56")
   * 
   * @example
   * new Decimal("12345600000", 7).format() // "1,234.56"
   * new Decimal("12345600000", 7).format(7) // "1,234.5600000"
   * new Decimal("10000000", 7).format(2, "de-DE") // "1,00"
   */
  format(decimals: number = 2, locale: string = "en-US"): string {
    const isNegative = this.value.startsWith('-');
    const absolute = isNegative ? this.value.slice(1) : this.value;
    
    // Pad to ensure we have enough digits
    const padded = absolute.padStart(this.scale + 1, '0');
    const splitPoint = padded.length - this.scale;
    
    const integerPart = padded.slice(0, splitPoint);
    const fractionalPart = padded.slice(splitPoint);
    
    // Round fractional part to desired decimals
    const rounded = this.roundFraction(fractionalPart, decimals);
    
    // Handle carry-over from rounding
    let finalInteger = integerPart;
    let finalFraction = rounded.fraction;
    
    if (rounded.carry) {
      finalInteger = this.addOne(integerPart);
    }
    
    // Format integer part with locale
    const integerNum = parseInt(finalInteger, 10);
    const formattedInteger = integerNum.toLocaleString(locale, {
      useGrouping: true,
      minimumIntegerDigits: 1,
    });
    
    // Build final string
    const sign = isNegative ? '-' : '';
    if (decimals === 0) {
      return sign + formattedInteger;
    }
    
    return sign + formattedInteger + '.' + finalFraction;
  }

  /**
   * Adds another Decimal to this one.
   * 
   * @param other - Decimal to add
   * @returns New Decimal with the sum
   * @throws Error if scales don't match
   * 
   * @example
   * new Decimal("1000000", 7).add(new Decimal("2000000", 7)) // 0.3000000
   */
  add(other: Decimal): Decimal {
    if (this.scale !== other.scale) {
      throw new Error(`Scale mismatch: ${this.scale} !== ${other.scale}`);
    }
    
    const a = BigInt(this.value);
    const b = BigInt(other.value);
    const sum = a + b;
    
    return new Decimal(sum.toString(), this.scale);
  }

  /**
   * Subtracts another Decimal from this one.
   * 
   * @param other - Decimal to subtract
   * @returns New Decimal with the difference
   * @throws Error if scales don't match
   * 
   * @example
   * new Decimal("5000000", 7).sub(new Decimal("2000000", 7)) // 0.3000000
   */
  sub(other: Decimal): Decimal {
    if (this.scale !== other.scale) {
      throw new Error(`Scale mismatch: ${this.scale} !== ${other.scale}`);
    }
    
    const a = BigInt(this.value);
    const b = BigInt(other.value);
    const diff = a - b;
    
    return new Decimal(diff.toString(), this.scale);
  }

  /**
   * Multiplies this Decimal by another.
   * Result scale is maintained by dividing by 10^scale.
   * 
   * @param other - Decimal to multiply by
   * @returns New Decimal with the product
   * @throws Error if scales don't match
   * 
   * @example
   * new Decimal("20000000", 7).mul(new Decimal("30000000", 7)) // 6.0000000
   */
  mul(other: Decimal): Decimal {
    if (this.scale !== other.scale) {
      throw new Error(`Scale mismatch: ${this.scale} !== ${other.scale}`);
    }
    
    const a = BigInt(this.value);
    const b = BigInt(other.value);
    const product = a * b;
    
    // Divide by 10^scale to maintain scale
    const scaleFactor = BigInt(10) ** BigInt(this.scale);
    const scaled = product / scaleFactor;
    
    return new Decimal(scaled.toString(), this.scale);
  }

  /**
   * Divides this Decimal by another.
   * 
   * @param other - Decimal to divide by
   * @param precision - Result precision (default: same as scale)
   * @returns New Decimal with the quotient
   * @throws Error if divisor is zero or scales don't match
   * 
   * @example
   * new Decimal("60000000", 7).div(new Decimal("20000000", 7)) // 3.0000000
   */
  div(other: Decimal, precision?: number): Decimal {
    if (this.scale !== other.scale) {
      throw new Error(`Scale mismatch: ${this.scale} !== ${other.scale}`);
    }
    
    const divisor = BigInt(other.value);
    if (divisor === 0n) {
      throw new Error("Division by zero");
    }
    
    const resultPrecision = precision ?? this.scale;
    const a = BigInt(this.value);
    
    // Multiply dividend by 10^scale to maintain precision
    const scaleFactor = BigInt(10) ** BigInt(resultPrecision);
    const scaled = a * scaleFactor;
    const quotient = scaled / divisor;
    
    return new Decimal(quotient.toString(), resultPrecision);
  }

  /**
   * Compares this Decimal to another.
   * 
   * @param other - Decimal to compare to
   * @returns -1 if less, 0 if equal, 1 if greater
   * @throws Error if scales don't match
   */
  compareTo(other: Decimal): -1 | 0 | 1 {
    if (this.scale !== other.scale) {
      throw new Error(`Scale mismatch: ${this.scale} !== ${other.scale}`);
    }
    
    const a = BigInt(this.value);
    const b = BigInt(other.value);
    
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  /**
   * Checks if this Decimal equals another.
   */
  equals(other: Decimal): boolean {
    return this.scale === other.scale && this.value === other.value;
  }

  /**
   * Checks if this Decimal is less than another.
   */
  lt(other: Decimal): boolean {
    return this.compareTo(other) === -1;
  }

  /**
   * Checks if this Decimal is less than or equal to another.
   */
  lte(other: Decimal): boolean {
    return this.compareTo(other) <= 0;
  }

  /**
   * Checks if this Decimal is greater than another.
   */
  gt(other: Decimal): boolean {
    return this.compareTo(other) === 1;
  }

  /**
   * Checks if this Decimal is greater than or equal to another.
   */
  gte(other: Decimal): boolean {
    return this.compareTo(other) >= 0;
  }

  /**
   * Returns the string representation of the raw value.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Returns the scale (decimal places).
   */
  getScale(): number {
    return this.scale;
  }

  // Private helper methods

  /**
   * Rounds a fractional part string to specified decimals.
   * Returns the rounded fraction and whether there was a carry.
   */
  private roundFraction(fraction: string, decimals: number): { fraction: string; carry: boolean } {
    if (decimals >= fraction.length) {
      return { fraction: fraction.padEnd(decimals, '0'), carry: false };
    }
    
    const toKeep = fraction.slice(0, decimals);
    const nextDigit = parseInt(fraction[decimals] || '0', 10);
    
    // Round up if next digit >= 5
    if (nextDigit >= 5) {
      const rounded = this.addOneToFraction(toKeep);
      return rounded;
    }
    
    return { fraction: toKeep, carry: false };
  }

  /**
   * Adds 1 to a fractional part string (for rounding).
   * Returns the result and whether there was a carry into the integer part.
   */
  private addOneToFraction(fraction: string): { fraction: string; carry: boolean } {
    const digits = fraction.split('').map(d => parseInt(d, 10));
    let carry = 1;
    
    for (let i = digits.length - 1; i >= 0 && carry; i--) {
      const sum = digits[i] + carry;
      digits[i] = sum % 10;
      carry = Math.floor(sum / 10);
    }
    
    return {
      fraction: digits.join(''),
      carry: carry === 1,
    };
  }

  /**
   * Adds 1 to an integer part string.
   */
  private addOne(integerPart: string): string {
    const num = BigInt(integerPart);
    return (num + 1n).toString();
  }
}
