import type { VerificationResult, VerificationTask } from "@/src/types/verification";
import { verifyCertificatePayload } from "@/src/workers/certVerifier.worker";

export type CertVerifierWorkerFactory = () => Worker;

function cancelledResult(task: VerificationTask, startedAt: number, reason = "Verification cancelled"): VerificationResult {
  return { taskId: task.id, certificateId: task.certificateId, verified: false, status: "cancelled", reason, durationMs: Date.now() - startedAt };
}

export function verifyCertificate(
  task: VerificationTask,
  signal?: AbortSignal,
  workerFactory?: CertVerifierWorkerFactory
): Promise<VerificationResult> {
  const startedAt = Date.now();
  if (signal?.aborted) return Promise.resolve(cancelledResult(task, startedAt));

  if (!workerFactory || typeof Worker === "undefined") {
    return Promise.resolve(verifyCertificatePayload(task));
  }

  return new Promise((resolve, reject) => {
    const worker = workerFactory();
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      worker.terminate();
    };
    const finish = (result: VerificationResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ ...result, durationMs: Date.now() - startedAt });
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onAbort = () => finish(cancelledResult(task, startedAt));
    const onMessage = (event: MessageEvent<VerificationResult>) => finish(event.data);
    const onError = (event: ErrorEvent) => fail(event.error ?? new Error(event.message));

    signal?.addEventListener("abort", onAbort, { once: true });
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage(task);
  });
}
