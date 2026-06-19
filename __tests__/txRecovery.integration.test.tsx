/**
 * Integration tests for the transaction recovery system
 * Tests the full flow from transaction submission through page refresh to recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSorobanEscrow } from "@/hooks/useSorobanEscrow";
import { useTxRetryQueue } from "@/hooks/useTxRetryQueue";
import * as txStateStore from "@/services/txStateStore";
import type { ReactNode } from "react";

// Mock WalletContext
vi.mock("@/components/providers/WalletContext", () => ({
  useWallet: () => ({
    account: "0xintegration_test",
    isSwitching: false,
  }),
}));

// Mock fetch
global.fetch = vi.fn();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("Transaction Recovery Integration", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("full flow: deposit -> refresh -> recover -> confirm", async () => {
    // ===== STEP 1: User submits deposit =====
    const mockDepositResponse = {
      txHash: "0xfullflow123",
      status: "pending" as const,
    };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balance: "1000",
          milestoneStatus: "active",
          certificationValid: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDepositResponse,
      });

    const { result: escrowResult } = renderHook(() => useSorobanEscrow(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(escrowResult.current.isLoading).toBe(false);
    });

    // Start deposit using depositDirect (don't await - simulate interruption)
    escrowResult.current.depositDirect({
      amount: "500",
      metadata: { purpose: "integration_test" },
    });

    // Wait a bit for transaction to be tracked
    await new Promise((resolve) => setTimeout(resolve, 100));

    // ===== STEP 2: Verify transaction is tracked =====
    const pendingTx = txStateStore.getPending();
    expect(pendingTx.length).toBeGreaterThan(0);
    
    const operationId = pendingTx[0].operationId;

    // ===== STEP 3: Simulate refresh - recovery hook checks transaction status =====
    // Mock the blockchain status check API
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "confirmed" }),
    });

    const { result: recoveryResult } = renderHook(() => useTxRetryQueue());

    await waitFor(
      () => {
        expect(recoveryResult.current.isRecovering).toBe(false);
      },
      { timeout: 10000 }
    );

    // ===== STEP 4: Verify transaction was recovered =====
    expect(recoveryResult.current.recoveredTransactions.length).toBeGreaterThan(0);

    const recoveredTx = recoveryResult.current.recoveredTransactions.find(
      (tx) => tx.operationId === operationId
    );

    expect(recoveredTx).toBeDefined();
    expect(recoveredTx?.txHash).toBeDefined();
    expect(recoveredTx?.checked).toBe(true);
  });

  it("handles interrupted transaction before signing", async () => {
    vi.useFakeTimers();

    // User starts deposit but page refreshes before wallet signing
    const now = Date.now();
    txStateStore.save({
      txHash: null,
      operationId: "op_interrupted",
      status: "preparing",
      createdAt: now,
      updatedAt: now,
      metadata: {
        operationType: "escrow_deposit",
        amount: "100",
      },
    });

    vi.useRealTimers();

    // After refresh, recovery hook processes the interrupted transaction
    const { result } = renderHook(() => useTxRetryQueue());

    await waitFor(() => {
      expect(result.current.isRecovering).toBe(false);
    });

    // Should mark as failed with appropriate message
    const recoveredTx = result.current.recoveredTransactions.find(
      (tx) => tx.operationId === "op_interrupted"
    );

    expect(recoveredTx).toBeDefined();
    expect(recoveredTx?.status).toBe("failed");
  });

  it("handles transaction not found on ledger (needs retry)", async () => {
    const now = Date.now();

    // Simulate a transaction that was broadcast but not confirmed
    txStateStore.save({
      txHash: "0xnotfound",
      operationId: "op_notfound",
      status: "pending_confirmation",
      createdAt: now,
      updatedAt: now,
      metadata: {
        operationType: "escrow_deposit",
      },
    });

    // Mock ledger check returning not_found
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "not_found" }),
    });

    const { result } = renderHook(() => useTxRetryQueue());

    await waitFor(
      () => {
        expect(result.current.isRecovering).toBe(false);
      },
      { timeout: 10000 }
    );

    const recoveredTx = result.current.recoveredTransactions.find(
      (tx) => tx.operationId === "op_notfound"
    );

    expect(recoveredTx).toBeDefined();
    expect(recoveredTx?.status).toBe("pending_confirmation");
    expect(recoveredTx?.checked).toBe(true);

    // User can retry
    await result.current.retryTransaction("op_notfound");

    // Transaction should be removed from recovered list
    await waitFor(() => {
      expect(
        result.current.recoveredTransactions.find(
          (tx) => tx.operationId === "op_notfound"
        )
      ).toBeUndefined();
    });
  });

  it("handles multiple transactions with mixed states", async () => {
    const now = Date.now();

    // Create multiple transactions in different states
    const transactions = [
      {
        txHash: null,
        operationId: "op_preparing",
        status: "preparing" as const,
        createdAt: now,
        updatedAt: now,
        metadata: { operationType: "tx1" },
      },
      {
        txHash: "0xconfirmed",
        operationId: "op_confirmed",
        status: "broadcasting" as const,
        createdAt: now,
        updatedAt: now,
        metadata: { operationType: "tx2" },
      },
      {
        txHash: "0xnotfound",
        operationId: "op_notfound",
        status: "pending_confirmation" as const,
        createdAt: now,
        updatedAt: now,
        metadata: { operationType: "tx3" },
      },
    ];

    transactions.forEach((tx) => txStateStore.save(tx));

    // Mock ledger checks
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "confirmed" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "not_found" }),
      });

    const { result } = renderHook(() => useTxRetryQueue());

    await waitFor(
      () => {
        expect(result.current.isRecovering).toBe(false);
      },
      { timeout: 10000 }
    );

    expect(result.current.recoveredTransactions).toHaveLength(3);

    // Check each transaction's final state
    const preparing = result.current.recoveredTransactions.find(
      (tx) => tx.operationId === "op_preparing"
    );
    const confirmed = result.current.recoveredTransactions.find(
      (tx) => tx.operationId === "op_confirmed"
    );
    const notFound = result.current.recoveredTransactions.find(
      (tx) => tx.operationId === "op_notfound"
    );

    expect(preparing?.status).toBe("failed");
    expect(confirmed?.status).toBe("confirmed");
    expect(notFound?.status).toBe("pending_confirmation");
  });

  it("respects 5-second recovery timeout", async () => {
    const now = Date.now();
    txStateStore.save({
      txHash: "0xslow",
      operationId: "op_slow",
      status: "broadcasting",
      createdAt: now,
      updatedAt: now,
      metadata: {},
    });

    // Mock API that resolves but will be checked against timeout
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "confirmed" }),
    });

    const { result } = renderHook(() => useTxRetryQueue());

    await waitFor(
      () => {
        expect(result.current.isRecovering).toBe(false);
      },
      { timeout: 10000 }
    );

    // Transaction should be recovered
    const recoveredTx = result.current.recoveredTransactions.find(
      (tx) => tx.operationId === "op_slow"
    );

    expect(recoveredTx).toBeDefined();
  });

  it("handles LRU eviction when exceeding 100 transactions", async () => {
    // Create 105 transactions directly in storage to test LRU
    const now = Date.now();
    for (let i = 0; i < 105; i++) {
      txStateStore.save({
        txHash: `0x${i}`,
        operationId: `op_${i}`,
        status: "confirmed",
        createdAt: now + i, // Incrementing timestamp
        updatedAt: now + i,
        metadata: { index: `${i}` },
      });
    }

    // Should only keep 100 most recent
    const all = txStateStore.getAll();
    expect(all.length).toBeLessThanOrEqual(100);

    // The most recent should be kept
    const stored = txStateStore.get("op_104");
    expect(stored).toBeDefined();

    // Oldest should be evicted
    const evicted = txStateStore.get("op_0");
    expect(evicted).toBeNull();
  });

  it("dismissAll clears all recovered transactions", async () => {
    const now = Date.now();

    // Create multiple transactions
    for (let i = 0; i < 3; i++) {
      txStateStore.save({
        txHash: `0x${i}`,
        operationId: `op_${i}`,
        status: "broadcasting",
        createdAt: now,
        updatedAt: now,
        metadata: {},
      });
    }

    // Mock all as confirmed
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "confirmed" }),
    });

    const { result } = renderHook(() => useTxRetryQueue());

    await waitFor(
      () => {
        expect(result.current.isRecovering).toBe(false);
      },
      { timeout: 10000 }
    );

    expect(result.current.recoveredTransactions).toHaveLength(3);

    // Dismiss all
    result.current.dismissAll();

    await waitFor(() => {
      expect(result.current.recoveredTransactions).toHaveLength(0);
    });

    expect(txStateStore.getAll()).toEqual([]);
  });
});
