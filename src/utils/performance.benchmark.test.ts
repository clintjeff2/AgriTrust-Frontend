import { describe, it, expect } from "vitest";
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  COLUMN_COUNT,
  drawCell,
  drawHeader,
  setupCanvas,
} from "@/src/utils/canvasRenderer";
import type { FleetAsset } from "@/src/types/fleet";

function generateSyntheticAssets(count: number): FleetAsset[] {
  const assets: FleetAsset[] = [];
  const types: FleetAsset["assetType"][] = [
    "truck",
    "drone",
    "tractor",
    "harvester",
  ];
  const statuses: FleetAsset["status"][] = ["healthy", "warning", "critical"];
  const insurance: FleetAsset["insuranceStatus"][] = [
    "active",
    "expiring",
    "expired",
  ];

  for (let i = 0; i < count; i++) {
    const temp = -5 + Math.random() * 50;
    assets.push({
      id: `AGR-FLEET-${String(i + 1).padStart(5, "0")}`,
      assetType: types[i % types.length],
      temperature: parseFloat(temp.toFixed(1)),
      status: statuses[i % statuses.length],
      eta: Math.floor(Math.random() * 4320),
      cargoCount: Math.floor(Math.random() * 500),
      batteryLevel: parseFloat((Math.random() * 100).toFixed(1)),
      lastGps: {
        lat: parseFloat((Math.random() * 180 - 90).toFixed(6)),
        lng: parseFloat((Math.random() * 360 - 180).toFixed(6)),
      },
      deliveryEta: new Date(
        Date.now() + Math.random() * 72 * 3600000,
      ).toISOString(),
      insuranceStatus: insurance[i % insurance.length],
    });
  }
  return assets;
}

describe("Canvas Rendering Performance", () => {
  it("renders 10,000 cells within 16ms per frame (p95)", () => {
    const canvas = document.createElement("canvas");
    window.devicePixelRatio = 1;
    const ctx = setupCanvas(
      canvas,
      CELL_WIDTH * COLUMN_COUNT,
      600,
    ) as CanvasRenderingContext2D;
    expect(ctx).not.toBeNull();

    const assets = generateSyntheticAssets(10000);

    const scrollTop = 0;

    const frameTimes: number[] = [];

    for (let frame = 0; frame < 100; frame++) {
      const start = performance.now();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawHeader(ctx, CELL_WIDTH * COLUMN_COUNT);

      const startRow = Math.max(0, Math.floor(scrollTop / CELL_HEIGHT) - 1);
      const endRow = Math.min(
        assets.length - 1,
        Math.ceil((scrollTop + 600) / CELL_HEIGHT) + 1,
      );

      for (let r = startRow; r <= endRow; r++) {
        const asset = assets[r];
        if (!asset) continue;
        drawCell(ctx, asset, r, scrollTop, false, false);
      }

      const elapsed = performance.now() - start;
      frameTimes.push(elapsed);
    }

    frameTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(frameTimes.length * 0.95);
    const p95 = frameTimes[p95Index];
    const avg =
      frameTimes.reduce((sum, t) => sum + t, 0) / frameTimes.length;
    const min = frameTimes[0];
    const max = frameTimes[frameTimes.length - 1];

    console.log(`Benchmark: 10,000 assets, 100 frames`);
    console.log(`  Avg: ${avg.toFixed(3)}ms`);
    console.log(`  Min: ${min.toFixed(3)}ms`);
    console.log(`  Max: ${max.toFixed(3)}ms`);
    console.log(`  P95: ${p95.toFixed(3)}ms`);
    console.log(`  Target: < 16ms`);

    expect(p95).toBeLessThan(16);
  });

  it("measures incremental dirty-rect update performance", () => {
    const canvas = document.createElement("canvas");
    window.devicePixelRatio = 1;
    const ctx = setupCanvas(
      canvas,
      CELL_WIDTH * COLUMN_COUNT,
      600,
    ) as CanvasRenderingContext2D;
    expect(ctx).not.toBeNull();

    const assets = generateSyntheticAssets(10000);
    const scrollTop = 0;
    const changedIndices = [100, 200, 300, 400, 500];

    const start = performance.now();
    for (let iter = 0; iter < 50; iter++) {
      for (const idx of changedIndices) {
        const asset = assets[idx];
        if (!asset) continue;
        const y = idx * CELL_HEIGHT - scrollTop;
        ctx.clearRect(0, y, CELL_WIDTH * COLUMN_COUNT, CELL_HEIGHT);
        drawCell(ctx, asset, idx, scrollTop, false, false);
      }
    }
    const elapsed = performance.now() - start;
    const avg = elapsed / 50;

    console.log(`Dirty-rect update (5 cells × 50 iterations):`);
    console.log(`  Total: ${elapsed.toFixed(3)}ms`);
    console.log(`  Avg per batch: ${avg.toFixed(3)}ms`);

    expect(avg).toBeLessThan(5);
  });
});
