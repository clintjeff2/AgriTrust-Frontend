/**
 * Strategy registration and discovery service.
 *
 * Maintains a registry of available wallet strategies and handles provider
 * auto-discovery, active-strategy switching, and fallback chain logic.
 */

import type {
  WalletStrategy,
  ProviderMetadata,
  RegistryEvent,
  RegistryEventType,
} from "@/src/types/wallet";
import EventEmitter from "eventemitter3";
import { createFreighterStrategy } from "@/src/services/wallet/strategies/freighterStrategy";
import { createLobstrStrategy } from "@/src/services/wallet/strategies/lobstrStrategy";
import { createWalletConnectStrategy } from "@/src/services/wallet/strategies/walletConnectStrategy";

// ── provider metadata presets ───────────────────────────────────────────

const FREIGHTER_META: ProviderMetadata = {
  id: "freighter",
  name: "Freighter",
  icon: "/icons/freighter.svg",
  website: "https://freighter.app",
  requiredFeatures: ["signMessage", "signTransaction"],
  installed: false,
};

const LOBSTR_META: ProviderMetadata = {
  id: "lobstr",
  name: "Lobstr",
  icon: "/icons/lobstr.svg",
  website: "https://lobstr.co",
  requiredFeatures: ["signMessage", "signTransaction", "qrCode"],
  installed: false,
};

const WALLETCONNECT_META: ProviderMetadata = {
  id: "walletconnect",
  name: "WalletConnect",
  icon: "/icons/walletconnect.svg",
  website: "https://walletconnect.com",
  requiredFeatures: ["qrCode", "signMessage"],
  installed: false,
};

// ── registry implementation ──────────────────────────────────────────────

export class StrategyRegistry extends EventEmitter {
  private strategies = new Map<string, WalletStrategy>();
  private metadata = new Map<string, ProviderMetadata>();
  private priorities = new Map<string, number>();
  private activeId: string | null = null;

  /**
   * Register a strategy with the registry.
   *
   * @param strategy  - The strategy to register.
   * @param metadata  - Provider metadata (name, icon, features).
   * @param priority  - Priority for auto-selection (higher = preferred).
   */
  register(
    strategy: WalletStrategy,
    metadata: ProviderMetadata,
    priority = 0,
  ): void {
    this.strategies.set(strategy.id, strategy);
    this.metadata.set(strategy.id, { ...metadata });
    this.priorities.set(strategy.id, priority);
    this.emit("strategy:registered", {
      type: "strategy:registered" as RegistryEventType,
      strategyId: strategy.id,
    } satisfies RegistryEvent);
  }

  /**
   * Scan for installed wallet providers and update discovery metadata.
   * Returns the list of available providers (both installed and not).
   */
  discoverProviders(): ProviderMetadata[] {
    const available: ProviderMetadata[] = [];

    for (const [id, meta] of this.metadata) {
      const installed = this.isProviderInstalled(id);
      const updatedMeta = { ...meta, installed };
      this.metadata.set(id, updatedMeta);
      available.push(updatedMeta);
    }

    // Sort: installed first, then by priority descending.
    available.sort((a, b) => {
      const aInstalled = a.installed ? 1 : 0;
      const bInstalled = b.installed ? 1 : 0;
      if (aInstalled !== bInstalled) return bInstalled - aInstalled;

      const aPrio = this.priorities.get(a.id) ?? 0;
      const bPrio = this.priorities.get(b.id) ?? 0;
      return bPrio - aPrio;
    });

    return available;
  }

  /**
   * Check whether a specific provider is installed in the browser.
   */
  private isProviderInstalled(id: string): boolean {
    if (typeof window === "undefined") return false;

    switch (id) {
      case "freighter":
        return typeof window.freighter?.isConnected === "function";
      case "lobstr":
        return window.lobstr !== undefined;
      case "walletconnect":
        return window.ethereum !== undefined;
      default:
        return false;
    }
  }

  /**
   * Set the active strategy.  Disconnects the current active strategy
   * (if any), then connects via the new one.  Does NOT require a page
   * reload.
   *
   * @param strategyId - The strategy id to activate.
   * @returns The auth result from the new connection.
   */
  async setActive(strategyId: string): Promise<void> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Unknown strategy: ${strategyId}`);
    }

    // Disconnect current strategy first.
    if (this.activeId) {
      const current = this.strategies.get(this.activeId);
      if (current) {
        try {
          current.disconnect();
        } catch {
          // Swallow disconnect errors — we're switching anyway.
        }
      }
    }

    await strategy.connect();
    this.activeId = strategyId;

    this.emit("strategy:active", {
      type: "strategy:active" as RegistryEventType,
      strategyId,
    } satisfies RegistryEvent);
  }

  /** Get the currently active strategy, or null if none is active. */
  getActive(): WalletStrategy | null {
    if (!this.activeId) return null;
    return this.strategies.get(this.activeId) ?? null;
  }

  /** Get the id of the currently active strategy. */
  getActiveId(): string | null {
    return this.activeId;
  }

  /** Get a strategy by id. */
  get(id: string): WalletStrategy | undefined {
    return this.strategies.get(id);
  }

  /** Get all registered strategies. */
  getAll(): WalletStrategy[] {
    return [...this.strategies.values()];
  }

  /** Get all registered strategies that are currently installed. */
  getInstalled(): WalletStrategy[] {
    return [...this.strategies.entries()]
      .filter(([id]) => this.isProviderInstalled(id))
      .map(([, strategy]) => strategy);
  }

  /** Get metadata for a strategy. */
  getMetadata(id: string): ProviderMetadata | undefined {
    return this.metadata.get(id);
  }

  /**
   * Resolve the best available strategy using the fallback chain:
   * 1. Preferred extension provider (if installed)
   * 2. WalletConnect (always listed)
   * 3. Ephemeral key pair (not implemented here; handled by caller)
   */
  resolveFallback(): string | null {
    // Try Freighter (Stellar-native extension).
    if (this.isProviderInstalled("freighter")) return "freighter";
    // Try Lobstr.
    if (this.isProviderInstalled("lobstr")) return "lobstr";
    // Fall back to WalletConnect.
    return "walletconnect";
  }

  /** Check if a strategy id is registered. */
  has(id: string): boolean {
    return this.strategies.has(id);
  }

  /** Number of registered strategies. */
  get size(): number {
    return this.strategies.size;
  }
}

// ── singleton ────────────────────────────────────────────────────────────

let instance: StrategyRegistry | null = null;

/** Get or create the singleton strategy registry and auto-initialize with defaults. */
export function getStrategyRegistry(): StrategyRegistry {
  if (!instance) {
    instance = new StrategyRegistry();
    // Auto-register default strategies on first access.
    instance.register(createFreighterStrategy(), { ...FREIGHTER_META }, 100);
    instance.register(createLobstrStrategy(), { ...LOBSTR_META }, 50);
    instance.register(createWalletConnectStrategy(), { ...WALLETCONNECT_META }, 0);
  }
  return instance;
}

/** Reset the singleton for testing. */
export function _resetStrategyRegistryForTests(): void {
  instance = null;
}
