export type AssetType = "truck" | "drone" | "tractor" | "harvester";
export type AssetStatus = "healthy" | "warning" | "critical";
export type InsuranceStatus = "active" | "expiring" | "expired";

export interface FleetAsset {
  id: string;
  assetType: AssetType;
  temperature: number;
  status: AssetStatus;
  eta: number;
  cargoCount: number;
  batteryLevel: number;
  lastGps: { lat: number; lng: number };
  deliveryEta: string;
  insuranceStatus: InsuranceStatus;
}

export interface FleetDataSnapshot {
  assets: FleetAsset[];
  changedIndices: number[];
  timestamp: number;
}
