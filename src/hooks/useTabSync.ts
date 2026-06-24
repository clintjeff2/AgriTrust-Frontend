/**
 * React hook that initialises the cross-tab sync service on mount and
 * wires incoming messages into the shared wallet store.
 *
 * Usage — call once near the root (e.g. inside WalletProvider):
 *
 *   const tabSync = useTabSync();
 */

import { useEffect, useMemo } from "react";
import {
  createTabSyncService,
  type TabSyncService,
} from "@/src/services/tabSync";
import { defaultWalletStore } from "@/src/stores/walletStore";
import type { SyncMessage } from "@/src/types/sync";

export function useTabSync(): TabSyncService {
  const service = useMemo(() => createTabSyncService(), []);

  useEffect(() => {
    service.init();

    const unsubMessage = service.onMessage((msg: SyncMessage) => {
      switch (msg.type) {
        case "wallet_state_change":
        case "tab_disconnect":
          defaultWalletStore.applyRemoteState(
            msg.payload,
            msg.timestamp,
            msg.tabId,
          );
          break;
        case "tab_heartbeat":
          break;
      }
    });

    return () => {
      unsubMessage();
      service.destroy();
    };
  }, [service]);

  return service;
}
