import { AUDIT_CHUNK_MAX_BYTES, AUDIT_CHUNK_STORE, AUDIT_ENTRY_STORE, AUDIT_META_STORE, getAppCacheDb } from "@/src/services/cache";
import { EMPTY_ROOT, buildTree, getProof, hashAuditEntry, stableAuditPayload, verifyProof } from "@/src/services/merkleTree";
import type { AuditEntry, AuditEntryInput, AuditIntegrityStatus, AuditLogChunk, AuditLogMetadata, IntegrityProof } from "@/src/types/audit";

const META_ID = "audit-log" as const;
const encoder = new TextEncoder();

function entryId(sequence: number, leafHash: string): string {
  return `${sequence.toString().padStart(12, "0")}-${leafHash.slice(0, 16)}`;
}

function chunkId(index: number): string {
  return `audit-chunk-${index.toString().padStart(8, "0")}`;
}

async function readEntries(): Promise<AuditEntry[]> {
  const db = await getAppCacheDb();
  return (await db.getAllFromIndex(AUDIT_ENTRY_STORE, "by-sequence")).sort((a, b) => a.sequence - b.sequence);
}

async function persistChunk(entries: AuditEntry[]): Promise<void> {
  const db = await getAppCacheDb();
  const latest = await db.getAllFromIndex(AUDIT_CHUNK_STORE, "by-chunkIndex");
  let chunkIndex = latest.length > 0 ? latest[latest.length - 1].chunkIndex : 0;
  let current = latest.at(-1);
  const payload = `${JSON.stringify(entries.map((entry) => ({ ...entry, merkleProof: entry.merkleProof })))}\n`;
  const bytes = encoder.encode(payload).byteLength;

  if (!current || current.byteSize + bytes > AUDIT_CHUNK_MAX_BYTES) {
    chunkIndex = current ? current.chunkIndex + 1 : 0;
    current = {
      id: chunkId(chunkIndex),
      chunkIndex,
      entryIds: [],
      byteSize: 0,
      blob: new Blob([], { type: "application/json" }),
      createdAt: Date.now(),
    } satisfies AuditLogChunk;
  }

  const blob = new Blob([current.blob, payload], { type: "application/json" });
  await db.put(AUDIT_CHUNK_STORE, {
    ...current,
    entryIds: [...current.entryIds, ...entries.map((entry) => entry.id)],
    byteSize: current.byteSize + bytes,
    blob,
  });
}

async function writeMetadata(rootHash: string, totalEntries: number): Promise<AuditLogMetadata> {
  const db = await getAppCacheDb();
  const metadata: AuditLogMetadata = { id: META_ID, rootHash, totalEntries, updatedAt: Date.now() };
  await db.put(AUDIT_META_STORE, metadata);
  return metadata;
}

export async function getAuditMetadata(): Promise<AuditLogMetadata> {
  const db = await getAppCacheDb();
  return (await db.get(AUDIT_META_STORE, META_ID)) ?? { id: META_ID, rootHash: EMPTY_ROOT, totalEntries: 0, updatedAt: 0 };
}

export async function append(input: AuditEntryInput): Promise<AuditEntry> {
  const db = await getAppCacheDb();
  const count = await db.count(AUDIT_ENTRY_STORE);
  const base = {
    timestamp: input.timestamp ?? Date.now(),
    certId: input.certId,
    previousState: input.previousState,
    newState: input.newState,
    signer: input.signer,
    sequence: count,
  };
  const leafHash = await hashAuditEntry(base);
  const draft: AuditEntry = {
    ...base,
    id: entryId(count, leafHash),
    leafHash,
    merkleRoot: EMPTY_ROOT,
    merkleProof: [],
  };

  const entries = [...(await readEntries()), draft];
  const root = await buildTree(entries);
  const merkleRoot = root?.hash ?? EMPTY_ROOT;
  const finalized: AuditEntry = { ...draft, merkleRoot, merkleProof: await getProof(entries, leafHash) };

  await db.put(AUDIT_ENTRY_STORE, finalized);
  await persistChunk([finalized]);
  await writeMetadata(merkleRoot, entries.length);
  return finalized;
}

export async function verifyIntegrity(): Promise<AuditIntegrityStatus> {
  const started = performance.now();
  const [entries, metadata] = await Promise.all([readEntries(), getAuditMetadata()]);
  const leaves = await Promise.all(entries.map(async (entry) => ({ ...entry, leafHash: await hashAuditEntry(entry) })));
  const leafHashesMatch = leaves.every((entry, index) => entry.leafHash === entries[index].leafHash);
  const root = await buildTree(leaves);
  const recomputedRoot = root?.hash ?? EMPTY_ROOT;
  const durationMs = performance.now() - started;
  return {
    ok: leafHashesMatch && recomputedRoot === metadata.rootHash && metadata.totalEntries === entries.length,
    rootHash: metadata.rootHash,
    recomputedRoot,
    totalEntries: entries.length,
    checkedAt: Date.now(),
    durationMs,
  };
}

export async function listAuditEntries(limit = 200, offset = 0): Promise<AuditEntry[]> {
  return (await readEntries()).slice(offset, offset + limit);
}

export async function getInclusionProof(certId: string): Promise<IntegrityProof | null> {
  const entries = await readEntries();
  const entry = [...entries].reverse().find((item) => item.certId === certId);
  if (!entry) return null;
  const metadata = await getAuditMetadata();
  return {
    leafHash: entry.leafHash,
    rootHash: metadata.rootHash,
    proof: await getProof(entries, entry.leafHash),
    index: entry.sequence,
    totalEntries: metadata.totalEntries,
  };
}

export async function verifyInclusionProof(proof: IntegrityProof): Promise<boolean> {
  return verifyProof(proof.rootHash, proof.leafHash, proof.proof);
}

export { stableAuditPayload };
