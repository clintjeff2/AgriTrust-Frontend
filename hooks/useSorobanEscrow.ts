import { useQuery, useMutation } from "@tanstack/react-query";
import { useWallet } from "@/components/providers/WalletContext";
import * as txStateStore from "@/services/txStateStore";
import { useCallback } from "react";

interface EscrowData {
  balance: string;
  milestoneStatus: string;
  certificationValid: boolean;
}

interface DepositParams {
  amount: string;
  metadata?: Record<string, string>;
}

interface TransactionResponse {
  txHash: string;
  status: "pending" | "confirmed";
}

async function fetchEscrowData(account: string): Promise<EscrowData> {
  const response = await fetch(
    `/api/soroban/escrow?account=${encodeURIComponent(account)}`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch escrow data");
  }
  return response.json();
}

async function submitEscrowDeposit(
  account: string,
  params: DepositParams
): Promise<TransactionResponse> {
  const response = await fetch("/api/soroban/escrow/deposit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      account,
      amount: params.amount,
      metadata: params.metadata,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to submit escrow deposit");
  }

  return response.json();
}

export function useSorobanEscrow() {
  const { account, isSwitching } = useWallet();

  const query = useQuery<EscrowData>({
    queryKey: ["soroban", "escrow", account],
    queryFn: () => fetchEscrowData(account!),
    enabled: !!account && !isSwitching,
  });

  const depositMutation = useMutation({
    mutationFn: async (params: DepositParams) => {
      if (!account) throw new Error("No wallet connected");

      // Generate unique operation ID
      const operationId = `deposit_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = Date.now();

      // Step 1: Save transaction in "preparing" state
      txStateStore.save({
        txHash: null,
        operationId,
        status: "preparing",
        createdAt: now,
        updatedAt: now,
        metadata: {
          operationType: "escrow_deposit",
          amount: params.amount,
          account,
          ...params.metadata,
        },
      });

      try {
        // Step 2: Submit transaction (wallet signing happens here)
        const result = await submitEscrowDeposit(account, params);

        // Step 3: Update with txHash and status "broadcasting"
        txStateStore.update(operationId, {
          txHash: result.txHash,
          status: "broadcasting",
        });

        // Step 4: Update to pending_confirmation
        txStateStore.update(operationId, {
          status: "pending_confirmation",
        });

        // Simulate waiting for confirmation
        // In a real implementation, you would poll the ledger or use websockets
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Step 5: Mark as confirmed
        txStateStore.update(operationId, {
          status: "confirmed",
        });

        return result;
      } catch (error) {
        // Mark as failed on error
        txStateStore.update(operationId, {
          status: "failed",
          metadata: {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          },
        });
        throw error;
      }
    },
  });

  const deposit = useCallback(
    (params: DepositParams) => {
      return depositMutation.mutateAsync(params);
    },
    [depositMutation]
  );

  return {
    escrowData: query.data,
    isLoading: query.isLoading || isSwitching,
    error: query.error,
    deposit,
    isDepositing: depositMutation.isPending,
    depositError: depositMutation.error,
  };
}
