import type { AuditEntry, AuditHashHex, MerkleNode, MerkleProof } from "@/src/types/audit";

const EMPTY_ROOT = "0".repeat(64);
const HASH_BYTES = 32;

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): AuditHashHex {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("Merkle hashes must be 32-byte SHA-256 hex strings");
  }
  const out = new Uint8Array(HASH_BYTES);
  for (let i = 0; i < HASH_BYTES; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function sha256(bytes: Uint8Array): Promise<AuditHashHex> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
  return bytesToHex(new Uint8Array(digest));
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  return combined;
}

export function stableAuditPayload(entry: Pick<AuditEntry, "timestamp" | "certId" | "previousState" | "newState" | "signer" | "sequence">): string {
  return JSON.stringify({
    sequence: entry.sequence,
    timestamp: entry.timestamp,
    certId: entry.certId,
    previousState: entry.previousState,
    newState: entry.newState,
    signer: entry.signer,
  });
}

export async function hashAuditEntry(entry: Pick<AuditEntry, "timestamp" | "certId" | "previousState" | "newState" | "signer" | "sequence">): Promise<AuditHashHex> {
  return sha256(encoder.encode(stableAuditPayload(entry)));
}

async function hashPair(left: AuditHashHex, right: AuditHashHex): Promise<AuditHashHex> {
  return sha256(concatBytes(hexToBytes(left), hexToBytes(right)));
}

export async function buildTree(entries: Pick<AuditEntry, "leafHash">[]): Promise<MerkleNode | null> {
  if (entries.length === 0) return null;

  let level: MerkleNode[] = entries.map((entry, index) => ({
    hash: entry.leafHash,
    indexStart: index,
    indexEnd: index,
  }));

  while (level.length > 1) {
    const next: MerkleNode[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      const parent: MerkleNode = {
        hash: await hashPair(left.hash, right.hash),
        left,
        right,
        indexStart: left.indexStart,
        indexEnd: right.indexEnd,
      };
      left.parent = parent;
      right.parent = parent;
      next.push(parent);
    }
    level = next;
  }

  return level[0];
}

export async function getProof(entries: Pick<AuditEntry, "leafHash">[], entryHash: AuditHashHex): Promise<MerkleProof> {
  const index = entries.findIndex((entry) => entry.leafHash === entryHash);
  if (index === -1) throw new Error("Entry hash is not present in the Merkle tree");
  if (entries.length <= 1) return [];

  const proof: MerkleProof = [];
  let hashes = entries.map((entry) => entry.leafHash);
  let cursor = index;

  while (hashes.length > 1) {
    const siblingIndex = cursor % 2 === 0 ? cursor + 1 : cursor - 1;
    const siblingHash = hashes[siblingIndex] ?? hashes[cursor];
    proof.push({ hash: siblingHash, position: cursor % 2 === 0 ? "right" : "left" });

    const next: AuditHashHex[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      next.push(await hashPair(hashes[i], hashes[i + 1] ?? hashes[i]));
    }
    hashes = next;
    cursor = Math.floor(cursor / 2);
  }

  return proof;
}

export async function verifyProof(root: AuditHashHex, leaf: AuditHashHex, proof: MerkleProof): Promise<boolean> {
  let computed = leaf;
  for (const step of proof) {
    computed = step.position === "left"
      ? await hashPair(step.hash, computed)
      : await hashPair(computed, step.hash);
  }
  return computed === root;
}

export { EMPTY_ROOT };
