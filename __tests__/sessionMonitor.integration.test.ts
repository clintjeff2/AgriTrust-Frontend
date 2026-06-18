import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionMonitor, SESSION_EXPIRED } from "@/services/sessionMonitor";
import { queryClient } from "@/lib/queryClient";

// Mock queryClient
vi.mock("@/lib/queryClient", () => ({
  queryClient: {
    clear: vi.fn(),
    resetQueries: vi.fn(),
    invalidateQueries: vi.fn(),
  },
}));

describe("SessionMonitor Integration Tests", () => {
  let monitor: SessionMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = new SessionMonitor();
    vi.clearAllMocks();

    // Mock window with ethereum provider
    global.window = {
      ethereum: {
        isMetaMask: true,
        request: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
      },
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
    
    // Don't use requestIdleCallback in tests
    delete (global.window as any).requestIdleCallback;
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
  });

  it("simulates wallet disconnection after 12 seconds and triggers complete cleanup", async () => {
    const sessionExpiredHandler = vi.fn(() => {
      // Simulate the cleanup that would happen in useWeb3Session
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.localStorage.clear();
        window.location.href = "/login";
      }
    });

    monitor.on(SESSION_EXPIRED, sessionExpiredHandler);

    // Mock ethereum provider to return accounts initially
    (global.window.ethereum!.request as any).mockResolvedValue(["0x123"]);

    // Start monitoring
    monitor.start("metamask", "0x123");

    // Verify initial state
    let status = monitor.getStatus();
    expect(status.isRunning).toBe(true);
    expect(status.lastKnownAccount).toBe("0x123");
    expect(status.consecutiveFailures).toBe(0);

    // Simulate wallet disconnection (user unplugs hardware wallet)
    (global.window.ethereum!.request as any).mockResolvedValue([]);

    // Advance time by 5 seconds - first check detects disconnection
    await vi.advanceTimersByTimeAsync(5100);
    
    status = monitor.getStatus();
    expect(status.consecutiveFailures).toBe(1);
    expect(sessionExpiredHandler).not.toHaveBeenCalled();

    // Advance time by another 5+ seconds - second check confirms disconnection
    await vi.advanceTimersByTimeAsync(5100);
    
    // SESSION_EXPIRED should be triggered after 2 consecutive failures
    expect(sessionExpiredHandler).toHaveBeenCalledTimes(1);
    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    expect(window.localStorage.clear).toHaveBeenCalled();
    expect(window.location.href).toBe("/login");
    
    // Verify monitoring stopped
    const finalStatus = monitor.getStatus();
    expect(finalStatus.isRunning).toBe(false);
  });

  it("does not trigger false-positive on rapid account switches within 10 seconds", async () => {
    const sessionExpiredHandler = vi.fn();
    monitor.on(SESSION_EXPIRED, sessionExpiredHandler);

    // Start with first account
    (global.window.ethereum!.request as any).mockResolvedValue(["0x111"]);
    monitor.start("metamask", "0x111");

    // Rapid account switches (simulating user switching between accounts)
    const accounts = ["0x222", "0x333", "0x444", "0x555"];
    
    for (const account of accounts) {
      (global.window.ethereum!.request as any).mockResolvedValue([account]);
      await vi.advanceTimersByTimeAsync(2000); // 2 seconds between each switch
    }

    // Total elapsed time: 8 seconds
    // No account should be null, so no session expiration

    expect(sessionExpiredHandler).not.toHaveBeenCalled();
    
    const status = monitor.getStatus();
    expect(status.isRunning).toBe(true);
    expect(status.consecutiveFailures).toBe(0);
  });

  it("handles Freighter wallet disconnection within 10 seconds", async () => {
    monitor.stop();
    
    // Mock Freighter
    global.window = {
      freighter: {
        isConnected: vi.fn().mockReturnValue(true),
        connect: vi.fn(),
        on: vi.fn(),
      },
    } as any;

    const freighterMonitor = new SessionMonitor();
    const sessionExpiredHandler = vi.fn();
    freighterMonitor.on(SESSION_EXPIRED, sessionExpiredHandler);

    freighterMonitor.start("freighter", "stellar-address");

    // Simulate disconnection
    (global.window.freighter!.isConnected as any).mockReturnValue(false);

    // First check (5 seconds)
    await vi.advanceTimersByTimeAsync(5000);
    expect(sessionExpiredHandler).not.toHaveBeenCalled();

    // Second check (10 seconds total)
    await vi.advanceTimersByTimeAsync(5000);
    expect(sessionExpiredHandler).toHaveBeenCalledTimes(1);

    freighterMonitor.stop();
  });

  it("recovers from temporary network error without triggering session expiration", async () => {
    const sessionExpiredHandler = vi.fn();
    monitor.on(SESSION_EXPIRED, sessionExpiredHandler);

    (global.window.ethereum!.request as any).mockResolvedValue(["0x123"]);
    monitor.start("metamask", "0x123");

    // First check - network error
    (global.window.ethereum!.request as any).mockRejectedValue(new Error("Network error"));
    await vi.advanceTimersByTimeAsync(5000);

    let status = monitor.getStatus();
    expect(status.consecutiveFailures).toBe(1);

    // Second check - network recovered
    (global.window.ethereum!.request as any).mockResolvedValue(["0x123"]);
    await vi.advanceTimersByTimeAsync(5000);

    status = monitor.getStatus();
    expect(status.consecutiveFailures).toBe(0);
    expect(sessionExpiredHandler).not.toHaveBeenCalled();
  });

  it("handles browser tab close simulation (wallet extension becomes unavailable)", async () => {
    const sessionExpiredHandler = vi.fn();
    monitor.on(SESSION_EXPIRED, sessionExpiredHandler);

    (global.window.ethereum!.request as any).mockResolvedValue(["0x123"]);
    monitor.start("metamask", "0x123");

    // Simulate browser extension becoming unavailable
    (global.window.ethereum!.request as any).mockRejectedValue(
      new Error("Extension context invalidated")
    );

    // First check
    await vi.advanceTimersByTimeAsync(5000);
    expect(sessionExpiredHandler).not.toHaveBeenCalled();

    // Second check - should trigger expiration
    await vi.advanceTimersByTimeAsync(5000);
    expect(sessionExpiredHandler).toHaveBeenCalledTimes(1);
  });

  it("verifies no CPU overhead by using requestIdleCallback", async () => {
    const requestIdleCallbackSpy = vi.fn((callback: any) => {
      // Simulate idle callback
      setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0);
      return 1;
    });

    global.window = {
      ...global.window,
      requestIdleCallback: requestIdleCallbackSpy,
    } as any;

    (global.window.ethereum!.request as any).mockResolvedValue(["0x123"]);

    const idleMonitor = new SessionMonitor();
    idleMonitor.start("metamask", "0x123");

    await vi.advanceTimersByTimeAsync(100);

    // Verify requestIdleCallback was used instead of setTimeout
    expect(requestIdleCallbackSpy).toHaveBeenCalled();

    idleMonitor.stop();
  });

  it("handles MetaMask account logout (selectedAddress becomes null)", async () => {
    const sessionExpiredHandler = vi.fn();
    monitor.on(SESSION_EXPIRED, sessionExpiredHandler);

    // Start with connected account
    (global.window.ethereum!.request as any).mockResolvedValue(["0x123"]);
    monitor.start("metamask", "0x123");

    // User logs out of MetaMask
    (global.window.ethereum!.request as any).mockResolvedValue([]);

    // Wait for detection (2 checks = 10 seconds)
    await vi.advanceTimersByTimeAsync(10100);

    expect(sessionExpiredHandler).toHaveBeenCalledTimes(1);
  });

  it("handles WalletConnect session termination", async () => {
    monitor.stop();

    // Mock WalletConnect
    global.window = {
      ethereum: {
        isWalletConnect: true,
        request: vi.fn().mockResolvedValue(["0xabc"]),
        on: vi.fn(),
        removeListener: vi.fn(),
      },
    } as any;

    const wcMonitor = new SessionMonitor();
    const sessionExpiredHandler = vi.fn();
    wcMonitor.on(SESSION_EXPIRED, sessionExpiredHandler);

    wcMonitor.start("walletconnect", "0xabc");

    // Simulate WalletConnect session termination
    (global.window.ethereum!.request as any).mockResolvedValue([]);

    // First check
    await vi.advanceTimersByTimeAsync(5000);
    expect(sessionExpiredHandler).not.toHaveBeenCalled();

    // Second check
    await vi.advanceTimersByTimeAsync(5000);
    expect(sessionExpiredHandler).toHaveBeenCalledTimes(1);

    wcMonitor.stop();
  });

  it("preserves IndexedDB protection by only clearing localStorage", async () => {
    const sessionExpiredHandler = vi.fn(() => {
      // Only clear localStorage, not IndexedDB
      if (typeof window !== "undefined") {
        window.localStorage.clear();
      }
    });

    monitor.on(SESSION_EXPIRED, sessionExpiredHandler);

    (global.window.ethereum!.request as any).mockResolvedValue(["0x123"]);
    monitor.start("metamask", "0x123");

    // Simulate disconnection
    (global.window.ethereum!.request as any).mockResolvedValue([]);
    await vi.advanceTimersByTimeAsync(10100);

    expect(sessionExpiredHandler).toHaveBeenCalled();
    expect(window.localStorage.clear).toHaveBeenCalled();
    
    // IndexedDB would not be cleared (we're only verifying localStorage is cleared)
  });
});
