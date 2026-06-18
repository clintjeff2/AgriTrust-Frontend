import { useEffect, useRef, useState } from "react";
import type { FleetAsset, FleetDataSnapshot } from "@/src/types/fleet";

const ASSET_TYPES: FleetAsset["assetType"][] = [
  "truck",
  "drone",
  "tractor",
  "harvester",
];
const STATUSES: FleetAsset["status"][] = ["healthy", "warning", "critical"];
const INSURANCE: FleetAsset["insuranceStatus"][] = [
  "active",
  "expiring",
  "expired",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomLat(): number {
  return randomFloat(-90, 90, 6);
}

function randomLng(): number {
  return randomFloat(-180, 180, 6);
}

function generateETA(hoursOffset: number): string {
  const d = new Date(Date.now() + hoursOffset * 3600_000);
  return d.toISOString();
}

function generateAsset(idSuffix: number): FleetAsset {
  const etaHours = randomInt(1, 72);
  return {
    id: `AGR-FLEET-${String(idSuffix).padStart(5, "0")}`,
    assetType: randomItem(ASSET_TYPES),
    temperature: randomFloat(-5, 45, 1),
    status: randomItem(STATUSES),
    eta: etaHours * 60,
    cargoCount: randomInt(0, 500),
    batteryLevel: randomFloat(10, 100, 1),
    lastGps: { lat: randomLat(), lng: randomLng() },
    deliveryEta: generateETA(etaHours),
    insuranceStatus: randomItem(INSURANCE),
  };
}

function generateAllAssets(count: number): FleetAsset[] {
  const assets: FleetAsset[] = [];
  for (let i = 0; i < count; i++) {
    assets.push(generateAsset(i + 1));
  }
  return assets;
}

function mutateRandomAsset(
  asset: FleetAsset,
  rng: number,
): FleetAsset {
  const field = rng % 5;
  switch (field) {
    case 0:
      return { ...asset, temperature: randomFloat(-5, 45, 1) };
    case 1:
      return { ...asset, status: randomItem(STATUSES) };
    case 2:
      return { ...asset, eta: Math.max(0, asset.eta - randomInt(0, 5)) };
    case 3:
      return { ...asset, cargoCount: randomInt(0, 500) };
    case 4:
      return {
        ...asset,
        batteryLevel: Math.max(0, asset.batteryLevel - randomFloat(0, 2, 1)),
      };
    default:
      return asset;
  }
}

export function createFleetDataStream(
  totalAssets: number,
  updateIntervalMs = 1000,
  mutateCount = 10,
): {
  subscribe: (cb: (snapshot: FleetDataSnapshot) => void) => () => void;
  getSnapshot: () => FleetDataSnapshot;
  destroy: () => void;
} {
  let assets = generateAllAssets(totalAssets);
  let changedIndices: number[] = [];
  let snapshot: FleetDataSnapshot = {
    assets,
    changedIndices: [],
    timestamp: Date.now(),
  };
  const listeners = new Set<(snapshot: FleetDataSnapshot) => void>();

  const intervalId = setInterval(() => {
    changedIndices = [];
    for (let i = 0; i < mutateCount; i++) {
      const idx = randomInt(0, totalAssets - 1);
      const original = assets[idx];
      const mutated = mutateRandomAsset(original, i + idx);
      if (mutated !== original) {
        assets = [
          ...assets.slice(0, idx),
          mutated,
          ...assets.slice(idx + 1),
        ];
        changedIndices.push(idx);
      }
    }
    snapshot = {
      assets,
      changedIndices: [...new Set(changedIndices)].sort((a, b) => a - b),
      timestamp: Date.now(),
    };
    for (const cb of listeners) {
      cb(snapshot);
    }
  }, updateIntervalMs);

  return {
    subscribe(cb: (snapshot: FleetDataSnapshot) => void) {
      listeners.add(cb);
      cb(snapshot);
      return () => {
        listeners.delete(cb);
      };
    },
    getSnapshot() {
      return snapshot;
    },
    destroy() {
      clearInterval(intervalId);
      listeners.clear();
    },
  };
}

export function useFleetData(
  totalAssets = 10000,
  updateIntervalMs = 1000,
  mutateCount = 10,
) {
  const assetsRef = useRef<FleetAsset[]>([]);
  const [snapshot, setSnapshot] = useState<FleetDataSnapshot>({
    assets: [],
    changedIndices: [],
    timestamp: 0,
  });

  useEffect(() => {
    const stream = createFleetDataStream(
      totalAssets,
      updateIntervalMs,
      mutateCount,
    );
    const unsub = stream.subscribe((s) => {
      assetsRef.current = s.assets;
      setSnapshot(s);
    });
    return () => {
      unsub();
      stream.destroy();
    };
  }, [totalAssets, updateIntervalMs, mutateCount]);

  return snapshot;
}
