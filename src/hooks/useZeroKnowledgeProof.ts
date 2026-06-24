"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { handleProveRequest } from "@/src/services/zkp/ProverWorker";
import { verifierEngine, type VerifierEngine } from "@/src/services/zkp/VerifierEngine";
import { loadCircuitArtifact } from "@/src/workers/circuitLoader.worker";
import type {
  ProofLifecycleState,
  ProveRequest,
  ProveResponse,
  PublicSignals,
  VerificationResult,
  ZkProof,
} from "@/src/types/zkp";

export interface ProveInput {
  credential: ProveRequest["credential"];
  disclose: string[];
  claim: string;
}

export interface UseZeroKnowledgeProofOptions {
  /** Inject a custom verifier (tests). Defaults to the shared singleton. */
  engine?: VerifierEngine;
  /** Inject a prover worker factory (tests). Defaults to the bundled worker. */
  createProverWorker?: () => Worker;
}

export interface UseZeroKnowledgeProofResult {
  state: ProofLifecycleState;
  proof: ZkProof | null;
  publicSignals: PublicSignals | null;
  result: VerificationResult | null;
  error: string | null;
  /** Generate a proof from a credential and verify it end-to-end. */
  prove: (input: ProveInput) => Promise<void>;
  /** Verify a proof received from another party (auditor side). */
  verifyExisting: (
    proof: ZkProof,
    publicSignals: PublicSignals
  ) => Promise<void>;
  /** Ensure a circuit's verification key is cached for offline use. */
  ensureCircuit: (circuitId: string, source?: string) => Promise<boolean>;
  reset: () => void;
}

type Pending = {
  resolve: (response: ProveResponse) => void;
  reject: (error: Error) => void;
};

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `prove-${Math.floor(performance.now())}`;
}

/**
 * Binds the ZKP pipeline to React state. Proof generation runs in a Web Worker
 * when one is available, with an in-thread fallback for SSR and tests, and
 * verification runs through the {@link VerifierEngine}. The `state` field walks
 * idle → proving → verifying → verified | rejected (or → error on failure).
 */
export function useZeroKnowledgeProof(
  options: UseZeroKnowledgeProofOptions = {}
): UseZeroKnowledgeProofResult {
  const { engine = verifierEngine, createProverWorker } = options;

  const [state, setState] = useState<ProofLifecycleState>("idle");
  const [proof, setProof] = useState<ZkProof | null>(null);
  const [publicSignals, setPublicSignals] = useState<PublicSignals | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, Pending>>(new Map());

  useEffect(() => {
    if (typeof window === "undefined" && !createProverWorker) return;

    const factory =
      createProverWorker ??
      (() =>
        new Worker(
          new URL("../services/zkp/ProverWorker.ts", import.meta.url),
          { type: "module" }
        ));

    let worker: Worker;
    try {
      worker = factory();
    } catch {
      // No worker support — prove() falls back to the in-thread handler.
      return;
    }

    workerRef.current = worker;
    const pending = pendingRef.current;

    const handleMessage = (event: MessageEvent<ProveResponse>) => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      entry.resolve(event.data);
    };
    const handleError = () => {
      const failure = new Error("Prover worker failed");
      for (const entry of pending.values()) entry.reject(failure);
      pending.clear();
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
      workerRef.current = null;
      pending.clear();
    };
  }, [createProverWorker]);

  const runProve = useCallback(
    async (request: ProveRequest): Promise<ProveResponse> => {
      const worker = workerRef.current;
      if (!worker) {
        // SSR / no worker support: generate in-thread.
        return handleProveRequest(request);
      }
      return new Promise<ProveResponse>((resolve, reject) => {
        pendingRef.current.set(request.id, { resolve, reject });
        worker.postMessage(request);
      });
    },
    []
  );

  const prove = useCallback(
    async (input: ProveInput) => {
      setError(null);
      setResult(null);
      setProof(null);
      setPublicSignals(null);
      setState("proving");

      try {
        const response = await runProve({
          id: newId(),
          circuitId: input.credential.circuitId,
          credential: input.credential,
          disclose: input.disclose,
          claim: input.claim,
        });

        if (!response.ok || !response.proof || !response.publicSignals) {
          throw new Error(response.error ?? "Proof generation failed");
        }

        setProof(response.proof);
        setPublicSignals(response.publicSignals);
        setState("verifying");

        const verification = await engine.verify(
          response.proof,
          response.publicSignals
        );
        setResult(verification);
        setState(verification.verified ? "verified" : "rejected");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Proof pipeline failed");
        setState("error");
      }
    },
    [engine, runProve]
  );

  const verifyExisting = useCallback(
    async (incomingProof: ZkProof, incomingSignals: PublicSignals) => {
      setError(null);
      setResult(null);
      setProof(incomingProof);
      setPublicSignals(incomingSignals);
      setState("verifying");

      try {
        const verification = await engine.verify(incomingProof, incomingSignals);
        setResult(verification);
        setState(verification.verified ? "verified" : "rejected");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verification failed");
        setState("error");
      }
    },
    [engine]
  );

  const ensureCircuit = useCallback(
    async (circuitId: string, source?: string): Promise<boolean> => {
      setState("loading-circuit");
      try {
        const loaded = await loadCircuitArtifact({
          id: newId(),
          circuitId,
          source,
        });
        setState("idle");
        if (!loaded.ok) {
          setError(loaded.error ?? "Circuit load failed");
        }
        return loaded.ok;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Circuit load failed");
        setState("error");
        return false;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState("idle");
    setProof(null);
    setPublicSignals(null);
    setResult(null);
    setError(null);
  }, []);

  return {
    state,
    proof,
    publicSignals,
    result,
    error,
    prove,
    verifyExisting,
    ensureCircuit,
    reset,
  };
}
