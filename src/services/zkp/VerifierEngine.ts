/**
 * Main-thread orchestrator for stateless proof verification.
 *
 * Resolves the verification key for a proof's circuit from the IndexedDB cache,
 * runs the pure {@link verifyProof} check, and decorates the result with a
 * wallclock timing and a synthetic on-chain cost estimate. No network and no
 * server-side proof database are touched — verification is fully offline once
 * the circuit artifact has been cached.
 *
 * Swapping the default commitment backend for a SNARK/Wasm backend means
 * changing only the `verifyProof` call here; the cache, hook, and UI are
 * backend-agnostic.
 */

import { verifyProof } from "./credential";
import {
  getCircuitArtifact,
  putCircuitArtifact,
} from "./circuitCache";
import type {
  CircuitArtifact,
  PublicSignals,
  VerificationResult,
  ZkProof,
} from "@/src/types/zkp";

/** Synthetic gas model — units are illustrative, not a live chain quote. */
const GAS_BASE = 21_000;
const GAS_PER_DISCLOSURE = 2_000;
const GAS_PER_PATH_NODE = 240;
const GAS_PER_BYTE = 16;

function now(): number {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

/**
 * Estimates the cost of verifying a proof on an on-chain verifier, scaling with
 * disclosure count, Merkle-path depth, and proof size. Used for UI/telemetry,
 * not for gating verification.
 */
export function estimateGas(proof: ZkProof): number {
  let gas = GAS_BASE;
  for (const disclosure of proof.disclosures) {
    gas += GAS_PER_DISCLOSURE + disclosure.path.length * GAS_PER_PATH_NODE;
  }
  const bytes = new TextEncoder().encode(JSON.stringify(proof)).length;
  gas += bytes * GAS_PER_BYTE;
  return gas;
}

export class VerifierEngine {
  /**
   * Registers (or refreshes) a circuit artifact in the cache. Typically called
   * once during setup so verification can later run offline.
   */
  async registerCircuit(artifact: CircuitArtifact): Promise<void> {
    await putCircuitArtifact(artifact);
  }

  /**
   * Verifies a proof against its public signals using the cached verification
   * key for `proof.circuitId`. Returns `verified: false` with a reason — never
   * throws — so callers can render rejections uniformly.
   */
  async verify(
    proof: ZkProof,
    publicSignals: PublicSignals
  ): Promise<VerificationResult> {
    const started = now();
    const gasEstimate = estimateGas(proof);

    let artifact: CircuitArtifact | undefined;
    try {
      artifact = await getCircuitArtifact(proof.circuitId);
    } catch (error) {
      return {
        verified: false,
        reason: error instanceof Error ? error.message : "Failed to load circuit",
        gasEstimate,
        elapsedMs: now() - started,
      };
    }

    if (!artifact) {
      return {
        verified: false,
        reason: `No cached verification key for circuit "${proof.circuitId}"`,
        gasEstimate,
        elapsedMs: now() - started,
      };
    }

    const core = await verifyProof(proof, publicSignals, artifact.verificationKey);
    return {
      verified: core.verified,
      reason: core.reason,
      gasEstimate,
      elapsedMs: now() - started,
    };
  }
}

/** Shared singleton instance for hooks/components. */
export const verifierEngine = new VerifierEngine();
