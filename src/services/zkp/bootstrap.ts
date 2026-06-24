/**
 * App-bootstrap preloading for ZKP circuits. Ensures each configured circuit
 * artifact is present in the IndexedDB cache so the first verification — which
 * may happen offline in the field — does not have to hit the network.
 *
 * The default registry is empty: circuits are registered at runtime (e.g. after
 * an inspector authenticates and their certifier set is known). `preloadCircuits`
 * is intentionally fault-tolerant — a failed fetch on bootstrap must never block
 * app start or throw into React rendering.
 */

import { loadCircuitArtifact } from "@/src/workers/circuitLoader.worker";
import type { CircuitLoadRequest } from "@/src/types/zkp";

export interface CircuitPreloadConfig {
  circuitId: string;
  /** URL to fetch the artifact from on a cache miss. */
  source?: string;
}

/** Circuits preloaded on every app start. Extend at runtime as needed. */
export const DEFAULT_CIRCUITS: CircuitPreloadConfig[] = [];

export interface PreloadOutcome {
  circuitId: string;
  ok: boolean;
  fromCache: boolean;
  error?: string;
}

export async function preloadCircuits(
  circuits: CircuitPreloadConfig[] = DEFAULT_CIRCUITS
): Promise<PreloadOutcome[]> {
  if (typeof indexedDB === "undefined" || circuits.length === 0) {
    return [];
  }

  return Promise.all(
    circuits.map(async (circuit, index): Promise<PreloadOutcome> => {
      const request: CircuitLoadRequest = {
        id: `preload-${index}`,
        circuitId: circuit.circuitId,
        source: circuit.source,
      };
      const result = await loadCircuitArtifact(request);
      if (!result.ok) {
        console.warn(
          `[AgriTrust] ZKP circuit preload failed for "${circuit.circuitId}": ${result.error}`
        );
      }
      return {
        circuitId: circuit.circuitId,
        ok: result.ok,
        fromCache: result.fromCache ?? false,
        error: result.error,
      };
    })
  );
}
