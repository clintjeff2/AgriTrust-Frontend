import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach } from "vitest";
import { VerifierEngine, estimateGas } from "@/src/services/zkp/VerifierEngine";
import {
  _resetCircuitCacheForTests,
  getCircuitArtifact,
  hasCircuitArtifact,
  deleteCircuitArtifact,
} from "@/src/services/zkp/circuitCache";
import { issueCredential, generateProof } from "@/src/services/zkp/credential";
import { generateCertifierKeyPair } from "@/src/services/zkp/signature";
import type { CircuitArtifact } from "@/src/types/zkp";

const CIRCUIT_ID = "agri-cert-v1";

async function buildFixture() {
  const pair = await generateCertifierKeyPair();
  const credential = await issueCredential(
    CIRCUIT_ID,
    { certifierName: "Fairtrade", batchId: "B-9", organic: true },
    pair.privateKeyJwk
  );
  const { proof, publicSignals } = await generateProof(
    credential,
    ["certifierName"],
    "authentic"
  );
  const artifact: CircuitArtifact = {
    circuitId: CIRCUIT_ID,
    algorithm: "ECDSA-P256-SHA256",
    version: 1,
    verificationKey: {
      circuitId: CIRCUIT_ID,
      algorithm: "ECDSA-P256-SHA256",
      publicKeyJwk: pair.publicKeyJwk,
      securityBits: 128,
      createdAt: 0,
    },
    cachedAt: 0,
  };
  return { proof, publicSignals, artifact };
}

beforeEach(() => {
  _resetCircuitCacheForTests();
  globalThis.indexedDB = new IDBFactory();
});

describe("circuitCache", () => {
  it("stores, reads, checks, and deletes artifacts", async () => {
    const { artifact } = await buildFixture();
    const engine = new VerifierEngine();

    expect(await hasCircuitArtifact(CIRCUIT_ID)).toBe(false);
    await engine.registerCircuit(artifact);
    expect(await hasCircuitArtifact(CIRCUIT_ID)).toBe(true);
    expect((await getCircuitArtifact(CIRCUIT_ID))?.circuitId).toBe(CIRCUIT_ID);

    await deleteCircuitArtifact(CIRCUIT_ID);
    expect(await hasCircuitArtifact(CIRCUIT_ID)).toBe(false);
  });
});

describe("VerifierEngine", () => {
  it("verifies a proof when the circuit is cached", async () => {
    const { proof, publicSignals, artifact } = await buildFixture();
    const engine = new VerifierEngine();
    await engine.registerCircuit(artifact);

    const result = await engine.verify(proof, publicSignals);
    expect(result.verified).toBe(true);
    expect(result.gasEstimate).toBeGreaterThan(0);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("rejects when no verification key is cached", async () => {
    const { proof, publicSignals } = await buildFixture();
    const engine = new VerifierEngine();

    const result = await engine.verify(proof, publicSignals);
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/no cached verification key/i);
  });
});

describe("estimateGas", () => {
  it("grows with disclosure count", async () => {
    const pair = await generateCertifierKeyPair();
    const credential = await issueCredential(
      CIRCUIT_ID,
      { a: "1", b: "2", c: "3", d: "4" },
      pair.privateKeyJwk
    );
    const one = await generateProof(credential, ["a"], "x");
    const three = await generateProof(credential, ["a", "b", "c"], "x");
    expect(estimateGas(three.proof)).toBeGreaterThan(estimateGas(one.proof));
  });
});
