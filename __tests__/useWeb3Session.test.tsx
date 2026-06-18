import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWeb3Session } from "@/hooks/useWeb3Session";
import { sessionMonitor, SESSION_EXPIRED, ACCOUNT_CHANGED } from "@/services/sessionMonitor";
import { queryClient } from "@/lib/queryClient";

// Mock the queryClient
vi.mock("@/lib/queryClient", () => ({
  queryClient: {
    clear: vi.fn(),
    resetQueries: vi.fn(),
    invalidateQueries: vi.fn(),
  },
}));

describe("useWeb3Session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    
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
  });

  afterEach(() => {
    sessionMonitor.stop();
    vi.useRealTimers();
  });

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

      // Change to null account
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

  describe("Session expiration handling", () => {
    it("clears queryClient cache on session expiration", async () => {
      renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      // Emit SESSION_EXPIRED event
      sessionMonitor.emit(SESSION_EXPIRED);

      // Wait a tick for the event to be processed
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

      // Should not redirect when custom handler is provided
      expect(global.window.location.href).toBe("");
    });
  });

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

      // Cache should not be cleared on account change
      expect(queryClient.clear).not.toHaveBeenCalled();
    });
  });

  describe("Integration test: Complete disconnection flow", () => {
    it("simulates wallet disconnection and asserts full cleanup", async () => {
      // Mock the start method to verify it was called
      const startSpy = vi.spyOn(sessionMonitor, "start");
      
      renderHook(() =>
        useWeb3Session({
          account: "0x123",
          provider: "metamask",
        })
      );

      // Verify monitoring was started
      expect(startSpy).toHaveBeenCalledWith("metamask", "0x123");

      // Simulate disconnection by emitting SESSION_EXPIRED
      sessionMonitor.emit(SESSION_EXPIRED);

      // Wait for all cleanup operations
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
      // Mock fetch to reject
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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

      // Should still complete other cleanup operations
      expect(queryClient.clear).toHaveBeenCalled();
      expect(global.window.localStorage.clear).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

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

      // Rerender with same props
      rerender({ account: "0x123" });
      rerender({ account: "0x123" });

      // Should not register handlers again
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
            provider: "metamask" as any 
          },
        }
      );

      // Change provider
      rerender({ account: "stellar-address", provider: "freighter" as any });

      expect(stopSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalledWith("freighter", "stellar-address");
    });
  });
});
