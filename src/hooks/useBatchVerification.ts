"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createScope } from "@/src/services/verification/concurrencyScope";
import { verifyCertificate } from "@/src/services/verification/verifyCertificate";
import type { CancellationScope, VerificationResult, VerificationTask, VerificationTaskStatus } from "@/src/types/verification";

export function useBatchVerification(tasks: VerificationTask[]) {
  const scopeRef = useRef<CancellationScope | null>(null);
  const [results, setResults] = useState<Record<string, VerificationResult>>({});
  const [statuses, setStatuses] = useState<Record<string, VerificationTaskStatus>>({});

  useEffect(() => {
    const scope = createScope({ parallelism: 8, timeoutMs: 30_000 });
    scopeRef.current = scope;
    return () => {
      scope.cancel("Batch verification unmounted");
      scopeRef.current = null;
    };
  }, []);

  const progress = useMemo(() => {
    const total = tasks.length;
    const completed = Object.values(statuses).filter((status) => ["verified", "failed", "cancelled", "timeout"].includes(status)).length;
    return { total, completed, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
  }, [statuses, tasks.length]);

  const start = useCallback(async () => {
    const scope = scopeRef.current ?? createScope({ parallelism: 8, timeoutMs: 30_000 });
    scopeRef.current = scope;
    setStatuses(Object.fromEntries(tasks.map((task) => [task.id, "pending" as const])));

    await Promise.all(tasks.map(async (task) => {
      setStatuses((current) => ({ ...current, [task.id]: "running" }));
      const scoped = await scope.run((signal) => verifyCertificate(task, signal), task.id);
      if (scoped.ok && scoped.value) {
        setResults((current) => ({ ...current, [task.id]: scoped.value! }));
        setStatuses((current) => ({ ...current, [task.id]: scoped.value!.status }));
      } else {
        const status = scoped.error?.code === "timeout" ? "timeout" : "cancelled";
        setStatuses((current) => ({ ...current, [task.id]: status }));
      }
    }));
  }, [tasks]);

  const cancel = useCallback(() => scopeRef.current?.cancel("User cancelled batch verification"), []);

  return { start, cancel, results, statuses, progress };
}
