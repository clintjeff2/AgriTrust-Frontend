/**
 * Tests for fee formatter utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatStroops,
  formatStroopsWithLabel,
  stroopsToXlm,
  fetchExchangeRate,
  formatStroopsAsUsd,
  formatStroopsDual,
  formatNumber,
  formatBytes,
  clearExchangeRateCache,
  getCachedExchangeRate,
} from '@/src/utils/feeFormatter';

describe('feeFormatter', () => {
  beforeEach(() => {
    clearExchangeRateCache();
  });

  describe('formatStroops', () => {
    it('should format stroops to XLM correctly', () => {
      expect(formatStroops(BigInt(10_000_000))).toBe('1.0000000');
      expect(formatStroops(BigInt(5_000_000))).toBe('0.5000000');
      expect(formatStroops(BigInt(1))).toBe('0.0000001');
      expect(formatStroops(BigInt(0))).toBe('0.0000000');
    });

    it('should handle large values', () => {
      expect(formatStroops(BigInt(100_000_000_000))).toBe('10000.0000000');
    });
  });

  describe('formatStroopsWithLabel', () => {
    it('should format with XLM label', () => {
      expect(formatStroopsWithLabel(BigInt(10_000_000))).toBe('1.0000000 XLM');
      expect(formatStroopsWithLabel(BigInt(5_000_000))).toBe('0.5000000 XLM');
    });
  });

  describe('stroopsToXlm', () => {
    it('should convert stroops to XLM number', () => {
      expect(stroopsToXlm(BigInt(10_000_000))).toBe(1);
      expect(stroopsToXlm(BigInt(5_000_000))).toBe(0.5);
      expect(stroopsToXlm(BigInt(1))).toBe(0.0000001);
    });
  });

  describe('fetchExchangeRate', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch exchange rate from API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          stellar: {
            usd: 0.12,
          },
        }),
      });

      const rate = await fetchExchangeRate();
      expect(rate).toBe(0.12);
      expect(getCachedExchangeRate()).toBe(0.12);
    });

    it('should use cached rate within TTL', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          stellar: { usd: 0.12 },
        }),
      });

      const rate1 = await fetchExchangeRate();
      const rate2 = await fetchExchangeRate();

      expect(rate1).toBe(0.12);
      expect(rate2).toBe(0.12);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should return fallback rate on API error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const rate = await fetchExchangeRate();
      expect(rate).toBe(0.10); // Fallback rate
    });

    it('should handle invalid response data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const rate = await fetchExchangeRate();
      expect(rate).toBe(0.10); // Fallback rate
    });

    it('should use stale cache on fetch error', async () => {
      // First call succeeds
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          stellar: { usd: 0.15 },
        }),
      });

      await fetchExchangeRate();

      // Second call fails but cache exists
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      
      const rate = await fetchExchangeRate();
      expect(rate).toBe(0.15); // Stale cache used
    });
  });

  describe('formatStroopsAsUsd', () => {
    it('should format stroops as USD with provided rate', async () => {
      const usd = await formatStroopsAsUsd(BigInt(10_000_000), 0.12);
      expect(usd).toBe('0.1200');
    });

    it('should fetch rate if not provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          stellar: { usd: 0.12 },
        }),
      });

      const usd = await formatStroopsAsUsd(BigInt(10_000_000));
      expect(usd).toBe('0.1200');
    });

    it('should handle zero stroops', async () => {
      const usd = await formatStroopsAsUsd(BigInt(0), 0.12);
      expect(usd).toBe('0.0000');
    });
  });

  describe('formatStroopsDual', () => {
    it('should format with both XLM and USD', async () => {
      const formatted = await formatStroopsDual(BigInt(10_000_000), 0.12);
      expect(formatted).toBe('1.0000000 XLM ($0.1200)');
    });

    it('should fetch rate if not provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          stellar: { usd: 0.10 },
        }),
      });

      const formatted = await formatStroopsDual(BigInt(5_000_000));
      expect(formatted).toContain('0.5000000 XLM');
      expect(formatted).toContain('$0.0500');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with thousand separators', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1234567)).toBe('1,234,567');
      expect(formatNumber(100)).toBe('100');
      expect(formatNumber(0)).toBe('0');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(100)).toBe('100.0 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(2048)).toBe('2.0 KB');
      expect(formatBytes(1048576)).toBe('1.0 MB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          stellar: { usd: 0.12 },
        }),
      });

      await fetchExchangeRate();
      expect(getCachedExchangeRate()).toBe(0.12);

      clearExchangeRateCache();
      expect(getCachedExchangeRate()).toBeNull();
    });
  });
});
