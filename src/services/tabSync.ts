/**
 * Cross-tab synchronization service using BroadcastChannel + localStorage.
 *
 * Invariants:
 * - Sync latency < 200 ms between tabs on the same origin
 * - Race conditions handled at tab open/close boundaries (≤ 3 simultaneous tabs)
 * - Maximum state payload per broadcast: 2 KB
 * - Tab lifecycle: heartbeat on visibility change, broadcast removal on close
 */

import type {
  SyncMessage,
  SyncMessageType,
  WalletSyncPayload,
  ActiveTabEntry,
} from "@/src/types/sync";

const CHANNEL_NAME = "wallet-sync";
const ACTIVE_TABS_KEY = "agritrust_activeTabs";
const MAX_PAYLOAD_BYTES = 2048;
const HEARTBEAT_INTERVAL_MS = 30_000;
const STALE_TAB_THRESHOLD_MS = 60_000;

export interface TabSyncService {
  readonly tabId: string;
  /** Start listening and register this tab. */
  init(): void;
  /** Broadcast a wallet state change to other tabs. */
  broadcast(payload: WalletSyncPayload): void;
  /** Subscribe to incoming sync messages (excludes own tabId). */
  onMessage(handler: (msg: SyncMessage) => void): () => void;
  /** Return the list of currently active tabs. */
  getActiveTabs(): ActiveTabEntry[];
  /** Tear down the service: close channel, remove listeners, unregister tab. */
  destroy(): void;
}

function generateTabId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function readActiveTabs(): ActiveTabEntry[] {
  try {
    const raw = localStorage.getItem(ACTIVE_TABS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ActiveTabEntry[];
  } catch {
    return [];
  }
}

function writeActiveTabs(tabs: ActiveTabEntry[]): void {
  try {
    localStorage.setItem(ACTIVE_TABS_KEY, JSON.stringify(tabs));
  } catch {
    // localStorage full or unavailable — best effort
  }
}

export function createTabSyncService(): TabSyncService {
  const tabId = generateTabId();
  let channel: BroadcastChannel | null = null;
  const messageHandlers = new Set<(msg: SyncMessage) => void>();
  let visibilityHandler: (() => void) | null = null;
  let unloadHandler: (() => void) | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  function registerTab(): void {
    const tabs = readActiveTabs().filter((t) => t.tabId !== tabId);
    tabs.push({ tabId, lastHeartbeat: Date.now() });
    writeActiveTabs(tabs);
  }

  function unregisterTab(): void {
    writeActiveTabs(readActiveTabs().filter((t) => t.tabId !== tabId));
  }

  function pruneStale(): void {
    const now = Date.now();
    writeActiveTabs(
      readActiveTabs().filter(
        (t) => now - t.lastHeartbeat < STALE_TAB_THRESHOLD_MS,
      ),
    );
  }

  function postToChannel(
    type: SyncMessageType,
    payload: WalletSyncPayload,
  ): void {
    if (!channel) return;

    const msg: SyncMessage = { type, tabId, payload, timestamp: Date.now() };
    const serialized = JSON.stringify(msg);

    if (new Blob([serialized]).size > MAX_PAYLOAD_BYTES) {
      console.warn("[tabSync] Message exceeds 2 KB limit, skipping broadcast");
      return;
    }

    try {
      channel.postMessage(msg);
    } catch {
      // Channel closed or unavailable
    }
  }

  function handleIncoming(event: MessageEvent): void {
    const msg = event.data as SyncMessage;
    // Filter out own messages to avoid loops
    if (!msg || msg.tabId === tabId) return;
    for (const handler of messageHandlers) handler(msg);
  }

  return {
    get tabId() {
      return tabId;
    },

    init() {
      if (typeof window === "undefined") return;

      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.addEventListener("message", handleIncoming);

      registerTab();

      // Heartbeat on visibility change
      visibilityHandler = () => {
        if (document.visibilityState === "visible") {
          registerTab();
        }
      };
      document.addEventListener("visibilitychange", visibilityHandler);

      // Periodic heartbeat + prune stale tabs
      heartbeatInterval = setInterval(() => {
        registerTab();
        pruneStale();
      }, HEARTBEAT_INTERVAL_MS);

      // On close: unregister and broadcast disconnect
      unloadHandler = () => {
        unregisterTab();
        postToChannel("tab_disconnect", {
          account: null,
          chainId: null,
          status: "disconnected",
        });
      };
      window.addEventListener("beforeunload", unloadHandler);
    },

    broadcast(payload) {
      postToChannel("wallet_state_change", payload);
    },

    onMessage(handler) {
      messageHandlers.add(handler);
      return () => {
        messageHandlers.delete(handler);
      };
    },

    getActiveTabs() {
      return readActiveTabs();
    },

    destroy() {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
        visibilityHandler = null;
      }

      if (unloadHandler) {
        window.removeEventListener("beforeunload", unloadHandler);
        unloadHandler = null;
      }

      unregisterTab();

      if (channel) {
        channel.removeEventListener("message", handleIncoming);
        channel.close();
        channel = null;
      }

      messageHandlers.clear();
    },
  };
}
