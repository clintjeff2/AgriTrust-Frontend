import type { CertificationStatus } from "@/src/types/certification";

export type AuditHashHex = string;

export interface MerkleProofStep {
  hash: AuditHashHex;
  position: "left" | "right";
}

export type MerkleProof = MerkleProofStep[];

export interface IntegrityProof {
  leafHash: AuditHashHex;
  rootHash: AuditHashHex;
  proof: MerkleProof;
  index: number;
  totalEntries: number;
}

export interface AuditEntryInput {
  certId: string;
  previousState: CertificationStatus | "unknown";
  newState: CertificationStatus;
  signer: string;
  timestamp?: number;
}

export interface AuditEntry extends Required<AuditEntryInput> {
  id: string;
  sequence: number;
  leafHash: AuditHashHex;
  merkleRoot: AuditHashHex;
  merkleProof: MerkleProof;
}

export interface MerkleNode {
  hash: AuditHashHex;
  left?: MerkleNode;
  right?: MerkleNode;
  parent?: MerkleNode;
  indexStart: number;
  indexEnd: number;
}

export interface AuditLogChunk {
  id: string;
  chunkIndex: number;
  entryIds: string[];
  byteSize: number;
  blob: Blob;
  createdAt: number;
}

export interface AuditLogMetadata {
  id: "audit-log";
  rootHash: AuditHashHex;
  totalEntries: number;
  updatedAt: number;
}

export interface AuditIntegrityStatus {
  ok: boolean;
  rootHash: AuditHashHex;
  recomputedRoot: AuditHashHex;
  totalEntries: number;
  checkedAt: number;
  durationMs: number;
}
