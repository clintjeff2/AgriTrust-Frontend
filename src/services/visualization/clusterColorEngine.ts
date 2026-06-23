import type { ClusterColorInput, ColorAssignment, OklchColor } from "@/src/types/visualization";
import { ciede2000, oklchToRgb, rgbToHex, rgbToLab } from "@/src/utils/color";
import { hashString } from "@/src/utils/hash";

const BASE_HUES = 32;
const LUMINANCE_LEVELS = [0.52, 0.6, 0.68, 0.76, 0.84] as const;
const CHROMA = 0.18;
const PALETTE_SIZE = BASE_HUES * LUMINANCE_LEVELS.length;
const MIN_ADJACENT_DELTA_E = 30;

const assignmentCache = new Map<string, ColorAssignment>();
const paletteCache = new Map<string, ColorAssignment[]>();

export function generatePalette(count: number, seed: string): ColorAssignment[] {
  const boundedCount = Math.max(0, count);
  const cacheKey = `${seed}:${boundedCount}`;
  const cached = paletteCache.get(cacheKey);
  if (cached) return cached;

  const start = Number(hashString(seed) % BigInt(PALETTE_SIZE));
  const palette = Array.from({ length: boundedCount }, (_, index) => createAssignment(seed, `palette-${index}`, (start + index) % PALETTE_SIZE));
  paletteCache.set(cacheKey, palette);
  return palette;
}

export function getClusterColorAssignments(clusters: Array<string | ClusterColorInput>): Map<string, ColorAssignment> {
  const normalized = clusters.map((cluster) => (typeof cluster === "string" ? { id: cluster } : cluster));
  const assignments = new Map<string, ColorAssignment>();
  const usedIndexes = new Set<number>();

  for (const cluster of normalized) {
    const adjacent = cluster.adjacentIds ?? [];
    const assignment = selectAssignment(cluster.id, adjacent, assignments, usedIndexes);
    assignments.set(cluster.id, assignment);
    usedIndexes.add(assignment.paletteIndex);
  }

  return optimizeAdjacentAssignments(assignments, normalized);
}

export function getClusterColor(clusterId: string): ColorAssignment {
  const cached = assignmentCache.get(clusterId);
  if (cached) return cached;
  const paletteIndex = Number(hashString(clusterId) % BigInt(PALETTE_SIZE));
  const assignment = createAssignment(clusterId, clusterId, paletteIndex);
  assignmentCache.set(clusterId, assignment);
  return assignment;
}

export function getMinimumAdjacentDistance(assignments: Map<string, ColorAssignment>, clusters: ClusterColorInput[]): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (const cluster of clusters) {
    const current = assignments.get(cluster.id);
    if (!current) continue;
    for (const adjacentId of cluster.adjacentIds ?? []) {
      const adjacent = assignments.get(adjacentId);
      if (adjacent) minimum = Math.min(minimum, ciede2000(current.lab, adjacent.lab));
    }
  }
  return minimum === Number.POSITIVE_INFINITY ? 0 : minimum;
}

function selectAssignment(clusterId: string, adjacentIds: string[], assignments: Map<string, ColorAssignment>, usedIndexes: Set<number>): ColorAssignment {
  const start = Number(hashString(clusterId) % BigInt(PALETTE_SIZE));
  let best = getClusterColor(clusterId);
  let bestScore = -1;

  for (let offset = 0; offset < PALETTE_SIZE; offset += 1) {
    const paletteIndex = (start + offset * 37) % PALETTE_SIZE;
    const candidate = createAssignment(clusterId, clusterId, paletteIndex);
    const adjacentDistances = adjacentIds.map((id) => assignments.get(id)).filter(Boolean).map((assignment) => ciede2000(candidate.lab, assignment!.lab));
    const minimumDistance = adjacentDistances.length ? Math.min(...adjacentDistances) : MIN_ADJACENT_DELTA_E;
    const reusePenalty = usedIndexes.has(paletteIndex) ? 0.001 : 0;
    const score = minimumDistance - reusePenalty;

    if (minimumDistance >= MIN_ADJACENT_DELTA_E && !usedIndexes.has(paletteIndex)) return candidate;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function optimizeAdjacentAssignments(assignments: Map<string, ColorAssignment>, clusters: ClusterColorInput[]): Map<string, ColorAssignment> {
  const optimized = new Map(assignments);

  for (let pass = 0; pass < 2; pass += 1) {
    for (const cluster of clusters) {
      const current = optimized.get(cluster.id);
      if (!current) continue;
      const currentMin = minimumForCluster(cluster, current, optimized);
      if (currentMin >= MIN_ADJACENT_DELTA_E) continue;

      let best = current;
      let bestMin = currentMin;
      for (let paletteIndex = 0; paletteIndex < PALETTE_SIZE; paletteIndex += 1) {
        const candidate = createAssignment(cluster.id, cluster.id, paletteIndex);
        const candidateMin = minimumForCluster(cluster, candidate, optimized);
        if (candidateMin > bestMin) {
          best = candidate;
          bestMin = candidateMin;
        }
        if (candidateMin >= MIN_ADJACENT_DELTA_E) break;
      }
      optimized.set(cluster.id, best);
    }
  }

  return optimized;
}

function minimumForCluster(cluster: ClusterColorInput, candidate: ColorAssignment, assignments: Map<string, ColorAssignment>): number {
  const distances = (cluster.adjacentIds ?? []).map((id) => assignments.get(id)).filter(Boolean).map((assignment) => ciede2000(candidate.lab, assignment!.lab));
  return distances.length ? Math.min(...distances) : Number.POSITIVE_INFINITY;
}

function createAssignment(seed: string, clusterId: string, paletteIndex: number): ColorAssignment {
  const hueSlot = paletteIndex % BASE_HUES;
  const luminanceSlot = Math.floor(paletteIndex / BASE_HUES) % LUMINANCE_LEVELS.length;
  const jitter = Number(hashString(seed, BigInt(paletteIndex + 1)) % 1000n) / 1000;
  const oklch: OklchColor = {
    l: LUMINANCE_LEVELS[luminanceSlot],
    c: CHROMA,
    h: (hueSlot * (360 / BASE_HUES) + jitter * 4) % 360,
  };
  const rgb = oklchToRgb(oklch);
  return { clusterId, hex: rgbToHex(rgb), oklch, rgb, lab: rgbToLab(rgb), paletteIndex };
}
