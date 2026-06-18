"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import EventEmitter from "eventemitter3";
import { queryClient } from "@/lib/queryClient";
import { useWeb3Session } from "@/hooks/useWeb3Session";

const ACCOUNT_SWITCH = "ACCOUNT_SWITCH";

class AccountChangeChannel extends EventEmitter {
  private pendingAccount: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceWindow = 50;

  push(account: string | null): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.pendingAccount = account;

    this.debounceTimer = setTimeout(() => {
      this.emit(ACCOUNT_SWITCH, this.pendingAccount);
      this.pendingAccount = null;
      this.debounceTimer = null;
    }, this.debounceWindow);
  }

  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.removeAllListeners();
  }
}

type WalletProvider =
  | "metamask"
  | "walletconnect"
  | "freighter"
  | null;

interface WalletState {
  account: string | null;
  isSwitching: boolean;
  provider: WalletProvider;
  connect: (p?: WalletProvider) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

function detectProvider(): WalletProvider {
  if (typeof window === "undefined") return null;
  if (window.ethereum?.isMetaMask) return "metamask";
  if (window.ethereum?.isWalletConnect) return "walletconnect";
  if (window.freighter?.isConnected) return "freighter";
  return null;
}

async function connectWallet(provider: WalletProvider): Promise<string> {
  switch (provider) {
    case "metamask":
    case "walletconnect": {
      if (!window.ethereum) throw new Error("No ethereum provider found");
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      return accounts[0];
    }
    case "freighter": {
      const freighter = window.freighter;
      if (!freighter) throw new Error("Freighter not found");
      const { address } = await freighter.connect();
      return address;
    }
    default:
      throw new Error("Unsupported wallet provider");
  }
}

function getAccountsFromProvider(provider: WalletProvider): string[] | null {
  if (!provider || typeof window === "undefined") return null;
  switch (provider) {
    case "metamask":
    case "walletconnect":
      return window.ethereum?.selectedAddress
        ? [window.ethereum.selectedAddress]
        : null;
    case "freighter": {
      const freighter = window.freighter;
      if (freighter?.isConnected()) {
        return null;
      }
      return null;
    }
    default:
      return null;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [provider, setProvider] = useState<WalletProvider>(null);
  const channelRef = useRef<AccountChangeChannel | null>(null);
  const previousAccountRef = useRef<string | null>(null);

  const handleAccountSwitch = useCallback((newAccount: string | null) => {
    setIsSwitching(true);

    if (!newAccount) {
      queryClient.clear();
    } else {
      queryClient.resetQueries();
      queryClient.invalidateQueries();
    }

    setAccount(newAccount);
    previousAccountRef.current = newAccount;

    setTimeout(() => {
      setIsSwitching(false);
    }, 200);
  }, []);

  // Handle session expiration from SessionMonitor
  const handleSessionExpired = useCallback(() => {
    setAccount(null);
    setProvider(null);
    previousAccountRef.current = null;
    queryClient.clear();
    if (typeof window !== "undefined") {
      localStorage.clear();
      window.location.href = "/login";
    }
  }, []);

  // Handle account changes from SessionMonitor
  const handleMonitorAccountChanged = useCallback((newAccount: string) => {
    // The native wallet event handlers will handle the account switch
    // This is just for logging/debugging
    console.log("SessionMonitor detected account change:", newAccount);
  }, []);

  // Integrate session monitoring
  useWeb3Session({
    account,
    provider,
    onSessionExpired: handleSessionExpired,
    onAccountChanged: handleMonitorAccountChanged,
  });

  useEffect(() => {
    const channel = new AccountChangeChannel();
    channelRef.current = channel;

    channel.on(ACCOUNT_SWITCH, handleAccountSwitch);

    return () => {
      channel.off(ACCOUNT_SWITCH, handleAccountSwitch);
      channel.destroy();
      channelRef.current = null;
    };
  }, [handleAccountSwitch]);

  useEffect(() => {
    if (typeof window === "undefined" || !provider) return;

    const handler = (accounts: unknown) => {
      if (Array.isArray(accounts)) {
        const newAccount = accounts[0] ?? null;
        channelRef.current?.push(newAccount);
      }
    };

    const freighterHandler = () => {
      const accounts = getAccountsFromProvider(provider);
      if (accounts) {
        channelRef.current?.push(accounts[0] ?? null);
      }
    };

    if (provider === "metamask" || provider === "walletconnect") {
      window.ethereum?.on("accountsChanged", handler);
    }

    if (provider === "freighter") {
      window.freighter?.on("accountChanged", freighterHandler);
    }

    return () => {
      if (provider === "metamask" || provider === "walletconnect") {
        window.ethereum?.removeListener("accountsChanged", handler);
      }
      if (provider === "freighter") {
        window.freighter?.removeListener?.("accountChanged", freighterHandler);
      }
    };
  }, [provider]);

  const connect = useCallback(async (p?: WalletProvider) => {
    const resolvedProvider = p ?? detectProvider();
    if (!resolvedProvider) throw new Error("No wallet provider detected");

    const acct = await connectWallet(resolvedProvider);
    setProvider(resolvedProvider);
    setAccount(acct);
    previousAccountRef.current = acct;
  }, []);

  const disconnect = useCallback(() => {
    channelRef.current?.push(null);
    setProvider(null);
    setAccount(null);
    previousAccountRef.current = null;
    queryClient.clear();
  }, []);

  return (
    <WalletContext.Provider
      value={{
        account,
        isSwitching,
        provider,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return ctx;
}
