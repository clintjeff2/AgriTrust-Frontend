import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface CertificationPayload {
  batchId: string;
  provenanceChain: unknown;
  certificate: { trustScore?: number; [key: string]: unknown };
  trustScore: number;
}

export interface CachedCertification extends CertificationPayload {
  lastUpdated: number;
  integrityHash: string;
  provenanceChainVersion: number;
  certificateVersion: number;
  trustScoreVersion: number;
}

interface CertificationDB extends DBSchema {
  certifications: {
    key: string;
    value: CachedCertification;
  };
}

const DB_NAME = "agritrust-certifications";
const DB_VERSION = 1;
const STORE_NAME = "certifications";
const CHANNEL_NAME = "cert-sync-channel";

let dbPromise: Promise<IDBPDatabase<CertificationDB>> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function getDb(): Promise<IDBPDatabase<CertificationDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CertificationDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "batchId" });
        }
      },
    });
  }
  return dbPromise;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function computeCertificationIntegrityHash(
  batchId: string,
  data: Pick<CertificationPayload, "provenanceChain" | "certificate" | "trustScore">
): Promise<string> {
  return sha256(`${batchId}:${stableStringify(data)}`);
}

async function writeCertificationAtomically(payload: CertificationPayload): Promise<void> {
  const db = await getDb();
  const certificate = { ...payload.certificate, trustScore: payload.trustScore };
  const integrityHash = await computeCertificationIntegrityHash(payload.batchId, {
    provenanceChain: payload.provenanceChain,
    certificate,
    trustScore: payload.trustScore,
  });

  // Keep the transaction body limited to IndexedDB requests. Awaiting unrelated
  // promises inside an IDB transaction can auto-close it before the put runs.
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const existing = await store.get(payload.batchId);
  const nextVersion = Math.max(
    existing?.provenanceChainVersion ?? 0,
    existing?.certificateVersion ?? 0,
    existing?.trustScoreVersion ?? 0
  ) + 1;
  const record: CachedCertification = {
    ...payload,
    certificate,
    lastUpdated: Date.now(),
    provenanceChainVersion: nextVersion,
    certificateVersion: nextVersion,
    trustScoreVersion: nextVersion,
    integrityHash,
  };
  await store.put(record);
  await tx.done;
}

function announceWriteIntent(payload: CertificationPayload): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage({ type: "certification-write-intent", batchId: payload.batchId });
  channel.close();
}

export function syncCertificationData(payload: CertificationPayload): Promise<void> {
  announceWriteIntent(payload);
  writeQueue = writeQueue.then(() => writeCertificationAtomically(payload));
  return writeQueue;
}

export async function readCertificationData(batchId: string): Promise<CachedCertification | null> {
  const db = await getDb();
  const record = await db.get(STORE_NAME, batchId);
  if (!record) return null;

  const expected = await computeCertificationIntegrityHash(batchId, {
    provenanceChain: record.provenanceChain,
    certificate: record.certificate,
    trustScore: record.trustScore,
  });
  const versions = [record.provenanceChainVersion, record.certificateVersion, record.trustScoreVersion];
  const versionSkew = Math.max(...versions) - Math.min(...versions);
  const certificateScore = record.certificate.trustScore;

  if (record.integrityHash !== expected || versionSkew > 1 || certificateScore !== record.trustScore) {
    await db.delete(STORE_NAME, batchId);
    return null;
  }

  return record;
}

export async function _resetCertificationDbForTests(): Promise<void> {
  dbPromise?.then((db) => db.close()).catch(() => undefined);
  dbPromise = null;
  writeQueue = Promise.resolve();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
