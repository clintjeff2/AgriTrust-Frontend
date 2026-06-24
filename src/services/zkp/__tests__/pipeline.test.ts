import { describe, it, expect } from "vitest";
import {
  issueCredential,
  generateProof,
  verifyProof,
  proofSizeBytes,
  type CertificateRecord,
} from "@/src/services/zkp/credential";
import {
  generateCertifierKeyPair,
  type CertifierKeyPair,
} from "@/src/services/zkp/signature";
import { MAX_PROOF_BYTES } from "@/src/types/zkp";
import type { VerificationKey } from "@/src/types/zkp";

const CIRCUIT_ID = "agri-cert-v1";

const RECORD: CertificateRecord = {
  certifierName: "Rainforest Alliance",
  certificateId: "RA-2026-00481",
  supplierGps: "0.3476,32.5825",
  supplierName: "Mukono Coffee Cooperative",
  organic: true,
  harvestYield: 1240,
  expiry: "2027-01-01",
};

async function vkFrom(pair: CertifierKeyPair): Promise<VerificationKey> {
  return {
    circuitId: CIRCUIT_ID,
    algorithm: "ECDSA-P256-SHA256",
    publicKeyJwk: pair.publicKeyJwk,
    securityBits: 128,
    createdAt: 0,
  };
}

describe("ZKP pipeline (issue → prove → verify)", () => {
  it("verifies an honestly generated proof", async () => {
    const pair = await generateCertifierKeyPair();
    const credential = await issueCredential(CIRCUIT_ID, RECORD, pair.privateKeyJwk);
    const { proof, publicSignals } = await generateProof(
      credential,
      ["certifierName", "organic"],
      "Certificate is authentic and product is organic"
    );

    const result = await verifyProof(proof, publicSignals, await vkFrom(pair));
    expect(result.verified).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("keeps undisclosed values off the wire", async () => {
    const pair = await generateCertifierKeyPair();
    const credential = await issueCredential(CIRCUIT_ID, RECORD, pair.privateKeyJwk);
    const { proof } = await generateProof(
      credential,
      ["certifierName"],
      "authenticity"
    );

    const wire = JSON.stringify(proof);
    // Disclosed value present; confidential supplier data absent.
    expect(wire).toContain("Rainforest Alliance");
    expect(wire).not.toContain("Mukono Coffee Cooperative");
    expect(wire).not.toContain("0.3476,32.5825");
    expect(proof.disclosures).toHaveLength(1);
  });

  it("stays within the 4KB wire budget", async () => {
    const pair = await generateCertifierKeyPair();
    const credential = await issueCredential(CIRCUIT_ID, RECORD, pair.privateKeyJwk);
    const { proof } = await generateProof(
      credential,
      Object.keys(RECORD), // disclose everything — worst case for size
      "full disclosure"
    );
    expect(proofSizeBytes(proof)).toBeLessThanOrEqual(MAX_PROOF_BYTES);
  });

  it("rejects a tampered disclosed value", async () => {
    const pair = await generateCertifierKeyPair();
    const credential = await issueCredential(CIRCUIT_ID, RECORD, pair.privateKeyJwk);
    const { proof, publicSignals } = await generateProof(
      credential,
      ["certifierName"],
      "authenticity"
    );

    proof.disclosures[0].value = "Forged Certifier";
    const result = await verifyProof(proof, publicSignals, await vkFrom(pair));
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/not committed/i);
  });

  it("rejects a proof signed by a different certifier", async () => {
    const issuer = await generateCertifierKeyPair();
    const attacker = await generateCertifierKeyPair();
    const credential = await issueCredential(CIRCUIT_ID, RECORD, issuer.privateKeyJwk);
    const { proof, publicSignals } = await generateProof(
      credential,
      ["certifierName"],
      "authenticity"
    );

    const result = await verifyProof(proof, publicSignals, await vkFrom(attacker));
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/signature/i);
  });

  it("rejects a tampered Merkle root", async () => {
    const pair = await generateCertifierKeyPair();
    const credential = await issueCredential(CIRCUIT_ID, RECORD, pair.privateKeyJwk);
    const { proof, publicSignals } = await generateProof(
      credential,
      ["certifierName"],
      "authenticity"
    );

    proof.merkleRoot = "ff".repeat(32);
    publicSignals.merkleRoot = proof.merkleRoot;
    const result = await verifyProof(proof, publicSignals, await vkFrom(pair));
    expect(result.verified).toBe(false);
  });

  it("rejects circuit id mismatch", async () => {
    const pair = await generateCertifierKeyPair();
    const credential = await issueCredential(CIRCUIT_ID, RECORD, pair.privateKeyJwk);
    const { proof, publicSignals } = await generateProof(
      credential,
      ["certifierName"],
      "authenticity"
    );
    const vk = await vkFrom(pair);
    vk.circuitId = "some-other-circuit";

    const result = await verifyProof(proof, publicSignals, vk);
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/circuit id/i);
  });

  it("throws when disclosing a field that is not in the credential", async () => {
    const pair = await generateCertifierKeyPair();
    const credential = await issueCredential(CIRCUIT_ID, RECORD, pair.privateKeyJwk);
    await expect(
      generateProof(credential, ["nonexistentField"], "x")
    ).rejects.toThrow(/not part of this credential/i);
  });

  it("is reproducible with fixed salts", async () => {
    const pair = await generateCertifierKeyPair();
    const salts = Object.fromEntries(
      Object.keys(RECORD).map((f, i) => [f, String(i).padStart(64, "0")])
    );
    const a = await issueCredential(CIRCUIT_ID, RECORD, pair.privateKeyJwk, {
      issuedAt: 1000,
      salts,
    });
    const b = await issueCredential(CIRCUIT_ID, RECORD, pair.privateKeyJwk, {
      issuedAt: 1000,
      salts,
    });
    expect(a.merkleRoot).toBe(b.merkleRoot);
  });
});
