import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Capture the SW invalidation subscriber so we can trigger it from tests.
let invalidationHandler: ((event: { certId: string }) => void) | null = null;
const broadcastSpy = vi.fn();

vi.mock("@/src/services/swRegistration", () => ({
  broadcastCertStatusChange: (...args: unknown[]) => broadcastSpy(...args),
  subscribeToCacheInvalidation: (handler: (event: { certId: string }) => void) => {
    invalidationHandler = handler;
    return () => {
      invalidationHandler = null;
    };
  },
}));

import { useCertificationCache } from "@/src/hooks/useCertificationCache";
import type { CertificationRecord } from "@/src/types/certification";

const record = (over: Partial<CertificationRecord> = {}): CertificationRecord => ({
  id: "cert-1",
  status: "verified",
  trustScore: 88,
  updatedAt: 1,
  ...over,
});

beforeEach(() => {
  broadcastSpy.mockClear();
  invalidationHandler = null;
});

describe("useCertificationCache", () => {
  it("loads data via the fetcher", async () => {
    const fetcher = vi.fn().mockResolvedValue(record());
    const { result } = renderHook(() =>
      useCertificationCache<CertificationRecord>("cert-1", "verified", { fetcher })
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data?.trustScore).toBe(88);
    expect(fetcher).toHaveBeenCalledWith("cert-1", "verified");
    expect(result.current.isLoading).toBe(false);
  });

  it("revalidates when this cert's cache is invalidated by the SW", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(record({ trustScore: 70 }))
      .mockResolvedValueOnce(record({ trustScore: 95 }));

    const { result } = renderHook(() =>
      useCertificationCache<CertificationRecord>("cert-1", "verified", { fetcher })
    );
    await waitFor(() => expect(result.current.data?.trustScore).toBe(70));

    act(() => invalidationHandler?.({ certId: "cert-1" }));
    await waitFor(() => expect(result.current.data?.trustScore).toBe(95));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("ignores invalidations for other certificates", async () => {
    const fetcher = vi.fn().mockResolvedValue(record());
    renderHook(() =>
      useCertificationCache<CertificationRecord>("cert-1", "verified", { fetcher })
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    act(() => invalidationHandler?.({ certId: "different-cert" }));
    // No extra fetch for an unrelated cert.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("broadcasts a status change on notifyStatusChange", async () => {
    const fetcher = vi.fn().mockResolvedValue(record());
    const { result } = renderHook(() =>
      useCertificationCache<CertificationRecord>("cert-1", "verified", { fetcher })
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => result.current.notifyStatusChange("revoked"));
    expect(broadcastSpy).toHaveBeenCalledWith("cert-1", "revoked", "verified");
  });

  it("surfaces fetch errors", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() =>
      useCertificationCache<CertificationRecord>("cert-1", "verified", { fetcher })
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe("boom");
  });
});
