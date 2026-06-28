import { useCallback, useEffect, useRef, useState } from "react";
import { createNonceFromCounter, loadNonceCounter, saveNonceCounter } from "@/src/utils/crypto";
import { useWallet } from "@/src/hooks/useWallet";

const MAX_RESERVATION_WINDOW = 100;
const DEFAULT_CHAIN_ID = "unknown";

export class NonceCollisionError extends Error {
  constructor(counter: number) {
    super(`Nonce counter ${counter} has already been used or reserved`);
    this.name = "NonceCollisionError";
  }
}

export interface NonceState {
  counter: number;
  reserved: Set<number>;
  address: string;
  chainId: string;
}

export interface UseNonceReturn {
  counter: number;
  generateNonce: () => Uint8Array;
  reserveNonces: (count: number) => Uint8Array[];
}

function resolveIdentity(account: string | null, chainId: string | null | undefined) {
  return {
    address: account ?? "anonymous",
    chainId: chainId ?? DEFAULT_CHAIN_ID,
  };
}

export function useNonce(): UseNonceReturn {
  const wallet = useWallet();
  const identity = resolveIdentity(wallet.account, wallet.chainId);
  const initialCounter = loadNonceCounter(identity.address, identity.chainId);
  const stateRef = useRef<NonceState>({
    counter: initialCounter,
    reserved: new Set<number>(),
    address: identity.address,
    chainId: identity.chainId,
  });
  const [counter, setCounter] = useState(initialCounter);

  useEffect(() => {
    const next = resolveIdentity(wallet.account, wallet.chainId);
    const nextState = {
      counter: loadNonceCounter(next.address, next.chainId),
      reserved: new Set<number>(),
      address: next.address,
      chainId: next.chainId,
    };
    stateRef.current = nextState;
    queueMicrotask(() => {
      setCounter(nextState.counter);
    });
  }, [wallet.account, wallet.chainId]);

  const consumeCounter = useCallback((counter: number): Uint8Array => {
    const state = stateRef.current;
    if (state.reserved.has(counter)) {
      throw new NonceCollisionError(counter);
    }

    state.counter = counter;
    saveNonceCounter(state.address, state.chainId, state.counter);
    return createNonceFromCounter(counter);
  }, []);

  const generateNonce = useCallback((): Uint8Array => {
    const nextCounter = stateRef.current.counter + 1;
    const nonce = consumeCounter(nextCounter);
    setCounter(stateRef.current.counter);
    return nonce;
  }, [consumeCounter]);

  const reserveNonces = useCallback((count: number): Uint8Array[] => {
    if (!Number.isInteger(count) || count < 1 || count > MAX_RESERVATION_WINDOW) {
      throw new RangeError(`Nonce reservation count must be between 1 and ${MAX_RESERVATION_WINDOW}`);
    }

    const state = stateRef.current;
    const nonces: Uint8Array[] = [];
    for (let offset = 1; offset <= count; offset += 1) {
      const counter = state.counter + offset;
      if (state.reserved.has(counter)) {
        throw new NonceCollisionError(counter);
      }
      state.reserved.add(counter);
      nonces.push(createNonceFromCounter(counter));
    }

    state.counter += count;
    saveNonceCounter(state.address, state.chainId, state.counter);
    setCounter(state.counter);
    return nonces;
  }, []);

  return {
    counter,
    generateNonce,
    reserveNonces,
  };
}
