/**
 * Unit tests for the wallet strategy registry.
 *
 * Verifies strategy registration, provider discovery, active-strategy
 * switching with disconnect/reconnect, and fallback chain resolution.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  StrategyRegistry,
  getStrategyRegistry,
  _resetStrategyRegistryForTests,
} from "@/src/services/wallet/strategyRegistry";
import type {
  WalletStrategy,
  AuthResult,
  SignPayload,
  ProviderMetadata,
} from "@/src/types/wallet";

// ── mock strategy factory ───────────────────────────────────────────────

function createMockStrategy(
  id: string,
  connected = false,
): WalletStrategy {
  let _connected = connected;
  let account: string | null = connected ? `0x${id}` : null;

  return {
    id,
    connect: vi.fn().mockImplementation(async (): Promise<AuthResult> => {
      _connected = true;
      account = `0x${id}`;
      return { account: account!, chainId: null };
    }),
    disconnect: vi.fn().mockImplementation(() => {
      _connected = false;
      account = null;
    }),
    sign: vi.fn().mockImplementation(async (_payload: SignPayload): Promise<AuthResult> => {
      return { account: account ?? "", chainId: null, signature: "0xsigned" };
    }),
    getAccount: () => account,
    isConnected: () => _connected,
  };
}

function createMockMetadata(id: string): ProviderMetadata {
  return {
    id,
    name: id.toUpperCase(),
    icon: `/icons/${id}.svg`,
    website: `https://${id}.example.com`,
    requiredFeatures: ["signMessage"],
    installed: false,
  };
}

// ── tests ───────────────────────────────────────────────────────────────

describe("StrategyRegistry", () => {
  let registry: StrategyRegistry;

  beforeEach(() => {
    registry = new StrategyRegistry();
  });

  describe("registration", () => {
    it("registers a strategy", () => {
      const strategy = createMockStrategy("test");
      const meta = createMockMetadata("test");
      registry.register(strategy, meta);

      expect(registry.has("test")).toBe(true);
      expect(registry.size).toBe(1);
      expect(registry.get("test")).toBe(strategy);
    });

    it("returns undefined for unknown strategy", () => {
      expect(registry.get("unknown")).toBeUndefined();
    });

    it("returns all registered strategies", () => {
      const a = createMockStrategy("a");
      const b = createMockStrategy("b");
      registry.register(a, createMockMetadata("a"));
      registry.register(b, createMockMetadata("b"));

      expect(registry.getAll()).toHaveLength(2);
    });

    it("stores metadata", () => {
      const strategy = createMockStrategy("meta");
      const meta = createMockMetadata("meta");
      registry.register(strategy, meta);

      const stored = registry.getMetadata("meta");
      expect(stored).toBeDefined();
      expect(stored?.name).toBe("META");
      expect(stored?.website).toBe("https://meta.example.com");
    });
  });

  describe("setActive", () => {
    it("connects and sets active strategy", async () => {
      const strategy = createMockStrategy("active");
      registry.register(strategy, createMockMetadata("active"));

      await registry.setActive("active");

      expect(registry.getActiveId()).toBe("active");
      expect(registry.getActive()?.isConnected()).toBe(true);
    });

    it("disconnects previous active before switching", async () => {
      const old = createMockStrategy("old");
      const newer = createMockStrategy("new");
      registry.register(old, createMockMetadata("old"));
      registry.register(newer, createMockMetadata("new"));

      await registry.setActive("old");
      expect(registry.getActiveId()).toBe("old");

      await registry.setActive("new");
      expect(registry.getActiveId()).toBe("new");
      // Old should be disconnected.
      expect(old.isConnected()).toBe(false);
    });

    it("throws on unknown strategy", async () => {
      await expect(registry.setActive("nope")).rejects.toThrow(
        "Unknown strategy: nope",
      );
    });

    it("emits strategy:active event", async () => {
      const strategy = createMockStrategy("event");
      registry.register(strategy, createMockMetadata("event"));

      const listener = vi.fn();
      registry.once("strategy:active", listener);

      await registry.setActive("event");
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "strategy:active",
          strategyId: "event",
        }),
      );
    });
  });

  describe("discoverProviders", () => {
    it("returns metadata for all registered providers", () => {
      const strategy = createMockStrategy("d1");
      registry.register(strategy, createMockMetadata("d1"));

      const providers = registry.discoverProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe("d1");
    });

    it("marks installed providers correctly (in browser env)", () => {
      // In jsdom, window.freighter is undefined, so no providers are installed.
      const strategy = createMockStrategy("freighter");
      registry.register(strategy, createMockMetadata("freighter"));

      const providers = registry.discoverProviders();
      expect(providers[0].installed).toBe(false);
    });
  });

  describe("fallback chain", () => {
    it("resolves to walletconnect when no extensions installed", () => {
      const a = createMockStrategy("freighter");
      const b = createMockStrategy("walletconnect");
      registry.register(a, createMockMetadata("freighter"));
      registry.register(b, createMockMetadata("walletconnect"));

      // In jsdom, neither freighter nor ethereum are available.
      const resolved = registry.resolveFallback();
      expect(resolved).toBe("walletconnect");
    });
  });

  describe("getInstalled", () => {
    it("returns empty when nothing is installed", () => {
      const a = createMockStrategy("a");
      registry.register(a, createMockMetadata("a"));
      expect(registry.getInstalled()).toHaveLength(0);
    });
  });

  describe("singleton", () => {
    beforeEach(() => {
      _resetStrategyRegistryForTests();
    });

    it("returns the same instance", () => {
      const r1 = getStrategyRegistry();
      const r2 = getStrategyRegistry();
      expect(r1).toBe(r2);
    });

    it("_reset clears the singleton", () => {
      const r1 = getStrategyRegistry();
      _resetStrategyRegistryForTests();
      const r2 = getStrategyRegistry();
      expect(r1).not.toBe(r2);
    });
  });
});
