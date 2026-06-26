import type { CancellationScope, ScopeError, ScopeOptions, ScopeResult, ScopedTask } from "@/src/types/verification";

const DEFAULT_PARALLELISM = 8;
const DEFAULT_TIMEOUT_MS = 30_000;
let scopeCounter = 0;

type QueueItem<T> = {
  task: ScopedTask<T>;
  taskId?: string;
  resolve: (value: ScopeResult<T>) => void;
  enqueuedAt: number;
};

function makeScopeError(code: ScopeError["code"], scopeId: string, taskId?: string, cause?: unknown): ScopeError {
  const error = new Error(code === "timeout" ? "Verification task timed out" : code === "cancelled" ? "Verification scope was cancelled" : "Verification task failed") as ScopeError;
  error.name = "ScopeError";
  error.code = code;
  error.scopeId = scopeId;
  error.taskId = taskId;
  error.cause = cause;
  return error;
}

function abortReason(signal: AbortSignal): unknown {
  return "reason" in signal ? signal.reason : undefined;
}

function onceAbort(signal: AbortSignal, listener: () => void): () => void {
  if (signal.aborted) {
    listener();
    return () => undefined;
  }
  signal.addEventListener("abort", listener, { once: true });
  return () => signal.removeEventListener("abort", listener);
}

export function createScope(options: ScopeOptions = {}): CancellationScope {
  const parallelism = Math.max(1, Math.min(DEFAULT_PARALLELISM, options.parallelism ?? DEFAULT_PARALLELISM));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const scopeId = options.scopeId ?? `verification-scope-${++scopeCounter}`;
  const controller = new AbortController();
  const queue: QueueItem<unknown>[] = [];
  const childScopes = new Set<CancellationScope>();
  const cancelListeners = new Set<(reason?: unknown) => void>();
  const cleanupCallbacks = new Set<() => void>();
  let active = 0;
  let completed = false;

  const cancel = (reason?: unknown) => {
    if (controller.signal.aborted) return;
    controller.abort(reason ?? makeScopeError("cancelled", scopeId));
    for (const child of Array.from(childScopes)) child.cancel(reason);
    const pending = queue.splice(0);
    for (const item of pending) {
      item.resolve({ ok: false, error: makeScopeError("cancelled", scopeId, item.taskId, reason), durationMs: Date.now() - item.enqueuedAt });
    }
    for (const listener of Array.from(cancelListeners)) listener(reason);
    drainIfComplete();
  };

  const parentSignal = options.signal ?? options.parent?.signal;
  if (parentSignal) cleanupCallbacks.add(onceAbort(parentSignal, () => cancel(abortReason(parentSignal))));

  function drainIfComplete() {
    if (completed || active > 0 || queue.length > 0 || !controller.signal.aborted) return;
    completed = true;
    for (const cleanup of Array.from(cleanupCallbacks)) cleanup();
    cleanupCallbacks.clear();
    cancelListeners.clear();
  }

  function pump() {
    while (!controller.signal.aborted && active < parallelism && queue.length > 0) {
      const item = queue.shift()!;
      void execute(item);
    }
    drainIfComplete();
  }

  async function execute<T>(item: QueueItem<T>) {
    active += 1;
    const startedAt = Date.now();
    const taskController = new AbortController();
    const removeScopeAbort = onceAbort(controller.signal, () => taskController.abort(abortReason(controller.signal)));
    const timeout = setTimeout(() => taskController.abort(makeScopeError("timeout", scopeId, item.taskId)), timeoutMs);

    try {
      if (controller.signal.aborted) throw makeScopeError("cancelled", scopeId, item.taskId, abortReason(controller.signal));
      const value = await item.task(taskController.signal);
      item.resolve({ ok: true, value, durationMs: Date.now() - startedAt });
    } catch (cause) {
      const code: ScopeError["code"] = taskController.signal.aborted
        ? ((abortReason(taskController.signal) as ScopeError | undefined)?.code === "timeout" ? "timeout" : "cancelled")
        : "task_failed";
      item.resolve({ ok: false, error: makeScopeError(code, scopeId, item.taskId, cause), durationMs: Date.now() - startedAt });
    } finally {
      clearTimeout(timeout);
      removeScopeAbort();
      active -= 1;
      pump();
    }
  }

  const scope: CancellationScope = {
    scopeId,
    signal: controller.signal,
    run<T>(task: ScopedTask<T>, taskId?: string): Promise<ScopeResult<T>> {
      const enqueuedAt = Date.now();
      if (controller.signal.aborted) {
        return Promise.resolve({ ok: false, error: makeScopeError("cancelled", scopeId, taskId, abortReason(controller.signal)), durationMs: 0 });
      }
      return new Promise<ScopeResult<T>>((resolve) => {
        queue.push({ task, taskId, resolve: resolve as (value: ScopeResult<unknown>) => void, enqueuedAt });
        pump();
      });
    },
    cancel,
    onCancel(listener) {
      cancelListeners.add(listener);
      return () => cancelListeners.delete(listener);
    },
    createChild(childOptions = {}) {
      const child = createScope({ ...childOptions, parent: scope });
      childScopes.add(child);
      child.onCancel(() => childScopes.delete(child));
      return child;
    },
  };

  return scope;
}
