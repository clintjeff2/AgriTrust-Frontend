import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/components/providers/WalletContext";
import * as txStateStore from "@/services/txStateStore";
import { useCallback, useState } from "react";
import { useOptimisticMutation } from "@/src/hooks/useOptimisticMutation";

/** A pending deposit that has been optimistically applied to the UI. */
export interface PendingDeposit {
  optimisticId: string;
  amount: string;
  timestamp: number;
}

interface EscrowData {
  balance: string;
  milestoneStatus: string;
  certificationValid: boolean;
  /** Frontend-only field for tracking optimistic pending deposits. */
  pendingDeposits: PendingDeposit[];
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
  const raw = await response.json();
  // The API doesn't return pendingDeposits — we manage that on the frontend.
  return { ...raw, pendingDeposits: [] };
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
  const [showPreflightModal, setShowPreflightModal] = useState(false);
  const [pendingDeposit, setPendingDeposit] = useState<DepositParams | null>(null);

  const query = useQuery<EscrowData>({
    queryKey: ["soroban", "escrow", account],
    queryFn: () => fetchEscrowData(account!),
    enabled: !!account && !isSwitching,
  });

  const depositMutation = useOptimisticMutation<EscrowData, DepositParams>({
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

        // Return the transaction result. The cache is managed separately by the
        // optimistic updater and will be invalidated/refetched by onSettled.
        return result as unknown as EscrowData;
      } catch (error) {
        // Mark as failed on error, merging with existing metadata to preserve
        // amount and other fields set during the "preparing" save.
        const existing = txStateStore.get(operationId);
        txStateStore.update(operationId, {
          status: "failed",
          metadata: {
            ...existing?.metadata,
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          },
        });
        throw error;
      }
    },
    queryKey: ["soroban", "escrow", account],
    optimisticUpdater: (variables, currentData, callOptimisticId) => {
      const base = currentData ?? {
        balance: "0",
        milestoneStatus: "unknown",
        certificationValid: false,
        pendingDeposits: [],
      };

      const pendingDeposit: PendingDeposit = {
        optimisticId: callOptimisticId,
        amount: variables.amount,
        timestamp: Date.now(),
      };

      // Optimistically increment balance and add pending deposit entry.
      const currentBalance = Number(base.balance);
      const depositAmount = Number(variables.amount);

      return {
        ...base,
        balance: String(currentBalance + depositAmount),
        pendingDeposits: [...base.pendingDeposits, pendingDeposit],
      };
    },
    rollbackFn: (error, variables, rollbackData) => {
      // Dispatch a custom event so UI components like InventoryCard can react.
      // In production this would use a toast notification system.
      console.error(
        `[Escrow] Deposit of ${variables.amount} failed: ${error.message}`,
        { rollbackData }
      );

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("escrow-deposit-failed", {
            detail: {
              amount: variables.amount,
              error: error.message,
              optimisticId: depositMutation.optimisticId ?? "unknown",
            },
          })
        );
      }
    },
  });

  // Destructure mutateAsync to avoid recreating the callback when the
  // mutation result object reference changes (mutateAsync is stable).
  const { mutateAsync } = depositMutation;
  
  // deposit() - Shows preflight modal (for UI flows)
  const deposit = useCallback(
    (params: DepositParams) => {
      // Store params and show preflight modal
      setPendingDeposit(params);
      setShowPreflightModal(true);
    },
    []
  );

  // depositDirect() - Bypasses modal and executes directly (for tests and programmatic use)
  const depositDirect = useCallback(
    async (params: DepositParams) => {
      return mutateAsync(params);
    },
    [mutateAsync]
  );

  const confirmDeposit = useCallback(() => {
    if (pendingDeposit) {
      setShowPreflightModal(false);
      depositMutation.mutate(pendingDeposit);
      setPendingDeposit(null);
    }
  }, [pendingDeposit, depositMutation]);

  const cancelDeposit = useCallback(() => {
    setShowPreflightModal(false);
    setPendingDeposit(null);
  }, []);

  return {
    escrowData: query.data,
    isLoading: query.isLoading || isSwitching,
    error: query.error,
    deposit,
    depositDirect,
    isDepositing: depositMutation.isPending,
    depositError: depositMutation.error,
    // Preflight modal state
    showPreflightModal,
    pendingDeposit,
    confirmDeposit,
    cancelDeposit,
  };
}
