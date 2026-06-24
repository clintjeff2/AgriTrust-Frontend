/**
 * Web Worker entry for proof generation. Receives a "witness" (the holder's
 * signed credential), the field names to disclose, and the circuit id; runs
 * {@link generateProof} off the main thread; and posts the proof back.
 *
 * Generation here is signing-free (the certifier signed the root at issuance),
 * so it comfortably fits the 500ms budget even on low-end devices.
 *
 * Self-registration mirrors `src/services/formValidator.worker.ts`: the message
 * listener only attaches in a worker context, leaving the exported handler
 * importable for unit tests.
 */

import { generateProof } from "./credential";
import type { ProveRequest, ProveResponse } from "@/src/types/zkp";

export async function handleProveRequest(
  request: ProveRequest
): Promise<ProveResponse> {
  try {
    const { proof, publicSignals } = await generateProof(
      request.credential,
      request.disclose,
      request.claim
    );
    return { id: request.id, ok: true, proof, publicSignals };
  } catch (error) {
    return {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : "Proof generation failed",
    };
  }
}

if (
  typeof window === "undefined" &&
  typeof globalThis.addEventListener === "function" &&
  typeof globalThis.postMessage === "function"
) {
  globalThis.addEventListener(
    "message",
    async (event: MessageEvent<ProveRequest>) => {
      const response = await handleProveRequest(event.data);
      globalThis.postMessage(response);
    }
  );
}
