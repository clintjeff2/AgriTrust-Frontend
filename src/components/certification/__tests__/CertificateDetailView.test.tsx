import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const notifyStatusChange = vi.fn();
let hookState: {
  data: unknown;
  error: Error | null;
  isLoading: boolean;
  isRevalidating: boolean;
};

vi.mock("@/src/hooks/useCertificationCache", () => ({
  useCertificationCache: () => ({
    ...hookState,
    revalidate: vi.fn(),
    notifyStatusChange,
  }),
}));

import CertificateDetailView from "@/src/components/certification/CertificateDetailView";

beforeEach(() => {
  notifyStatusChange.mockClear();
  hookState = {
    data: { id: "cert-1", status: "issued", trustScore: 80, updatedAt: 1 },
    error: null,
    isLoading: false,
    isRevalidating: false,
  };
});

describe("CertificateDetailView", () => {
  it("renders cached certificate data", () => {
    render(<CertificateDetailView certificateId="cert-1" status="issued" />);
    expect(screen.getByTestId("cert-status")).toHaveTextContent("issued");
    expect(screen.getByTestId("cert-data")).toHaveTextContent("80%");
  });

  it("dispatches a status change only after the on-chain update succeeds", async () => {
    const onChainUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <CertificateDetailView
        certificateId="cert-1"
        status="issued"
        onChainUpdate={onChainUpdate}
      />
    );

    await userEvent.click(screen.getByTestId("action-verify"));

    await waitFor(() =>
      expect(onChainUpdate).toHaveBeenCalledWith("cert-1", "verified")
    );
    expect(notifyStatusChange).toHaveBeenCalledWith("verified");
  });

  it("does not invalidate caches if the on-chain update fails", async () => {
    const onChainUpdate = vi.fn().mockRejectedValue(new Error("tx reverted"));
    render(
      <CertificateDetailView
        certificateId="cert-1"
        status="issued"
        onChainUpdate={onChainUpdate}
      />
    );

    await userEvent.click(screen.getByTestId("action-revoke"));

    await waitFor(() =>
      expect(screen.getByTestId("cert-update-error")).toHaveTextContent(
        "tx reverted"
      )
    );
    expect(notifyStatusChange).not.toHaveBeenCalled();
  });
});
