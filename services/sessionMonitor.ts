import EventEmitter from "eventemitter3";

export type WalletProvider = "metamask" | "walletconnect" | "freighter" | null;

export const SESSION_EXPIRED = "SESSION_EXPIRED";
export const ACCOUNT_CHANGED = "ACCOUNT_CHANGED";

export interface WalletProviderAdapter {
  getActiveAccount(): Promise<string | null>;
}

class FreighterAdapter implements WalletProviderAdapter {
  async getActiveAccount(): Promise<string | null> {
    if (typeof window === "undefined" || !window.freighter) return null;
    try {
      const isConnected = window.freighter.isConnected();
      return isConnected ? "connected" : null;
    } catch {
      return null;
    }
  }
}

class MetaMaskAdapter implements WalletProviderAdapter {
  async getActiveAccount(): Promise<string | null> {
    if (typeof window === "undefined" || !window.ethereum?.isMetaMask)
      return null;
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_accounts",
      })) as string[];
      return accounts[0] ?? null;
    } catch {
      return null;
    }
  }
}

class WalletConnectAdapter implements WalletProviderAdapter {
  async getActiveAccount(): Promise<string | null> {
    if (typeof window === "undefined" || !window.ethereum?.isWalletConnect)
      return null;
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_accounts",
      })) as string[];
      return accounts[0] ?? null;
    } catch {
      return null;
    }
  }
}

export class SessionMonitor extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null;
  private lastKnownAccount: string | null = null;
  private consecutiveFailures: number = 0;
  private provider: WalletProviderAdapter | null = null;
  private readonly pollingInterval = 5000; // 5 seconds
  private readonly failureThreshold = 2; // 2 failures = 10 seconds
  private isRunning: boolean = false;

  start(providerType: WalletProvider, initialAccount: string | null): void {
    if (this.isRunning) {
      this.stop();
    }

    this.lastKnownAccount = initialAccount;
    this.consecutiveFailures = 0;
    this.provider = this.createAdapter(providerType);

    if (!this.provider) {
      console.warn(`SessionMonitor: Unsupported provider ${providerType}`);
      return;
    }

    this.isRunning = true;
    this.scheduleCheck();
  }

  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.provider = null;
    this.lastKnownAccount = null;
    this.consecutiveFailures = 0;
  }

  private createAdapter(
    providerType: WalletProvider
  ): WalletProviderAdapter | null {
    switch (providerType) {
      case "freighter":
        return new FreighterAdapter();
      case "metamask":
        return new MetaMaskAdapter();
      case "walletconnect":
        return new WalletConnectAdapter();
      default:
        return null;
    }
  }

  private scheduleCheck(): void {
    if (!this.isRunning) return;

    // Use requestIdleCallback when available for better performance
    if (typeof window !== "undefined" && "requestIdleCallback" in window && window.requestIdleCallback) {
      window.requestIdleCallback(
        () => {
          this.performCheck();
        },
        { timeout: this.pollingInterval }
      );
    } else {
      // Fallback to setTimeout
      this.intervalId = setTimeout(() => {
        this.performCheck();
      }, this.pollingInterval);
    }
  }

  private async performCheck(): Promise<void> {
    if (!this.provider || !this.isRunning) return;

    try {
      const currentAccount = await this.provider.getActiveAccount();

      if (currentAccount === null || currentAccount === undefined) {
        // Wallet disconnected
        this.consecutiveFailures++;

        if (this.consecutiveFailures >= this.failureThreshold) {
          // Confirmed disconnection after 10 seconds
          this.emit(SESSION_EXPIRED);
          this.stop();
          return;
        }
      } else if (currentAccount !== this.lastKnownAccount) {
        // Legitimate account switch
        this.consecutiveFailures = 0;
        this.lastKnownAccount = currentAccount;
        this.emit(ACCOUNT_CHANGED, currentAccount);
      } else {
        // Account still connected, reset failure counter
        this.consecutiveFailures = 0;
      }
    } catch (error) {
      console.error("SessionMonitor: Error checking wallet status", error);
      this.consecutiveFailures++;

      if (this.consecutiveFailures >= this.failureThreshold) {
        this.emit(SESSION_EXPIRED);
        this.stop();
        return;
      }
    }

    // Schedule next check
    this.scheduleCheck();
  }

  getStatus(): {
    isRunning: boolean;
    lastKnownAccount: string | null;
    consecutiveFailures: number;
  } {
    return {
      isRunning: this.isRunning,
      lastKnownAccount: this.lastKnownAccount,
      consecutiveFailures: this.consecutiveFailures,
    };
  }
}

// Singleton instance
export const sessionMonitor = new SessionMonitor();
