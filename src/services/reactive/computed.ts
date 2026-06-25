/**
 * Computed (derived) signal implementation.
 *
 * A computed signal derives its value from other signals via a user-provided
 * computation function.  During the first evaluation, all signals read within
 * the function are automatically tracked as dependencies.  When any
 * dependency changes, the computed signal is marked as dirty and lazily
 * re-evaluated on the next read.
 *
 * Circular dependency detection uses a Set-based evaluation stack — if the
 * same computed is encountered again during its own evaluation, a CycleError
 * is thrown.
 */

import { createSignal, popTracker, pushTracker } from "@/src/services/reactive/signal";
import { peek } from "@/src/services/reactive/signal";
import { schedule } from "@/src/services/reactive/batch";
import { CycleError } from "@/src/types/reactive";
import type { Computed, Signal, TrackingContext } from "@/src/types/reactive";

/** Set of computed signals currently mid-evaluation (for cycle detection). */
const evaluating = new Set<Computed<unknown>>();

export function createComputed<T>(fn: () => T): Computed<T> {
  // The internal signal holds the value; it also acts as a notification
  // channel for dependent signals/effects.
  const signal = createSignal<T>(undefined as unknown as T);
  let dirty = true;
  const unsubs: Array<() => void> = [];

  // ── re-evaluate and re-subscribe ────────────────────────────────────

  function evaluate(): void {
    // Unsubscribe from old dependencies.
    for (const unsub of unsubs) {
      unsub();
    }
    unsubs.length = 0;

    // Cycle detection.
    if (evaluating.has(computed)) {
      throw new CycleError("Circular dependency detected in computed signal");
    }
    evaluating.add(computed);

    // Collect dependencies during evaluation.
    const deps = new Set<Signal<unknown>>();
    const collectTracker: TrackingContext = {
      track(dep: Signal<unknown>) {
        deps.add(dep);
      },
    };

    try {
      pushTracker(collectTracker);
      const newValue = fn();
      popTracker();

      // Subscribe to each dependency for change notifications.
      for (const dep of deps) {
        unsubs.push(
          dep.subscribe(() => {
            if (!dirty) {
              dirty = true;
              schedule(() => {
                computed.get();
              });
            }
          }),
        );
      }

      const oldValue = peek(signal);
      if (!Object.is(oldValue, newValue)) {
        signal.set(newValue);
      }
    } finally {
      evaluating.delete(computed);
    }

    dirty = false;
  }

  // ── public API ──────────────────────────────────────────────────────

  const computed: Computed<T> = {
    get() {
      if (dirty) {
        evaluate();
      }
      return signal.get();
    },

    subscribe(listener: (value: T) => void): () => void {
      return signal.subscribe(listener);
    },
  };

  // Initial evaluation to establish dependency graph and subscriptions.
  evaluate();

  return computed;
}
