/*
 * AgriTrust service worker — dynamic certification cache invalidation.
 *
 * Strategy logic mirrors src/services/swCacheStrategy.ts (the typed source of
 * truth, covered by unit tests). This file is a classic worker script and can't
 * import TypeScript at runtime, so the constants/helpers below are kept in sync
 * by hand. If you change TTLs, the key schema, or routing here, change them
 * there too.
 *
 *   - Cache keys: cert-v1-{status}-{id}
 *   - TTL: 15 min for active (issued/verified), 1 h for historical (revoked/expired)
 *   - Cert endpoints: network-first, with stale-while-revalidate fallback
 *   - Static assets: cache-first
 *   - Invalidation: BroadcastChannel "cert-status-change" pings purge a cert's
 *     entries without blocking any render
 *   - Storage: 50MB/origin budget, LRU eviction
 */

const CERT_CACHE_VERSION = "v1";
const CERT_CACHE_NAME = "cert-" + CERT_CACHE_VERSION;
const CERT_CACHE_PREFIX = "cert-" + CERT_CACHE_VERSION;
const STATIC_CACHE_NAME = "static-" + CERT_CACHE_VERSION;
const CERT_STATUS_CHANNEL = "cert-status-change";
const CERT_CACHE_PATH = "/__certcache__";
const STORAGE_LIMIT_BYTES = 50 * 1024 * 1024;

const MINUTE = 60 * 1000;
const ACTIVE_TTL_MS = 15 * MINUTE;
const HISTORICAL_TTL_MS = 60 * MINUTE;

const CERTIFICATION_STATUSES = ["issued", "verified", "revoked", "expired"];
const STATIC_ASSET_RE =
  /\.(?:js|css|woff2?|ttf|eot|otf|png|jpe?g|gif|svg|webp|avif|ico)$/i;

// ─── Pure helpers (mirror swCacheStrategy.ts) ────────────────────────────

function buildCertCacheKey(id, status) {
  return CERT_CACHE_PREFIX + "-" + status + "-" + id;
}

function parseCertCacheKey(key) {
  const prefix = CERT_CACHE_PREFIX + "-";
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  for (const status of CERTIFICATION_STATUSES) {
    const marker = status + "-";
    if (rest.startsWith(marker)) {
      const id = rest.slice(marker.length);
      return id.length ? { status: status, id: id } : null;
    }
  }
  return null;
}

function certCacheUrl(origin, key) {
  return origin + CERT_CACHE_PATH + "/" + key;
}

