export interface TransactionWithNonce {
  nonce?: Uint8Array;
  [key: string]: unknown;
}
