"use client";

import { useWallet } from "@/components/providers/WalletContext";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/src/hooks/useLocale";

// ─── Sign-in button ──────────────────────────────────────────────────

/**
 * Smart sign-in button that adapts to the current auth state:
 * - No wallet connected → "Connect Wallet" (calls wallet connect)
 * - Wallet connected, not authenticated → "Sign In" (challenge-sign)
 * - Pending signature → "Pending Signature..." (disabled spinner)
 * - Already authenticated → renders nothing (managed by parent)
 */
export function SignInButton() {
  const { t } = useLocale();
  const { account, connect } = useWallet();
  const { status, error, login, isLoggingIn } = useAuth();

  // ── Already authenticated — nothing to show ────────────────────────

  if (status === "authenticated") {
    return null;
  }

  // ── No wallet connected — show Connect Wallet button ───────────────

  if (!account) {
    return (
      <button
        onClick={() => connect()}
        className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
        aria-label={t("auth.connectAria")}
      >
        <WalletIcon className="mr-2 h-4 w-4" />
        {t("auth.connectWallet")}
      </button>
    );
  }

  // ── Wallet connected, not authenticated — show Sign In ─────────────

  const isPending =
    status === "challenge_pending" ||
    status === "signing" ||
    status === "verifying" ||
    isLoggingIn;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
      onClick={isPending ? undefined : () => login()}
      disabled={isPending}
      className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      aria-label={isPending ? t("auth.waitingAria") : t("auth.signInAria")}
    >
      {isPending ? (
        <>
          <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
          {status === "challenge_pending" && t("auth.requestingChallenge")}
          {status === "signing" && t("auth.waitingSignature")}
          {status === "verifying" && t("auth.verifying")}
          {isLoggingIn &&
            status !== "challenge_pending" &&
            status !== "signing" &&
            status !== "verifying" &&
            t("auth.signingIn")}
        </>
      ) : (
        <>
          <SignInIcon className="mr-2 h-4 w-4" />
          {t("auth.signIn")}
        </>
      )}
    </button>
      {status === "error" && error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Inline icon components ──────────────────────────────────────────

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"
      />
    </svg>
  );
}

function SignInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
      />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
