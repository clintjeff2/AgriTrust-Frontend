/**
 * Soroban transaction simulation service
 * Provides dry-run simulation using Soroban's simulateTransaction RPC method
 */

export interface SimulationResult {
  minResourceFee: bigint;
  instructions: number;
  readBytes: number;
  writeBytes: number;
  ledgerEntryReads: number;
  ledgerEntryWrites: number;
  cpuInstructions: number;
}

export interface SimulationError {
  code: string;
  message: string;
}

export interface SimulateTransactionParams {
  contractId: string;
  functionName: string;
  args: unknown[];
  sourceAccount?: string;
}

// Soroban network limits (Mainnet values as of 2024)
export const SOROBAN_LIMITS = {
  maxInstructions: 100_000_000, // 100M CPU instructions
  maxReadBytes: 200_000, // 200KB
  maxWriteBytes: 100_000, // 100KB
  maxLedgerEntryReads: 40,
  maxLedgerEntryWrites: 25,
} as const;

/**
 * Simulates a Soroban contract transaction via RPC
 * @param params Transaction parameters
 * @param rpcUrl Soroban RPC endpoint URL
 * @param timeoutMs Request timeout in milliseconds (default: 5000)
 * @returns Simulation result with resource footprint and fees
 * @throws SimulationError if simulation fails or times out
 */
export async function simulateTransaction(
  params: SimulateTransactionParams,
  rpcUrl: string = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  timeoutMs: number = 5000
): Promise<SimulationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'simulateTransaction',
        params: {
          transaction: buildTransactionXDR(params),
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw {
        code: 'RPC_ERROR',
        message: `RPC request failed with status ${response.status}`,
      } as SimulationError;
    }

    const data = await response.json();

    if (data.error) {
      throw {
        code: data.error.code || 'SIMULATION_ERROR',
        message: data.error.message || 'Simulation failed',
      } as SimulationError;
    }

    if (!data.result) {
      throw {
        code: 'INVALID_RESPONSE',
        message: 'Invalid response from RPC',
      } as SimulationError;
    }

    return parseSimulationResult(data.result);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw {
        code: 'TIMEOUT',
        message: `Simulation timed out after ${timeoutMs}ms`,
      } as SimulationError;
    }

    if (isSimulationError(error)) {
      throw error;
    }

    throw {
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    } as SimulationError;
  }
}

/**
 * Builds transaction XDR for simulation
 * In production, this should use Stellar SDK to build proper transaction XDR
 */
function buildTransactionXDR(params: SimulateTransactionParams): string {
  // Placeholder implementation
  // In production, use @stellar/stellar-sdk to build proper transaction
  return JSON.stringify({
    contractId: params.contractId,
    function: params.functionName,
    args: params.args,
    source: params.sourceAccount,
  });
}

/**
 * Parses simulation result from RPC response
 */
function parseSimulationResult(result: any): SimulationResult {
  const cost = result.cost || {};
  const footprint = result.footprint || {};
  
  return {
    minResourceFee: BigInt(cost.minResourceFee || '0'),
    instructions: Number(cost.cpuInsns || 0),
    cpuInstructions: Number(cost.cpuInsns || 0),
    readBytes: Number(footprint.readBytes || 0),
    writeBytes: Number(footprint.writeBytes || 0),
    ledgerEntryReads: Number(footprint.readEntries || 0),
    ledgerEntryWrites: Number(footprint.writeEntries || 0),
  };
}

/**
 * Type guard for SimulationError
 */
function isSimulationError(error: unknown): error is SimulationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

/**
 * Calculates resource usage percentages
 */
export function calculateResourceUsage(result: SimulationResult) {
  return {
    cpuPercent: (result.instructions / SOROBAN_LIMITS.maxInstructions) * 100,
    readBytesPercent: (result.readBytes / SOROBAN_LIMITS.maxReadBytes) * 100,
    writeBytesPercent: (result.writeBytes / SOROBAN_LIMITS.maxWriteBytes) * 100,
    readEntriesPercent: (result.ledgerEntryReads / SOROBAN_LIMITS.maxLedgerEntryReads) * 100,
    writeEntriesPercent: (result.ledgerEntryWrites / SOROBAN_LIMITS.maxLedgerEntryWrites) * 100,
  };
}

/**
 * Gets color code for resource usage (for UI display)
 */
export function getUsageColor(percent: number): 'green' | 'yellow' | 'red' {
  if (percent < 50) return 'green';
  if (percent < 80) return 'yellow';
  return 'red';
}
