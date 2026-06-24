import { describe, it, expect } from "vitest";
import {
  buildCertCacheKey,
  parseCertCacheKey,
  certCacheUrl,
  keyFromCertCacheUrl,
  statusTtlMs,
  isEntryFresh,
  classifyRoute,
  isCertApiPath,
  certIdFromApiPath,
  selectLruVictims,
  ACTIVE_TTL_MS,
  HISTORICAL_TTL_MS,
  CERT_CACHE_PREFIX,
  STORAGE_LIMIT_BYTES,
} from "@/src/services/swCacheStrategy";

describe("cache key schema", () => {
  it("builds the cert-v1-{status}-{id} key", () => {
    expect(buildCertCacheKey("abc", "verified")).toBe("cert-v1-verified-abc");
    expect(CERT_CACHE_PREFIX).toBe("cert-v1");
  });

  it("round-trips keys whose id contains dashes (UUID)", () => {
    const id = "9f8b2c1a-1234-4def-9abc-000000000001";
    const key = buildCertCacheKey(id, "revoked");
    expect(parseCertCacheKey(key)).toEqual({ status: "revoked", id });
  });

  it("rejects malformed or unknown-status keys", () => {
    expect(parseCertCacheKey("form-draft-x")).toBeNull();
    expect(parseCertCacheKey("cert-v1-bogus-abc")).toBeNull();
    expect(parseCertCacheKey("cert-v1-verified-")).toBeNull();
  });

  it("round-trips through the synthetic cache URL", () => {
    const key = buildCertCacheKey("abc-1", "issued");
    const url = certCacheUrl("https://app.test", key);
    expect(url).toBe("https://app.test/__certcache__/cert-v1-issued-abc-1");
    expect(keyFromCertCacheUrl(url)).toBe(key);
    expect(keyFromCertCacheUrl("https://app.test/other")).toBeNull();
  });
});

describe("TTL by status", () => {
  it("uses 15 min for active and 1 h for historical", () => {
    expect(statusTtlMs("issued")).toBe(ACTIVE_TTL_MS);
    expect(statusTtlMs("verified")).toBe(ACTIVE_TTL_MS);
    expect(statusTtlMs("revoked")).toBe(HISTORICAL_TTL_MS);
    expect(statusTtlMs("expired")).toBe(HISTORICAL_TTL_MS);
    expect(ACTIVE_TTL_MS).toBe(15 * 60 * 1000);
    expect(HISTORICAL_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("marks entries fresh within and stale beyond their TTL", () => {
    const now = 10_000_000;
    expect(isEntryFresh(now - ACTIVE_TTL_MS + 1, "verified", now)).toBe(true);
    expect(isEntryFresh(now - ACTIVE_TTL_MS - 1, "verified", now)).toBe(false);
    // A revoked entry of the same age is still fresh (longer TTL).
    expect(isEntryFresh(now - ACTIVE_TTL_MS - 1, "revoked", now)).toBe(true);
  });
});

describe("route classification", () => {
  it("treats certification + api endpoints as network-first", () => {
    expect(classifyRoute("/api/v1/certifications/abc")).toBe("network-first");
    expect(classifyRoute("/api/v1/auth/session")).toBe("network-first");
  });

  it("treats static assets and next build output as cache-first", () => {
    expect(classifyRoute("/_next/static/chunks/main.js")).toBe("cache-first");
    expect(classifyRoute("/icons/logo.svg")).toBe("cache-first");
    expect(classifyRoute("/fonts/inter.woff2")).toBe("cache-first");
  });

  it("passes through everything else (e.g. navigations)", () => {
    expect(classifyRoute("/dashboard")).toBe("passthrough");
  });

  it("identifies cert API paths and extracts the id", () => {
    expect(isCertApiPath("/api/v1/certifications/abc")).toBe(true);
    expect(isCertApiPath("/api/v2/certifications")).toBe(true);
    expect(isCertApiPath("/api/v1/audits/abc")).toBe(false);
    expect(certIdFromApiPath("/api/v1/certifications/cert-42")).toBe("cert-42");
    expect(certIdFromApiPath("/api/v1/certifications/a%2Fb")).toBe("a/b");
    expect(certIdFromApiPath("/api/v1/audits/x")).toBeNull();
  });
});

describe("LRU eviction planner", () => {
  const mb = (n: number) => n * 1024 * 1024;

  it("evicts nothing when within budget", () => {
    const entries = [
      { key: "a", size: mb(10), lastAccess: 1 },
      { key: "b", size: mb(10), lastAccess: 2 },
    ];
    expect(selectLruVictims(entries, mb(5), STORAGE_LIMIT_BYTES)).toEqual([]);
  });

  it("evicts least-recently-accessed entries until under budget", () => {
    const entries = [
      { key: "old", size: mb(20), lastAccess: 1 },
      { key: "mid", size: mb(20), lastAccess: 5 },
      { key: "new", size: mb(20), lastAccess: 9 },
    ];
    // 60MB cached + 15MB incoming = 75MB; drop old (→55) then mid (→35 ≤ 50).
    const victims = selectLruVictims(entries, mb(15), STORAGE_LIMIT_BYTES);
    expect(victims).toEqual(["old", "mid"]);
  });

  it("stops as soon as the projected total fits", () => {
    const entries = [
      { key: "old", size: mb(30), lastAccess: 1 },
      { key: "new", size: mb(15), lastAccess: 9 },
    ];
    // 45MB + 10MB = 55MB > 50MB; dropping just "old" (30MB) is enough.
    expect(selectLruVictims(entries, mb(10), STORAGE_LIMIT_BYTES)).toEqual([
      "old",
    ]);
  });
});
