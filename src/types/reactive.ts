/**
 * Type definitions for the signal-based reactive dependency graph.
 *
 * Signals are the primitive reactive value containers.  Computed signals
 * derive their value from other signals and automatically track
 * dependencies.  Effects run side-effects when tracked signals change.
 */

/** Error thrown when a circular dependency is detected in a computed signal. */
export class CycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CycleError";
  }
}

/** A reactive value container that notifies subscribers on change. */
export interface Signal<T> {
  /** Read the current value and register this access with the active tracking context. */
  get(): T;
  /** Update the value and schedule subscriber notifications. */
  set(value: T): void;
  /** Subscribe to value changes. Returns an unsubscribe function. */
  subscribe(listener: (value: T) => void): () => void;
}

/** A signal whose value is derived from other signals. */
export interface Computed<T> {
  /** Read the current derived value (lazily re-evaluates if dirty). */
  get(): T;
  /** Subscribe to value changes. Returns an unsubscribe function. */
  subscribe(listener: (value: T) => void): () => void;
}

/** A side-effect that re-runs when its tracked signals change. */
export interface Effect {
  /** Stop the effect and clean up subscriptions. */
  dispose(): void;
}

/** The current evaluation context (used for auto-dependency tracking). */
export interface TrackingContext {
  /** Add a signal that this computation depends on. */
  track(signal: Signal<unknown>): void;
}

/** A listener registered with a signal. */
export interface SignalListener<T> {
  /** The subscriber callback. */
  fn: (value: T) => void;
  /** Optional: the computed/effect context that owns this subscription. */
  context?: TrackingContext;
}

/** State transitions for the batch scheduler. */
export type BatchState = "idle" | "scheduled" | "flushing";
