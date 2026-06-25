/**
 * WalletConnect strategy adapter.
 *
 * WalletConnect provides QR-code-based wallet pairing for mobile wallets.
 * This strategy serves as a fallback when no browser extension is detected.
 */

import type {
  WalletStrategy,
  AuthResult,
  SignPayload,
} from "@/src/types/wallet";

export const WALLETCONNECT_ID = "walletconnect";

export function createWalletConnectStrategy(): WalletStrategy {
  let connected = false;
  let account: string | null = null;

  return {
    id: WALLETCONNECT_ID,

    async connect(): Promise<AuthResult> {
      const ethereum = window.ethereum;
      if (!ethereum) {
        throw new Error(
          "No Ethereum provider found. Please install a wallet extension or use WalletConnect.",
        );
      }

      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned from WalletConnect");
      }

      account = accounts[0];
      connected = true;

      return {
        account: accounts[0],
        chainId: null,
      };
    },

    disconnect(): void {
      connected = false;
      account = null;
      // WalletConnect doesn't have a disconnect RPC method;
      // the user disconnects from their wallet app.
    },

    async sign(payload: SignPayload): Promise<AuthResult> {
      const ethereum = window.ethereum;
      if (!ethereum || !account) {
        throw new Error("Wallet not connected");
      }

      // Encode message to hex string for personal_sign.
      const messageBytes =
        typeof payload.message === "string"
          ? new TextEncoder().encode(payload.message)
          : payload.message;
      const hexMessage =
        "0x" +
        Array.from(messageBytes)
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");

      const signature = (await ethereum.request({
        method: "personal_sign",
        params: [hexMessage, account],
      })) as string;

      return {
        account,
        chainId: null,
        signature,
      };
    },

    getAccount(): string | null {
      if (connected) return account;
      return window.ethereum?.selectedAddress ?? null;
    },

    isConnected(): boolean {
      return connected || (window.ethereum?.selectedAddress !== undefined);
    },
  };
}
