# Quick Start: Fee Estimation Feature

## Overview

The fee estimation feature allows users to see exact resource costs before signing Soroban transactions.

## For Users

### What You'll See

When you attempt a transaction (e.g., escrow deposit), a modal will appear showing:

1. **Estimated Fee**: Displayed in both XLM and USD
2. **Resource Usage**:
   - CPU Instructions (with color-coded bar)
   - Storage Read/Write (in KB/MB)
   - Ledger Entries accessed
3. **Action Buttons**:
   - **Cancel**: Abort the transaction
   - **Confirm & Sign**: Proceed with wallet signature

### Color Coding

- **Green**: Safe usage (<50% of network limits)
- **Yellow**: Moderate usage (50-80%)
- **Red**: High usage (≥80%) - may be rejected

### What to Do

1. Review the estimated fee
2. Check resource usage bars
3. If everything looks good, click "Confirm & Sign"
4. If fees are too high or resources are near limits, click "Cancel"

### Timeout Handling

If simulation takes >5 seconds:
- You'll see a timeout warning
- You can **Retry** the simulation
- Or **Proceed Anyway** with default parameters (not recommended)

## For Developers

### Basic Integration

```tsx
import { TransactionModal } from '@/src/components/wallet/TransactionModal';

function MyComponent() {
  const [showModal, setShowModal] = useState(false);
  const { account } = useWallet();

  const handleTransaction = () => {
    // Execute your transaction logic
    console.log('Transaction confirmed!');
  };

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Send Transaction
      </button>

      <TransactionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleTransaction}
        contractId="CA..." // Your contract ID
        functionName="transfer"
        args={[recipient, amount]}
        sourceAccount={account}
        title="Confirm Transfer"
        description="Review fees before transfer"
      />
    </>
  );
}
```

### With Existing Hooks

The `useSorobanEscrow` hook now includes preflight support:

```tsx
import { useSorobanEscrow } from '@/hooks/useSorobanEscrow';
import { TransactionModal } from '@/src/components/wallet/TransactionModal';

function EscrowDeposit() {
  const escrow = useSorobanEscrow();
  const { account } = useWallet();
  const [amount, setAmount] = useState('');

  return (
    <>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount in XLM"
      />
      
      <button onClick={() => escrow.deposit({ amount })}>
        Deposit
      </button>

      {/* Modal automatically managed */}
      {escrow.showPreflightModal && escrow.pendingDeposit && (
        <TransactionModal
          isOpen={escrow.showPreflightModal}
          onClose={escrow.cancelDeposit}
          onConfirm={escrow.confirmDeposit}
          contractId={process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID!}
          functionName="deposit"
          args={[escrow.pendingDeposit.amount]}
          sourceAccount={account}
          title="Confirm Deposit"
        />
      )}
    </>
  );
}
```

### Manual Simulation

Use the hook directly for custom flows:

```tsx
import { useManualPreflightSimulation } from '@/src/hooks/usePreflightSimulation';

function CustomFlow() {
  const simulation = useManualPreflightSimulation({
    contractId: 'CA...',
    functionName: 'myFunction',
    args: [arg1, arg2],
  });

  const handleSimulate = () => {
    simulation.simulate();
  };

  return (
    <div>
      <button onClick={handleSimulate}>
        Estimate Fees
      </button>

      {simulation.state === 'ready' && (
        <div>
          Fee: {simulation.result.minResourceFee.toString()} stroops
        </div>
      )}
    </div>
  );
}
```

## Configuration

### Environment Variables

Create a `.env.local` file:

```env
# Soroban RPC endpoint
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Your contract IDs
NEXT_PUBLIC_ESCROW_CONTRACT_ID=CA...
```

### Customizing Limits

Edit `/src/services/sorobanSimulator.ts`:

```typescript
export const SOROBAN_LIMITS = {
  maxInstructions: 100_000_000,
  maxReadBytes: 200_000,
  maxWriteBytes: 100_000,
  maxLedgerEntryReads: 40,
  maxLedgerEntryWrites: 25,
};
```

## Testing

### Run Tests

```bash
# All tests
npm test

# Specific suite
npm test feeFormatter
npm test sorobanSimulator
npm test TransactionModal

# Watch mode
npm test -- --watch
```

### Manual Testing

1. Start dev server: `npm run dev`
2. Navigate to your transaction page
3. Click a transaction button
4. Verify modal appears with simulation
5. Check fee display and resource bars
6. Test Cancel and Confirm buttons

## Troubleshooting

### Modal Doesn't Appear

- Check that `isOpen` prop is `true`
- Verify contract ID is set
- Check browser console for errors

### Simulation Fails

- Verify RPC endpoint is accessible
- Check contract ID format
- Ensure args match contract function signature

### Exchange Rate Not Loading

- Check network connectivity
- Verify CoinGecko API is accessible
- Fee will still display in XLM if USD fails

### Tests Failing

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear test cache
npm test -- --clearCache

# Run with verbose output
npm test -- --reporter=verbose
```

## Common Patterns

### Conditional Simulation

Only simulate if amount exceeds threshold:

```tsx
const handleDeposit = () => {
  if (parseFloat(amount) > 100) {
    // Show preflight for large amounts
    setShowPreflight(true);
  } else {
    // Skip preflight for small amounts
    executeDeposit();
  }
};
```

### Custom Timeout

Increase timeout for complex contracts:

```tsx
<TransactionModal
  {...props}
  timeoutMs={10000} // 10 seconds
/>
```

### Disable Auto-Simulation

```tsx
const simulation = usePreflightSimulation({
  contractId: 'CA...',
  functionName: 'transfer',
  args: [amount],
  autoSimulate: false, // Manual control
});

// Trigger when needed
<button onClick={simulation.simulate}>
  Estimate Fees
</button>
```

## Next Steps

1. Read the full [FEE_ESTIMATION_README.md](./FEE_ESTIMATION_README.md)
2. Check the [implementation summary](./FEE_ESTIMATION_IMPLEMENTATION_SUMMARY.md)
3. Explore example: `/src/components/wallet/EscrowDepositExample.tsx`
4. Adapt for your specific transaction flows

## Support

- Check existing tests for usage patterns
- Review component source files for prop documentation
- See README files for detailed API reference
