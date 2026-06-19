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
        isConnected: async () => {
          console.log('CALL freighter.isConnected');
          return true;
        },
        getPublicKey: async () => {
          console.log('CALL freighter.getPublicKey');
          return walletInfo.address;
        },
        network: async () => {
          console.log('CALL freighter.network');
          return 'TESTNET';
        },
        signTransaction: async (xdr: string) => {
          console.log('CALL freighter.signTransaction', xdr);
          return xdr;
        },
        signBlob: async (blob: string) => {
          console.log('CALL freighter.signBlob', blob);
          return walletInfo.signatureHex;
        },
        signAuthEntry: async (entry: string) => {
          console.log('CALL freighter.signAuthEntry', entry);
          return walletInfo.signatureHex;
        }
      };

      // Inject window.ethereum (MetaMask)
      const mockEthereum = {
        isMetaMask: true,
        request: async ({ method, params }: { method: string; params?: any[] }) => {
          console.log('CALL ethereum.request', method, params);
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
        on: (event: string, handler: (...args: any[]) => void) => {
          console.log('CALL ethereum.on', event);
        },
        removeListener: (event: string, handler: (...args: any[]) => void) => {
          console.log('CALL ethereum.removeListener', event);
        }
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
