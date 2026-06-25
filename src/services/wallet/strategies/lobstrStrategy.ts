/**
 * Lobstr wallet strategy adapter.
 *
 * Lobstr is a Stellar mobile/web wallet.  This strategy uses the Lobstr
 * Wallet SDK or injected global for authentication.
 *
 * Note: Lobstr typically uses WalletConnect or a deep-link flow.  This
 * adapter provides a strategy placeholder for the Lobstr provider.
 */

import type {
  WalletStrategy,
  AuthResult,
  SignPayload,
} from "@/src/types/wallet";

export const LOBSTR_ID = "lobstr";

export function createLobstrStrategy(): WalletStrategy {
  let connected = false;
  let account: string | null = null;

  return {
    id: LOBSTR_ID,

    async connect(): Promise<AuthResult> {
      const lobstr = window.lobstr;
      if (!lobstr) {
        throw new Error("Lobstr wallet not detected. Please install Lobstr.");
      }

      const result = await lobstr.connect();
      account = result.publicKey;
      connected = true;

      return {
        account: result.publicKey,
        chainId: null,
      };
    },

    disconnect(): void {
      const lobstr = window.lobstr;
      if (lobstr) {
        lobstr.disconnect();
      }
      connected = false;
      account = null;
    },

    async sign(payload: SignPayload): Promise<AuthResult> {
      const lobstr = window.lobstr;
      if (!lobstr) {
        throw new Error("Lobstr wallet not detected");
      }
      if (!account) {
        throw new Error("Not connected — call connect() before sign()");
      }

      const message =
        typeof payload.message === "string"
          ? payload.message
          : new TextDecoder().decode(payload.message);

      const result = await lobstr.sign(message);

      return {
        account,
        chainId: null,
        signature: result.signature,
      };
    },

    getAccount(): string | null {
      const lobstr = window.lobstr;
      if (lobstr && lobstr.isConnected()) {
        return lobstr.getPublicKey();
      }
      return account;
    },

    isConnected(): boolean {
      const lobstr = window.lobstr;
      return connected || (lobstr?.isConnected() ?? false);
    },
  };
}
