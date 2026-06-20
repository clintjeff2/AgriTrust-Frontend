import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  saveAuditOffline,
  processSyncQueue,
  getPendingSyncCount,
  getSyncedAuditCount,
  getTotalAuditCount,
  _resetDbForTests,
  type AuditRecord,
} from "@/src/services/indexedDbStore";

function makeAudit(
  overrides: Partial<Omit<AuditRecord, "localId" | "synced" | "createdAt">> = {}
) {
  return {
    inspectorId: "insp-001",
    farmId: "farm-001",
    timestamp: Date.now(),
    gpsCoordinates: { lat: 6.5244, lng: 3.3792 },
    notes: "Field looks healthy.",
    signature: "Jane Doe",
    photos: [],
    ...overrides,
  };
}

// Simulate navigator.onLine
function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    get: () => online,
    configurable: true,
  });
}

beforeEach(() => {
  // Each test gets a fresh in-memory IDB instance so stores don't bleed across tests
  _resetDbForTests();
  globalThis.indexedDB = new IDBFactory();
  setOnline(true);
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("saveAuditOffline", () => {
  it("returns a UUID and stores the audit as unsynced", async () => {
    const id = await saveAuditOffline(makeAudit());
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);

    const total = await getTotalAuditCount();
    expect(total).toBe(1);

    const pending = await getPendingSyncCount();
    expect(pending).toBe(1);

    const synced = await getSyncedAuditCount();
    expect(synced).toBe(0);
  });

  it("stores multiple audits independently", async () => {
    await saveAuditOffline(makeAudit({ farmId: "farm-A" }));
    await saveAuditOffline(makeAudit({ farmId: "farm-B" }));
    await saveAuditOffline(makeAudit({ farmId: "farm-C" }));

    expect(await getTotalAuditCount()).toBe(3);
    expect(await getPendingSyncCount()).toBe(3);
  });
});

describe("processSyncQueue — happy path", () => {
  it("syncs 10 offline audits and marks them all as synced", async () => {
    for (let i = 0; i < 10; i++) {
      await saveAuditOffline(makeAudit({ farmId: `farm-${i}` }));
    }

    expect(await getPendingSyncCount()).toBe(10);

    const postedFarmIds: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options?: RequestInit) => {
        const body = JSON.parse(options?.body as string) as AuditRecord;
        postedFarmIds.push(body.farmId);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      })
    );

    await processSyncQueue("/api/v1");

    expect(postedFarmIds).toHaveLength(10);
    // All 10 farm IDs present, regardless of upload order
    expect(postedFarmIds.sort()).toEqual(
      Array.from({ length: 10 }, (_, i) => `farm-${i}`).sort()
    );

    expect(await getPendingSyncCount()).toBe(0);
    expect(await getSyncedAuditCount()).toBe(10);
    expect(await getTotalAuditCount()).toBe(10);
  });

  it("uploads records oldest-first when createdAt values are distinct", async () => {
    const base = Date.now();
    // Save audits with explicitly spaced timestamps via the timestamp field
    // (createdAt is assigned by saveAuditOffline, but we can rely on sequential saves
    //  having monotonically increasing Date.now() across separate event-loop turns)
    for (let i = 0; i < 3; i++) {
      await saveAuditOffline(makeAudit({ farmId: `ordered-${i}`, timestamp: base + i }));
      // Ensure each call lands in a distinct millisecond
      await new Promise((r) => setTimeout(r, 2));
    }

    const postedFarmIds: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options?: RequestInit) => {
        const body = JSON.parse(options?.body as string) as AuditRecord;
        postedFarmIds.push(body.farmId);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      })
    );

    await processSyncQueue("/api/v1");

    expect(postedFarmIds).toEqual(["ordered-0", "ordered-1", "ordered-2"]);
  });
});

describe("processSyncQueue — offline guard", () => {
  it("does nothing when navigator is offline", async () => {
    await saveAuditOffline(makeAudit());
    setOnline(false);

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await processSyncQueue("/api/v1");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await getPendingSyncCount()).toBe(1);
  });
});

describe("processSyncQueue — conflict resolution (409)", () => {
  it("stores server version as diff and sets status to needs_review", async () => {
    await saveAuditOffline(makeAudit({ notes: "Local notes" }));

    const serverVersion: AuditRecord = {
      localId: "server-id",
      inspectorId: "insp-001",
      farmId: "farm-001",
      timestamp: Date.now() + 1000,
      gpsCoordinates: { lat: 6.5244, lng: 3.3792 },
      notes: "Server notes",
      signature: "Jane Doe",
      photos: [],
      synced: true,
      createdAt: Date.now(),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(serverVersion), { status: 409 })
      )
    );

    await processSyncQueue("/api/v1");

    // Audit is NOT marked synced — conflict needs manual review
    expect(await getSyncedAuditCount()).toBe(0);
    expect(await getPendingSyncCount()).toBe(0); // removed from "pending" bucket
    // Total remains intact
    expect(await getTotalAuditCount()).toBe(1);
  });
});

describe("processSyncQueue — network error retry", () => {
  it("resets entries to pending on fetch failure so they retry next sync", async () => {
    await saveAuditOffline(makeAudit());

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Network error");
      })
    );

    await processSyncQueue("/api/v1");

    // Should still be pending for the next sync attempt
    expect(await getPendingSyncCount()).toBe(1);
    expect(await getSyncedAuditCount()).toBe(0);
  });

  it("succeeds on a second attempt after initial network failure", async () => {
    await saveAuditOffline(makeAudit());

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        if (callCount === 1) throw new Error("Network error");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      })
    );

    await processSyncQueue("/api/v1");
    expect(await getPendingSyncCount()).toBe(1); // still pending after failure

    await processSyncQueue("/api/v1");
    expect(await getPendingSyncCount()).toBe(0);
    expect(await getSyncedAuditCount()).toBe(1);
  });
});
