import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { useOptimisticMutation } from "@/src/hooks/useOptimisticMutation";
import type { ReactNode } from "react";
import React from "react";

// --- Test types ---
interface TestData {
  count: number;
  items: string[];
}

interface TestVariables {
  item: string;
}

// --- Helpers ---
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

function setupQueryCache(
  queryClient: QueryClient,
  queryKey: QueryKey,
  data: TestData
) {
  queryClient.setQueryData(queryKey, data);
}

describe("useOptimisticMutation", () => {
  let queryClient: QueryClient;
  const queryKey = ["test", "data"] as const;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    // Seed the cache with initial data
    setupQueryCache(queryClient, queryKey, {
      count: 0,
      items: [],
    });
  });

  // ---------------------------------------------------------------------------
  // Optimistic update on mutate
  // ---------------------------------------------------------------------------
  it("applies the optimistic update immediately in onMutate", async () => {
    const mutationFn = vi.fn().mockResolvedValue({ ok: true });
    const optimisticUpdater = vi.fn(
      (vars: TestVariables, current?: TestData, _oid?: string): TestData => ({
        count: (current?.count ?? 0) + 1,
        items: [...(current?.items ?? []), `optimistic:${vars.item}`],
      })
    );

    const { result } = renderHook(
      () =>
        useOptimisticMutation<TestData, TestVariables>({
          mutationFn,
          queryKey,
          optimisticUpdater,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    // Trigger mutation
    act(() => {
      result.current.mutate({ item: "apple" });
    });

    // The optimistic update runs inside onMutate which is async (it awaits
    // cancelQueries), so we must poll with waitFor rather than read immediately.
    await waitFor(() => {
      const cached = queryClient.getQueryData<TestData>(queryKey);
      expect(cached?.count).toBe(1);
      expect(cached?.items).toContain("optimistic:apple");
    });
  });

  // ---------------------------------------------------------------------------
  // Rollback on error
  // ---------------------------------------------------------------------------
  it("rolls back to the previous state on mutation error", async () => {
    const mutationFn = vi
      .fn()
      .mockRejectedValue(new Error("Network failure"));
    const optimisticUpdater = (
      vars: TestVariables,
      current?: TestData,
      _oid?: string
    ): TestData => ({
      count: (current?.count ?? 0) + 1,
      items: [...(current?.items ?? []), `optimistic:${vars.item}`],
    });

    const { result } = renderHook(
      () =>
        useOptimisticMutation<TestData, TestVariables>({
          mutationFn,
          queryKey,
          optimisticUpdater,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    // Trigger mutation
    act(() => {
      result.current.mutate({ item: "apple" });
    });

    // Wait for error
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Cache should be restored to original state
    const cached = queryClient.getQueryData<TestData>(queryKey);
    expect(cached?.count).toBe(0);
    expect(cached?.items).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // rollbackFn is called on error
  // ---------------------------------------------------------------------------
  it("calls rollbackFn on error with the error, variables, and rollback data", async () => {
    const mutationFn = vi.fn().mockRejectedValue(new Error("RPC timeout"));
    const optimisticUpdater = (
      vars: TestVariables,
      current?: TestData,
      _oid?: string
    ): TestData => ({
      count: (current?.count ?? 0) + 1,
      items: [...(current?.items ?? []), `optimistic:${vars.item}`],
    });
    const rollbackFn = vi.fn();

    const { result } = renderHook(
      () =>
        useOptimisticMutation<TestData, TestVariables>({
          mutationFn,
          queryKey,
          optimisticUpdater,
          rollbackFn,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    act(() => {
      result.current.mutate({ item: "banana" });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(rollbackFn).toHaveBeenCalledTimes(1);
    expect(rollbackFn).toHaveBeenCalledWith(
      expect.objectContaining({ message: "RPC timeout" }),
      { item: "banana" },
      { count: 0, items: [] } // the snapshot
    );
  });

  // ---------------------------------------------------------------------------
  // Queries are invalidated on settle
  // ---------------------------------------------------------------------------
  it("invalidates the query on settle", async () => {
    const mutationFn = vi.fn().mockResolvedValue({ ok: true });
    const optimisticUpdater = (
      vars: TestVariables,
      current?: TestData,
      _oid?: string
    ): TestData => ({
      count: (current?.count ?? 0) + 1,
      items: [...(current?.items ?? []), `optimistic:${vars.item}`],
    });

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () =>
        useOptimisticMutation<TestData, TestVariables>({
          mutationFn,
          queryKey,
          optimisticUpdater,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    act(() => {
      result.current.mutate({ item: "kiwi" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
    invalidateSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // Concurrent optimistic updates
  // ---------------------------------------------------------------------------
  it("handles concurrent optimistic updates correctly", async () => {
    const mutationFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("Second deposit failed"));

    const optimisticUpdater = (
      vars: TestVariables,
      current?: TestData,
      _oid?: string
    ): TestData => ({
      count: (current?.count ?? 0) + 1,
      items: [...(current?.items ?? []), `optimistic:${vars.item}`],
    });

    const { result } = renderHook(
      () =>
        useOptimisticMutation<TestData, TestVariables>({
          mutationFn,
          queryKey,
          optimisticUpdater,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    // First mutation succeeds
    act(() => {
      result.current.mutate({ item: "first" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Second mutation fails — should roll back only the second update
    act(() => {
      result.current.mutate({ item: "second" });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // After rollback, the cache should reflect only the first successful mutation
    // (pending count is tracked, the rollback restores the snapshot from before the second mutation)
    const cached = queryClient.getQueryData<TestData>(queryKey);
    // The snapshot was taken before the second optimistic update,
    // so the cache is restored to the state after the first success.
    expect(cached?.count).toBe(1);
    expect(cached?.items).toEqual(["optimistic:first"]);
  });

  // ---------------------------------------------------------------------------
  // Returns optimisticId after mutation call
  // ---------------------------------------------------------------------------
  it("returns a per-call optimisticId after mutation is triggered", async () => {
    const mutationFn = vi.fn().mockResolvedValue({ ok: true });
    const optimisticUpdater = (
      vars: TestVariables,
      current?: TestData,
      _oid?: string
    ): TestData => ({
      count: (current?.count ?? 0) + 1,
      items: [...(current?.items ?? []), `optimistic:${vars.item}`],
    });

    const { result } = renderHook(
      () =>
        useOptimisticMutation<TestData, TestVariables>({
          mutationFn,
          queryKey,
          optimisticUpdater,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    // Before mutation, optimisticId is null
    expect(result.current.optimisticId).toBeNull();

    // Trigger mutation
    act(() => {
      result.current.mutate({ item: "apple" });
    });

    await waitFor(() => {
      // After onMutate runs, optimisticId is set
      expect(result.current.optimisticId).toBeDefined();
      expect(typeof result.current.optimisticId).toBe("string");
      expect(result.current.optimisticId!.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Cancels in-flight queries during onMutate
  // ---------------------------------------------------------------------------
  it("cancels in-flight queries for the given queryKey during onMutate", async () => {
    const mutationFn = vi.fn().mockResolvedValue({ ok: true });
    const optimisticUpdater = (
      vars: TestVariables,
      current?: TestData,
      _oid?: string
    ): TestData => ({
      count: (current?.count ?? 0) + 1,
      items: [...(current?.items ?? []), `optimistic:${vars.item}`],
    });

    const cancelSpy = vi.spyOn(queryClient, "cancelQueries");

    const { result } = renderHook(
      () =>
        useOptimisticMutation<TestData, TestVariables>({
          mutationFn,
          queryKey,
          optimisticUpdater,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    act(() => {
      result.current.mutate({ item: "grape" });
    });

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey });
    cancelSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // Custom optimisticId
  // ---------------------------------------------------------------------------
  it("uses the provided optimisticId when passed", async () => {
    const mutationFn = vi.fn().mockResolvedValue({ ok: true });
    const optimisticUpdater = (
      vars: TestVariables,
      current?: TestData,
      _oid?: string
    ): TestData => ({
      count: (current?.count ?? 0) + 1,
      items: [...(current?.items ?? []), `optimistic:${vars.item}`],
    });

    const customId = "custom-id-123";

    const { result } = renderHook(
      () =>
        useOptimisticMutation<TestData, TestVariables>({
          mutationFn,
          queryKey,
          optimisticUpdater,
          optimisticId: customId,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    // Before mutation, optimisticId is null (ref starts empty).
    expect(result.current.optimisticId).toBeNull();

    // Trigger mutation — onMutate sets the optimisticId to the provided value.
    act(() => {
      result.current.mutate({ item: "grape" });
    });

    await waitFor(() => {
      expect(result.current.optimisticId).toBe(customId);
    });
  });
});
