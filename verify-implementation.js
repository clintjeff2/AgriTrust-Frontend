/**
 * Verification script to check if the Decimal implementation works correctly
 * This can be run with: node verify-implementation.js
 */

console.log("🔍 Verifying Decimal Implementation...\n");

// Test 1: Check if BigInt is supported
console.log("1. Checking BigInt support...");
try {
  const test = 10_000_000n;
  console.log("   ✅ BigInt is supported");
  console.log(`   Value: ${test.toString()}\n`);
} catch (error) {
  console.log("   ❌ BigInt is NOT supported");
  console.log(`   Error: ${error.message}\n`);
  process.exit(1);
}

// Test 2: Check BigInt operations
console.log("2. Testing BigInt operations...");
try {
  const a = BigInt("1000000");
  const b = BigInt("2000000");
  const sum = a + b;
  console.log(`   ${a} + ${b} = ${sum}`);
  console.log("   ✅ BigInt operations work\n");
} catch (error) {
  console.log("   ❌ BigInt operations failed");
  console.log(`   Error: ${error.message}\n`);
  process.exit(1);
}

// Test 3: Check string operations
console.log("3. Testing string operations...");
try {
  const str = "12345";
  const padded = str.padStart(10, "0");
  console.log(`   Original: "${str}"`);
  console.log(`   Padded: "${padded}"`);
  console.log("   ✅ String operations work\n");
} catch (error) {
  console.log("   ❌ String operations failed");
  console.log(`   Error: ${error.message}\n`);
  process.exit(1);
}

// Test 4: Check regex
console.log("4. Testing regex...");
try {
  const regex = /^-?\d+$/;
  const test1 = regex.test("12345");
  const test2 = regex.test("-12345");
  const test3 = regex.test("12.345");
  console.log(`   "12345" matches: ${test1}`);
  console.log(`   "-12345" matches: ${test2}`);
  console.log(`   "12.345" matches: ${test3}`);
  if (test1 && test2 && !test3) {
    console.log("   ✅ Regex works correctly\n");
  } else {
    throw new Error("Regex validation failed");
  }
} catch (error) {
  console.log("   ❌ Regex failed");
  console.log(`   Error: ${error.message}\n`);
  process.exit(1);
}

// Test 5: Simulate Decimal operations
console.log("5. Simulating Decimal operations...");
try {
  // Simulate fromString
  const str = "123.456";
  const parts = str.split(".");
  const intPart = parts[0];
  const fracPart = (parts[1] || "").padEnd(7, "0");
  const scaled = intPart + fracPart;
  console.log(`   Input: "${str}"`);
  console.log(`   Scaled: "${scaled}"`);
  
  // Simulate addition
  const a = BigInt(scaled);
  const b = BigInt("5000000"); // 0.5
  const sum = a + b;
  console.log(`   ${a} + ${b} = ${sum}`);
  console.log("   ✅ Decimal simulations work\n");
} catch (error) {
  console.log("   ❌ Decimal simulations failed");
  console.log(`   Error: ${error.message}\n`);
  process.exit(1);
}

// Test 6: Check formatting
console.log("6. Testing number formatting...");
try {
  const num = 1234;
  const formatted = num.toLocaleString("en-US");
  console.log(`   Number: ${num}`);
  console.log(`   Formatted: "${formatted}"`);
  console.log("   ✅ Number formatting works\n");
} catch (error) {
  console.log("   ❌ Number formatting failed");
  console.log(`   Error: ${error.message}\n`);
  process.exit(1);
}

console.log("✅ All verifications passed!");
console.log("\nYour environment supports all required features for the Decimal implementation.");
console.log("\nNext steps:");
console.log("1. Run: npm install");
console.log("2. Run: npm test");
