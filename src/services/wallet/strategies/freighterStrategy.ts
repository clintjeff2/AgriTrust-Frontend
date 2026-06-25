/**
 * Freighter wallet strategy adapter.
 *
 * Freighter is a Stellar browser extension wallet.  This strategy wraps
 * the Freighter SDK's global `window.freighter` API.
 */

import type {
  WalletStrategy,
  AuthResult,
  SignPayload,
} from "@/src/types/wallet";

export const FREIGHTER_ID = "freighter";

export function createFreighterStrategy(): WalletStrategy {
  let connected = false;
  let account: string | null = null;

  return {
    id: FREIGHTER_ID,

    async connect(): Promise<AuthResult> {
      const freighter = window.freighter;
      if (!freighter) {
        throw new Error("Freighter extension not detected");
      }

      const result = await freighter.connect();
      account = result.address;
      connected = true;

      return {
        account: result.address,
        chainId: null, // Stellar uses passphrases; chainId is handled at a higher level
      };
    },

    disconnect(): void {
      const freighter = window.freighter;
      if (freighter) {
        freighter.disconnect();
      }
      connected = false;
      account = null;
    },

    async sign(payload: SignPayload): Promise<AuthResult> {
      const freighter = window.freighter;
      if (!freighter) {
        throw new Error("Freighter extension not detected");
      }
      if (!account) {
        throw new Error("Not connected — call connect() before sign()");
      }

      const message =
        typeof payload.message === "string"
          ? new TextEncoder().encode(payload.message)
          : payload.message;

      const result = await freighter.sign(message);

      return {
        account,
        chainId: null,
        signature: result.signature,
      };
    },

    getAccount(): string | null {
      const freighter = window.freighter;
      if (freighter && freighter.isConnected()) {
        return freighter.getAccount();
      }
      return account;
    },

    isConnected(): boolean {
      const freighter = window.freighter;
      return connected || (freighter?.isConnected() ?? false);
    },
  };
}
