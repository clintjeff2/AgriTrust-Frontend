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

export interface FlowNode {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  mass?: number;
  color?: string;
  size?: number;
  trustScore?: number;
}

export interface FlowEdge {
  id?: string;
  source: string;
  target: string;
  bundleWeight?: number;
  color?: string;
}

export interface BundledEdge extends FlowEdge {
  controlPoints: Array<{ x: number; y: number }>;
}

export interface ParticleState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  size: number;
  color: [number, number, number, number];
}

export interface FlowVisualizationData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowCamera {
  x: number;
  y: number;
  zoom: number;
}
