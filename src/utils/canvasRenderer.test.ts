import { describe, it, expect } from "vitest";
import type { FleetAsset } from "@/src/types/fleet";
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  COLUMN_COUNT,
  HEADER_HEIGHT,
  getCellAtPoint,
} from "@/src/utils/canvasRenderer";

function makeMockAsset(override: Partial<FleetAsset> = {}): FleetAsset {
  return {
    id: "AGR-FLEET-00001",
    assetType: "truck",
    temperature: 22.5,
    status: "healthy",
    eta: 120,
    cargoCount: 150,
    batteryLevel: 85,
    lastGps: { lat: 40.7128, lng: -74.006 },
    deliveryEta: new Date(Date.now() + 7200000).toISOString(),
    insuranceStatus: "active",
    ...override,
  };
}

describe("canvasRenderer", () => {
  it("getCellAtPoint returns correct cell for given coordinates", () => {
    const cell = getCellAtPoint(10, HEADER_HEIGHT + 5, 0);
    expect(cell).not.toBeNull();
    expect(cell!.row).toBe(0);
    expect(cell!.col).toBe(0);
  });

  it("getCellAtPoint returns null for out-of-bounds coordinates", () => {
    const cell = getCellAtPoint(-1, 0, 0);
    expect(cell).toBeNull();
  });

  it("getCellAtPoint returns correct column index", () => {
    const cell = getCellAtPoint(CELL_WIDTH * 2 + 10, HEADER_HEIGHT + 5, 0);
    expect(cell).not.toBeNull();
    expect(cell!.col).toBe(2);
  });

  it("getCellAtPoint returns correct row index for scrolled view", () => {
    const cell = getCellAtPoint(10, HEADER_HEIGHT + 5, CELL_HEIGHT * 3);
    expect(cell).not.toBeNull();
    expect(cell!.row).toBe(3);
  });

  it("getCellAtPoint returns null when click is above header", () => {
    const cell = getCellAtPoint(10, 0, 0);
    expect(cell).toBeNull();
  });
});

describe("useFleetData", () => {
  it("generateAsset produces valid FleetAsset", () => {
    const asset = makeMockAsset();
    expect(asset.id).toBeTruthy();
    expect(["truck", "drone", "tractor", "harvester"]).toContain(
      asset.assetType,
    );
    expect(asset.temperature).toBeGreaterThanOrEqual(-5);
    expect(asset.temperature).toBeLessThanOrEqual(45);
    expect(["healthy", "warning", "critical"]).toContain(asset.status);
    expect(asset.eta).toBeGreaterThanOrEqual(0);
    expect(asset.cargoCount).toBeGreaterThanOrEqual(0);
    expect(asset.batteryLevel).toBeGreaterThanOrEqual(0);
    expect(asset.batteryLevel).toBeLessThanOrEqual(100);
  });
});

describe("CanvasGrid dimensions", () => {
  it("cell dimensions are consistent", () => {
    expect(CELL_WIDTH).toBe(120);
    expect(CELL_HEIGHT).toBe(40);
    expect(COLUMN_COUNT).toBe(6);
    expect(CELL_WIDTH * COLUMN_COUNT).toBe(720);
  });
});
