/**
 * Pure, framework-free logic for the certification cache-invalidation strategy.
 *
 * This module is the single source of truth for cache-key shape, per-status
 * TTLs, route classification, freshness checks, and LRU victim selection. It is
 * imported by `useCertificationCache` and the unit tests. The service worker
 * (`public/sw.js`) is a classic worker script and cannot import TypeScript at
 * runtime, so it mirrors these constants/functions in vanilla JS — keep the two
 * in sync (the SW file references this module in a header comment).
 *
 * Cache-key schema (per the feature spec): `cert-v1-{status}-{id}`.
 */

import {
  CERTIFICATION_STATUSES,
  type CertificationStatus,
} from "@/src/types/certification";

export const CERT_CACHE_VERSION = "v1";
export const CERT_CACHE_NAME = `cert-${CERT_CACHE_VERSION}`;
export const CERT_CACHE_PREFIX = `cert-${CERT_CACHE_VERSION}`;
export const STATIC_CACHE_NAME = `static-${CERT_CACHE_VERSION}`;

/** BroadcastChannel name the SW and main thread use for invalidation pings. */
export const CERT_STATUS_CHANNEL = "cert-status-change";

/** Synthetic path prefix under which status-segmented cache entries are stored. */
export const CERT_CACHE_PATH = "/__certcache__";

/** Per-origin Cache Storage budget (bytes). */
export const STORAGE_LIMIT_BYTES = 50 * 1024 * 1024;

const MINUTE = 60 * 1000;
/** Active certifications: short TTL because on-chain state may still change. */
export const ACTIVE_TTL_MS = 15 * MINUTE;
/** Revoked/expired certifications: longer TTL, they are historical. */
export const HISTORICAL_TTL_MS = 60 * MINUTE;

export type RouteStrategy = "network-first" | "cache-first" | "passthrough";

/** Builds the status-segmented logical cache key: `cert-v1-{status}-{id}`. */
export function buildCertCacheKey(
  id: string,
  status: CertificationStatus
): string {
  return `${CERT_CACHE_PREFIX}-${status}-${id}`;
}

export interface ParsedCertKey {
  status: CertificationStatus;
  id: string;
}

/**
 * Parses a `cert-v1-{status}-{id}` key. The id may itself contain dashes (e.g.
 * a UUID), so the status is matched against the known status set rather than by
 * naive splitting.
 */
export function parseCertCacheKey(key: string): ParsedCertKey | null {
  const prefix = `${CERT_CACHE_PREFIX}-`;
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);

  for (const status of CERTIFICATION_STATUSES) {
    const marker = `${status}-`;
    if (rest.startsWith(marker)) {
      const id = rest.slice(marker.length);
      if (id.length === 0) return null;
      return { status, id };
    }
  }
  return null;
}

/** The full synthetic Request URL a key is stored under in the SW cache. */
export function certCacheUrl(origin: string, key: string): string {
  return `${origin}${CERT_CACHE_PATH}/${key}`;
}

/** Extracts the logical key from a synthetic cache Request URL. */
export function keyFromCertCacheUrl(url: string): string | null {
  const marker = `${CERT_CACHE_PATH}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

/** TTL for a given status. */
export function statusTtlMs(status: CertificationStatus): number {
  return status === "revoked" || status === "expired"
    ? HISTORICAL_TTL_MS
    : ACTIVE_TTL_MS;
}

/** Whether a cache entry is still within its status-derived TTL. */
export function isEntryFresh(
  cachedAtMs: number,
  status: CertificationStatus,
  now: number
): boolean {
  return now - cachedAtMs < statusTtlMs(status);
}

const STATIC_ASSET_RE =
  /\.(?:js|css|woff2?|ttf|eot|otf|png|jpe?g|gif|svg|webp|avif|ico)$/i;

/** Whether a pathname targets a certification API endpoint. */
export function isCertApiPath(pathname: string): boolean {
  return /\/api\/v\d+\/certifications(?:\/|$)/.test(pathname);
}

/**
 * Extracts the certification id from an API path like
 * `/api/v1/certifications/{id}`.
 */
export function certIdFromApiPath(pathname: string): string | null {
  const match = pathname.match(/\/certifications\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Classifies a request: cert APIs and other APIs are network-first, static
 * assets and the Next build output are cache-first, everything else passes
 * through to the network untouched.
 */
export function classifyRoute(pathname: string): RouteStrategy {
  if (isCertApiPath(pathname) || /\/api\//.test(pathname)) {
    return "network-first";
  }
  if (pathname.startsWith("/_next/static/") || STATIC_ASSET_RE.test(pathname)) {
    return "cache-first";
  }
  return "passthrough";
}

export interface CacheEntryMeta {
  key: string;
  size: number;
  lastAccess: number;
}

/**
 * LRU eviction planner: given current entries, the size of an incoming entry,
 * and the storage limit, returns the keys to evict (least-recently-accessed
 * first) so the total stays within budget. Returns an empty array if no
 * eviction is needed.
 */
export function selectLruVictims(
  entries: CacheEntryMeta[],
  incomingSize: number,
  limitBytes: number = STORAGE_LIMIT_BYTES
): string[] {
  const currentTotal = entries.reduce((sum, e) => sum + e.size, 0);
  let projected = currentTotal + incomingSize;
  if (projected <= limitBytes) return [];

  const byOldest = [...entries].sort((a, b) => a.lastAccess - b.lastAccess);
  const victims: string[] = [];
  for (const entry of byOldest) {
    if (projected <= limitBytes) break;
    victims.push(entry.key);
    projected -= entry.size;
  }
  return victims;
}
