import type { VerificationTask, VerificationResult } from "@/src/types/verification";

export function verifyCertificatePayload(task: VerificationTask): VerificationResult {
  const startedAt = Date.now();
  const payload = task.payload as { revoked?: boolean; valid?: boolean } | undefined;
  const verified = payload?.valid !== false && payload?.revoked !== true;
  return {
    taskId: task.id,
    certificateId: task.certificateId,
    verified,
    status: verified ? "verified" : "failed",
    reason: verified ? undefined : "Certificate payload failed verification checks",
    durationMs: Date.now() - startedAt,
  };
}

if (typeof self !== "undefined" && typeof (self as unknown as { postMessage?: unknown }).postMessage === "function") {
  self.addEventListener("message", (event: MessageEvent<VerificationTask>) => {
    (self as unknown as { postMessage: (message: VerificationResult) => void }).postMessage(verifyCertificatePayload(event.data));
  });
}
