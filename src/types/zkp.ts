/**
 * Type definitions for the confidential audit-trail verification pipeline.
 *
 * The pipeline lets an auditor confirm that a certificate was issued by a
 * trusted certifier and that specific disclosed fields are authentic, WITHOUT
 * the holder transmitting the rest of the supply-chain record in plaintext.
 *
 * The default backend is a commitment + Merkle-inclusion + signature scheme
 * (SHA-256 + ECDSA P-256, both via Web Crypto). It provides authenticity and
 * selective disclosure — undisclosed fields never leave the holder's device.
 * The {@link ProofBackend} seam lets a future SNARK/Wasm circuit replace it
 * without touching the orchestration, hook, or UI layers.
 */

/** Lifecycle of a single verification, surfaced to the UI by the hook. */
export type ProofLifecycleState =
  | "idle"
  | "loading-circuit"
  | "proving"
  | "verifying"
  | "verified"
  | "rejected"
  | "error";

/** Signature/commitment algorithm a circuit is bound to. */
export type ProofAlgorithm = "ECDSA-P256-SHA256";

/** A leaf in the certificate's Merkle commitment tree. */
export interface FieldCommitment {
  /** Field name — names are public; only values are confidential. */
  field: string;
  /** Hex-encoded SHA-256 commitment to `salt || field || value`. */
  commitment: string;
}

/** One node on the Merkle path from a leaf to the root. */
export interface MerklePathNode {
  /** Hex-encoded sibling hash. */
  sibling: string;
  /** Whether the sibling sits to the `left` or `right` of the running hash. */
  position: "left" | "right";
}

/**
 * A field the holder chose to reveal to the auditor, with the salt needed to
 * reproduce its commitment and the Merkle path proving it belongs to the
 * signed certificate.
 */
export interface DisclosedField {
  field: string;
  value: string;
  /** Hex-encoded random salt used in the commitment (hiding factor). */
  salt: string;
  leafIndex: number;
  path: MerklePathNode[];
}

/**
 * Public inputs to verification. Safe to transmit and log — contains no
 * confidential field values beyond the ones the holder explicitly disclosed.
 */
export interface PublicSignals {
  circuitId: string;
  /** Hex-encoded Merkle root over all field commitments. */
  merkleRoot: string;
  /** Total number of committed leaves (does not reveal hidden values). */
  leafCount: number;
  /** Unix-ms issuance time, bound into the signed message. */
  issuedAt: number;
  /** Human-readable description of the claim being proven. */
  claim: string;
}

/** The proof transmitted from holder to auditor. Must stay under 4KB on wire. */
export interface ZkProof {
  circuitId: string;
  version: number;
  /** Hex-encoded Merkle root the disclosures are proven against. */
  merkleRoot: string;
  /** Fields the holder elected to reveal, each with an inclusion proof. */
  disclosures: DisclosedField[];
  /** Hex-encoded ECDSA signature by the certifier over the signed message. */
  signature: string;
  /** Security level in bits (P-256 ≈ 128-bit). */
  securityBits: number;
}

/**
 * The trust anchor for stateless verification: the certifier's public key plus
 * scheme parameters. Cached in IndexedDB so verification works fully offline.
 */
export interface VerificationKey {
  circuitId: string;
  algorithm: ProofAlgorithm;
  /** Certifier's public key as a JWK (P-256). */
  publicKeyJwk: JsonWebKey;
  securityBits: number;
  createdAt: number;
}

/**
 * A pre-compiled circuit artifact. For the default backend this carries the
 * scheme descriptor and verification key; a Wasm backend would also carry the
 * compiled circuit bytecode. Cached in IndexedDB keyed by `circuitId`.
 */
export interface CircuitArtifact {
  circuitId: string;
  algorithm: ProofAlgorithm;
  version: number;
  verificationKey: VerificationKey;
  /** Optional compiled circuit bytecode (Wasm backends only). */
  bytecode?: Uint8Array;
  cachedAt: number;
}

/**
 * The holder-side credential produced at issuance. Contains the confidential
 * field values and salts and never leaves the holder's device — proofs are
 * derived from it. Persist with care.
 */
export interface SignedCredential {
  circuitId: string;
  version: number;
  fields: Array<{ field: string; value: string; salt: string }>;
  commitments: FieldCommitment[];
  merkleRoot: string;
  signature: string;
  issuedAt: number;
  securityBits: number;
}

/** Result of verifying a proof. */
export interface VerificationResult {
  verified: boolean;
  /** Set when `verified` is false — why the proof was rejected. */
  reason?: string;
  /**
   * Synthetic cost estimate for verifying this proof on an on-chain verifier,
   * derived from proof size and Merkle-path work. Not a wallclock figure.
   */
  gasEstimate: number;
  /** Wallclock verification time in milliseconds. */
  elapsedMs: number;
}

/** Request posted to the prover worker (the "witness" + circuit id). */
export interface ProveRequest {
  id: string;
  circuitId: string;
  credential: SignedCredential;
  /** Field names to disclose to the auditor. */
  disclose: string[];
  claim: string;
}

/** Response posted back from the prover worker. */
export interface ProveResponse {
  id: string;
  ok: boolean;
  proof?: ZkProof;
  publicSignals?: PublicSignals;
  error?: string;
}

/** Request posted to the circuit-loader worker. */
export interface CircuitLoadRequest {
  id: string;
  circuitId: string;
  /** URL to fetch the artifact from on a cache miss. */
  source?: string;
}

/** Response posted back from the circuit-loader worker. */
export interface CircuitLoadResponse {
  id: string;
  ok: boolean;
  artifact?: CircuitArtifact;
  fromCache?: boolean;
  error?: string;
}

/** Maximum proof size accepted over the wire (rural bandwidth bound). */
export const MAX_PROOF_BYTES = 4096;

/** Security level the default backend targets. */
export const SECURITY_BITS = 128;

/** Current proof envelope version. */
export const PROOF_VERSION = 1;
