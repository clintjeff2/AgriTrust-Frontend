/**
 * React hook that bridges signal values into React components via
 * `useSyncExternalStore`, enabling tear-free concurrent rendering.
 *
 * Usage:
 *   const value = useSignal(mySignal);
 *   const computed = useSignal(myComputed);  // Computed signals also work
 */

import { useCallback, useSyncExternalStore } from "react";
import type { Signal, Computed } from "@/src/types/reactive";

/**
 * Subscribe to a signal or computed and return its current value.
 * Re-renders the component when the value changes.
 *
 * When the `source` prop changes to a different signal, `useSyncExternalStore`
 * automatically re-subscribes because the callback identities change via the
 * `[source]` dependency.
 */
export function useSignal<T>(
  source: Signal<T> | Computed<T>,
): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => source.subscribe(onStoreChange),
    [source],
  );

  const getSnapshot = useCallback(
    () => source.get(),
    [source],
  );

  const getServerSnapshot = useCallback(
    () => source.get(),
    [source],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
