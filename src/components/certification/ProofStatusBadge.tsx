"use client";

import React from "react";
import type {
  ProofLifecycleState,
  VerificationResult,
} from "@/src/types/zkp";

interface ProofStatusBadgeProps {
  state: ProofLifecycleState;
  result?: VerificationResult | null;
  error?: string | null;
  /** Optional label for what is being proven, shown alongside the status. */
  claim?: string;
}

const BUSY_STATES: ProofLifecycleState[] = [
  "loading-circuit",
  "proving",
  "verifying",
];

function label(state: ProofLifecycleState): string {
  switch (state) {
    case "idle":
      return "Not verified";
    case "loading-circuit":
      return "Loading circuit…";
    case "proving":
      return "Generating proof…";
    case "verifying":
      return "Verifying…";
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
    case "error":
      return "Error";
  }
}

function tone(state: ProofLifecycleState): string {
  if (state === "verified") return "bg-green-500";
  if (state === "rejected" || state === "error") return "bg-red-500";
  if (BUSY_STATES.includes(state)) return "bg-blue-500";
  return "bg-gray-400";
}

/**
 * Compact status indicator for a zero-knowledge verification. Shows a spinner
 * while the proof is being generated or verified, then a green (verified) or
 * red (rejected/error) badge. Drive it from `useZeroKnowledgeProof`.
 */
export const ProofStatusBadge: React.FC<ProofStatusBadgeProps> = ({
  state,
  result,
  error,
  claim,
}) => {
  const isBusy = BUSY_STATES.includes(state);
  const detail =
    state === "rejected"
      ? result?.reason
      : state === "error"
        ? error
        : state === "verified" && result
          ? `~${result.gasEstimate.toLocaleString()} gas · ${Math.round(result.elapsedMs)}ms`
          : undefined;

  return (
    <div
      data-testid="proof-status-badge"
      data-state={state}
      className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm"
      role="status"
      aria-live="polite"
    >
      <span
        data-testid="proof-status-dot"
        className={`flex h-3 w-3 items-center justify-center rounded-full text-white ${tone(state)}`}
      >
        {isBusy && (
          <span
            data-testid="proof-status-spinner"
            className="h-2 w-2 animate-spin rounded-full border border-white border-t-transparent"
            aria-hidden="true"
          />
        )}
      </span>

      <span className="font-medium" data-testid="proof-status-label">
        {label(state)}
      </span>

      {claim && <span className="text-gray-400">· {claim}</span>}

      {detail && (
        <span className="text-gray-400" data-testid="proof-status-detail" title={detail}>
          · {detail}
        </span>
      )}
    </div>
  );
};

export default ProofStatusBadge;
