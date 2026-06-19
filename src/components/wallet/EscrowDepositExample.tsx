/**
 * Example component showing TransactionModal integration with escrow deposit
 * This demonstrates the complete flow with preflight fee estimation
 */

'use client';

import { useState } from 'react';
import { useSorobanEscrow } from '@/hooks/useSorobanEscrow';
import { TransactionModal } from './TransactionModal';
import { useWallet } from '@/components/providers/WalletContext';

export function EscrowDepositExample() {
  const { account } = useWallet();
  const [amount, setAmount] = useState('');
  const escrow = useSorobanEscrow();

  const handleDeposit = () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    // This will trigger the preflight modal
    escrow.deposit({
      amount,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Escrow Deposit</h2>

      {escrow.escrowData && (
        <div className="mb-4 p-4 bg-gray-50 rounded">
          <div className="text-sm text-gray-600">Current Balance</div>
          <div className="text-xl font-semibold">{escrow.escrowData.balance} XLM</div>
          <div className="text-xs text-gray-500 mt-1">
            Certification: {escrow.escrowData.certificationValid ? '✓ Valid' : '✗ Invalid'}
          </div>
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
          Deposit Amount (XLM)
        </label>
        <input
          id="amount"
          type="number"
          step="0.0000001"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0.0000000"
          disabled={escrow.isDepositing}
        />
      </div>

      <button
        onClick={handleDeposit}
        disabled={!account || escrow.isDepositing || !amount}
        className="w-full px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md font-medium"
      >
        {escrow.isDepositing ? 'Processing...' : 'Deposit to Escrow'}
      </button>

      {escrow.depositError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-sm font-medium text-red-800">Deposit Failed</div>
          <div className="text-xs text-red-600 mt-1">
            {escrow.depositError instanceof Error
              ? escrow.depositError.message
              : 'Unknown error occurred'}
          </div>
        </div>
      )}

      {/* Preflight Modal */}
      {escrow.showPreflightModal && escrow.pendingDeposit && (
        <TransactionModal
          isOpen={escrow.showPreflightModal}
          onClose={escrow.cancelDeposit}
          onConfirm={escrow.confirmDeposit}
          contractId={process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || 'CA_ESCROW_123'}
          functionName="deposit"
          args={[escrow.pendingDeposit.amount]}
          sourceAccount={account || undefined}
          title="Confirm Escrow Deposit"
          description={`Review the resource fees for depositing ${escrow.pendingDeposit.amount} XLM to escrow`}
        />
      )}
    </div>
  );
}
