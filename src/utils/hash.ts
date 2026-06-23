const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

export function hashString(str: string, seed: bigint | string | number = FNV_OFFSET_BASIS_64): bigint {
  let hash = normalizeSeed(seed);
  const bytes = new TextEncoder().encode(str);

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME_64) & UINT64_MASK;
  }

  return hash;
}

function normalizeSeed(seed: bigint | string | number): bigint {
  if (typeof seed === "bigint") return seed & UINT64_MASK;
  if (typeof seed === "number") return BigInt(Math.trunc(seed)) & UINT64_MASK;
  return hashString(seed, FNV_OFFSET_BASIS_64);
}
