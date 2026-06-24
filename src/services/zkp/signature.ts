/**
 * ECDSA P-256 signing/verification over Web Crypto. P-256 gives a ~128-bit
 * security level, matching the pipeline's minimum bound, and is natively
 * available everywhere `SubtleCrypto` is (browsers, workers, Node webcrypto)
 * with no extra dependency.
 *
 * The signed message binds `circuitId`, the Merkle root, and the issuance time
 * so a signature for one certificate can't be replayed against another.
 */

import { bytesToHex, hexToBytes } from "./commitmentScheme";

const ALGO = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_PARAMS = { name: "ECDSA", hash: "SHA-256" } as const;
const SIGN_DOMAIN = "agritrust/zkp/sign/v1";

const encoder = new TextEncoder();

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto SubtleCrypto is unavailable in this environment");
  }
  return subtle;
}

/** Canonical bytes signed by the certifier for a given certificate. */
export function signedMessageBytes(
  circuitId: string,
  merkleRoot: string,
  issuedAt: number
): Uint8Array {
  return encoder.encode(
    `${SIGN_DOMAIN}|${circuitId}|${merkleRoot}|${issuedAt}`
  );
}

export interface CertifierKeyPair {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

/**
 * Generates a fresh certifier key pair as JWKs. Used at issuance / circuit
 * setup time; the public JWK becomes the {@link VerificationKey}.
 */
export async function generateCertifierKeyPair(): Promise<CertifierKeyPair> {
  const subtle = getSubtle();
  const pair = (await subtle.generateKey(ALGO, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    subtle.exportKey("jwk", pair.publicKey),
    subtle.exportKey("jwk", pair.privateKey),
  ]);
  return { publicKeyJwk, privateKeyJwk };
}

async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return getSubtle().importKey("jwk", jwk, ALGO, false, ["sign"]);
}

async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return getSubtle().importKey("jwk", jwk, ALGO, false, ["verify"]);
}

/** Signs the canonical message and returns a hex-encoded signature. */
export async function signRoot(
  privateKeyJwk: JsonWebKey,
  circuitId: string,
  merkleRoot: string,
  issuedAt: number
): Promise<string> {
  const key = await importPrivateKey(privateKeyJwk);
  const message = signedMessageBytes(circuitId, merkleRoot, issuedAt);
  const sig = await getSubtle().sign(SIGN_PARAMS, key, message as BufferSource);
  return bytesToHex(new Uint8Array(sig));
}

/** Verifies a hex-encoded signature against the certifier's public JWK. */
export async function verifyRoot(
  publicKeyJwk: JsonWebKey,
  circuitId: string,
  merkleRoot: string,
  issuedAt: number,
  signatureHex: string
): Promise<boolean> {
  try {
    const key = await importPublicKey(publicKeyJwk);
    const message = signedMessageBytes(circuitId, merkleRoot, issuedAt);
    return await getSubtle().verify(
      SIGN_PARAMS,
      key,
      hexToBytes(signatureHex) as BufferSource,
      message as BufferSource
    );
  } catch {
    // Malformed signature/key bytes are a verification failure, not a crash.
    return false;
  }
}
