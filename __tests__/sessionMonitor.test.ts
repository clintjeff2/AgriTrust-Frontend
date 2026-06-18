import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SessionMonitor,
  SESSION_EXPIRED,
  ACCOUNT_CHANGED,
  type WalletProviderAdapter,
} from "@/services/sessionMonitor";

// Mock adapter for testing
class MockAdapter implements WalletProviderAdapter {
  private account: string | null = null;
  private shouldThrow = false;

  setAccount(account: string | null): void {
    this.account = account;
  }

  setShouldThrow(shouldThrow: boolean): void {
    this.shouldThrow = shouldThrow;
  }

  async getActiveAccount(): Promise<string | null> {
    if (this.shouldThrow) {
      throw new Error("Provider error");
    }
    return this.account;
  }
}

describe("SessionMonitor", () => {
  let monitor: SessionMonitor;
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = new SessionMonitor();
    mockAdapter = new MockAdapter();
    
    // Mock the createAdapter method to return our mock
    monitor["createAdapter"] = vi.fn().mockReturnValue(mockAdapter);
    
    // Ensure requestIdleCallback is not available to use setTimeout fallback
    if (typeof global.window !== "undefined") {
      delete (global.window as any).requestIdleCallback;
    }
  });

  afterEach(() => {
    monitor.stop();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("Polling interval and detection latency", () => {
    it("checks wallet provider account status every 5 seconds", async () => {
      const getActiveAccountSpy = vi.spyOn(mockAdapter, "getActiveAccount");
      mockAdapter.setAccount("0x123");

      monitor.start("metamask", "0x123");

      // Wait for first check to complete
      await vi.advanceTimersByTimeAsync(5100);
      await Promise.resolve();
      expect(getActiveAccountSpy).toHaveBeenCalledTimes(1);

      // After another 5 seconds
      await vi.advanceTimersByTimeAsync(5000);
      await Promise.resolve();
      expect(getActiveAccountSpy).toHaveBeenCalledTimes(2);

      // After another 5 seconds
      await vi.advanceTimersByTimeAsync(5000);
      await Promise.resolve();
      expect(getActiveAccountSpy).toHaveBeenCalledTimes(3);
    });

    it("invalidates session within 10 seconds of wallet disconnection", async () => {
      const sessionExpiredHandler = vi.fn();
      monitor.on(SESSION_EXPIRED, sessionExpiredHandler);

      mockAdapter.setAccount("0x123");
      monitor.start("metamask", "0x123");

      // Simulate wallet disconnection
      mockAdapter.setAccount(null);

      // First check detects disconnection (consecutiveFailures = 1)
      await vi.advanceTimersByTimeAsync(5100);
      expect(sessionExpiredHandler).not.toHaveBeenCalled();

      // Second check confirms disconnection (consecutiveFailures = 2)
      await vi.advanceTimersByTimeAsync(5100);
      expect(sessionExpiredHandler).toHaveBeenCalledTimes(1);
    });

    it("session is invalidated within exactly 10 seconds", async () => {
      const sessionExpiredHandler = vi.fn();
      monitor.on(SESSION_EXPIRED, sessionExpiredHandler);

      mockAdapter.setAccount("0x123");
      monitor.start("metamask", "0x123");

      // Disconnect wallet
      mockAdapter.setAccount(null);

      // At 9 seconds, should not be expired yet
      await vi.advanceTimersByTimeAsync(9000);
      expect(sessionExpiredHandler).not.toHaveBeenCalled();

      // At 10+ seconds, should be expired
      await vi.advanceTimersByTimeAsync(1500);
      expect(sessionExpiredHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("Account switch handling", () => {
    it("does not trigger false-positive logout on legitimate account switch", async () => {
      const sessionExpiredHandler = vi.fn();
      const accountChangedHandler = vi.fn();
      monitor.on(SESSION_EXPIRED, sessionExpiredHandler);
      monitor.on(ACCOUNT_CHANGED, accountChangedHandler);

      mockAdapter.setAccount("0x123");
      monitor.start("metamask", "0x123");

      // Fast account switch
      mockAdapter.setAccount("0x456");
      await vi.advanceTimersByTimeAsync(5100);

      expect(accountChangedHandler).toHaveBeenCalledWith("0x456");
      expect(sessionExpiredHandler).not.toHaveBeenCalled();

      // Another fast switch
      mockAdapter.setAccount("0x789");
      await vi.advanceTimersByTimeAsync(5100);

      expect(accountChangedHandler).toHaveBeenCalledWith("0x789");
      expect(sessionExpiredHandler).not.toHaveBeenCalled();
    });

    it("resets consecutiveFailures counter on successful account switch", async () => {
      mockAdapter.setAccount("0x123");
      monitor.start("metamask", "0x123");

      // First disconnection check
      mockAdapter.setAccount(null);
      await vi.advanceTimersByTimeAsync(5100);

      const status1 = monitor.getStatus();
      expect(status1.consecutiveFailures).toBe(1);

      // Account reconnects before second check
      mockAdapter.setAccount("0x456");
      await vi.advanceTimersByTimeAsync(5100);

      const status2 = monitor.getStatus();
      expect(status2.consecutiveFailures).toBe(0);
      expect(status2.lastKnownAccount).toBe("0x456");
    });

    it("handles multiple rapid account switches correctly", async () => {
      const accountChangedHandler = vi.fn();
      monitor.on(ACCOUNT_CHANGED, accountChangedHandler);

      mockAdapter.setAccount("0x111");
      monitor.start("metamask", "0x111");

      const accounts = ["0x222", "0x333", "0x444", "0x555"];
      
      for (const account of accounts) {
        mockAdapter.setAccount(account);
        await vi.advanceTimersByTimeAsync(5100);
      }

      expect(accountChangedHandler).toHaveBeenCalledTimes(4);
      expect(accountChangedHandler).toHaveBeenNthCalledWith(1, "0x222");
      expect(accountChangedHandler).toHaveBeenNthCalledWith(2, "0x333");
      expect(accountChangedHandler).toHaveBeenNthCalledWith(3, "0x444");
      expect(accountChangedHandler).toHaveBeenNthCalledWith(4, "0x555");
    });
  });

  describe("Multi-provider support", () => {
    it("supports Freighter provider", () => {
      monitor.stop();
      vi.restoreAllMocks();
      
      const realMonitor = new SessionMonitor();
      
      // Mock window.freighter
      global.window = {
        freighter: {
          isConnected: vi.fn().mockReturnValue(true),
          connect: vi.fn(),
          on: vi.fn(),
        },
      } as any;

      realMonitor.start("freighter", "stellar-address");
      const status = realMonitor.getStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.lastKnownAccount).toBe("stellar-address");
      
      realMonitor.stop();
    });

    it("supports MetaMask provider", () => {
      monitor.stop();
      vi.restoreAllMocks();
      
      const realMonitor = new SessionMonitor();
      
      // Mock window.ethereum
      global.window = {
        ethereum: {
          isMetaMask: true,
          request: vi.fn().mockResolvedValue(["0xabc"]),
          on: vi.fn(),
          removeListener: vi.fn(),
        },
      } as any;

      realMonitor.start("metamask", "0xabc");
      const status = realMonitor.getStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.lastKnownAccount).toBe("0xabc");
      
      realMonitor.stop();
    });

    it("supports WalletConnect provider", () => {
      monitor.stop();
      vi.restoreAllMocks();
      
      const realMonitor = new SessionMonitor();
      
      // Mock window.ethereum with WalletConnect
      global.window = {
        ethereum: {
          isWalletConnect: true,
          request: vi.fn().mockResolvedValue(["0xdef"]),
          on: vi.fn(),
          removeListener: vi.fn(),
        },
      } as any;

      realMonitor.start("walletconnect", "0xdef");
      const status = realMonitor.getStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.lastKnownAccount).toBe("0xdef");
      
      realMonitor.stop();
    });
  });

  describe("Error handling", () => {
    it("emits SESSION_EXPIRED after 2 consecutive provider errors", async () => {
      const sessionExpiredHandler = vi.fn();
      monitor.on(SESSION_EXPIRED, sessionExpiredHandler);

      mockAdapter.setAccount("0x123");
      monitor.start("metamask", "0x123");

      // Simulate provider error
      mockAdapter.setShouldThrow(true);

      // First error
      await vi.advanceTimersByTimeAsync(5100);
      expect(sessionExpiredHandler).not.toHaveBeenCalled();

      // Second error - should trigger SESSION_EXPIRED
      await vi.advanceTimersByTimeAsync(5100);
      expect(sessionExpiredHandler).toHaveBeenCalledTimes(1);
    });

    it("recovers from single provider error if next check succeeds", async () => {
      const sessionExpiredHandler = vi.fn();
      monitor.on(SESSION_EXPIRED, sessionExpiredHandler);

      mockAdapter.setAccount("0x123");
      monitor.start("metamask", "0x123");

      // First check - error
      mockAdapter.setShouldThrow(true);
      await vi.advanceTimersByTimeAsync(5100);

      const status1 = monitor.getStatus();
      expect(status1.consecutiveFailures).toBe(1);

      // Second check - recovery
      mockAdapter.setShouldThrow(false);
      mockAdapter.setAccount("0x123");
      await vi.advanceTimersByTimeAsync(5100);

      const status2 = monitor.getStatus();
      expect(status2.consecutiveFailures).toBe(0);
      expect(sessionExpiredHandler).not.toHaveBeenCalled();
    });
  });

  describe("Start/Stop behavior", () => {
    it("stops monitoring when stop() is called", async () => {
      const getActiveAccountSpy = vi.spyOn(mockAdapter, "getActiveAccount");
      mockAdapter.setAccount("0x123");

      monitor.start("metamask", "0x123");
      await vi.advanceTimersByTimeAsync(5100);
      
      const callCountBeforeStop = getActiveAccountSpy.mock.calls.length;
      
      monitor.stop();
      
      // Advance time significantly
      await vi.advanceTimersByTimeAsync(20000);
      
      // Should not have made any more calls
      expect(getActiveAccountSpy).toHaveBeenCalledTimes(callCountBeforeStop);
    });

    it("restarts monitoring correctly when start() is called again", async () => {
      mockAdapter.setAccount("0x123");
      monitor.start("metamask", "0x123");

      monitor.stop();

      const status1 = monitor.getStatus();
      expect(status1.isRunning).toBe(false);

      mockAdapter.setAccount("0x456");
      monitor.start("metamask", "0x456");

      const status2 = monitor.getStatus();
      expect(status2.isRunning).toBe(true);
      expect(status2.lastKnownAccount).toBe("0x456");
      expect(status2.consecutiveFailures).toBe(0);
    });

    it("clears state when stop() is called", () => {
      mockAdapter.setAccount("0x123");
      monitor.start("metamask", "0x123");

      monitor.stop();

      const status = monitor.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.lastKnownAccount).toBeNull();
      expect(status.consecutiveFailures).toBe(0);
    });
  });

  describe("getStatus()", () => {
    it("returns correct status information", async () => {
      mockAdapter.setAccount("0x123");
      monitor.start("metamask", "0x123");

      const initialStatus = monitor.getStatus();
      expect(initialStatus.isRunning).toBe(true);
      expect(initialStatus.lastKnownAccount).toBe("0x123");
      expect(initialStatus.consecutiveFailures).toBe(0);

      // Simulate disconnection
      mockAdapter.setAccount(null);
      await vi.advanceTimersByTimeAsync(5100);

      const afterDisconnectStatus = monitor.getStatus();
      expect(afterDisconnectStatus.consecutiveFailures).toBe(1);
    });
  });
});
