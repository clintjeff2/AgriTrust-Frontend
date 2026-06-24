/**
 * Cryptographic core of the verification pipeline: salted SHA-256 commitments
 * and a binary Merkle tree, all built on the Web Crypto `SubtleCrypto` API so
 * the same code runs on the main thread, in a Web Worker, and under Node's
 * `webcrypto` in tests.
 *
 * Domain separation follows the common leaf/node tagging convention to block
 * second-preimage attacks across tree layers:
 *   leaf node = H(0x00 || commitment)
 *   inner node = H(0x01 || left || right)
 */

import type { MerklePathNode } from "@/src/types/zkp";

const LEAF_TAG = 0x00;
const NODE_TAG = 0x01;
/** Field-separator byte mixed into commitments (ASCII unit separator, 0x1f). */
const FIELD_SEP = String.fromCharCode(0x1f);
const COMMIT_DOMAIN = "agritrust/zkp/commit/v1";

const encoder = new TextEncoder();

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto SubtleCrypto is unavailable in this environment");
  }
  return subtle;
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string: odd length");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error("Invalid hex string: non-hex characters");
    }
    bytes[i] = byte;
  }
  return bytes;
}

async function digestHex(bytes: Uint8Array): Promise<string> {
  const digest = await getSubtle().digest("SHA-256", bytes as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

/** Generates a 32-byte random salt as a hex string. */
export function randomSaltHex(): string {
  const salt = new Uint8Array(32);
  globalThis.crypto.getRandomValues(salt);
  return bytesToHex(salt);
}

/**
 * Produces a hiding, binding commitment to a single field value:
 * `SHA-256(domain || salt || field || value)`. The random salt is the hiding
 * factor — without it, low-entropy values (e.g. a boolean or a known
 * certifier name) would be recoverable by brute force.
 */
export async function commitField(
  field: string,
  value: string,
  saltHex: string
): Promise<string> {
  const salt = hexToBytes(saltHex);
  const tail = encoder.encode(`${FIELD_SEP}${field}${FIELD_SEP}${value}`);
  const domain = encoder.encode(COMMIT_DOMAIN);
  const buf = new Uint8Array(domain.length + salt.length + tail.length);
  buf.set(domain, 0);
  buf.set(salt, domain.length);
  buf.set(tail, domain.length + salt.length);
  return digestHex(buf);
}

async function hashLeaf(commitmentHex: string): Promise<string> {
  const commitment = hexToBytes(commitmentHex);
  const buf = new Uint8Array(1 + commitment.length);
  buf[0] = LEAF_TAG;
  buf.set(commitment, 1);
  return digestHex(buf);
}

async function hashNode(leftHex: string, rightHex: string): Promise<string> {
  const left = hexToBytes(leftHex);
  const right = hexToBytes(rightHex);
  const buf = new Uint8Array(1 + left.length + right.length);
  buf[0] = NODE_TAG;
  buf.set(left, 1);
  buf.set(right, 1 + left.length);
  return digestHex(buf);
}

/** A Merkle tree as an array of layers, layer 0 being the (hashed) leaves. */
export interface MerkleTree {
  layers: string[][];
  root: string;
  leafCount: number;
}

/**
 * Builds a binary Merkle tree over field commitments. Odd layers duplicate the
 * final node (Bitcoin-style) so every parent has two children.
 */
export async function buildMerkleTree(
  commitments: string[]
): Promise<MerkleTree> {
  if (commitments.length === 0) {
    throw new Error("Cannot build a Merkle tree over zero commitments");
  }

  const leaves = await Promise.all(commitments.map(hashLeaf));
  const layers: string[][] = [leaves];

  while (layers[layers.length - 1].length > 1) {
    const prev = layers[layers.length - 1];
    const next: string[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const left = prev[i];
      const right = i + 1 < prev.length ? prev[i + 1] : prev[i];
      next.push(await hashNode(left, right));
    }
    layers.push(next);
  }

  return {
    layers,
    root: layers[layers.length - 1][0],
    leafCount: commitments.length,
  };
}

export async function merkleRoot(commitments: string[]): Promise<string> {
  return (await buildMerkleTree(commitments)).root;
}

/**
 * Produces the inclusion path for the leaf at `leafIndex`, from leaf to root.
 */
export function merkleProof(
  tree: MerkleTree,
  leafIndex: number
): MerklePathNode[] {
  if (leafIndex < 0 || leafIndex >= tree.leafCount) {
    throw new Error(`Leaf index ${leafIndex} out of range`);
  }

  const path: MerklePathNode[] = [];
  let index = leafIndex;

  for (let layer = 0; layer < tree.layers.length - 1; layer++) {
    const nodes = tree.layers[layer];
    const isRightNode = index % 2 === 1;
    const siblingIndex = isRightNode ? index - 1 : index + 1;
    // Odd final node is duplicated, so its sibling is itself.
    const sibling =
      siblingIndex < nodes.length ? nodes[siblingIndex] : nodes[index];
    path.push({
      sibling,
      position: isRightNode ? "left" : "right",
    });
    index = Math.floor(index / 2);
  }

  return path;
}

/**
 * Recomputes a root from a field commitment and its inclusion path and checks
 * it against the expected root. Returns false on any mismatch.
 */
export async function verifyMerklePath(
  commitmentHex: string,
  path: MerklePathNode[],
  expectedRoot: string
): Promise<boolean> {
  let running = await hashLeaf(commitmentHex);
  for (const node of path) {
    running =
      node.position === "left"
        ? await hashNode(node.sibling, running)
        : await hashNode(running, node.sibling);
  }
  return running === expectedRoot;
}
