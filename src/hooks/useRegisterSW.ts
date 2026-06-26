"use client";

import { useEffect, useRef, useCallback } from "react";
import { registerServiceWorker } from "@/src/services/swRegistration";

export interface UseSWOptions {
  /** Called when a new SW version has installed and is waiting to activate. */
  onUpdateReady?: (registration: ServiceWorkerRegistration) => void;
}

export interface UseSWResult {
  /**
   * Call after saving an audit offline to ask the service worker to replay the
   * queue as soon as connectivity is restored. Uses the SyncManager API when
   * available; falls back silently in unsupported environments.
   */
  requestBackgroundSync: () => Promise<void>;
}

/**
 * Registers the AgriTrust service worker and exposes a helper to request a
 * background sync tag (`sync-audits`), which the SW will replay once online.
 *
 * Registration is idempotent — safe to call on every mount. Degrades
 * gracefully when the browser does not support service workers or the
 * Background Sync API.
 */
export function useRegisterSW(options: UseSWOptions = {}): UseSWResult {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const reg = await registerServiceWorker({
        onUpdateReady: (r) => optionsRef.current.onUpdateReady?.(r),
      });
      if (!cancelled) {
        registrationRef.current = reg;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const requestBackgroundSync = useCallback(async (): Promise<void> => {
    const reg = registrationRef.current;
    if (!reg) return;

    // Background Sync API (https://wicg.github.io/background-sync/)
    // Not universally supported — degrade silently.
    if ("sync" in reg) {
      try {
        await (reg as ServiceWorkerRegistration & {
          sync: { register: (tag: string) => Promise<void> };
        }).sync.register("sync-audits");
      } catch (err) {
        // SyncManager.register can throw if the user has denied storage
        // permissions or the browser restricts background tasks. Not fatal.
        console.warn("[AgriTrust] Background sync registration failed:", err);
      }
    }
  }, []);

  return { requestBackgroundSync };
}
