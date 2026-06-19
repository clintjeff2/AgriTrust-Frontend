/**
 * Transaction preflight modal
 * Displays fee estimates and resource footprint before transaction signing
 */

'use client';

import { useEffect, useState } from 'react';
import {
  useAutoPreflightSimulation,
  type PreflightSimulation,
} from '@/src/hooks/usePreflightSimulation';
import {
  calculateResourceUsage,
  getUsageColor,
  SOROBAN_LIMITS,
} from '@/src/services/sorobanSimulator';
import {
  formatStroops,
  formatStroopsDual,
  formatNumber,
  formatBytes,
} from '@/src/utils/feeFormatter';

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  contractId: string;
  functionName: string;
  args: unknown[];
  sourceAccount?: string;
  title?: string;
  description?: string;
}

export function TransactionModal({
  isOpen,
  onClose,
  onConfirm,
  contractId,
  functionName,
  args,
  sourceAccount,
  title = 'Confirm Transaction',
  description,
}: TransactionModalProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [feeDisplay, setFeeDisplay] = useState<string>('');

  const simulation = useAutoPreflightSimulation({
    contractId,
    functionName,
    args,
    sourceAccount,
  });

  // Format fee display with USD conversion
  useEffect(() => {
    if (simulation.result && simulation.exchangeRate) {
      formatStroopsDual(simulation.result.minResourceFee, simulation.exchangeRate)
        .then(setFeeDisplay)
        .catch(() => {
          if (simulation.result) {
            setFeeDisplay(formatStroops(simulation.result.minResourceFee) + ' XLM');
          }
        });
    } else if (simulation.result) {
      setFeeDisplay(formatStroops(simulation.result.minResourceFee) + ' XLM');
    }
  }, [simulation.result, simulation.exchangeRate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {simulation.state === 'simulating' && (
            <SimulatingState />
          )}

          {simulation.state === 'ready' && simulation.result && (
            <ReadyState
              simulation={simulation}
              feeDisplay={feeDisplay}
              showDetails={showDetails}
              onToggleDetails={() => setShowDetails(!showDetails)}
            />
          )}

          {simulation.state === 'timeout' && (
            <TimeoutState onRetry={simulation.simulate} />
          )}

          {simulation.state === 'error' && simulation.error && (
            <ErrorState error={simulation.error} onRetry={simulation.simulate} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md border border-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={simulation.state === 'simulating'}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md"
          >
            {simulation.state === 'timeout' ? 'Proceed Anyway' : 'Confirm & Sign'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SimulatingState() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      <p className="mt-4 text-sm text-gray-600">Simulating transaction...</p>
      <p className="mt-1 text-xs text-gray-500">Calculating fees and resource usage</p>
    </div>
  );
}

interface ReadyStateProps {
  simulation: PreflightSimulation;
  feeDisplay: string;
  showDetails: boolean;
  onToggleDetails: () => void;
}

function ReadyState({ simulation, feeDisplay, showDetails, onToggleDetails }: ReadyStateProps) {
  const { result } = simulation;
  if (!result) return null;

  const usage = calculateResourceUsage(result);
  if (!usage) return null;

  return (
    <div className="space-y-4">
      {/* Fee Display */}
      <div className="rounded-lg bg-blue-50 p-4">
        <div className="text-sm font-medium text-blue-900">Estimated Resource Fee</div>
        <div className="mt-1 text-2xl font-bold text-blue-700">{feeDisplay}</div>
        <div className="mt-1 text-xs text-blue-600">
          {result.minResourceFee.toString()} stroops
        </div>
      </div>

      {/* Resource Breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Resource Usage</h3>

        {/* CPU Instructions */}
        <ResourceBar
          label="CPU Instructions"
          value={result.instructions}
          max={SOROBAN_LIMITS.maxInstructions}
          percent={usage.cpuPercent}
          color={getUsageColor(usage.cpuPercent)}
        />

        {/* Storage Read */}
        <ResourceBar
          label="Storage Read"
          value={result.readBytes}
          max={SOROBAN_LIMITS.maxReadBytes}
          percent={usage.readBytesPercent}
          color={getUsageColor(usage.readBytesPercent)}
          formatter={formatBytes}
        />

        {/* Storage Write */}
        <ResourceBar
          label="Storage Write"
          value={result.writeBytes}
          max={SOROBAN_LIMITS.maxWriteBytes}
          percent={usage.writeBytesPercent}
          color={getUsageColor(usage.writeBytesPercent)}
          formatter={formatBytes}
        />

        {/* Ledger Entries */}
        <div className="text-xs text-gray-600">
          <span className="font-medium">Ledger Entries:</span>{' '}
          {result.ledgerEntryReads} read, {result.ledgerEntryWrites} write
        </div>
      </div>

      {/* Details Toggle */}
      <button
        onClick={onToggleDetails}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        {showDetails ? '▼ Hide Details' : '▶ View Details'}
      </button>

      {/* Raw Simulation JSON */}
      {showDetails && (
        <div className="mt-2 rounded-md bg-gray-50 p-3 overflow-auto max-h-64">
          <pre className="text-xs text-gray-700">
            {JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

interface ResourceBarProps {
  label: string;
  value: number;
  max: number;
  percent: number;
  color: 'green' | 'yellow' | 'red';
  formatter?: (value: number) => string;
}

function ResourceBar({ label, value, max, percent, color, formatter = formatNumber }: ResourceBarProps) {
  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span className="font-medium">{label}</span>
        <span>
          {formatter(value)} / {formatter(max)} ({percent.toFixed(1)}%)
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-300`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function TimeoutState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto h-12 w-12 text-yellow-500">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="mt-2 text-sm font-medium text-gray-900">Simulation Timed Out</h3>
      <p className="mt-1 text-sm text-gray-500">
        The simulation took too long to complete. You can proceed with default fee parameters or
        retry the simulation.
      </p>
      <button
        onClick={onRetry}
        className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        Retry Simulation
      </button>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: { code: string; message: string }; onRetry: () => void }) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto h-12 w-12 text-red-500">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="mt-2 text-sm font-medium text-gray-900">Simulation Failed</h3>
      <p className="mt-1 text-sm text-gray-500">{error.message}</p>
      <p className="mt-1 text-xs text-gray-400">Error Code: {error.code}</p>
      <button
        onClick={onRetry}
        className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        Retry Simulation
      </button>
    </div>
  );
}
