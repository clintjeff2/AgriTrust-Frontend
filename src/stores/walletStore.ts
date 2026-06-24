/**
 * Lightweight external store for wallet state that plugs into React's
 * `useSyncExternalStore`. Supports local updates and remote (cross-tab)
 * state application with last-write-wins conflict resolution.
 */

import type { WalletSyncPayload } from "@/src/types/sync";

export interface WalletStoreState {
  account: string | null;
  chainId: string | null;
  status: "connected" | "disconnected" | "connecting";
  /** Wall-clock timestamp of the last state mutation (local or remote). */
  lastUpdated: number;
}

export interface WalletStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): WalletStoreState;
  getServerSnapshot(): WalletStoreState;
  /** Apply a local wallet state change. */
  setState(payload: WalletSyncPayload): void;
  /**
   * Merge a remote tab's state using last-write-wins.
   * Returns `true` when the remote state was accepted.
   */
  applyRemoteState(
    payload: WalletSyncPayload,
    timestamp: number,
    remoteTabId: string,
  ): boolean;
  reset(): void;
}

const CLOCK_SKEW_WARN_MS = 5_000;

const EMPTY: WalletStoreState = Object.freeze({
  account: null,
  chainId: null,
  status: "disconnected" as const,
  lastUpdated: 0,
});

export function createWalletStore(): WalletStore {
  const listeners = new Set<() => void>();
  let state: WalletStoreState = { ...EMPTY };

  function emit(): void {
    for (const l of listeners) l();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      return state;
    },

    getServerSnapshot() {
      return EMPTY;
    },

    setState(payload) {
      state = {
        account: payload.account,
        chainId: payload.chainId,
        status: payload.status,
        lastUpdated: Date.now(),
      };
      emit();
    },

    applyRemoteState(payload, timestamp, remoteTabId) {
      const skew = Math.abs(Date.now() - timestamp);
      if (skew > CLOCK_SKEW_WARN_MS) {
        console.warn(
          `[walletStore] Clock skew of ${skew}ms detected from tab ${remoteTabId}`,
        );
      }

      // Last-write-wins: reject stale updates
      if (timestamp <= state.lastUpdated) return false;

      state = {
        account: payload.account,
        chainId: payload.chainId,
        status: payload.status,
        lastUpdated: timestamp,
      };
      emit();
      return true;
    },

    reset() {
      state = { ...EMPTY };
      emit();
    },
  };
}

/** Shared singleton wired up by the tab-sync hooks. */
export const defaultWalletStore = createWalletStore();
