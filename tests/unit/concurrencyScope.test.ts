import { describe, expect, it, vi } from "vitest";
import { createScope } from "@/src/services/verification/concurrencyScope";

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => {
    clearTimeout(timeout);
    reject(signal.reason ?? new Error("aborted"));
  }, { once: true });
});

describe("createScope", () => {
  it("bounds parallel verification work to eight tasks", async () => {
    const scope = createScope({ parallelism: 8, timeoutMs: 1_000 });
    let active = 0;
    let peak = 0;
    const results = await Promise.all(Array.from({ length: 16 }, (_, index) =>
      scope.run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await wait(5);
        active -= 1;
        return index;
      }, `task-${index}`)
    ));

    expect(results.every((result) => result.ok)).toBe(true);
    expect(peak).toBe(8);
  });

  it("cancels pending and in-flight tasks inside the scope", async () => {
    const scope = createScope({ parallelism: 1, timeoutMs: 1_000 });
    const first = scope.run((signal) => wait(1_000, signal), "first");
    const second = scope.run(() => Promise.resolve("never-started"), "second");

    const started = Date.now();
    scope.cancel("stop");
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(Date.now() - started).toBeLessThan(50);
    expect(firstResult.ok).toBe(false);
    expect(secondResult.ok).toBe(false);
    expect(firstResult.error?.code).toBe("cancelled");
    expect(secondResult.error?.code).toBe("cancelled");
  });

  it("times out long-running tasks", async () => {
    const scope = createScope({ timeoutMs: 10 });
    const result = await scope.run((signal) => wait(1_000, signal), "slow");

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("timeout");
  });

  it("cascades parent cancellation to nested scopes", async () => {
    const parent = createScope({ timeoutMs: 1_000 });
    const child = parent.createChild({ timeoutMs: 1_000 });
    const resultPromise = child.run((signal) => wait(1_000, signal), "child-task");

    parent.cancel("parent stopped");
    const result = await resultPromise;

    expect(child.signal.aborted).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("cancelled");
  });

  it("cleans up cancellation listeners after explicit unsubscribe", () => {
    const scope = createScope();
    const listener = vi.fn();
    const unsubscribe = scope.onCancel(listener);

    unsubscribe();
    scope.cancel("done");

    expect(listener).not.toHaveBeenCalled();
  });
});
