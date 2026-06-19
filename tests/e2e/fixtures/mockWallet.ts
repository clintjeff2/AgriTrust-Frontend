import * as ed from '@noble/ed25519';
import crypto from 'crypto';

// Provide sha512 implementation for noble-ed25519
ed.hashes.sha512 = (message) => crypto.createHash('sha512').update(message).digest();

function crc16(bytes: Uint8Array): number {
  let crc = 0x0000;
  for (let i = 0; i < bytes.length; i++) {
    let code = (crc >>> 8) ^ bytes[i];
    code ^= code >>> 4;
    crc = (crc << 8) ^ (code << 12) ^ (code << 5) ^ code;
    crc &= 0xffff;
  }
  return crc;
}

function encodeBase32(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let val = 0;
  let bits = 0;
  for (let i = 0; i < bytes.length; i++) {
    val = (val << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += alphabet[(val << (5 - bits)) & 31];
  }
  return result;
}

export function publicKeyToAddress(publicKeyBytes: Uint8Array): string {
  const payload = new Uint8Array(33);
  payload[0] = 0x30; // version byte: KeyTypeEd25519 is 6 << 3 = 48 (0x30)
  payload.set(publicKeyBytes, 1);
  const checksum = crc16(payload);
  const finalBytes = new Uint8Array(35);
  finalBytes.set(payload, 0);
  finalBytes[33] = checksum & 0xff;
  finalBytes[34] = (checksum >>> 8) & 0xff;
  return encodeBase32(finalBytes);
}

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
  const stellarAddress = publicKeyToAddress(pubKeyBytes);
  
  return {
    publicKey: publicKeyHex,
    address: stellarAddress,
    network: 'TESTNET',
    sign: async (message: string | Uint8Array) => {
      const msgBytes = typeof message === 'string' ? encoder.encode(message) : message;
      const signatureBytes = await ed.sign(msgBytes, privateKey);
      return Buffer.from(signatureBytes).toString('hex');
    }
  };
}
