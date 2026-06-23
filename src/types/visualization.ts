export type ClusterGroup = "region" | "productType" | "certificationStatus" | string;

export interface ClusterColorInput {
  id: string;
  group?: ClusterGroup;
  adjacentIds?: string[];
}

export interface OklchColor {
  l: number;
  c: number;
  h: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface LabColor {
  l: number;
  a: number;
  b: number;
}

export interface ColorAssignment {
  clusterId: string;
  hex: string;
  oklch: OklchColor;
  rgb: RgbColor;
  lab: LabColor;
  paletteIndex: number;
}
