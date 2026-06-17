/**
 * Transaction State Store
 * Persists transaction states to sessionStorage to survive soft navigation and refresh.
 * Cleared on tab close.
 */

export type TxStatus =
  | "preparing"
  | "broadcasting"
  | "pending_confirmation"
  | "confirmed"
  | "failed"
  | "unknown";

export interface TxEntry {
  txHash: string | null;
  operationId: string;
  status: TxStatus;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, string>;
}

const STORAGE_KEY = "agritrust_tx_queue";
const MAX_TRACKED_TXS = 100;

/**
 * Get all transaction entries from sessionStorage
 */
export function getAll(): TxEntry[] {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return [];
    }
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("txStateStore: Failed to read from sessionStorage", error);
    return [];
  }
}

/**
 * Get only pending transaction entries (broadcasting or pending_confirmation)
 */
export function getPending(): TxEntry[] {
  const all = getAll();
  return all.filter(
    (entry) =>
      entry.status === "broadcasting" ||
      entry.status === "pending_confirmation" ||
      entry.status === "preparing"
  );
}

/**
 * Save all transaction entries to sessionStorage
 */
function saveAll(entries: TxEntry[]): boolean {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return false;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "QuotaExceededError"
    ) {
      console.warn("txStateStore: sessionStorage quota exceeded, clearing old entries");
      // Try to clear old completed transactions and retry
      const pending = entries.filter(
        (e) =>
          e.status === "broadcasting" ||
          e.status === "pending_confirmation" ||
          e.status === "preparing"
      );
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
        return true;
      } catch {
        console.error("txStateStore: Failed to save even after clearing");
        return false;
      }
    }
    console.error("txStateStore: Failed to save to sessionStorage", error);
    return false;
  }
}

/**
 * Enforce LRU eviction - keep only the most recent MAX_TRACKED_TXS entries
 */
function enforceLRU(entries: TxEntry[]): TxEntry[] {
  if (entries.length <= MAX_TRACKED_TXS) {
    return entries;
  }
  // Sort by updatedAt descending (most recent first) and take the first MAX_TRACKED_TXS
  const sorted = [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
  return sorted.slice(0, MAX_TRACKED_TXS);
}

/**
 * Save a new transaction entry
 */
export function save(entry: TxEntry): boolean {
  const all = getAll();
  // Check if operationId already exists (prevent duplicates)
  const existingIndex = all.findIndex(
    (e) => e.operationId === entry.operationId
  );
  if (existingIndex !== -1) {
    // Update existing entry instead
    all[existingIndex] = entry;
  } else {
    all.push(entry);
  }
  const evicted = enforceLRU(all);
  return saveAll(evicted);
}

/**
 * Update an existing transaction by txHash or operationId
 */
export function update(
  identifier: string,
  updates: Partial<TxEntry>
): boolean {
  const all = getAll();
  const index = all.findIndex(
    (e) => e.txHash === identifier || e.operationId === identifier
  );
  if (index === -1) {
    console.warn(`txStateStore: No entry found for identifier ${identifier}`);
    return false;
  }
  all[index] = {
    ...all[index],
    ...updates,
    updatedAt: Date.now(),
  };
  return saveAll(all);
}

/**
 * Clear all transaction entries from sessionStorage
 */
export function clear(): boolean {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return false;
    }
    sessionStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error("txStateStore: Failed to clear sessionStorage", error);
    return false;
  }
}

/**
 * Remove a specific transaction entry by operationId or txHash
 */
export function remove(identifier: string): boolean {
  const all = getAll();
  const filtered = all.filter(
    (e) => e.txHash !== identifier && e.operationId !== identifier
  );
  if (filtered.length === all.length) {
    // Nothing was removed
    return false;
  }
  return saveAll(filtered);
}

/**
 * Get a specific transaction entry by operationId or txHash
 */
export function get(identifier: string): TxEntry | null {
  const all = getAll();
  return (
    all.find(
      (e) => e.txHash === identifier || e.operationId === identifier
    ) ?? null
  );
}
