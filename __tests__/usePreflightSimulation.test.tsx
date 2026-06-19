/**
 * Tests for usePreflightSimulation hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePreflightSimulation } from '@/src/hooks/usePreflightSimulation';
import * as sorobanSimulator from '@/src/services/sorobanSimulator';
import * as feeFormatter from '@/src/utils/feeFormatter';

vi.mock('@/src/services/sorobanSimulator');
vi.mock('@/src/utils/feeFormatter');

describe('usePreflightSimulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start in idle state', () => {
    const { result } = renderHook(() =>
      usePreflightSimulation({
        contractId: 'CA123',
        functionName: 'deposit',
        args: ['100'],
        autoSimulate: false,
      })
    );

    expect(result.current.state).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should auto-simulate when autoSimulate is true', async () => {
    const mockResult = {
      minResourceFee: BigInt(1000000),
      instructions: 5000000,
      cpuInstructions: 5000000,
      readBytes: 1024,
      writeBytes: 512,
      ledgerEntryReads: 5,
      ledgerEntryWrites: 3,
    };

    vi.mocked(sorobanSimulator.simulateTransaction).mockResolvedValue(mockResult);
    vi.mocked(feeFormatter.fetchExchangeRate).mockResolvedValue(0.12);

    const { result } = renderHook(() =>
      usePreflightSimulation({
        contractId: 'CA123',
        functionName: 'deposit',
        args: ['100'],
        autoSimulate: true,
      })
    );

    // When autoSimulate is true, simulation starts immediately
    // So we may see 'idle' or 'simulating' depending on timing
    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });

    expect(result.current.result).toEqual(mockResult);
    expect(result.current.exchangeRate).toBe(0.12);
    expect(result.current.error).toBeNull();
  });

  it('should handle manual simulation', async () => {
    const mockResult = {
      minResourceFee: BigInt(1000000),
      instructions: 5000000,
      cpuInstructions: 5000000,
      readBytes: 1024,
      writeBytes: 512,
      ledgerEntryReads: 5,
      ledgerEntryWrites: 3,
    };

    vi.mocked(sorobanSimulator.simulateTransaction).mockResolvedValue(mockResult);
    vi.mocked(feeFormatter.fetchExchangeRate).mockResolvedValue(0.12);

    const { result } = renderHook(() =>
      usePreflightSimulation({
        contractId: 'CA123',
        functionName: 'deposit',
        args: ['100'],
        autoSimulate: false,
      })
    );

    expect(result.current.state).toBe('idle');

    // Manually trigger simulation
    act(() => {
      result.current.simulate();
    });

    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });

    expect(result.current.result).toEqual(mockResult);
  });

  it('should handle timeout errors', async () => {
    const timeoutError = {
      code: 'TIMEOUT',
      message: 'Simulation timed out after 5000ms',
    };

    vi.mocked(sorobanSimulator.simulateTransaction).mockRejectedValue(timeoutError);

    const { result } = renderHook(() =>
      usePreflightSimulation({
        contractId: 'CA123',
        functionName: 'deposit',
        args: ['100'],
        autoSimulate: true,
      })
    );

    await waitFor(() => {
      expect(result.current.state).toBe('timeout');
    });

    expect(result.current.error).toEqual(timeoutError);
    expect(result.current.result).toBeNull();
  });

  it('should handle other errors', async () => {
    const error = {
      code: 'CONTRACT_ERROR',
      message: 'Contract execution failed',
    };

    vi.mocked(sorobanSimulator.simulateTransaction).mockRejectedValue(error);

    const { result } = renderHook(() =>
      usePreflightSimulation({
        contractId: 'CA123',
        functionName: 'deposit',
        args: ['100'],
        autoSimulate: true,
      })
    );

    await waitFor(() => {
      expect(result.current.state).toBe('error');
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.result).toBeNull();
  });

  it('should handle exchange rate fetch failure gracefully', async () => {
    const mockResult = {
      minResourceFee: BigInt(1000000),
      instructions: 5000000,
      cpuInstructions: 5000000,
      readBytes: 1024,
      writeBytes: 512,
      ledgerEntryReads: 5,
      ledgerEntryWrites: 3,
    };

    vi.mocked(sorobanSimulator.simulateTransaction).mockResolvedValue(mockResult);
    vi.mocked(feeFormatter.fetchExchangeRate).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      usePreflightSimulation({
        contractId: 'CA123',
        functionName: 'deposit',
        args: ['100'],
        autoSimulate: true,
      })
    );

    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });

    expect(result.current.result).toEqual(mockResult);
    expect(result.current.exchangeRate).toBeNull();
  });

  it('should reset state correctly', async () => {
    const mockResult = {
      minResourceFee: BigInt(1000000),
      instructions: 5000000,
      cpuInstructions: 5000000,
      readBytes: 1024,
      writeBytes: 512,
      ledgerEntryReads: 5,
      ledgerEntryWrites: 3,
    };

    vi.mocked(sorobanSimulator.simulateTransaction).mockResolvedValue(mockResult);
    vi.mocked(feeFormatter.fetchExchangeRate).mockResolvedValue(0.12);

    const { result } = renderHook(() =>
      usePreflightSimulation({
        contractId: 'CA123',
        functionName: 'deposit',
        args: ['100'],
        autoSimulate: false, // Changed to false to prevent re-simulation after reset
      })
    );

    // Manually trigger simulation
    act(() => {
      result.current.simulate();
    });

    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });

    // Now reset
    act(() => {
      result.current.reset();
    });

    // Should be idle and stay idle since autoSimulate is false
    expect(result.current.state).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.exchangeRate).toBeNull();
  });

  it('should pass correct parameters to simulateTransaction', async () => {
    const mockResult = {
      minResourceFee: BigInt(1000000),
      instructions: 5000000,
      cpuInstructions: 5000000,
      readBytes: 1024,
      writeBytes: 512,
      ledgerEntryReads: 5,
      ledgerEntryWrites: 3,
    };

    vi.mocked(sorobanSimulator.simulateTransaction).mockResolvedValue(mockResult);
    vi.mocked(feeFormatter.fetchExchangeRate).mockResolvedValue(0.12);

    const { result } = renderHook(() =>
      usePreflightSimulation({
        contractId: 'CA123',
        functionName: 'deposit',
        args: ['100', '200'],
        sourceAccount: 'GABC123',
        rpcUrl: 'https://custom-rpc.stellar.org',
        timeoutMs: 3000,
        autoSimulate: true,
      })
    );

    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });

    expect(sorobanSimulator.simulateTransaction).toHaveBeenCalledWith(
      {
        contractId: 'CA123',
        functionName: 'deposit',
        args: ['100', '200'],
        sourceAccount: 'GABC123',
      },
      'https://custom-rpc.stellar.org',
      3000
    );
  });
});

