/**
 * Hook for managing Soroban transaction preflight simulation
 * Orchestrates simulation calls and state management
 */

import { useState, useEffect, useCallback } from 'react';
import {
  simulateTransaction,
  SimulationResult,
  SimulationError,
  SimulateTransactionParams,
} from '@/src/services/sorobanSimulator';
import { fetchExchangeRate } from '@/src/utils/feeFormatter';

export type SimulationState = 'idle' | 'simulating' | 'ready' | 'error' | 'timeout';

export interface PreflightSimulation {
  state: SimulationState;
  result: SimulationResult | null;
  error: SimulationError | null;
  exchangeRate: number | null;
  simulate: () => Promise<void>;
  reset: () => void;
}

interface UsePreflightSimulationOptions {
  contractId: string;
  functionName: string;
  args: unknown[];
  sourceAccount?: string;
  autoSimulate?: boolean; // Auto-run simulation on mount
  rpcUrl?: string;
  timeoutMs?: number;
}

/**
 * Hook to manage preflight simulation for Soroban transactions
 * 
 * @param options Simulation configuration
 * @returns Simulation state and control functions
 * 
 * @example
 * ```tsx
 * const simulation = usePreflightSimulation({
 *   contractId: 'CA...',
 *   functionName: 'deposit',
 *   args: [amount],
 *   autoSimulate: true,
 * });
 * 
 * if (simulation.state === 'ready') {
 *   console.log('Fee:', simulation.result.minResourceFee);
 * }
 * ```
 */
export function usePreflightSimulation(
  options: UsePreflightSimulationOptions
): PreflightSimulation {
  const {
    contractId,
    functionName,
    args,
    sourceAccount,
    autoSimulate = false,
    rpcUrl,
    timeoutMs = 5000,
  } = options;

  const [state, setState] = useState<SimulationState>('idle');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<SimulationError | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  const simulate = useCallback(async () => {
    setState('simulating');
    setError(null);
    setResult(null);

    try {
      const params: SimulateTransactionParams = {
        contractId,
        functionName,
        args,
        sourceAccount,
      };

      // Run simulation and fetch exchange rate in parallel
      const [simResult, rate] = await Promise.all([
        simulateTransaction(params, rpcUrl, timeoutMs),
        fetchExchangeRate().catch(() => null), // Don't fail if exchange rate fetch fails
      ]);

      setResult(simResult);
      setExchangeRate(rate);
      setState('ready');
    } catch (err) {
      const simulationError = err as SimulationError;
      setError(simulationError);

      // Set specific state for timeout
      if (simulationError.code === 'TIMEOUT') {
        setState('timeout');
      } else {
        setState('error');
      }
    }
  }, [contractId, functionName, args, sourceAccount, rpcUrl, timeoutMs]);

  const reset = useCallback(() => {
    setState('idle');
    setResult(null);
    setError(null);
    setExchangeRate(null);
  }, []);

  // Auto-simulate on mount if enabled
  useEffect(() => {
    if (autoSimulate && state === 'idle') {
      simulate();
    }
  }, [autoSimulate, simulate, state]);

  return {
    state,
    result,
    error,
    exchangeRate,
    simulate,
    reset,
  };
}

/**
 * Hook variant that simulates on demand (button click, etc.)
 */
export function useManualPreflightSimulation(
  options: Omit<UsePreflightSimulationOptions, 'autoSimulate'>
) {
  return usePreflightSimulation({
    ...options,
    autoSimulate: false,
  });
}

/**
 * Hook variant that auto-simulates when modal opens
 */
export function useAutoPreflightSimulation(
  options: Omit<UsePreflightSimulationOptions, 'autoSimulate'>
) {
  return usePreflightSimulation({
    ...options,
    autoSimulate: true,
  });
}
