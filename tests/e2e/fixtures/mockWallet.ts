import * as ed from '@noble/ed25519';

export interface MockWallet {
  publicKey: string;
  address: string;
  network: string;
  sign: (message: string | Uint8Array) => Promise<string>;
}

export async function createMockWallet(seed: string = 'deterministic-seed-32-bytes-long-abc'): Promise<MockWallet> {
  const encoder = new TextEncoder();
  const privateKey = encoder.encode(seed.padEnd(32, '0').slice(0, 32));
  
  const pubKeyBytes = await ed.getPublicKey(privateKey);
  const publicKeyHex = Buffer.from(pubKeyBytes).toString('hex');
  
  return {
    publicKey: publicKeyHex,
    address: publicKeyHex,
    network: 'TESTNET',
    sign: async (message: string | Uint8Array) => {
      const msgBytes = typeof message === 'string' ? encoder.encode(message) : message;
      const signatureBytes = await ed.sign(msgBytes, privateKey);
      return Buffer.from(signatureBytes).toString('hex');
    }
  };
}
