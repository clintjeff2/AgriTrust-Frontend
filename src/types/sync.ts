/**
 * Type definitions for the cross-tab wallet state synchronization protocol.
 *
 * Messages are broadcast via BroadcastChannel and must stay under 2 KB
 * (wallet address + chain ID + status only).
 */

export type SyncMessageType =
  | "wallet_state_change"
  | "tab_heartbeat"
  | "tab_disconnect";

/** Minimal wallet state that is broadcast between tabs. */
export interface WalletSyncPayload {
  account: string | null;
  chainId: string | null;
  status: "connected" | "disconnected" | "connecting" | "approving" | "reconnecting" | "signing" | "ready";
}

/** Envelope sent over the BroadcastChannel. */
export interface SyncMessage {
  type: SyncMessageType;
  tabId: string;
  payload: WalletSyncPayload;
  timestamp: number;
}

/** Emitted on visibility-change to signal tab liveness. */
export interface TabHeartbeat {
  tabId: string;
  timestamp: number;
  visible: boolean;
}

/** Entry stored in localStorage to track active tabs. */
export interface ActiveTabEntry {
  tabId: string;
  lastHeartbeat: number;
}
