# Soroban Transaction Fee Estimation Implementation

## Overview

This implementation provides a comprehensive fee estimation component for Soroban transactions, allowing users to preview resource costs and network fees before signing transactions.

## Architecture

### Core Components

1. **sorobanSimulator.ts** - Simulation service
   - Calls Soroban's `simulateTransaction` RPC method
   - Returns resource footprint (CPU, memory, storage)
   - Handles timeout and error cases
   - Located: `/src/services/sorobanSimulator.ts`

2. **feeFormatter.ts** - Fee formatting utilities
   - Converts stroops to XLM
   - Fetches XLM/USD exchange rates
   - Caches exchange rates (5-minute TTL)
   - Formats bytes and numbers for display
   - Located: `/src/utils/feeFormatter.ts`

3. **usePreflightSimulation.ts** - Simulation hook
   - Manages simulation state machine
   - Orchestrates API calls
   - Supports auto and manual simulation
   - Located: `/src/hooks/usePreflightSimulation.ts`

4. **TransactionModal.tsx** - UI component
   - Displays fee estimates
   - Shows resource usage with color-coded bars
   - Handles timeout and error states
   - Provides raw JSON view for developers
   - Located: `/src/components/wallet/TransactionModal.tsx`

### State Machine

The simulation follows this state flow:

```
idle → simulating → ready
                 → timeout
                 → error
```

States:
- **idle**: Initial state, no simulation run
- **simulating**: API call in progress
- **ready**: Successful simulation, results available
- **timeout**: Simulation exceeded 5-second limit
- **error**: Simulation failed with error

## Key Features

### 1. Resource Footprint Display

Shows absolute values and percentages for:
- **CPU Instructions**: With color-coded progress bar
- **Storage Read**: Bytes read from ledger
- **Storage Write**: Bytes written to ledger
- **Ledger Entries**: Number of entries accessed

### 2. Fee Display

- Primary display: XLM (7 decimal places)
- Secondary display: USD equivalent
- Stroops shown for debugging
- Exchange rate cached to reduce API calls

### 3. Color-Coded Warnings

Resource usage bars change color based on percentage:
- **Green**: < 50% of network limit
- **Yellow**: 50-79% of network limit
- **Red**: ≥ 80% of network limit

### 4. Timeout Handling

If simulation exceeds 5 seconds:
- Shows timeout warning
- Allows user to retry
- Allows proceeding with default fees

### 5. Developer Details

Expandable section showing:
- Raw simulation JSON
- All response fields
- Useful for debugging

## Usage

### Basic Integration

```tsx
import { TransactionModal } from '@/src/components/wallet/TransactionModal';

function MyComponent() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Send Transaction
      </button>

      <TransactionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleConfirm}
        contractId="CA..."
        functionName="transfer"
        args={[recipient, amount]}
        sourceAccount={userAccount}
        title="Confirm Transfer"
        description="Review fees before signing"
      />
    </>
  );
}
```

### With Escrow Hook

The `useSorobanEscrow` hook has been updated to integrate the modal:

```tsx
import { useSorobanEscrow } from '@/hooks/useSorobanEscrow';

function EscrowDeposit() {
  const escrow = useSorobanEscrow();

  // Trigger deposit (shows modal)
  const handleDeposit = () => {
    escrow.deposit({
      amount: '100.0000000',
      metadata: { note: 'Payment for crops' },
    });
  };

  return (
    <>
      <button onClick={handleDeposit}>Deposit</button>

      {/* Modal automatically managed by hook */}
      {escrow.showPreflightModal && escrow.pendingDeposit && (
        <TransactionModal
          isOpen={escrow.showPreflightModal}
          onClose={escrow.cancelDeposit}
          onConfirm={escrow.confirmDeposit}
          contractId={ESCROW_CONTRACT_ID}
          functionName="deposit"
          args={[escrow.pendingDeposit.amount]}
          sourceAccount={account}
        />
      )}
    </>
  );
}
```

## Configuration

### Environment Variables

```env
# Soroban RPC endpoint (defaults to testnet)
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Escrow contract ID (example)
NEXT_PUBLIC_ESCROW_CONTRACT_ID=CA...
```

### Soroban Limits

Network limits are defined in `sorobanSimulator.ts`:

