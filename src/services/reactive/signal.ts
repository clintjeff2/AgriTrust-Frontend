/**
 * Core signal primitive for the reactive dependency graph.
 *
 * Each signal holds a single value and a list of subscribers.  On `set()`,
 * subscribers are notified via the batch scheduler so multiple updates
 * within a microtask are coalesced into one render cycle.
 *
 * A module-level `activeTrackers` stack allows computed signals and effects
 * to automatically register their dependencies during evaluation.
 */

import { schedule } from "@/src/services/reactive/batch";
import type {
  Signal,
  SignalListener,
  TrackingContext,
} from "@/src/types/reactive";

// ── dependency tracking stack ───────────────────────────────────────────

/**
 * Stack of active tracking contexts.  When a computed signal or effect
 * evaluates, it pushes its context onto this stack so that any signal reads
 * can automatically register as dependencies.
 */
const activeTrackers: TrackingContext[] = [];

/** Push a tracking context onto the stack.  Returns it for use in try/finally. */
export function pushTracker(ctx: TrackingContext): TrackingContext {
  activeTrackers.push(ctx);
  return ctx;
}

/** Pop a tracking context from the stack. */
export function popTracker(): void {
  activeTrackers.pop();
}

/** Register a dependency with all active tracking contexts. */
function trackSignal(signal: Signal<unknown>): void {
  for (const ctx of activeTrackers) {
    ctx.track(signal);
  }
}

// ── signal implementation ───────────────────────────────────────────────

export function createSignal<T>(initialValue: T): Signal<T> {
  let value = initialValue;
  const listeners = new Set<SignalListener<T>>();

  const signal: Signal<T> = {
    get() {
      trackSignal(signal);
      return value;
    },

    set(newValue: T) {
      // Skip no-op updates.
      if (Object.is(value, newValue)) return;
      value = newValue;

      for (const listener of listeners) {
        schedule(() => {
          try {
            listener.fn(value);
          } catch (err) {
            console.error("[reactive/signal] Subscriber error:", err);
          }
        });
      }
    },

    subscribe(fn: (value: T) => void): () => void {
      const listener: SignalListener<T> = { fn };
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return signal;
}

/** Read a signal without registering a dependency (for peeking). */
export function peek<T>(signal: Signal<T>): T {
  // Temporarily save and clear active trackers so reads aren't tracked.
  const saved = [...activeTrackers];
  activeTrackers.length = 0;
  const value = signal.get();
  activeTrackers.push(...saved);
  return value;
}
