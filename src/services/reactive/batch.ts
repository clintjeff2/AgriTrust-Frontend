/**
 * Microtask-based batching scheduler for signal updates.
 *
 * All signal `set()` calls within the same microtask are collected and their
 * subscribers are notified in one batch, preventing cascading re-renders.
 * The scheduler integrates with React's `useSyncExternalStore` by flushing
 * pending updates before React reads a snapshot.
 */

import type { BatchState } from "@/src/types/reactive";

type Listener = () => void;

let pendingListeners = new Set<Listener>();
let state: BatchState = "idle";

/** Schedule a listener to be called during the next batch flush. */
export function schedule(listener: Listener): void {
  pendingListeners.add(listener);
  if (state === "idle") {
    state = "scheduled";
    queueMicrotask(flush);
  }
}

/** Flush all pending listener notifications immediately. */
export function flush(): void {
  if (state === "flushing") return;

  state = "flushing";
  const listeners = pendingListeners;
  pendingListeners = new Set();

  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      // Don't let one listener error block the rest.
      console.error("[reactive/batch] Listener error:", err);
    }
  }

  state = "idle";

  // If any listener scheduled more work, flush again.
  if (pendingListeners.size > 0) {
    flush();
  }
}

/** Reset the scheduler state for testing. */
export function _resetBatchForTests(): void {
  pendingListeners = new Set();
  state = "idle";
}
