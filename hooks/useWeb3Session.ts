import { useEffect, useCallback, useRef } from "react";
import {
  sessionMonitor,
  SESSION_EXPIRED,
  ACCOUNT_CHANGED,
  type WalletProvider,
} from "@/services/sessionMonitor";
import { queryClient } from "@/lib/queryClient";

interface UseWeb3SessionOptions {
  account: string | null;
  provider: WalletProvider;
  onSessionExpired?: () => void;
  onAccountChanged?: (newAccount: string) => void;
}

export function useWeb3Session({
  account,
  provider,
  onSessionExpired,
  onAccountChanged,
}: UseWeb3SessionOptions) {
  const handlersRegistered = useRef(false);

  const handleSessionExpired = useCallback(() => {
    // Clear all caches
    queryClient.clear();

    // Clear localStorage
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }

    // Call custom handler if provided
    if (onSessionExpired) {
      onSessionExpired();
    } else {
      // Default behavior: redirect to login
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    // Optional: Call server logout endpoint
    if (typeof window !== "undefined") {
      fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      }).catch((error) => {
        console.error("Failed to logout on server:", error);
      });
    }
  }, [onSessionExpired]);

  const handleAccountChanged = useCallback(
    (newAccount: string) => {
      if (onAccountChanged) {
        onAccountChanged(newAccount);
      }
    },
    [onAccountChanged]
  );

  // Register event handlers
  useEffect(() => {
    if (!handlersRegistered.current) {
      sessionMonitor.on(SESSION_EXPIRED, handleSessionExpired);
      sessionMonitor.on(ACCOUNT_CHANGED, handleAccountChanged);
      handlersRegistered.current = true;
    }

    return () => {
      if (handlersRegistered.current) {
        sessionMonitor.off(SESSION_EXPIRED, handleSessionExpired);
        sessionMonitor.off(ACCOUNT_CHANGED, handleAccountChanged);
        handlersRegistered.current = false;
      }
    };
  }, [handleSessionExpired, handleAccountChanged]);

  // Start/stop monitoring based on account and provider
  useEffect(() => {
    if (account && provider) {
      sessionMonitor.start(provider, account);
    } else {
      sessionMonitor.stop();
    }

    return () => {
      sessionMonitor.stop();
    };
  }, [account, provider]);

  return {
    monitorStatus: sessionMonitor.getStatus(),
  };
}
