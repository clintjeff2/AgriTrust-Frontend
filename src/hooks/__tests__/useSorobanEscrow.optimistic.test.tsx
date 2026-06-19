import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSorobanEscrow } from "@/hooks/useSorobanEscrow";
import * as txStateStore from "@/services/txStateStore";
import React from "react";

// Mock WalletContext
vi.mock("@/components/providers/WalletContext", () => ({
  useWallet: () => ({
    account: "GABC123DEF456",
    isSwitching: false,
    provider: "freighter" as const,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe("useSorobanEscrow — optimistic deposits", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();

    // Initialize global.fetch as a mock so .mockResolvedValue works.
    global.fetch = vi.fn();

    // Default: fetch returns valid escrow data
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        balance: "5000",
        milestoneStatus: "active",
        certificationValid: true,
      }),
    });
  });

  // ---------------------------------------------------------------------------
  // Optimistic balance update on deposit
  // ---------------------------------------------------------------------------
  it("optimistically increments balance and shows pending deposit immediately", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balance: "5000",
          milestoneStatus: "active",
          certificationValid: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ txHash: "0xabc123", status: "pending" }),
      });

    const { result } = renderHook(() => useSorobanEscrow(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.escrowData?.balance).toBe("5000");
    expect(result.current.escrowData?.pendingDeposits).toEqual([]);

    // Trigger deposit using depositDirect (bypasses modal for testing)
    // We await the promise to avoid unhandled rejections; it should resolve.
    await act(async () => {
      await result.current.depositDirect({ amount: "200" });
    });

    // After successful deposit, balance should be optimistically updated
    expect(result.current.escrowData?.balance).toBe("5200");
    expect(result.current.escrowData?.pendingDeposits).toHaveLength(1);
    expect(result.current.escrowData?.pendingDeposits[0].amount).toBe("200");
    expect(result.current.escrowData?.pendingDeposits[0].optimisticId).toMatch(
      /^opt_/
    );
  });

  // ---------------------------------------------------------------------------
  // Rollback on failed deposit
  // ---------------------------------------------------------------------------
  it("rolls back balance and removes pending deposit on failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balance: "5000",
          milestoneStatus: "active",
          certificationValid: true,
        }),
      })
      .mockRejectedValueOnce(new Error("Soroban RPC timeout"));

    const { result } = renderHook(() => useSorobanEscrow(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Trigger a failing deposit using depositDirect — catch the expected rejection.
    await act(async () => {
      await expect(
        result.current.depositDirect({ amount: "300" })
      ).rejects.toThrow("Soroban RPC timeout");
    });

    // After rollback, balance should be restored
    await waitFor(() => {
      expect(result.current.escrowData?.balance).toBe("5000");
      expect(result.current.escrowData?.pendingDeposits).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Dispatches escrow-deposit-failed event on rollback
  // ---------------------------------------------------------------------------
  it("dispatches escrow-deposit-failed custom event on failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balance: "5000",
          milestoneStatus: "active",
          certificationValid: true,
        }),
      })
      .mockRejectedValueOnce(new Error("Insufficient balance"));

    const eventListener = vi.fn();
    window.addEventListener("escrow-deposit-failed", eventListener);

    const { result } = renderHook(() => useSorobanEscrow(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(
        result.current.depositDirect({ amount: "99999" })
      ).rejects.toThrow("Insufficient balance");
    });

    expect(eventListener).toHaveBeenCalledTimes(1);
    const event = eventListener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.amount).toBe("99999");
    expect(event.detail.error).toBe("Insufficient balance");

    window.removeEventListener("escrow-deposit-failed", eventListener);
  });

  // ---------------------------------------------------------------------------
  // Marks txStateStore as failed on error
  // ---------------------------------------------------------------------------
  it("marks the transaction as failed in txStateStore on error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balance: "5000",
          milestoneStatus: "active",
          certificationValid: true,
        }),
      })
      .mockRejectedValueOnce(new Error("Network down"));

    const { result } = renderHook(() => useSorobanEscrow(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Await the rejected promise so the onError handler runs fully.
    await act(async () => {
      await expect(
        result.current.depositDirect({ amount: "150" })
      ).rejects.toThrow("Network down");
    });

    // Give txStateStore time to flush the update
    await waitFor(() => {
      const allTxs = txStateStore.getAll();
      const failedTx = allTxs.find((tx) => tx.status === "failed");
      expect(failedTx).toBeDefined();
      expect(failedTx?.metadata.amount).toBe("150");
    });
  });

  // ---------------------------------------------------------------------------
  // Successful deposit marks txStateStore as confirmed
  // ---------------------------------------------------------------------------
  it("marks the transaction as confirmed in txStateStore on success", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balance: "5000",
          milestoneStatus: "active",
          certificationValid: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ txHash: "0xsuccess", status: "pending" }),
      });

    const { result } = renderHook(() => useSorobanEscrow(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.depositDirect({ amount: "400" });
    });

    // Wait for deposit to complete (includes 2s simulated confirmation delay)
    await waitFor(
      () => {
        const allTxs = txStateStore.getAll();
        const confirmedTx = allTxs.find((tx) => tx.status === "confirmed");
        expect(confirmedTx).toBeDefined();
        expect(confirmedTx?.metadata.amount).toBe("400");
      },
      { timeout: 5000 }
    );
  });

  // ---------------------------------------------------------------------------
  // Handles undefined currentData gracefully
  // ---------------------------------------------------------------------------
  it("handles undefined escrowData gracefully during optimistic update", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balance: "0",
          milestoneStatus: "unknown",
          certificationValid: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ txHash: "0xnew", status: "pending" }),
      });

    const { result } = renderHook(() => useSorobanEscrow(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.depositDirect({ amount: "50" });
    });

    await waitFor(() => {
      expect(result.current.escrowData?.balance).toBe("50");
      expect(result.current.escrowData?.pendingDeposits).toHaveLength(1);
    });
  });
});
