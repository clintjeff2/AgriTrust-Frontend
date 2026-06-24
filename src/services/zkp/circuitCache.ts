/**
 * IndexedDB cache for pre-compiled circuit artifacts (verification key + scheme
 * descriptor, and optionally Wasm bytecode for a future SNARK backend). Caching
 * here is what lets verification — and offline replay — run with no network and
 * no server-side proof database.
 *
 * Follows the singleton `openDB` pattern used by the rest of the codebase
 * (see `src/services/cache.ts`).
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CircuitArtifact } from "@/src/types/zkp";

const DB_NAME = "agritrust-zkp-circuits";
const DB_VERSION = 1;
const CIRCUIT_STORE = "circuits";

interface CircuitCacheDB extends DBSchema {
  circuits: {
    key: string;
    value: CircuitArtifact;
    indexes: { "by-cachedAt": number };
  };
}

let dbPromise: Promise<IDBPDatabase<CircuitCacheDB>> | null = null;

function getCircuitDb(): Promise<IDBPDatabase<CircuitCacheDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CircuitCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(CIRCUIT_STORE)) {
          const store = db.createObjectStore(CIRCUIT_STORE, {
            keyPath: "circuitId",
          });
          store.createIndex("by-cachedAt", "cachedAt");
        }
      },
    });
  }
  return dbPromise;
}

export async function putCircuitArtifact(
  artifact: CircuitArtifact
): Promise<void> {
  const db = await getCircuitDb();
  await db.put(CIRCUIT_STORE, artifact);
}

export async function getCircuitArtifact(
  circuitId: string
): Promise<CircuitArtifact | undefined> {
  const db = await getCircuitDb();
  return db.get(CIRCUIT_STORE, circuitId);
}

export async function hasCircuitArtifact(circuitId: string): Promise<boolean> {
  const db = await getCircuitDb();
  return (await db.getKey(CIRCUIT_STORE, circuitId)) !== undefined;
}

export async function deleteCircuitArtifact(circuitId: string): Promise<void> {
  const db = await getCircuitDb();
  await db.delete(CIRCUIT_STORE, circuitId);
}

export async function listCachedCircuitIds(): Promise<string[]> {
  const db = await getCircuitDb();
  return (await db.getAllKeys(CIRCUIT_STORE)) as string[];
}

/** Resets the singleton DB connection — for use in tests only. */
export function _resetCircuitCacheForTests(): void {
  dbPromise = null;
}
