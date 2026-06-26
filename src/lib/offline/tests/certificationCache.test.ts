import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetCertificationDbForTests,
  readCertificationData,
  syncCertificationData,
  type CertificationPayload,
} from "../certificationCache";

function payload(batchId: string, score: number, version: string): CertificationPayload {
  return {
    batchId,
    provenanceChain: [{ step: "harvest", version, trustScore: score }],
    certificate: { id: `cert-${version}`, trustScore: score },
    trustScore: score,
  };
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  await _resetCertificationDbForTests();
});

describe("certification offline cache", () => {
  it("writes certificate, provenance chain, trust score, versions, and hash atomically", async () => {
    await syncCertificationData(payload("batch-1", 88, "v1"));

    const cached = await readCertificationData("batch-1");

    expect(cached).not.toBeNull();
    expect(cached?.certificate.trustScore).toBe(88);
    expect(cached?.trustScore).toBe(88);
    expect(cached?.provenanceChainVersion).toBe(cached?.certificateVersion);
    expect(cached?.certificateVersion).toBe(cached?.trustScoreVersion);
    expect(cached?.integrityHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("serializes overlapping main-thread and service-worker writes without desync", async () => {
    await Promise.all([
      syncCertificationData(payload("batch-2", 71, "main-thread")),
      new Promise<void>((resolve) => setTimeout(resolve, 25)).then(() =>
        syncCertificationData(payload("batch-2", 96, "service-worker"))
      ),
    ]);

    const cached = await readCertificationData("batch-2");

    expect(cached).not.toBeNull();
    expect(cached?.certificate.trustScore).toBe(cached?.trustScore);
    expect(cached?.provenanceChain).toEqual([{ step: "harvest", version: "service-worker", trustScore: 96 }]);
  });
});
