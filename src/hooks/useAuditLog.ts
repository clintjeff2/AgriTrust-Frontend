"use client";

import { useCallback, useEffect, useState } from "react";
import { append, getInclusionProof, listAuditEntries, verifyIntegrity } from "@/src/services/auditLog";
import type { AuditEntry, AuditEntryInput, AuditIntegrityStatus, IntegrityProof } from "@/src/types/audit";

export interface UseAuditLogResult {
  entries: AuditEntry[];
  integrity: AuditIntegrityStatus | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  appendEntry: (entry: AuditEntryInput) => Promise<AuditEntry>;
  getProof: (certId: string) => Promise<IntegrityProof | null>;
}

export function useAuditLog(limit = 200): UseAuditLogResult {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [integrity, setIntegrity] = useState<AuditIntegrityStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextEntries, nextIntegrity] = await Promise.all([
        listAuditEntries(limit),
        verifyIntegrity(),
      ]);
      setEntries(nextEntries);
      setIntegrity(nextIntegrity);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unable to load audit log"));
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  const appendEntry = useCallback(async (entry: AuditEntryInput) => {
    const saved = await append(entry);
    await refresh();
    return saved;
  }, [refresh]);

  return {
    entries,
    integrity,
    isLoading,
    error,
    refresh,
    appendEntry,
    getProof: getInclusionProof,
  };
}
