"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  broadcastCertStatusChange,
  subscribeToCacheInvalidation,
} from "@/src/services/swRegistration";
import { CERT_STATUS_CHANNEL } from "@/src/services/swCacheStrategy";
import { append as appendAuditEntry } from "@/src/services/auditLog";
import type {
  CertificationStatus,
  CertStatusChangeMessage,
} from "@/src/types/certification";

export interface UseCertificationCacheOptions<T> {
  /** Override the data fetcher (tests / custom transports). */
  fetcher?: (certId: string, status: CertificationStatus) => Promise<T>;
  /** Skip fetching until true. Defaults to true. */
  enabled?: boolean;
}

export interface UseCertificationCacheResult<T> {
  data: T | null;
  error: Error | null;
  /** True during the very first load (no data yet). */
  isLoading: boolean;
  /** True while a background revalidation is in flight. */
  isRevalidating: boolean;
  /** Force a revalidation against the network (SW handles freshness). */
  revalidate: () => Promise<void>;
  /**
   * Announce an on-chain status transition: purges the SW cache for this cert
   * across tabs, then revalidates. Call after a successful on-chain update.
   */
  notifyStatusChange: (toStatus: CertificationStatus) => void;
}

function defaultFetcher<T>(
  certId: string,
  status: CertificationStatus
): Promise<T> {
  // The status query segment lets the service worker build a `cert-v1-{status}-{id}`
  // cache key; the header is a redundant hint for non-SW transports.
  return fetch(
    `/api/v1/certifications/${encodeURIComponent(certId)}?status=${status}`,
    { credentials: "include", headers: { "x-cert-status": status } }
  ).then((res) => {
    if (!res.ok) {
      throw new Error(`Failed to load certification (${res.status})`);
    }
    return res.json() as Promise<T>;
  });
}

/**
 * Reads certification data through the service-worker cache and keeps it in
 * sync with lifecycle transitions. Revalidates automatically when a
 * `cert-status-change` ping (this tab or another) or an SW invalidation message
 * names this certificate. Revalidation never blocks the first render — stale
 * data stays visible until fresh data arrives.
 */
export function useCertificationCache<T = unknown>(
  certId: string,
  status: CertificationStatus,
  options: UseCertificationCacheOptions<T> = {}
): UseCertificationCacheResult<T> {
  const { fetcher = defaultFetcher, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);

  const requestTokenRef = useRef(0);
  const hasDataRef = useRef(false);
  // Keep the latest fetcher without re-subscribing channels on every render.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const load = useCallback(async () => {
    if (!enabled || !certId) return;

    const token = ++requestTokenRef.current;
    if (hasDataRef.current) {
      setIsRevalidating(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result = await fetcherRef.current(certId, status);
      if (token !== requestTokenRef.current) return; // superseded
      setData(result);
      hasDataRef.current = true;
      setError(null);
    } catch (err) {
      if (token !== requestTokenRef.current) return;
      setError(err instanceof Error ? err : new Error("Fetch failed"));
    } finally {
      if (token === requestTokenRef.current) {
        setIsLoading(false);
        setIsRevalidating(false);
      }
    }
  }, [certId, status, enabled]);

  // Initial load + reload on key change.
  useEffect(() => {
    void load();
  }, [load]);

  // Revalidate when this certificate is invalidated (same tab or cross-tab).
  useEffect(() => {
    if (!enabled || !certId) return;

    const unsubscribeSw = subscribeToCacheInvalidation((event) => {
      if (event.certId === certId) void load();
    });

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel(CERT_STATUS_CHANNEL);
      bc.onmessage = (event: MessageEvent<CertStatusChangeMessage>) => {
        if (event.data?.certId === certId) void load();
      };
    }

    return () => {
      unsubscribeSw();
      bc?.close();
    };
  }, [certId, enabled, load]);

  const notifyStatusChange = useCallback(
    (toStatus: CertificationStatus) => {
      broadcastCertStatusChange(certId, toStatus, status);
      void appendAuditEntry({
        certId,
        previousState: status,
        newState: toStatus,
        signer: "dashboard",
      });
    },
    [certId, status]
  );

  return {
    data,
    error,
    isLoading,
    isRevalidating,
    revalidate: load,
    notifyStatusChange,
  };
}
