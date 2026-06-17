import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TxRecoveryBanner } from "@/components/notifications/TxRecoveryBanner";
import * as txStateStore from "@/services/txStateStore";
import type { TxEntry } from "@/services/txStateStore";
import type { UseTxRetryQueueReturn } from "@/hooks/useTxRetryQueue";

// Create a mock state holder
let mockHookReturn: UseTxRetryQueueReturn = {
  recoveredTransactions: [],
  isRecovering: false,
  dismissTransaction: vi.fn(),
  retryTransaction: vi.fn(),
  dismissAll: vi.fn(),
};

// Mock the useTxRetryQueue hook
vi.mock("@/hooks/useTxRetryQueue", () => ({
  useTxRetryQueue: () => mockHookReturn,
}));

// Mock fetch
global.fetch = vi.fn();

describe("TxRecoveryBanner", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    // Reset mock state
    mockHookReturn = {
      recoveredTransactions: [],
      isRecovering: false,
      dismissTransaction: vi.fn(),
      retryTransaction: vi.fn(),
      dismissAll: vi.fn(),
    };
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("does not render when no transactions are recovered", () => {
    mockHookReturn.recoveredTransactions = [];
    mockHookReturn.isRecovering = false;

    const { container } = render(<TxRecoveryBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("does not render while still recovering", () => {
    mockHookReturn.recoveredTransactions = [
      {
        txHash: "0x123",
        operationId: "op_1",
        status: "pending_confirmation",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      },
    ];
    mockHookReturn.isRecovering = true;

    const { container } = render(<TxRecoveryBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders banner with pending transaction count", async () => {
    mockHookReturn.recoveredTransactions = [
      {
        txHash: "0x123",
        operationId: "op_1",
        status: "broadcasting",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { operationType: "escrow_deposit" },
      },
      {
        txHash: "0x456",
        operationId: "op_2",
        status: "pending_confirmation",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { operationType: "milestone_release" },
      },
    ];
    mockHookReturn.isRecovering = false;

    render(<TxRecoveryBanner />);

    expect(
      screen.getByText("2 pending transactions recovered")
    ).toBeInTheDocument();
  });

  it("renders banner with confirmed transaction count when no pending", async () => {
    mockHookReturn.recoveredTransactions = [
      {
        txHash: "0x123",
        operationId: "op_1",
        status: "confirmed",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { operationType: "escrow_deposit" },
      },
    ];
    mockHookReturn.isRecovering = false;

    render(<TxRecoveryBanner />);

    expect(screen.getByText("1 transaction confirmed")).toBeInTheDocument();
  });

  it("expands to show transaction details when Review is clicked", async () => {
    const user = userEvent.setup();
    mockHookReturn.recoveredTransactions = [
      {
        txHash: "0xabc123",
        operationId: "op_1",
        status: "pending_confirmation",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { operationType: "escrow_deposit" },
      },
    ];
    mockHookReturn.isRecovering = false;

    render(<TxRecoveryBanner />);

    const reviewButton = screen.getByText("Review");
    await user.click(reviewButton);

    expect(screen.getByText("escrow_deposit")).toBeInTheDocument();
    expect(screen.getByText("0xabc123")).toBeInTheDocument();
  });

  it("calls dismissTransaction when Dismiss button is clicked", async () => {
    const user = userEvent.setup();
    const dismissMock = vi.fn();
    mockHookReturn.recoveredTransactions = [
      {
        txHash: "0x123",
        operationId: "op_dismiss",
        status: "pending_confirmation",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { operationType: "escrow_deposit" },
      },
    ];
    mockHookReturn.isRecovering = false;
    mockHookReturn.dismissTransaction = dismissMock;

    render(<TxRecoveryBanner />);

    // Expand the banner
    await user.click(screen.getByText("Review"));

    // Click dismiss on individual transaction
    const dismissButtons = screen.getAllByText("Dismiss");
    await user.click(dismissButtons[0]);

    expect(dismissMock).toHaveBeenCalledWith("op_dismiss");
  });

  it("calls dismissAll when Dismiss All button is clicked", async () => {
    const user = userEvent.setup();
    const dismissAllMock = vi.fn();
    mockHookReturn.recoveredTransactions = [
      {
        txHash: "0x1",
        operationId: "op_1",
        status: "pending_confirmation",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      },
      {
        txHash: "0x2",
        operationId: "op_2",
        status: "broadcasting",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      },
    ];
    mockHookReturn.isRecovering = false;
    mockHookReturn.dismissAll = dismissAllMock;

    render(<TxRecoveryBanner />);

    const dismissAllButton = screen.getByText("Dismiss All");
    await user.click(dismissAllButton);

    expect(dismissAllMock).toHaveBeenCalledTimes(1);
  });

  it("shows Retry button for pending_confirmation transactions", async () => {
    const user = userEvent.setup();
    mockHookReturn.recoveredTransactions = [
      {
        txHash: "0xretry",
        operationId: "op_retry",
        status: "pending_confirmation",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { operationType: "escrow_deposit" },
      },
    ];
    mockHookReturn.isRecovering = false;

    render(<TxRecoveryBanner />);

    await user.click(screen.getByText("Review"));

    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("calls retryTransaction when Retry button is clicked", async () => {
    const user = userEvent.setup();
    const retryMock = vi.fn();
    mockHookReturn.recoveredTransactions = [
      {
        txHash: "0xretry",
        operationId: "op_retry",
        status: "pending_confirmation",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { operationType: "escrow_deposit" },
      },
    ];
    mockHookReturn.isRecovering = false;
    mockHookReturn.retryTransaction = retryMock;

    render(<TxRecoveryBanner />);

    await user.click(screen.getByText("Review"));
    await user.click(screen.getByText("Retry"));

    expect(retryMock).toHaveBeenCalledWith("op_retry");
  });

  it("displays status badges with correct colors", async () => {
    const user = userEvent.setup();
    mockHookReturn.recoveredTransactions = [
      {
        txHash: "0x1",
        operationId: "op_1",
        status: "confirmed",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      },
      {
        txHash: "0x2",
        operationId: "op_2",
        status: "failed",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      },
      {
        txHash: "0x3",
        operationId: "op_3",
        status: "pending_confirmation",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      },
    ];
    mockHookReturn.isRecovering = false;

    render(<TxRecoveryBanner />);

    await user.click(screen.getByText("Review"));

    expect(screen.getByText("confirmed")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("pending confirmation")).toBeInTheDocument();
  });

  it("shows message for interrupted transaction without txHash", async () => {
    const user = userEvent.setup();
    mockHookReturn.recoveredTransactions = [
      {
        txHash: null,
        operationId: "op_interrupted",
        status: "preparing",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { operationType: "escrow_deposit" },
      },
    ];
    mockHookReturn.isRecovering = false;

    render(<TxRecoveryBanner />);

    await user.click(screen.getByText("Review"));

    expect(screen.getByText("Interrupted before signing")).toBeInTheDocument();
  });

  it("collapses details when Hide is clicked", async () => {
    const user = userEvent.setup();
    mockHookReturn.recoveredTransactions = [
      {
        txHash: "0x123",
        operationId: "op_1",
        status: "pending_confirmation",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { operationType: "escrow_deposit" },
      },
    ];
    mockHookReturn.isRecovering = false;

    render(<TxRecoveryBanner />);

    // Expand
    await user.click(screen.getByText("Review"));
    expect(screen.getByText("0x123")).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByText("Hide"));
    expect(screen.queryByText("0x123")).not.toBeInTheDocument();
  });

  it("uses correct singular form for count", async () => {
    mockHookReturn.recoveredTransactions = [
      {
        txHash: "0x123",
        operationId: "op_1",
        status: "pending_confirmation",
        checked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      },
    ];
    mockHookReturn.isRecovering = false;

    render(<TxRecoveryBanner />);

    expect(screen.getByText("1 pending transaction recovered")).toBeInTheDocument();
  });
});
