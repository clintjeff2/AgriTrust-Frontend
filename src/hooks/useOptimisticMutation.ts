import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useRef } from "react";

/**
 * Context returned by onMutate for rollback in onError.
 * Holds the snapshot of the cache before the optimistic update was applied.
 */
interface OptimisticMutationContext<TData> {
  /** The previous cache data snapshot to restore on error. */
  previousData: TData | undefined;
  /** The optimisticId used for this specific mutation call. */
  optimisticId: string;
}

export interface UseOptimisticMutationOptions<TData, TVariables> {
  /** The mutation function that performs the actual side effect (e.g., API call). */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** The query key whose cache will be optimistically updated. */
  queryKey: QueryKey;
  /**
   * Called during onMutate to compute the optimistic cache update.
   * Receives the mutation variables, the current cached data (or undefined),
   * and the per-call optimisticId.
   * Must return the new data to set in the cache.
   */
  optimisticUpdater: (
    variables: TVariables,
    currentData: TData | undefined,
    optimisticId: string
  ) => TData;
  /**
   * Called during onError for side effects (e.g., showing an error toast).
   * Receives the error, the mutation variables, and the snapshot that was restored.
   */
  rollbackFn?: (
    error: Error,
    variables: TVariables,
    rollbackData: TData | undefined
  ) => void;
  /** Called after a successful mutation. */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Called after a failed mutation (the cache has already been rolled back). */
  onError?: (error: Error, variables: TVariables) => void;
  /**
   * Optional unique ID for this optimistic update.
   * Used to track concurrent updates for the same resource.
   * Defaults to a random UUID v4 if not provided.
   */
  optimisticId?: string;
}

/**
 * Generates a UUID v4 string for optimistic update tracking.
 */
function generateOptimisticId(): string {
  return "opt_" + crypto.randomUUID();
}

/**
 * A generic optimistic mutation hook that wraps `useMutation` from React Query.
 *
 * Key behaviors:
 * - **onMutate**: Cancels in-flight queries for the given queryKey, snapshots the
 *   current cache value, applies the optimistic update via `setQueryData`, and
 *   returns the snapshot as rollback context.
 * - **onError**: Restores the snapshot via `setQueryData` and calls `rollbackFn`
 *   for side effects like showing an error toast.
 * - **onSettled**: Invalidates the query to re-fetch and ensure consistency with
 *   the on-chain / server state.
 *
 * Supports concurrent optimistic updates by tagging each update with a unique
 * `optimisticId` and tracking pending count via a ref.
 */
export function useOptimisticMutation<TData, TVariables>({
  mutationFn,
  queryKey,
  optimisticUpdater,
  rollbackFn,
  onSuccess,
  onError,
  optimisticId: propOptimisticId,
}: UseOptimisticMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  // Stores the most recent optimisticId for external tracking.
  const optimisticIdRef = useRef<string | null>(null);

  const mutation = useMutation<TData, Error, TVariables, OptimisticMutationContext<TData>>({
    mutationFn,

    onMutate: async (variables): Promise<OptimisticMutationContext<TData>> => {
      // Generate a unique optimisticId for THIS mutation call (UUID v4 per the spec).
      const callOptimisticId = propOptimisticId ?? generateOptimisticId();
      optimisticIdRef.current = callOptimisticId;

      // Cancel any in-flight queries for this query key so they don't
      // overwrite our optimistic update.
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the current cache value before applying the optimistic update.
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Apply the optimistic update, passing the per-call optimisticId.
      queryClient.setQueryData<TData>(queryKey, (currentData) =>
        optimisticUpdater(variables, currentData, callOptimisticId)
      );

      return {
        previousData,
        optimisticId: callOptimisticId,
      };
    },

    onError: (error, variables, context) => {
      // Restore the exact previous state from the snapshot.
      if (context) {
        queryClient.setQueryData<TData>(queryKey, context.previousData);
      }

      // Call rollbackFn for side effects (e.g., error toast).
      rollbackFn?.(error, variables, context?.previousData);

      // Call user-provided onError callback.
      onError?.(error, variables);
    },

    onSuccess: (data, variables) => {
      onSuccess?.(data, variables);
    },

    onSettled: () => {
      // Always refetch from the server to ensure consistency with
      // the on-chain state.
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    ...mutation,
    /** The most recent per-call optimisticId (null if no mutation has been triggered yet). */
    optimisticId: optimisticIdRef.current,
  };
}

export default useOptimisticMutation;
