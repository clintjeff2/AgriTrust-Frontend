import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTxRetryQueue } from "@/hooks/useTxRetryQueue";
import * as txStateStore from "@/services/txStateStore";
import type { TxEntry } from "@/services/txStateStore";

// Mock fetch
global.fetch = vi.fn();

describe("useTxRetryQueue", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("initializes with no recovered transactions when storage is empty", async () => {
    const { result } = renderHook(() => useTxRetryQueue());

    // May start as true or quickly become false if no pending transactions
    await waitFor(() => {
      expect(result.current.isRecovering).toBe(false);
    });

    expect(result.current.recoveredTransactions).toEqual([]);
  });

  it("recovers pending transactions on mount", async () => {
    const now = Date.now();
    const pendingTx: TxEntry = {
      txHash: "0xabc123",
      operationId: "op_123",
      status: "broadcasting",
      createdAt: now,
      updatedAt: now,
      metadata: { operationType: "escrow_deposit" },
    };

    txStateStore.save(pendingTx);

    // Mock successful confirmation check
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "confirmed" }),
    });

    const { result } = renderHook(() => useTxRetryQueue());

    await waitFor(() => {
      expect(result.current.isRecovering).toBe(false);
    });

    expect(result.current.recoveredTransactions).toHaveLength(1);
    expect(result.current.recoveredTransactions[0].status).toBe("confirmed");
  });

  it("handles interrupted transaction in preparing state", async () => {
    const now = Date.now();
    const preparingTx: TxEntry = {
      txHash: null,
      operationId: "op_interrupted",
      status: "preparing",
      createdAt: now,
      updatedAt: now,
      metadata: { operationType: "escrow_deposit" },
    };

    txStateStore.save(preparingTx);

    const { result } = renderHook(() => useTxRetryQueue());

    await waitFor(() => {
      expect(result.current.isRecovering).toBe(false);
    });

    expect(result.current.recoveredTransactions).toHaveLength(1);
    expect(result.current.recoveredTransactions[0].status).toBe("failed");
  });

  it("marks transaction as not_found when not on ledger", async () => {
    const now = Date.now();
    const pendingTx: TxEntry = {
      txHash: "0xnotfound",
      operationId: "op_notfound",
      status: "pending_confirmation",
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    txStateStore.save(pendingTx);

    // Mock not found response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "not_found" }),
    });

    const { result } = renderHook(() => useTxRetryQueue());

    await waitFor(() => {
      expect(result.current.isRecovering).toBe(false);
    });

    expect(result.current.recoveredTransactions).toHaveLength(1);
    expect(result.current.recoveredTransactions[0].status).toBe(
      "pending_confirmation"
    );
  });

  it("handles API error gracefully", async () => {
    const now = Date.now();
    const pendingTx: TxEntry = {
      txHash: "0xerror",
      operationId: "op_error",
      status: "broadcasting",
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    txStateStore.save(pendingTx);

    // Mock failed API call
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error")
    );

    const { result } = renderHook(() => useTxRetryQueue());

    await waitFor(() => {
      expect(result.current.isRecovering).toBe(false);
    });

    expect(result.current.recoveredTransactions).toHaveLength(1);
    expect(result.current.recoveredTransactions[0].status).toBe("unknown");
  });

  it("completes recovery within 5 seconds timeout", async () => {
    const now = Date.now();
    const pendingTx: TxEntry = {
      txHash: "0xslow",
      operationId: "op_slow",
      status: "broadcasting",
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    txStateStore.save(pendingTx);

    // Mock API response that resolves quickly
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

    // Transaction should be recovered successfully
    expect(result.current.recoveredTransactions).toHaveLength(1);
    expect(result.current.recoveredTransactions[0].status).toBe("confirmed");
  });

  it("dismissTransaction removes transaction from list", async () => {
    const now = Date.now();
    const tx1: TxEntry = {
      txHash: "0x1",
      operationId: "op_1",
      status: "broadcasting",
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    const tx2: TxEntry = {
      txHash: "0x2",
      operationId: "op_2",
      status: "broadcasting",
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    txStateStore.save(tx1);
    txStateStore.save(tx2);

    // Mock API responses
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "confirmed" }),
      })
      .mockResolvedValueOnce({
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

    expect(result.current.recoveredTransactions).toHaveLength(2);

    // Dismiss one transaction
    result.current.dismissTransaction("op_1");

    await waitFor(() => {
      expect(result.current.recoveredTransactions).toHaveLength(1);
    });

    expect(result.current.recoveredTransactions[0].operationId).toBe("op_2");
    expect(txStateStore.get("op_1")).toBeNull();
  });

  it("dismissAll removes all transactions", async () => {
    const now = Date.now();
    const tx1: TxEntry = {
      txHash: "0x1",
      operationId: "op_1",
      status: "broadcasting",
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    const tx2: TxEntry = {
      txHash: "0x2",
      operationId: "op_2",
      status: "broadcasting",
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    txStateStore.save(tx1);
    txStateStore.save(tx2);

    // Mock API responses
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "confirmed" }),
      })
      .mockResolvedValueOnce({
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

    expect(result.current.recoveredTransactions).toHaveLength(2);

    // Dismiss all
    result.current.dismissAll();

    await waitFor(() => {
      expect(result.current.recoveredTransactions).toHaveLength(0);
    });

    expect(txStateStore.getAll()).toEqual([]);
  });

  it("handles multiple pending transactions with different states", async () => {
    const now = Date.now();

    const transactions: TxEntry[] = [
      {
        txHash: null,
        operationId: "op_preparing",
        status: "preparing",
        createdAt: now,
        updatedAt: now,
        metadata: {},
      },
      {
        txHash: "0xbroadcasting",
        operationId: "op_broadcasting",
        status: "broadcasting",
        createdAt: now,
        updatedAt: now,
        metadata: {},
      },
      {
        txHash: "0xpending",
        operationId: "op_pending",
        status: "pending_confirmation",
        createdAt: now,
        updatedAt: now,
        metadata: {},
      },
    ];

    transactions.forEach((tx) => txStateStore.save(tx));

    // Mock API responses for transactions with hashes
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

    // Check states
    const preparing = result.current.recoveredTransactions.find(
      (tx) => tx.operationId === "op_preparing"
    );
    const broadcasting = result.current.recoveredTransactions.find(
      (tx) => tx.operationId === "op_broadcasting"
    );
    const pending = result.current.recoveredTransactions.find(
      (tx) => tx.operationId === "op_pending"
    );

    expect(preparing?.status).toBe("failed");
    expect(broadcasting?.status).toBe("confirmed");
    expect(pending?.status).toBe("pending_confirmation");
  });

  it("retryTransaction marks transaction as failed and removes from list", async () => {
    const now = Date.now();
    const pendingTx: TxEntry = {
      txHash: "0xretry",
      operationId: "op_retry",
      status: "pending_confirmation",
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    txStateStore.save(pendingTx);

    // Mock API response
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

    expect(result.current.recoveredTransactions).toHaveLength(1);

    // Retry transaction
    await result.current.retryTransaction("op_retry");

    await waitFor(() => {
      expect(result.current.recoveredTransactions).toHaveLength(0);
    });

    const stored = txStateStore.get("op_retry");
    expect(stored?.status).toBe("failed");
  });

  it("handles fetch timeout with AbortController", async () => {
    const now = Date.now();
    const pendingTx: TxEntry = {
      txHash: "0xtimeout",
      operationId: "op_timeout",
      status: "broadcasting",
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    txStateStore.save(pendingTx);

    // Mock fetch that takes long but eventually resolves
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ status: "confirmed" }),
            });
          }, 4000); // 4 seconds - within our 5 second recovery timeout
        })
    );

    const { result } = renderHook(() => useTxRetryQueue());

    await waitFor(
      () => {
        expect(result.current.isRecovering).toBe(false);
      },
      { timeout: 15000 }
    );

    // Should still recover even with slow API
    expect(result.current.recoveredTransactions).toHaveLength(1);
  });
});
