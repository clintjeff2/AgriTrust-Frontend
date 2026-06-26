const NONCE_PREFIX = "nonce";
const COUNTER_BYTES = 8;
const NONCE_BYTES = 32;

function assertStorageAvailable(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export function getNonceStorageKey(address: string, chainId: string): string {
  return `${NONCE_PREFIX}-${address}-${chainId}`;
}

export function loadNonceCounter(address: string, chainId: string): number {
  const storage = assertStorageAvailable();
  if (!storage) return 0;

  const raw = storage.getItem(getNonceStorageKey(address, chainId));
  if (raw === null) return 0;

  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function saveNonceCounter(address: string, chainId: string, counter: number): void {
  if (!Number.isSafeInteger(counter) || counter < 0) {
    throw new RangeError("Nonce counter must be a non-negative safe integer");
  }

  const storage = assertStorageAvailable();
  if (!storage) return;

  storage.setItem(getNonceStorageKey(address, chainId), String(counter));
}

export function createNonceFromCounter(counter: number): Uint8Array {
  if (!Number.isSafeInteger(counter) || counter < 1) {
    throw new RangeError("Nonce counter must be a positive safe integer");
  }
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error("crypto.getRandomValues is required to generate nonces");
  }

  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const counterBytes = new ArrayBuffer(COUNTER_BYTES);
  new DataView(counterBytes).setBigUint64(0, BigInt(counter), false);
  const counterView = new Uint8Array(counterBytes);

  for (let i = 0; i < counterView.length; i += 1) {
    nonce[NONCE_BYTES - COUNTER_BYTES + i] ^= counterView[i];
  }

  return nonce;
}
