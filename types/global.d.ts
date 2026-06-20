/// <reference types="vite/client" />

interface FreighterProvider {
  isConnected: () => boolean;
  connect: () => Promise<{ address: string }>;
  signMessage: (message: string) => Promise<{ signedMessage: string }>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

interface EthereumProvider {
  isMetaMask?: boolean;
  isWalletConnect?: boolean;
  selectedAddress?: string;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (
    event: string,
    handler: (...args: unknown[]) => void
  ) => void;
}

interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining(): number;
}

interface Window {
  ethereum?: EthereumProvider;
  freighter?: FreighterProvider;
  sorobanEvents?: (account: string) => void;
  requestIdleCallback?: (
    callback: (deadline: IdleDeadline) => void,
    options?: { timeout: number }
  ) => number;
  cancelIdleCallback?: (id: number) => void;
}
