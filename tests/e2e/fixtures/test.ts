import { test as base, expect } from '@playwright/test';
import { createMockWallet, MockWallet } from './mockWallet';

interface CustomFixtures {
  mockWallet: MockWallet;
}

export const test = base.extend<CustomFixtures>({
  mockWallet: async ({}, use) => {
    const wallet = await createMockWallet();
    await use(wallet);
  },
  page: async ({ page, mockWallet }, use) => {
    await page.addInitScript((walletInfo) => {
      // Inject window.freighter
      (window as any).freighter = {
        isConnected: async () => true,
        getPublicKey: async () => walletInfo.address,
        network: async () => 'TESTNET',
        signTransaction: async (xdr: string) => xdr,
        signBlob: async (blob: string) => walletInfo.signatureHex,
        signAuthEntry: async (entry: string) => walletInfo.signatureHex
      };

      // Inject window.ethereum (MetaMask)
      const mockEthereum = {
        isMetaMask: true,
        request: async ({ method, params }: { method: string; params?: any[] }) => {
          switch (method) {
            case 'eth_requestAccounts':
            case 'eth_accounts':
              return [walletInfo.address];
            case 'eth_chainId':
              return '0xaa36a7'; // Sepolia
            case 'personal_sign':
              return walletInfo.signatureHex;
            case 'eth_sendTransaction':
              return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
            default:
              throw new Error(`Unsupported method: ${method}`);
          }
        },
        on: (event: string, handler: (...args: any[]) => void) => {},
        removeListener: (event: string, handler: (...args: any[]) => void) => {}
      };
      (window as any).ethereum = mockEthereum;
    }, {
      address: mockWallet.address,
      publicKey: mockWallet.publicKey,
      signatureHex: '0xabc123'
    });

    await use(page);
  }
});

export { expect };
