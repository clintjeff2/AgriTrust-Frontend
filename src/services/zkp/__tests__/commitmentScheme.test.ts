import { describe, it, expect } from "vitest";
import {
  bytesToHex,
  hexToBytes,
  commitField,
  randomSaltHex,
  buildMerkleTree,
  merkleProof,
  merkleRoot,
  verifyMerklePath,
} from "@/src/services/zkp/commitmentScheme";

describe("hex helpers", () => {
  it("round-trips bytes through hex", () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255, 128]);
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
  });

  it("rejects malformed hex", () => {
    expect(() => hexToBytes("abc")).toThrow();
    expect(() => hexToBytes("zz")).toThrow();
  });
});

describe("commitField", () => {
  it("is deterministic for the same field, value, and salt", async () => {
    const salt = randomSaltHex();
    const a = await commitField("origin", "Kenya", salt);
    const b = await commitField("origin", "Kenya", salt);
    expect(a).toBe(b);
    expect(a).toHaveLength(64); // 32-byte SHA-256, hex
  });

  it("hides the value: different salts give different commitments", async () => {
    const a = await commitField("origin", "Kenya", randomSaltHex());
    const b = await commitField("origin", "Kenya", randomSaltHex());
    expect(a).not.toBe(b);
  });

  it("binds the field name", async () => {
    const salt = randomSaltHex();
    const a = await commitField("origin", "Kenya", salt);
    const b = await commitField("destination", "Kenya", salt);
    expect(a).not.toBe(b);
  });
});

describe("Merkle tree", () => {
  const commitments = async () =>
    Promise.all(
      ["a", "b", "c", "d", "e"].map((v) => commitField("f", v, randomSaltHex()))
    );

  it("produces and verifies an inclusion path for every leaf", async () => {
    const leaves = await commitments();
    const tree = await buildMerkleTree(leaves);

    for (let i = 0; i < leaves.length; i++) {
      const path = merkleProof(tree, i);
      expect(await verifyMerklePath(leaves[i], path, tree.root)).toBe(true);
    }
  });

  it("rejects a path against the wrong root", async () => {
    const leaves = await commitments();
    const tree = await buildMerkleTree(leaves);
    const path = merkleProof(tree, 0);
    expect(await verifyMerklePath(leaves[0], path, "00".repeat(32))).toBe(false);
  });

  it("rejects a tampered leaf", async () => {
    const leaves = await commitments();
    const tree = await buildMerkleTree(leaves);
    const path = merkleProof(tree, 2);
    const forged = await commitField("f", "tampered", randomSaltHex());
    expect(await verifyMerklePath(forged, path, tree.root)).toBe(false);
  });

  it("is stable for a single-leaf tree", async () => {
    const leaf = await commitField("only", "1", randomSaltHex());
    const root = await merkleRoot([leaf]);
    const tree = await buildMerkleTree([leaf]);
    expect(await verifyMerklePath(leaf, merkleProof(tree, 0), root)).toBe(true);
  });

  it("throws on an empty commitment set", async () => {
    await expect(buildMerkleTree([])).rejects.toThrow();
  });
});
