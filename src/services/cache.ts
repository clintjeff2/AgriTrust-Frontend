import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { FormStep } from "@/src/types/registration";
import {
  buildCertCacheKey,
  CERT_CACHE_PREFIX,
} from "@/src/services/swCacheStrategy";
import type { CertificationStatus } from "@/src/types/certification";
import type { AuditEntry, AuditLogChunk, AuditLogMetadata } from "@/src/types/audit";

const DB_NAME = "agritrust-form-cache";
const DB_VERSION = 2;
const DRAFT_STORE = "formDrafts";
const MAX_FORM_DRAFTS = 10;
export const AUDIT_ENTRY_STORE = "auditEntries";
export const AUDIT_CHUNK_STORE = "auditChunks";
export const AUDIT_META_STORE = "auditMetadata";
export const AUDIT_CHUNK_MAX_BYTES = 1024 * 1024;

export interface FormDraft<TData = unknown> {
  key: string;
  productId: string;
  data: TData;
  currentStep: FormStep;
  updatedAt: number;
}

export interface SaveFormDraftInput<TData> {
  productId: string;
  data: TData;
  currentStep: FormStep;
  updatedAt?: number;
}

interface FormCacheDB extends DBSchema {
  formDrafts: {
    key: string;
    value: FormDraft<unknown>;
    indexes: {
      "by-updatedAt": number;
    };
  };
  auditEntries: {
    key: string;
    value: AuditEntry;
    indexes: {
      "by-sequence": number;
      "by-certId": string;
    };
  };
  auditChunks: {
    key: string;
    value: AuditLogChunk;
    indexes: {
      "by-chunkIndex": number;
    };
  };
  auditMetadata: {
    key: string;
    value: AuditLogMetadata;
  };
}

let dbPromise: Promise<IDBPDatabase<FormCacheDB>> | null = null;

export function formDraftKey(productId: string): string {
  return `form-draft-${productId}`;
}

/**
 * Builds a status-aware cache key so certification entries are invalidated per
 * lifecycle transition rather than in bulk. Certification keys follow the
 * `cert-v1-{status}-{id}` schema (see {@link buildCertCacheKey}); other types
 * fall back to a plain `{type}-{id}` key.
 */
export function buildCacheKey(
  type: string,
  id: string,
  status?: CertificationStatus
): string {
  if (type === CERT_CACHE_PREFIX || type === "cert") {
    if (!status) {
      throw new Error("Certification cache keys require a status segment");
    }
    return buildCertCacheKey(id, status);
  }
  return `${type}-${id}`;
}

export function getAppCacheDb(): Promise<IDBPDatabase<FormCacheDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FormCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(DRAFT_STORE)) {
          const store = db.createObjectStore(DRAFT_STORE, { keyPath: "key" });
          store.createIndex("by-updatedAt", "updatedAt");
        }
        if (!db.objectStoreNames.contains(AUDIT_ENTRY_STORE)) {
          const store = db.createObjectStore(AUDIT_ENTRY_STORE, { keyPath: "id" });
          store.createIndex("by-sequence", "sequence", { unique: true });
          store.createIndex("by-certId", "certId");
        }
        if (!db.objectStoreNames.contains(AUDIT_CHUNK_STORE)) {
          const store = db.createObjectStore(AUDIT_CHUNK_STORE, { keyPath: "id" });
          store.createIndex("by-chunkIndex", "chunkIndex", { unique: true });
        }
        if (!db.objectStoreNames.contains(AUDIT_META_STORE)) {
          db.createObjectStore(AUDIT_META_STORE, { keyPath: "id" });
        }
      },
    });
  }

  return dbPromise;
}

function getDraftDb(): Promise<IDBPDatabase<FormCacheDB>> {
  return getAppCacheDb();
}

async function enforceDraftLimit(
  db: IDBPDatabase<FormCacheDB>,
  maxDrafts: number
): Promise<void> {
  const drafts = await db.getAll(DRAFT_STORE);
  const overflow = drafts
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(maxDrafts);

  if (overflow.length === 0) return;

  const tx = db.transaction(DRAFT_STORE, "readwrite");
  await Promise.all(
    overflow.map((draft) => tx.objectStore(DRAFT_STORE).delete(draft.key))
  );
  await tx.done;
}

export async function saveFormDraft<TData>(
  input: SaveFormDraftInput<TData>
): Promise<FormDraft<TData>> {
  const db = await getDraftDb();
  const draft: FormDraft<TData> = {
    key: formDraftKey(input.productId),
    productId: input.productId,
    data: input.data,
    currentStep: input.currentStep,
    updatedAt: input.updatedAt ?? Date.now(),
  };

  await db.put(DRAFT_STORE, draft as FormDraft<unknown>);
  await enforceDraftLimit(db, MAX_FORM_DRAFTS);

  return draft;
}

export async function loadFormDraft<TData>(
  productId: string
): Promise<FormDraft<TData> | undefined> {
  const db = await getDraftDb();
  return (await db.get(DRAFT_STORE, formDraftKey(productId))) as
    | FormDraft<TData>
    | undefined;
}

export async function listFormDrafts<TData>(): Promise<FormDraft<TData>[]> {
  const db = await getDraftDb();
  const drafts = (await db.getAll(DRAFT_STORE)) as FormDraft<TData>[];
  return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteFormDraft(productId: string): Promise<void> {
  const db = await getDraftDb();
  await db.delete(DRAFT_STORE, formDraftKey(productId));
}

export function _resetFormDraftDbForTests(): void {
  dbPromise = null;
}
