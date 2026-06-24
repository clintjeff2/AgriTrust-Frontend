import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProofStatusBadge from "@/src/components/certification/ProofStatusBadge";
import type { VerificationResult } from "@/src/types/zkp";

describe("ProofStatusBadge", () => {
  it("shows a spinner while proving", () => {
    render(<ProofStatusBadge state="proving" />);
    expect(screen.getByTestId("proof-status-label")).toHaveTextContent(
      /generating proof/i
    );
    expect(screen.getByTestId("proof-status-spinner")).toBeInTheDocument();
    expect(screen.getByTestId("proof-status-badge")).toHaveAttribute(
      "data-state",
      "proving"
    );
  });

  it("renders a verified badge with the gas/time detail", () => {
    const result: VerificationResult = {
      verified: true,
      gasEstimate: 31234,
      elapsedMs: 12.7,
    };
    render(<ProofStatusBadge state="verified" result={result} />);
    expect(screen.getByTestId("proof-status-label")).toHaveTextContent(
      /verified/i
    );
    expect(screen.queryByTestId("proof-status-spinner")).not.toBeInTheDocument();
    expect(screen.getByTestId("proof-status-detail")).toHaveTextContent(/gas/i);
  });

  it("renders the rejection reason", () => {
    const result: VerificationResult = {
      verified: false,
      reason: "Certifier signature is invalid",
      gasEstimate: 21000,
      elapsedMs: 3,
    };
    render(<ProofStatusBadge state="rejected" result={result} />);
    expect(screen.getByTestId("proof-status-detail")).toHaveTextContent(
      /signature is invalid/i
    );
  });

  it("renders an error message", () => {
    render(<ProofStatusBadge state="error" error="Prover worker failed" />);
    expect(screen.getByTestId("proof-status-detail")).toHaveTextContent(
      /worker failed/i
    );
  });
});
