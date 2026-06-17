import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as txStateStore from "@/services/txStateStore";
import type { TxEntry } from "@/services/txStateStore";

describe("txStateStore", () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe("save and getAll", () => {
    it("saves a transaction entry to sessionStorage", () => {
      const entry: TxEntry = {
        txHash: "0xabc123",
        operationId: "op_123",
        status: "preparing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { amount: "100" },
      };

      const result = txStateStore.save(entry);
      expect(result).toBe(true);

      const all = txStateStore.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toEqual(entry);
    });

    it("returns empty array when sessionStorage is empty", () => {
      const all = txStateStore.getAll();
      expect(all).toEqual([]);
    });

    it("prevents duplicate operationIds", () => {
      const entry1: TxEntry = {
        txHash: null,
        operationId: "op_123",
        status: "preparing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      };

      const entry2: TxEntry = {
        txHash: "0xabc",
        operationId: "op_123",
        status: "broadcasting",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      };

      txStateStore.save(entry1);
      txStateStore.save(entry2);

      const all = txStateStore.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].status).toBe("broadcasting");
    });
  });

  describe("getPending", () => {
    it("returns only pending transactions", () => {
      const entries: TxEntry[] = [
        {
          txHash: "0x1",
          operationId: "op_1",
          status: "preparing",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          metadata: {},
        },
        {
          txHash: "0x2",
          operationId: "op_2",
          status: "broadcasting",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          metadata: {},
        },
        {
          txHash: "0x3",
          operationId: "op_3",
          status: "confirmed",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          metadata: {},
        },
        {
          txHash: "0x4",
          operationId: "op_4",
          status: "pending_confirmation",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          metadata: {},
        },
        {
          txHash: "0x5",
          operationId: "op_5",
          status: "failed",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          metadata: {},
        },
      ];

      entries.forEach((entry) => txStateStore.save(entry));

      const pending = txStateStore.getPending();
      expect(pending).toHaveLength(3);
      expect(pending.map((e) => e.status)).toEqual([
        "preparing",
        "broadcasting",
        "pending_confirmation",
      ]);
    });
  });

  describe("update", () => {
    it("updates transaction by txHash", () => {
      const entry: TxEntry = {
        txHash: "0xabc",
        operationId: "op_123",
        status: "preparing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      };

      txStateStore.save(entry);
      const result = txStateStore.update("0xabc", { status: "confirmed" });

      expect(result).toBe(true);
      const all = txStateStore.getAll();
      expect(all[0].status).toBe("confirmed");
    });

    it("updates transaction by operationId", () => {
      const entry: TxEntry = {
        txHash: null,
        operationId: "op_123",
        status: "preparing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      };

      txStateStore.save(entry);
      const result = txStateStore.update("op_123", {
        txHash: "0xabc",
        status: "broadcasting",
      });

      expect(result).toBe(true);
      const all = txStateStore.getAll();
      expect(all[0].txHash).toBe("0xabc");
      expect(all[0].status).toBe("broadcasting");
    });

    it("returns false when identifier not found", () => {
      const result = txStateStore.update("nonexistent", { status: "failed" });
      expect(result).toBe(false);
    });

    it("updates updatedAt timestamp", () => {
      const now = Date.now();
      const entry: TxEntry = {
        txHash: "0xabc",
        operationId: "op_123",
        status: "preparing",
        createdAt: now,
        updatedAt: now,
        metadata: {},
      };

      txStateStore.save(entry);

      // Wait a bit to ensure timestamp difference
      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      txStateStore.update("0xabc", { status: "confirmed" });

      const all = txStateStore.getAll();
      expect(all[0].updatedAt).toBeGreaterThan(now);

      vi.useRealTimers();
    });
  });

  describe("LRU eviction", () => {
    it("enforces maximum of 100 tracked transactions", () => {
      // Create 110 entries
      for (let i = 0; i < 110; i++) {
        const entry: TxEntry = {
          txHash: `0x${i}`,
          operationId: `op_${i}`,
          status: "confirmed",
          createdAt: Date.now() + i,
          updatedAt: Date.now() + i,
          metadata: {},
        };
        txStateStore.save(entry);
      }

      const all = txStateStore.getAll();
      expect(all).toHaveLength(100);

      // The most recent 100 should be kept
      const operationIds = all.map((e) => e.operationId);
      expect(operationIds).toContain("op_109");
      expect(operationIds).toContain("op_10");
      expect(operationIds).not.toContain("op_0");
      expect(operationIds).not.toContain("op_9");
    });
  });

  describe("clear", () => {
    it("clears all transaction entries", () => {
      const entry: TxEntry = {
        txHash: "0xabc",
        operationId: "op_123",
        status: "preparing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      };

      txStateStore.save(entry);
      expect(txStateStore.getAll()).toHaveLength(1);

      const result = txStateStore.clear();
      expect(result).toBe(true);
      expect(txStateStore.getAll()).toEqual([]);
    });
  });

  describe("remove", () => {
    it("removes transaction by operationId", () => {
      const entry1: TxEntry = {
        txHash: "0x1",
        operationId: "op_1",
        status: "preparing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      };

      const entry2: TxEntry = {
        txHash: "0x2",
        operationId: "op_2",
        status: "preparing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      };

      txStateStore.save(entry1);
      txStateStore.save(entry2);

      const result = txStateStore.remove("op_1");
      expect(result).toBe(true);

      const all = txStateStore.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].operationId).toBe("op_2");
    });

    it("removes transaction by txHash", () => {
      const entry: TxEntry = {
        txHash: "0xabc",
        operationId: "op_123",
        status: "preparing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      };

      txStateStore.save(entry);
      const result = txStateStore.remove("0xabc");

      expect(result).toBe(true);
      expect(txStateStore.getAll()).toEqual([]);
    });

    it("returns false when identifier not found", () => {
      const result = txStateStore.remove("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("get", () => {
    it("retrieves transaction by operationId", () => {
      const entry: TxEntry = {
        txHash: "0xabc",
        operationId: "op_123",
        status: "preparing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      };

      txStateStore.save(entry);
      const result = txStateStore.get("op_123");

      expect(result).toEqual(entry);
    });

    it("retrieves transaction by txHash", () => {
      const entry: TxEntry = {
        txHash: "0xabc",
        operationId: "op_123",
        status: "preparing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      };

      txStateStore.save(entry);
      const result = txStateStore.get("0xabc");

      expect(result).toEqual(entry);
    });

    it("returns null when identifier not found", () => {
      const result = txStateStore.get("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("error handling", () => {
    it("handles quota exceeded error gracefully", () => {
      // Mock sessionStorage.setItem to throw QuotaExceededError
      const originalSetItem = sessionStorage.setItem;
      let callCount = 0;
      
      sessionStorage.setItem = vi.fn((key: string, value: string) => {
        callCount++;
        if (callCount === 1) {
          const error = new DOMException("QuotaExceededError");
          error.name = "QuotaExceededError";
          throw error;
        }
        // Second call should succeed (after clearing)
        originalSetItem.call(sessionStorage, key, value);
      });

      const entry: TxEntry = {
        txHash: "0xabc",
        operationId: "op_123",
        status: "preparing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      };

      const result = txStateStore.save(entry);
      expect(result).toBe(true);

      sessionStorage.setItem = originalSetItem;
    });

    it("handles invalid JSON in sessionStorage", () => {
      sessionStorage.setItem("agritrust_tx_queue", "invalid json");
      const all = txStateStore.getAll();
      expect(all).toEqual([]);
    });
  });
});
