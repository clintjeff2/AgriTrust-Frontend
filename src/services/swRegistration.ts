/**
 * Service-worker registration, update flow, and the main-thread side of the
 * certification invalidation channel.
 *
 * The SW caches certification assets with a status-segmented key schema; when
 * an on-chain status transition happens, the app calls
 * {@link broadcastCertStatusChange} to ping the SW (and other tabs) so stale
 * badge/score renders are purged. See `public/sw.js` and
 * `src/services/swCacheStrategy.ts`.
 */

import { CERT_STATUS_CHANNEL } from "@/src/services/swCacheStrategy";
import type {
  CertificationStatus,
  CertStatusChangeMessage,
} from "@/src/types/certification";

const SW_URL = "/sw.js";

export interface RegisterOptions {
  /** Called when an updated worker has installed and is waiting to activate. */
  onUpdateReady?: (registration: ServiceWorkerRegistration) => void;
}

function supportsServiceWorker(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

/**
 * Registers the service worker and wires the update flow. Safe to call on every
 * mount — registration is idempotent. Returns the registration, or null when
 * the environment has no service-worker support.
 */
export async function registerServiceWorker(
  options: RegisterOptions = {}
): Promise<ServiceWorkerRegistration | null> {
  if (!supportsServiceWorker()) return null;

  try {
    const registration = await navigator.serviceWorker.register(SW_URL);

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (
          installing.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          // A new version is ready behind the current one.
          options.onUpdateReady?.(registration);
        }
      });
    });

    return registration;
  } catch (error) {
    console.warn("[AgriTrust] Service worker registration failed:", error);
    return null;
  }
}

/** Tells a waiting worker to activate immediately. */
export function activateWaitingWorker(
  registration: ServiceWorkerRegistration
): void {
  registration.waiting?.postMessage({ type: "SKIP_WAITING" });
}

// ─── Invalidation channel ────────────────────────────────────────────────

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CERT_STATUS_CHANNEL);
  return channel;
}

/**
 * Announces a certification status transition. Pings the service worker (which
 * purges the cert's cached entries) and every other open tab. Falls back to
 * `controller.postMessage` where BroadcastChannel is unavailable.
 */
export function broadcastCertStatusChange(
  certId: string,
  toStatus: CertificationStatus,
  fromStatus?: CertificationStatus,
  at: number = Date.now()
): void {
  const message: CertStatusChangeMessage = {
    type: "cert-status-change",
    certId,
    fromStatus,
    toStatus,
    at,
  };

  const ch = getChannel();
  if (ch) {
    ch.postMessage(message);
    return;
  }

  if (
    supportsServiceWorker() &&
    navigator.serviceWorker.controller
  ) {
    navigator.serviceWorker.controller.postMessage(message);
  }
}

export interface CacheInvalidatedEvent {
  certId: string;
  toStatus?: CertificationStatus;
}

/**
 * Subscribes to "this cert's cache was invalidated, please revalidate" signals
 * from the service worker. Returns an unsubscribe function.
 */
export function subscribeToCacheInvalidation(
  handler: (event: CacheInvalidatedEvent) => void
): () => void {
  if (!supportsServiceWorker()) return () => {};

  const listener = (event: MessageEvent) => {
    const data = event.data as { type?: string } | null;
    if (data?.type === "cert-cache-invalidated") {
      handler(data as unknown as CacheInvalidatedEvent);
    }
  };

  navigator.serviceWorker.addEventListener("message", listener);
  return () => {
    navigator.serviceWorker.removeEventListener("message", listener);
  };
}
