"use client";

import React, { useState } from "react";
import { useCertificationCache } from "@/src/hooks/useCertificationCache";
import type {
  CertificationRecord,
  CertificationStatus,
} from "@/src/types/certification";

interface CertificateDetailViewProps {
  certificateId: string;
  status: CertificationStatus;
  /**
   * Performs the on-chain status transition. Injected so this view stays
   * decoupled from the wallet/Soroban layer (and testable). Resolves once the
   * transition is confirmed.
   */
  onChainUpdate?: (
    certId: string,
    toStatus: CertificationStatus
  ) => Promise<void>;
}

/**
 * Page-level view that consumes cached certificate data and, after a successful
 * on-chain status update, dispatches a `cert-status-change` ping so the service
 * worker purges stale entries and every open tab revalidates.
 */
export const CertificateDetailView: React.FC<CertificateDetailViewProps> = ({
  certificateId,
  status,
  onChainUpdate,
}) => {
  const { data, error, isLoading, isRevalidating, notifyStatusChange } =
    useCertificationCache<CertificationRecord>(certificateId, status);

  const [pendingStatus, setPendingStatus] = useState<CertificationStatus | null>(
    null
  );
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleTransition = async (toStatus: CertificationStatus) => {
    setUpdateError(null);
    setPendingStatus(toStatus);
    try {
      await onChainUpdate?.(certificateId, toStatus);
      // Only invalidate caches once the chain has confirmed the transition.
      notifyStatusChange(toStatus);
    } catch (err) {
      setUpdateError(
        err instanceof Error ? err.message : "On-chain update failed"
      );
    } finally {
      setPendingStatus(null);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 p-6" data-testid="cert-detail-view">
      <h2 className="mb-4 text-xl font-bold">Certificate {certificateId}</h2>

      {isLoading && (
        <p className="text-gray-500" data-testid="cert-loading">
          Loading certificate…
        </p>
      )}

      {error && !data && (
        <p className="text-red-600" data-testid="cert-error">
          {error.message}
        </p>
      )}

      {data && (
        <dl className="space-y-2" data-testid="cert-data">
          <div className="flex justify-between">
            <dt className="text-gray-500">Status</dt>
            <dd className="font-medium" data-testid="cert-status">
              {data.status}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Trust score</dt>
            <dd className="font-medium">{data.trustScore}%</dd>
          </div>
          {isRevalidating && (
            <p className="text-xs text-gray-400" data-testid="cert-revalidating">
              Refreshing…
            </p>
          )}
        </dl>
      )}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          className="rounded bg-green-500 px-3 py-1 text-white disabled:opacity-50"
          disabled={pendingStatus !== null}
          onClick={() => handleTransition("verified")}
          data-testid="action-verify"
        >
          {pendingStatus === "verified" ? "Verifying…" : "Mark verified"}
        </button>
        <button
          type="button"
          className="rounded bg-red-500 px-3 py-1 text-white disabled:opacity-50"
          disabled={pendingStatus !== null}
          onClick={() => handleTransition("revoked")}
          data-testid="action-revoke"
        >
          {pendingStatus === "revoked" ? "Revoking…" : "Revoke"}
        </button>
      </div>

      {updateError && (
        <p className="mt-2 text-sm text-red-600" data-testid="cert-update-error">
          {updateError}
        </p>
      )}
    </div>
  );
};

export default CertificateDetailView;