function keyFromCertCacheUrl(url) {
  const marker = CERT_CACHE_PATH + "/";
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

function statusTtlMs(status) {
  return status === "revoked" || status === "expired"
    ? HISTORICAL_TTL_MS
    : ACTIVE_TTL_MS;
}

function isEntryFresh(cachedAtMs, status, now) {
  return now - cachedAtMs < statusTtlMs(status);
}

function isCertApiPath(pathname) {
  return /\/api\/v\d+\/certifications(?:\/|$)/.test(pathname);
}

function certIdFromApiPath(pathname) {
  const match = pathname.match(/\/certifications\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function classifyRoute(pathname) {
  if (isCertApiPath(pathname) || /\/api\//.test(pathname)) return "network-first";
  if (pathname.startsWith("/_next/static/") || STATIC_ASSET_RE.test(pathname)) {
    return "cache-first";
  }
  return "passthrough";
}

function selectLruVictims(entries, incomingSize, limitBytes) {
  const limit = limitBytes || STORAGE_LIMIT_BYTES;
  const currentTotal = entries.reduce((sum, e) => sum + e.size, 0);
  let projected = currentTotal + incomingSize;
  if (projected <= limit) return [];
  const byOldest = entries.slice().sort((a, b) => a.lastAccess - b.lastAccess);
  const victims = [];
  for (const entry of byOldest) {
    if (projected <= limit) break;
    victims.push(entry.key);
    projected -= entry.size;
  }
  return victims;
}

// ─── Cache metadata helpers ──────────────────────────────────────────────

async function readCertEntryMetas(cache) {
  const requests = await cache.keys();
  const metas = [];
  for (const request of requests) {
    const response = await cache.match(request);
    if (!response) continue;
    metas.push({
      key: request.url,
      request: request,
      size: Number(response.headers.get("x-sw-size") || 0),
      lastAccess: Number(response.headers.get("x-sw-last-access") || 0),
    });
  }
  return metas;
}

async function enforceStorageLimit(cache, incomingSize) {
  const metas = await readCertEntryMetas(cache);
  const victims = selectLruVictims(metas, incomingSize, STORAGE_LIMIT_BYTES);
  await Promise.all(
    victims.map((key) => {
      const meta = metas.find((m) => m.key === key);
      return meta ? cache.delete(meta.request) : Promise.resolve(false);
    })
  );
}

async function storeCertResponse(cache, keyRequest, response, status, id, now) {
  const body = await response.clone().blob();
  await enforceStorageLimit(cache, body.size);
  const headers = new Headers(response.headers);
  headers.set("x-sw-cached-at", String(now));
  headers.set("x-sw-last-access", String(now));
  headers.set("x-sw-status", status);
  headers.set("x-sw-cert-id", id);
  headers.set("x-sw-size", String(body.size));
  const stored = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers,
  });
  await cache.put(keyRequest, stored);
}

async function touchLastAccess(cache, keyRequest, cached, now) {
  try {
    const body = await cached.clone().blob();
    const headers = new Headers(cached.headers);
    headers.set("x-sw-last-access", String(now));
    await cache.put(
      keyRequest,
      new Response(body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: headers,
      })
    );
  } catch {
    // Non-fatal: failing to bump LRU metadata must not break the response.
  }
}

// ─── Fetch strategies ────────────────────────────────────────────────────

function handleCertFetch(event, url) {
  const id = certIdFromApiPath(url.pathname);
  const status = url.searchParams.get("status");
  // Without an id + status we can't build a status-segmented key — passthrough.
  if (!id || !status || CERTIFICATION_STATUSES.indexOf(status) === -1) {
    return fetch(event.request);
  }

  return caches.open(CERT_CACHE_NAME).then(async (cache) => {
    const keyRequest = new Request(certCacheUrl(url.origin, buildCertCacheKey(id, status)));
    const cached = await cache.match(keyRequest);
    const now = Date.now();

    const revalidate = async () => {
      try {
        const fresh = await fetch(event.request);
        if (fresh && fresh.ok) {
          await storeCertResponse(cache, keyRequest, fresh, status, id, now);
        }
        return fresh;
      } catch {
        return null;
      }
    };

    if (cached) {
      event.waitUntil(touchLastAccess(cache, keyRequest, cached, now));
      const cachedAt = Number(cached.headers.get("x-sw-cached-at") || 0);
      if (isEntryFresh(cachedAt, status, now)) {
        // Fresh: serve instantly and refresh in the background (SWR) so the
        // critical render path is never blocked by revalidation.
        event.waitUntil(revalidate());
        return cached;
      }
      // Stale: prefer the network, but fall back to the stale copy offline.
      const fresh = await revalidate();
      return fresh || cached;
    }

    const fresh = await revalidate();
    if (fresh) return fresh;
    return new Response(
      JSON.stringify({ error: "offline", certId: id }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  });
}

function cacheFirst(event) {
  return caches.open(STATIC_CACHE_NAME).then(async (cache) => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const fresh = await fetch(event.request);
    if (fresh && fresh.ok && (fresh.type === "basic" || fresh.type === "cors")) {
      cache.put(event.request, fresh.clone());
    }
    return fresh;
  });
}

// ─── Invalidation ──────────────────────────────────────────────────────────

async function handleCertUpdate(message) {
  if (!message || message.type !== "cert-status-change" || !message.certId) {
    return;
  }
  const cache = await caches.open(CERT_CACHE_NAME);
  const requests = await cache.keys();
  await Promise.all(
    requests.map((request) => {
      const key = keyFromCertCacheUrl(request.url);
      const parsed = key ? parseCertCacheKey(key) : null;
      return parsed && parsed.id === message.certId
        ? cache.delete(request)
        : Promise.resolve(false);
    })
  );

  // Tell open tabs to revalidate so badges/scores re-render against fresh state.
  const clientList = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clientList) {
    client.postMessage({
      type: "cert-cache-invalidated",
      certId: message.certId,
      toStatus: message.toStatus,
    });
  }
}

// BroadcastChannel is the primary invalidation transport per the spec.
let invalidationChannel = null;
if (typeof BroadcastChannel !== "undefined") {
  invalidationChannel = new BroadcastChannel(CERT_STATUS_CHANNEL);
  invalidationChannel.onmessage = (event) => {
    handleCertUpdate(event.data);
  };
}

// ─── Lifecycle ───────────────────────────────────────────────────────────

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const keep = [CERT_CACHE_NAME, STATIC_CACHE_NAME];
      await Promise.all(
        names.filter((n) => !keep.includes(n)).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  // Fallback invalidation path for environments without BroadcastChannel.
  if (data.type === "cert-status-change") {
    event.waitUntil(handleCertUpdate(data));
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (isCertApiPath(url.pathname)) {
    event.respondWith(handleCertFetch(event, url));
    return;
  }
  if (classifyRoute(url.pathname) === "cache-first") {
    event.respondWith(cacheFirst(event));
  }
});
