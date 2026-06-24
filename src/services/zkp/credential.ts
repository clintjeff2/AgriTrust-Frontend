/**
 * Issuance and proof-generation core for the confidential audit-trail pipeline.
 *
 * Flow:
 *   1. The certifier calls {@link issueCredential} once, committing to every
 *      field and signing the Merkle root. The resulting {@link SignedCredential}
 *      holds the confidential values + salts and stays on the holder's device.
 *   2. The holder calls {@link generateProof} per auditor request, revealing
 *      only the chosen fields (each with a Merkle inclusion path). This is the
 *      work the prover worker performs — no signing, so it stays well under the
 *      500ms budget.
 *   3. The auditor calls {@link verifyProof} (via the VerifierEngine) using the
 *      cached verification key — fully stateless and offline.
 *
 * This default backend proves authenticity + selective disclosure rather than
 * arbitrary predicates; the seam for a future SNARK lives in VerifierEngine.
 */

import {
  buildMerkleTree,
  commitField,
  merkleProof,
  randomSaltHex,
  verifyMerklePath,
} from "./commitmentScheme";
import { signRoot, verifyRoot } from "./signature";
import {
  PROOF_VERSION,
  SECURITY_BITS,
  MAX_PROOF_BYTES,
  type FieldCommitment,
  type PublicSignals,
  type SignedCredential,
  type VerificationKey,
  type ZkProof,
} from "@/src/types/zkp";

/** Raw certificate field values accepted at issuance. */
export type CertificateRecord = Record<string, string | number | boolean>;

export interface IssueOptions {
  /** Override issuance time (ms). Defaults to `Date.now()`. */
  issuedAt?: number;
  /** Pre-generated salts keyed by field — for deterministic tests only. */
  salts?: Record<string, string>;
}

/** Stable field ordering so commitments and the tree are reproducible. */
function canonicalEntries(record: CertificateRecord): Array<[string, string]> {
  return Object.keys(record)
    .sort()
    .map((field) => [field, String(record[field])] as [string, string]);
}

/**
 * Commits to every field, builds the Merkle tree, and signs the root. Returns
 * the holder-side credential (confidential — do not transmit).
 */
export async function issueCredential(
  circuitId: string,
  record: CertificateRecord,
  certifierPrivateKeyJwk: JsonWebKey,
  options: IssueOptions = {}
): Promise<SignedCredential> {
  const entries = canonicalEntries(record);
  if (entries.length === 0) {
    throw new Error("Cannot issue a credential with no fields");
  }

  const fields = await Promise.all(
    entries.map(async ([field, value]) => {
      const salt = options.salts?.[field] ?? randomSaltHex();
      const commitment = await commitField(field, value, salt);
      return { field, value, salt, commitment };
    })
  );

  const commitments: FieldCommitment[] = fields.map(({ field, commitment }) => ({
    field,
    commitment,
  }));

  const tree = await buildMerkleTree(commitments.map((c) => c.commitment));
  const issuedAt = options.issuedAt ?? Date.now();
  const signature = await signRoot(
    certifierPrivateKeyJwk,
    circuitId,
    tree.root,
    issuedAt
  );

  return {
    circuitId,
    version: PROOF_VERSION,
    fields: fields.map(({ field, value, salt }) => ({ field, value, salt })),
    commitments,
    merkleRoot: tree.root,
    signature,
    issuedAt,
    securityBits: SECURITY_BITS,
  };
}

/**
 * Derives a transmittable proof that discloses only `disclose` fields. Hidden
 * fields never appear in the output — not even their commitments.
 */
export async function generateProof(
  credential: SignedCredential,
  disclose: string[],
  claim: string
): Promise<{ proof: ZkProof; publicSignals: PublicSignals }> {
  const tree = await buildMerkleTree(
    credential.commitments.map((c) => c.commitment)
  );

  const disclosures = disclose.map((field) => {
    const leafIndex = credential.commitments.findIndex(
      (c) => c.field === field
    );
    if (leafIndex === -1) {
      throw new Error(`Field "${field}" is not part of this credential`);
    }
    const source = credential.fields[leafIndex];
    return {
      field,
      value: source.value,
      salt: source.salt,
      leafIndex,
      path: merkleProof(tree, leafIndex),
    };
  });

  const publicSignals: PublicSignals = {
    circuitId: credential.circuitId,
    merkleRoot: credential.merkleRoot,
    leafCount: credential.commitments.length,
    issuedAt: credential.issuedAt,
    claim,
  };

  const proof: ZkProof = {
    circuitId: credential.circuitId,
    version: credential.version,
    merkleRoot: credential.merkleRoot,
    disclosures,
    signature: credential.signature,
    securityBits: credential.securityBits,
  };

  return { proof, publicSignals };
}

/** Serialized size of a proof in UTF-8 bytes (the on-wire footprint). */
export function proofSizeBytes(proof: ZkProof): number {
  return new TextEncoder().encode(JSON.stringify(proof)).length;
}

export interface CoreVerification {
  verified: boolean;
  reason?: string;
}

/**
 * Pure verification of a proof against public signals and a verification key.
 * No I/O — the VerifierEngine wraps this with VK loading, timing, and a cost
 * estimate. Returns `verified: false` with a reason rather than throwing.
 */
export async function verifyProof(
  proof: ZkProof,
  publicSignals: PublicSignals,
  vk: VerificationKey
): Promise<CoreVerification> {
  if (proof.version !== PROOF_VERSION) {
    return { verified: false, reason: `Unsupported proof version ${proof.version}` };
  }

  if (
    proof.circuitId !== publicSignals.circuitId ||
    proof.circuitId !== vk.circuitId
  ) {
    return { verified: false, reason: "Circuit id mismatch between proof, signals, and key" };
  }

  if (proof.merkleRoot !== publicSignals.merkleRoot) {
    return { verified: false, reason: "Merkle root mismatch between proof and signals" };
  }

  if (proof.securityBits < vk.securityBits) {
    return {
      verified: false,
      reason: `Proof security level ${proof.securityBits} below required ${vk.securityBits}`,
    };
  }

  if (proofSizeBytes(proof) > MAX_PROOF_BYTES) {
    return { verified: false, reason: "Proof exceeds 4KB wire limit" };
  }

  for (const disclosure of proof.disclosures) {
    if (disclosure.leafIndex < 0 || disclosure.leafIndex >= publicSignals.leafCount) {
      return { verified: false, reason: `Disclosed field "${disclosure.field}" has an out-of-range leaf index` };
    }
    const commitment = await commitField(
      disclosure.field,
      disclosure.value,
      disclosure.salt
    );
    const included = await verifyMerklePath(
      commitment,
      disclosure.path,
      proof.merkleRoot
    );
    if (!included) {
      return {
        verified: false,
        reason: `Disclosed field "${disclosure.field}" is not committed under the signed root`,
      };
    }
  }

  const signatureOk = await verifyRoot(
    vk.publicKeyJwk,
    proof.circuitId,
    proof.merkleRoot,
    publicSignals.issuedAt,
    proof.signature
  );
  if (!signatureOk) {
    return { verified: false, reason: "Certifier signature is invalid" };
  }

  return { verified: true };
}
