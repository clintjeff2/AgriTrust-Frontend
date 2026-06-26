import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNonce } from "@/src/hooks/useNonce";

let walletState = { account: "0xabc" as string | null, chainId: "testnet" as string | null };

vi.mock("@/src/hooks/useWallet", () => ({
  useWallet: () => ({
    ...walletState,
    isSwitching: false,
    provider: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    activeTabs: 1,
  }),
}));

describe("useNonce", () => {
  beforeEach(() => {
    walletState = { account: "0xabc", chainId: "testnet" };
    localStorage.clear();
    vi.stubGlobal("crypto", {
      getRandomValues: vi.fn((bytes: Uint8Array) => {
        bytes.fill(0);
        return bytes;
      }),
    });
  });

  it("persists generated counters and resumes after reload from last persisted value + 1", () => {
    const first = renderHook(() => useNonce());

    let nonce: Uint8Array | undefined;
    act(() => {
      nonce = first.result.current.generateNonce();
    });

    expect(nonce).toHaveLength(32);
    expect(nonce?.[31]).toBe(1);
    expect(localStorage.getItem("nonce-0xabc-testnet")).toBe("1");

    first.unmount();
    const second = renderHook(() => useNonce());

    act(() => {
      nonce = second.result.current.generateNonce();
    });

    expect(nonce?.[31]).toBe(2);
    expect(localStorage.getItem("nonce-0xabc-testnet")).toBe("2");
  });

  it("reserves nonces without colliding with later generated nonces", () => {
    const { result } = renderHook(() => useNonce());

    let reserved: Uint8Array[] = [];
    act(() => {
      reserved = result.current.reserveNonces(3);
    });

    expect(reserved.map((nonce) => nonce[31])).toEqual([1, 2, 3]);
    expect(localStorage.getItem("nonce-0xabc-testnet")).toBe("3");

    let generated: Uint8Array | undefined;
    act(() => {
      generated = result.current.generateNonce();
    });

    expect(generated?.[31]).toBe(4);
    expect(localStorage.getItem("nonce-0xabc-testnet")).toBe("4");
  });

  it("rejects reservation windows larger than 100", () => {
    const { result } = renderHook(() => useNonce());

    expect(() => result.current.reserveNonces(101)).toThrow(RangeError);
  });

  it("flushes reservations and loads a wallet-specific counter on wallet switch", () => {
    localStorage.setItem("nonce-0xdef-mainnet", "9");
    const hook = renderHook(() => useNonce());

    act(() => {
      hook.result.current.reserveNonces(2);
    });
    expect(localStorage.getItem("nonce-0xabc-testnet")).toBe("2");

    walletState = { account: "0xdef", chainId: "mainnet" };
    hook.rerender();

    let nonce: Uint8Array | undefined;
    act(() => {
      nonce = hook.result.current.generateNonce();
    });

    expect(nonce?.[31]).toBe(10);
    expect(localStorage.getItem("nonce-0xdef-mainnet")).toBe("10");
  });
});
