/**
 * Tests for TransactionModal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionModal } from '@/src/components/wallet/TransactionModal';
import * as usePreflightSimulationHook from '@/src/hooks/usePreflightSimulation';

vi.mock('@/src/hooks/usePreflightSimulation');

describe('TransactionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    contractId: 'CA123',
    functionName: 'deposit',
    args: ['100'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    vi.mocked(usePreflightSimulationHook.useAutoPreflightSimulation).mockReturnValue({
      state: 'idle',
      result: null,
      error: null,
      exchangeRate: null,
      simulate: vi.fn(),
      reset: vi.fn(),
    });

    const { container } = render(
      <TransactionModal {...defaultProps} isOpen={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should show simulating state', () => {
    vi.mocked(usePreflightSimulationHook.useAutoPreflightSimulation).mockReturnValue({
      state: 'simulating',
      result: null,
      error: null,
      exchangeRate: null,
      simulate: vi.fn(),
      reset: vi.fn(),
    });

    render(<TransactionModal {...defaultProps} />);

    expect(screen.getByText('Simulating transaction...')).toBeInTheDocument();
    expect(screen.getByText('Calculating fees and resource usage')).toBeInTheDocument();
  });

  it('should display simulation results', async () => {
    const mockResult = {
      minResourceFee: BigInt(1000000),
      instructions: 5000000,
      cpuInstructions: 5000000,
      readBytes: 1024,
      writeBytes: 512,
      ledgerEntryReads: 5,
      ledgerEntryWrites: 3,
    };

    vi.mocked(usePreflightSimulationHook.useAutoPreflightSimulation).mockReturnValue({
      state: 'ready',
      result: mockResult,
      error: null,
      exchangeRate: 0.12,
      simulate: vi.fn(),
      reset: vi.fn(),
    });

    render(<TransactionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Estimated Resource Fee')).toBeInTheDocument();
    });

    expect(screen.getByText('Resource Usage')).toBeInTheDocument();
    expect(screen.getByText('CPU Instructions')).toBeInTheDocument();
    expect(screen.getByText('Storage Read')).toBeInTheDocument();
    expect(screen.getByText('Storage Write')).toBeInTheDocument();
  });

  it('should display timeout state with retry option', async () => {
    const mockSimulate = vi.fn();
    vi.mocked(usePreflightSimulationHook.useAutoPreflightSimulation).mockReturnValue({
      state: 'timeout',
      result: null,
      error: null,
      exchangeRate: null,
      simulate: mockSimulate,
      reset: vi.fn(),
    });

    render(<TransactionModal {...defaultProps} />);

    expect(screen.getByText('Simulation Timed Out')).toBeInTheDocument();
    expect(
      screen.getByText(/The simulation took too long to complete/)
    ).toBeInTheDocument();

    const retryButton = screen.getByText('Retry Simulation');
    await userEvent.click(retryButton);

    expect(mockSimulate).toHaveBeenCalledTimes(1);
  });

  it('should display error state with retry option', async () => {
    const mockSimulate = vi.fn();
    const mockError = {
      code: 'CONTRACT_ERROR',
      message: 'Contract execution failed',
    };

    vi.mocked(usePreflightSimulationHook.useAutoPreflightSimulation).mockReturnValue({
      state: 'error',
      result: null,
      error: mockError,
      exchangeRate: null,
      simulate: mockSimulate,
      reset: vi.fn(),
    });

    render(<TransactionModal {...defaultProps} />);

    expect(screen.getByText('Simulation Failed')).toBeInTheDocument();
    expect(screen.getByText('Contract execution failed')).toBeInTheDocument();
    expect(screen.getByText('Error Code: CONTRACT_ERROR')).toBeInTheDocument();

    const retryButton = screen.getByText('Retry Simulation');
    await userEvent.click(retryButton);

    expect(mockSimulate).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when Cancel button is clicked', async () => {
    const mockOnClose = vi.fn();
    vi.mocked(usePreflightSimulationHook.useAutoPreflightSimulation).mockReturnValue({
      state: 'idle',
      result: null,
      error: null,
      exchangeRate: null,
      simulate: vi.fn(),
      reset: vi.fn(),
    });

    render(<TransactionModal {...defaultProps} onClose={mockOnClose} />);

    const cancelButton = screen.getByText('Cancel');
    await userEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onConfirm when Confirm button is clicked', async () => {
    const mockOnConfirm = vi.fn();
    const mockResult = {
      minResourceFee: BigInt(1000000),
      instructions: 5000000,
      cpuInstructions: 5000000,
      readBytes: 1024,
      writeBytes: 512,
      ledgerEntryReads: 5,
      ledgerEntryWrites: 3,
    };

    vi.mocked(usePreflightSimulationHook.useAutoPreflightSimulation).mockReturnValue({
      state: 'ready',
      result: mockResult,
      error: null,
      exchangeRate: 0.12,
      simulate: vi.fn(),
      reset: vi.fn(),
    });

    render(<TransactionModal {...defaultProps} onConfirm={mockOnConfirm} />);

    await waitFor(() => {
      expect(screen.getByText('Confirm & Sign')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Confirm & Sign');
    await userEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('should disable confirm button while simulating', () => {
    vi.mocked(usePreflightSimulationHook.useAutoPreflightSimulation).mockReturnValue({
      state: 'simulating',
      result: null,
      error: null,
      exchangeRate: null,
      simulate: vi.fn(),
      reset: vi.fn(),
    });

    render(<TransactionModal {...defaultProps} />);

    const confirmButton = screen.getByText('Confirm & Sign');
    expect(confirmButton).toBeDisabled();
  });

  it('should show "Proceed Anyway" button on timeout', () => {
    vi.mocked(usePreflightSimulationHook.useAutoPreflightSimulation).mockReturnValue({
      state: 'timeout',
      result: null,
      error: null,
      exchangeRate: null,
      simulate: vi.fn(),
      reset: vi.fn(),
    });

    render(<TransactionModal {...defaultProps} />);

    expect(screen.getByText('Proceed Anyway')).toBeInTheDocument();
  });

  it('should toggle details view', async () => {
    const mockResult = {
      minResourceFee: BigInt(1000000),
      instructions: 5000000,
      cpuInstructions: 5000000,
      readBytes: 1024,
      writeBytes: 512,
      ledgerEntryReads: 5,
      ledgerEntryWrites: 3,
    };

    vi.mocked(usePreflightSimulationHook.useAutoPreflightSimulation).mockReturnValue({
      state: 'ready',
      result: mockResult,
      error: null,
      exchangeRate: 0.12,
      simulate: vi.fn(),
      reset: vi.fn(),
    });

    render(<TransactionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('▶ View Details')).toBeInTheDocument();
    });

    const toggleButton = screen.getByText('▶ View Details');
    await userEvent.click(toggleButton);

    expect(screen.getByText('▼ Hide Details')).toBeInTheDocument();
    
    // Check if JSON is displayed
    const jsonElement = screen.getByText(/"minResourceFee"/);
    expect(jsonElement).toBeInTheDocument();
  });

  it('should display custom title and description', () => {
    vi.mocked(usePreflightSimulationHook.useAutoPreflightSimulation).mockReturnValue({
      state: 'idle',
      result: null,
      error: null,
      exchangeRate: null,
      simulate: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <TransactionModal
        {...defaultProps}
        title="Custom Title"
        description="Custom description text"
      />
    );

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom description text')).toBeInTheDocument();
  });

  it('should show ledger entry information', async () => {
    const mockResult = {
      minResourceFee: BigInt(1000000),
      instructions: 5000000,
      cpuInstructions: 5000000,
      readBytes: 1024,
      writeBytes: 512,
      ledgerEntryReads: 5,
      ledgerEntryWrites: 3,
    };

    vi.mocked(usePreflightSimulationHook.useAutoPreflightSimulation).mockReturnValue({
      state: 'ready',
      result: mockResult,
      error: null,
      exchangeRate: 0.12,
      simulate: vi.fn(),
      reset: vi.fn(),
    });

    render(<TransactionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/5 read, 3 write/)).toBeInTheDocument();
    });
  });
});