```typescript
export const SOROBAN_LIMITS = {
  maxInstructions: 100_000_000,    // 100M CPU instructions
  maxReadBytes: 200_000,           // 200KB
  maxWriteBytes: 100_000,          // 100KB
  maxLedgerEntryReads: 40,
  maxLedgerEntryWrites: 25,
};
```

These should be updated if Soroban network limits change.

## Testing

### Unit Tests

All components have comprehensive unit tests:

```bash
npm test
```

Test files:
- `__tests__/sorobanSimulator.test.ts` - Simulation service
- `__tests__/feeFormatter.test.ts` - Formatting utilities
- `__tests__/usePreflightSimulation.test.tsx` - Hook logic
- `__tests__/TransactionModal.test.tsx` - UI component
- `__tests__/escrowDepositIntegration.test.tsx` - End-to-end flow

### Running Specific Tests

```bash
# Run simulation tests
npm test sorobanSimulator

# Run integration tests
npm test escrowDepositIntegration

# Run with coverage
npm test -- --coverage
```

## API Reference

### simulateTransaction

```typescript
function simulateTransaction(
  params: SimulateTransactionParams,
  rpcUrl?: string,
  timeoutMs?: number
): Promise<SimulationResult>
```

**Parameters:**
- `params.contractId`: Contract address
- `params.functionName`: Function to call
- `params.args`: Function arguments
- `params.sourceAccount`: (Optional) Source account
- `rpcUrl`: (Optional) Custom RPC endpoint
- `timeoutMs`: (Optional) Timeout in ms (default: 5000)

**Returns:**
- `minResourceFee`: Fee in stroops
- `instructions`: CPU instructions used
- `readBytes`: Storage bytes read
- `writeBytes`: Storage bytes written
- `ledgerEntryReads`: Number of entries read
- `ledgerEntryWrites`: Number of entries written

### usePreflightSimulation

```typescript
function usePreflightSimulation(options: {
  contractId: string;
  functionName: string;
  args: unknown[];
  sourceAccount?: string;
  autoSimulate?: boolean;
  rpcUrl?: string;
  timeoutMs?: number;
}): PreflightSimulation
```

**Returns:**
- `state`: Current simulation state
- `result`: Simulation result (if ready)
- `error`: Error details (if failed)
- `exchangeRate`: XLM/USD rate (if fetched)
- `simulate()`: Manually trigger simulation
- `reset()`: Reset to idle state

## Known Limitations

1. **Transaction XDR Building**: Currently uses placeholder implementation. Production code should use `@stellar/stellar-sdk` to build proper transaction XDR.

2. **Exchange Rate API**: Uses free CoinGecko API which has rate limits. Consider upgrading for production.

3. **Simulation Accuracy**: Dry-run simulation may differ slightly from actual execution due to:
   - Ledger state changes between simulation and execution
   - Network congestion affecting resource usage
   - Contract state modifications

4. **Timeout Handling**: Users can proceed on timeout, but will use default fee parameters which may be insufficient for complex transactions.

## Future Enhancements

### Planned Features

1. **Smart Fee Recommendations**: Suggest fee bumps based on historical data
2. **Gas Price Oracle**: Real-time network congestion analysis
3. **Fee History**: Show user's past transaction fees
4. **Advanced Options**: Allow manual fee/resource adjustments
5. **Multi-transaction Batching**: Estimate fees for transaction batches

### Integration Points

- **Cargo Status Updates**: Add preflight modal to status change flow
- **Milestone Releases**: Integrate with escrow release operations
- **Certification Claims**: Show fees for on-chain cert verification

## Troubleshooting

### Simulation Always Times Out

1. Check RPC endpoint is accessible:
   ```bash
   curl -X POST https://soroban-testnet.stellar.org \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
   ```

2. Increase timeout in modal props:
   ```tsx
   <TransactionModal {...props} timeoutMs={10000} />
   ```

### Exchange Rate Not Loading

1. Check CoinGecko API status
2. Verify network connectivity
3. Check browser console for CORS errors
4. Consider using fallback rate

### Tests Failing

1. Clear test cache:
   ```bash
   npm test -- --clearCache
   ```

2. Check for mock configuration issues
3. Ensure all dependencies are installed
4. Verify Node.js version compatibility

## Support

For issues or questions:
1. Check existing tests for usage examples
2. Review component documentation in source files
3. Check network RPC endpoint status
4. Verify contract ID and function names

## License

Part of AgriTrust Protocol - See main LICENSE file
