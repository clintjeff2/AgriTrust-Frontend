import type { AuthResult, SignPayload, WalletStrategy } from "@/src/types/wallet";
import type { TransactionWithNonce } from "@/src/types/transactions";

export type NonceGenerator = () => Uint8Array;

export interface TransactionSignerOptions {
  generateNonce: NonceGenerator;
}

export class TransactionSigner {
  private readonly generateNonce: NonceGenerator;

  constructor(options: TransactionSignerOptions) {
    this.generateNonce = options.generateNonce;
  }

  async sign<T extends TransactionWithNonce>(
    transaction: T,
    strategy: Pick<WalletStrategy, "sign">,
  ): Promise<AuthResult> {
    const nonce = this.generateNonce();
    transaction.nonce = nonce;

    const payload: SignPayload = {
      message: JSON.stringify({ ...transaction, nonce: Array.from(nonce) }),
      encoding: "utf8",
    };

    return strategy.sign(payload);
  }
}

export async function signTransaction<T extends TransactionWithNonce>(
  transaction: T,
  strategy: Pick<WalletStrategy, "sign">,
  generateNonce: NonceGenerator,
): Promise<AuthResult> {
  return new TransactionSigner({ generateNonce }).sign(transaction, strategy);
}
