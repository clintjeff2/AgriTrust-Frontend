/**
 * Web Worker that loads pre-compiled circuit artifacts (verification key +
 * scheme descriptor) and caches them in IndexedDB so verification works offline
 * on subsequent runs. On a cache hit it returns immediately; on a miss it
 * fetches from the given source URL and persists the result.
 *
 * The exported {@link loadCircuitArtifact} is importable for tests; the message
 * listener only attaches in a worker context.
 */

import {
  getCircuitArtifact,
  putCircuitArtifact,
} from "@/src/services/zkp/circuitCache";
import type {
  CircuitArtifact,
  CircuitLoadRequest,
  CircuitLoadResponse,
} from "@/src/types/zkp";

export async function loadCircuitArtifact(
  request: CircuitLoadRequest,
  now: number = Date.now()
): Promise<CircuitLoadResponse> {
  try {
    const cached = await getCircuitArtifact(request.circuitId);
    if (cached) {
      return { id: request.id, ok: true, artifact: cached, fromCache: true };
    }

    if (!request.source) {
      return {
        id: request.id,
        ok: false,
        error: `Circuit "${request.circuitId}" is not cached and no source was provided`,
      };
    }

    const response = await fetch(request.source);
    if (!response.ok) {
      return {
        id: request.id,
        ok: false,
        error: `Failed to fetch circuit (${response.status})`,
      };
    }

    const raw = (await response.json()) as Omit<CircuitArtifact, "cachedAt">;
    if (raw.circuitId !== request.circuitId) {
      return {
        id: request.id,
        ok: false,
        error: "Fetched circuit id does not match the requested id",
      };
    }

    const artifact: CircuitArtifact = { ...raw, cachedAt: now };
    await putCircuitArtifact(artifact);
    return { id: request.id, ok: true, artifact, fromCache: false };
  } catch (error) {
    return {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : "Circuit load failed",
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
    async (event: MessageEvent<CircuitLoadRequest>) => {
      const response = await loadCircuitArtifact(event.data);
      globalThis.postMessage(response);
    }
  );
}
