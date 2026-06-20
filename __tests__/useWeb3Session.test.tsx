import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWeb3Session } from "@/hooks/useWeb3Session";
import { sessionMonitor, SESSION_EXPIRED, ACCOUNT_CHANGED } from "@/services/sessionMonitor";
import { queryClient } from "@/lib/queryClient";

// ─── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/queryClient", () => ({
  queryClient: {
    clear: vi.fn(),
    resetQueries: vi.fn(),
    invalidateQueries: vi.fn(),
  },
}));

vi.mock("@/lib/apiClient", () => ({
  authApi: {
    getSession: vi.fn(),
    getChallenge: vi.fn(),
    verify: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    ping: vi.fn(),
  },
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(),
}));

import { authApi, setAccessToken } from "@/lib/apiClient";

// ─── Helpers ─────────────────────────────────────────────────────────

function setupMockBrowser() {
  // Mock window and fetch
  global.window = {
    location: { href: "" },
    localStorage: {
      clear: vi.fn(),
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn(),
    },
  } as any;

  global.fetch = vi.fn().mockResolvedValue({ ok: true });
}

function mockMetaMask() {
  (global.window as any).ethereum = {
    isMetaMask: true,
    request: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
}

function mockFreighter() {
  (global.window as any).freighter = {
    isConnected: vi.fn().mockReturnValue(true),
    signMessage: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("useWeb3Session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setupMockBrowser();
    mockMetaMask();

    // Default authApi mocks
    (authApi.getSession as any).mockResolvedValue({ user: null });
    (authApi.getChallenge as any).mockResolvedValue({
      nonce: "test-nonce-abc123",
      nonce_id: "nonce-id-xyz",
    });
    (authApi.verify as any).mockResolvedValue({
      token: "jwt-token-123",
      user: { address: "0x123", provider: "metamask" },
    });
    (authApi.logout as any).mockResolvedValue(undefined);
    (authApi.ping as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    sessionMonitor.stop();
    vi.useRealTimers();
  });

  // ── Backward-compatible: Session monitoring integration ─────────────

  describe("Session monitoring integration", () => {
    it("starts monitoring when account and provider are provided", () => {
      const startSpy = vi.spyOn(sessionMonitor, "start");

      renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      expect(startSpy).toHaveBeenCalledWith("metamask", "0x123");
    });

    it("stops monitoring when account becomes null", () => {
      const stopSpy = vi.spyOn(sessionMonitor, "stop");

      const { rerender } = renderHook(
        ({ account, provider }) =>
          useWeb3Session({
            account,
            provider,
          }),
        {
          initialProps: { account: "0x123" as string | null, provider: "metamask" as any },
        }
      );

      rerender({ account: null, provider: "metamask" as any });

      expect(stopSpy).toHaveBeenCalled();
    });

    it("stops monitoring on unmount", () => {
      const stopSpy = vi.spyOn(sessionMonitor, "stop");

      const { unmount } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      unmount();

      expect(stopSpy).toHaveBeenCalled();
    });
  });

  // ── Backward-compatible: Session expiration handling ────────────────

  describe("Session expiration handling", () => {
    it("clears queryClient cache on session expiration", async () => {
      renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      sessionMonitor.emit(SESSION_EXPIRED);

      await vi.waitFor(() => {
        expect(queryClient.clear).toHaveBeenCalledTimes(1);
      });
    });

    it("clears localStorage on session expiration", async () => {
      renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      sessionMonitor.emit(SESSION_EXPIRED);

      await vi.waitFor(() => {
        expect(global.window.localStorage.clear).toHaveBeenCalled();
      });
    });

    it("redirects to /login on session expiration", async () => {
      renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      sessionMonitor.emit(SESSION_EXPIRED);

      await vi.waitFor(() => {
        expect(global.window.location.href).toBe("/login");
      });
    });

    it("calls POST /api/v1/auth/logout on session expiration", async () => {
      renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      sessionMonitor.emit(SESSION_EXPIRED);

      await vi.waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/v1/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      });
    });

    it("calls custom onSessionExpired handler if provided", async () => {
      const customHandler = vi.fn();

      renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
          onSessionExpired: customHandler,
        })
      );

      sessionMonitor.emit(SESSION_EXPIRED);

      await vi.waitFor(() => {
        expect(customHandler).toHaveBeenCalledTimes(1);
      });
    });

    it("does not redirect to /login when custom handler is provided", async () => {
      const customHandler = vi.fn();

      renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
          onSessionExpired: customHandler,
        })
      );

      sessionMonitor.emit(SESSION_EXPIRED);

      await vi.waitFor(() => {
        expect(customHandler).toHaveBeenCalled();
      });

      expect(global.window.location.href).toBe("");
    });
  });

  // ── Backward-compatible: Account change handling ────────────────────

  describe("Account change handling", () => {
    it("calls onAccountChanged when account changes", async () => {
      const accountChangedHandler = vi.fn();

      renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
          onAccountChanged: accountChangedHandler,
        })
      );

      sessionMonitor.emit(ACCOUNT_CHANGED, "0x456");

      await vi.waitFor(() => {
        expect(accountChangedHandler).toHaveBeenCalledWith("0x456");
      });
    });

    it("does not clear cache on account change", async () => {
      const accountChangedHandler = vi.fn();

      renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
          onAccountChanged: accountChangedHandler,
        })
      );

      sessionMonitor.emit(ACCOUNT_CHANGED, "0x456");

      await vi.waitFor(() => {
        expect(accountChangedHandler).toHaveBeenCalled();
      });

      expect(queryClient.clear).not.toHaveBeenCalled();
    });
  });

  // ── Backward-compatible: Integration ────────────────────────────────

  describe("Integration test: Complete disconnection flow", () => {
    it("simulates wallet disconnection and asserts full cleanup", async () => {
      const startSpy = vi.spyOn(sessionMonitor, "start");

      renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      expect(startSpy).toHaveBeenCalledWith("metamask", "0x123");

      sessionMonitor.emit(SESSION_EXPIRED);

      await vi.waitFor(() => {
        expect(queryClient.clear).toHaveBeenCalledTimes(1);
        expect(global.window.localStorage.clear).toHaveBeenCalled();
        expect(global.window.location.href).toBe("/login");
        expect(global.fetch).toHaveBeenCalledWith("/api/v1/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      });
    });

    it("handles server logout failure gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      sessionMonitor.emit(SESSION_EXPIRED);

      await vi.waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      expect(queryClient.clear).toHaveBeenCalled();
      expect(global.window.localStorage.clear).toHaveBeenCalled();
    });
  });

  // ── Backward-compatible: Event handler registration ─────────────────

  describe("Event handler registration", () => {
    it("registers event handlers only once", () => {
      const onSpy = vi.spyOn(sessionMonitor, "on");

      const { rerender } = renderHook(
        ({ account }) =>
          useWeb3Session({
            account,
            provider: "metamask",
          }),
        {
          initialProps: { account: "0x123" },
        }
      );

      const initialCallCount = onSpy.mock.calls.length;

      rerender({ account: "0x123" });
      rerender({ account: "0x123" });

      expect(onSpy).toHaveBeenCalledTimes(initialCallCount);
    });

    it("unregisters event handlers on unmount", () => {
      const offSpy = vi.spyOn(sessionMonitor, "off");

      const { unmount } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      unmount();

      expect(offSpy).toHaveBeenCalledWith(SESSION_EXPIRED, expect.any(Function));
      expect(offSpy).toHaveBeenCalledWith(ACCOUNT_CHANGED, expect.any(Function));
    });
  });

  // ── Backward-compatible: Multiple provider types ────────────────────

  describe("Multiple provider types", () => {
    it("works with Freighter provider", () => {
      const startSpy = vi.spyOn(sessionMonitor, "start");

      renderHook(() =>
        useWeb3Session({
          account: "stellar-address",
          provider: "freighter",
        })
      );

      expect(startSpy).toHaveBeenCalledWith("freighter", "stellar-address");
    });

    it("works with WalletConnect provider", () => {
      const startSpy = vi.spyOn(sessionMonitor, "start");

      renderHook(() =>
        useWeb3Session({
          account: "0xabc",
          provider: "walletconnect",
        })
      );

      expect(startSpy).toHaveBeenCalledWith("walletconnect", "0xabc");
    });

    it("switches monitoring when provider changes", () => {
      const startSpy = vi.spyOn(sessionMonitor, "start");
      const stopSpy = vi.spyOn(sessionMonitor, "stop");

      const { rerender } = renderHook(
        ({ provider, account }) =>
          useWeb3Session({
            account,
            provider,
          }),
        {
          initialProps: {
            account: "0x123" as string | null,
            provider: "metamask" as any,
          },
        }
      );

      rerender({ account: "stellar-address", provider: "freighter" as any });

      expect(stopSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalledWith("freighter", "stellar-address");
    });
  });

  // ── NEW: Auth status & return value shape ───────────────────────────

  describe("Auth status and return value", () => {
    it("returns initial status 'idle' with null user when no session exists", () => {
      (authApi.getSession as any).mockResolvedValue({ user: null });

      const { result } = renderHook(() =>
        useWeb3Session({
          account: null,
          provider: null,
        })
      );

      expect(result.current.status).toBe("idle");
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("returns 'authenticated' status when existing session is found", async () => {
      (authApi.getSession as any).mockResolvedValue({
        user: { address: "0x123", provider: "metamask" },
      });

      const { result } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      await vi.waitFor(() => {
        expect(result.current.status).toBe("authenticated");
      });

      expect(result.current.user).toEqual({
        address: "0x123",
        provider: "metamask",
      });
    });

    it("stays idle when getSession fails (network error)", async () => {
      (authApi.getSession as any).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      await vi.waitFor(() => {
        expect(result.current.status).toBe("idle");
      });
    });

    it("exposes monitorStatus", () => {
      const { result } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      expect(result.current.monitorStatus).toBeDefined();
      expect(result.current.monitorStatus).toHaveProperty("isRunning");
    });
  });

  // ── NEW: Challenge-signing login flow ───────────────────────────────

  describe("Challenge-signing login flow", () => {
    it("transitions through challenge_pending → signing → verifying → authenticated", async () => {
      (window as any).ethereum.request.mockResolvedValue("0xsignature-hex");

      const { result } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      await act(async () => {
        await result.current.login("0x123", "metamask");
      });

      // Should end as authenticated
      expect(result.current.status).toBe("authenticated");
      expect(result.current.user).toEqual({
        address: "0x123",
        provider: "metamask",
      });

      // Verify API calls were made in the correct order
      expect(authApi.getChallenge).toHaveBeenCalledWith("0x123");
      expect(authApi.verify).toHaveBeenCalledWith(
        "nonce-id-xyz",
        "0xsignature-hex",
        "0x123"
      );
      expect(setAccessToken).toHaveBeenCalledWith("jwt-token-123");
    });

    it("sets status to 'error' when challenge request fails", async () => {
      (authApi.getChallenge as any).mockRejectedValue(
        new Error("Server unreachable")
      );

      const { result } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      await act(async () => {
        await result.current.login("0x123", "metamask");
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Server unreachable");
    });

    it("sets status to 'error' when wallet signing fails", async () => {
      (window as any).ethereum.request.mockRejectedValue(
        new Error("User rejected signature")
      );

      const { result } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      await act(async () => {
        await result.current.login("0x123", "metamask");
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("User rejected signature");
    });

    it("sets status to 'error' when verification fails", async () => {
      (window as any).ethereum.request.mockResolvedValue("0xsignature-hex");
      (authApi.verify as any).mockRejectedValue(
        new Error("Invalid signature")
      );

      const { result } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      await act(async () => {
        await result.current.login("0x123", "metamask");
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Invalid signature");
    });

    it("works with Freighter wallet", async () => {
      mockFreighter();
      (window as any).freighter.signMessage.mockResolvedValue({
        signedMessage: "freighter-sig-base64",
      });
      // Re-mock session to have null user
      (authApi.getSession as any).mockResolvedValue({ user: null });

      const { result } = renderHook(() =>
        useWeb3Session({
          account: "stellar-address",
          provider: "freighter",
        })
      );

      await act(async () => {
        await result.current.login("stellar-address", "freighter");
      });

      expect(result.current.status).toBe("authenticated");
      expect(authApi.verify).toHaveBeenCalledWith(
        "nonce-id-xyz",
        "freighter-sig-base64",
        "stellar-address"
      );
    });

    it("works with WalletConnect", async () => {
      (window as any).ethereum = {
        isWalletConnect: true,
        request: vi.fn().mockResolvedValue("0xwc-sig"),
        on: vi.fn(),
        removeListener: vi.fn(),
      };

      const { result } = renderHook(() =>
        useWeb3Session({
          account: "0xabc",
          provider: "walletconnect",
        })
      );

      await act(async () => {
        await result.current.login("0xabc", "walletconnect");
      });

      expect(result.current.status).toBe("authenticated");
    });

    it("prevents concurrent login attempts", async () => {
      (window as any).ethereum.request.mockResolvedValue("0xsignature-hex");

      const { result } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      // Start two login attempts concurrently
      await act(async () => {
        const p1 = result.current.login("0x123", "metamask");
        const p2 = result.current.login("0x123", "metamask");
        await Promise.allSettled([p1, p2]);
      });

      // getChallenge should only be called once
      expect(authApi.getChallenge).toHaveBeenCalledTimes(1);
    });
  });

  // ── NEW: Logout ─────────────────────────────────────────────────────

  describe("Logout", () => {
    it("resets state to idle and clears queryClient on logout", async () => {
      (authApi.getSession as any).mockResolvedValue({
        user: { address: "0x123", provider: "metamask" },
      });

      const { result } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      await vi.waitFor(() => {
        expect(result.current.status).toBe("authenticated");
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.status).toBe("idle");
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeNull();
      expect(authApi.logout).toHaveBeenCalled();
      expect(queryClient.clear).toHaveBeenCalled();
    });

    it("resets state even when server logout fails", async () => {
      (authApi.logout as any).mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      await act(async () => {
        await result.current.logout();
      });

      // Should still reset local state
      expect(result.current.status).toBe("idle");
      expect(result.current.user).toBeNull();
      expect(setAccessToken).toHaveBeenCalledWith(null);
    });
  });

  // ── NEW: Token refresh ──────────────────────────────────────────────

  describe("Token refresh", () => {
    it("returns true on successful refresh", async () => {
      (authApi.refresh as any).mockResolvedValue({ token: "new-jwt-token" });

      const { result } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      let success: boolean = false;
      await act(async () => {
        success = await result.current.refresh();
      });

      expect(success).toBe(true);
      expect(setAccessToken).toHaveBeenCalledWith("new-jwt-token");
    });

    it("returns false and sets status to expired on refresh failure", async () => {
      (authApi.refresh as any).mockRejectedValue(new Error("Refresh failed"));

      const { result } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      let success: boolean = true;
      await act(async () => {
        success = await result.current.refresh();
      });

      expect(success).toBe(false);
      expect(result.current.status).toBe("expired");
      expect(setAccessToken).toHaveBeenCalledWith(null);
    });
  });

  // ── NEW: Session ping loop ──────────────────────────────────────────

  describe("Session ping loop", () => {
    it("starts ping loop after successful authentication", async () => {
      (authApi.getSession as any).mockResolvedValue({
        user: { address: "0x123", provider: "metamask" },
      });

      renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      // Advance time past the ping interval
      await act(async () => {
        vi.advanceTimersByTime(61_000);
      });

      // The ping should NOT be called yet because the ping loop
      // only starts after authentication is confirmed
    });

    it("sets status to expired when ping returns 401", async () => {
      const onExpired = vi.fn();

      // First authenticate
      (authApi.getSession as any).mockResolvedValue({
        user: { address: "0x123", provider: "metamask" },
      });
      (authApi.ping as any).mockRejectedValue({ status: 401 });

      const { result } = renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
          onSessionExpired: onExpired,
        })
      );

      // Wait for authentication
      await vi.waitFor(() => {
        expect(result.current.status).toBe("authenticated");
      });

      // Advance time by 60+ seconds to trigger ping
      await act(async () => {
        vi.advanceTimersByTime(61_000);
      });

      // The ping should have been called and triggered expired state
      await vi.waitFor(() => {
        expect(authApi.ping).toHaveBeenCalled();
      });
    });
  });
});
