"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@/components/providers/WalletContext";
import {
  useWeb3Session,
  type AuthStatus,
  type AuthUser,
} from "@/hooks/useWeb3Session";

// ─── Auth context shape ──────────────────────────────────────────────

interface AuthContextValue {
  /** Current authentication status */
  status: AuthStatus;
  /** Authenticated user info */
  user: AuthUser | null;
  /** Error message if status is 'error' */
  error: string | null;
  /** Initiate the challenge-signing login flow */
  login: () => Promise<void>;
  /** Log out and clear session */
  logout: () => Promise<void>;
  /** Manually refresh the access token */
  refresh: () => Promise<boolean>;
  /** Whether a login operation is in progress */
  isLoggingIn: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const { account, provider, disconnect: disconnectWallet } = useWallet();

  // When session expires, also disconnect the wallet to clear wallet state.
  // Do NOT pass onSessionExpired here intentionally — let useWeb3Session's
  // default redirect (/login) handle the navigation.
  const handleAccountChanged = useCallback(
    (newAccount: string) => {
      console.log("AuthProvider: account changed to", newAccount);
    },
    []
  );

  const {
    status,
    user,
    error,
    login: sessionLogin,
    logout: sessionLogout,
    refresh: sessionRefresh,
  } = useWeb3Session({
    account,
    provider,
    // Intentionally NOT passing onSessionExpired so the default redirect fires
    onAccountChanged: handleAccountChanged,
  });

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ── login() — connects wallet if needed, then signs in ─────────────

  const login = useCallback(async (): Promise<void> => {
    if (!account || !provider) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    setIsLoggingIn(true);
    try {
      await sessionLogin(account, provider);
    } finally {
      setIsLoggingIn(false);
    }
  }, [account, provider, sessionLogin]);

  // ── logout() — disconnects wallet and clears auth state ─────────────

  const logout = useCallback(async (): Promise<void> => {
    await sessionLogout();
  }, [sessionLogout]);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        error,
        login,
        logout,
        refresh: sessionRefresh,
        isLoggingIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
