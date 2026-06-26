import type { BundledEdge, FlowEdge, FlowNode } from "@/src/types/visualization";

const MAX_BUNDLE_ITERATIONS = 6;
const MAX_EDGE_SAMPLE = 2000;
const CROSSING_REPULSION = 0.015;
const PATH_ATTRACTION = 0.12;

interface Point { x: number; y: number }

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
}

function edgeKey(edge: FlowEdge): string {
  return [edge.source, edge.target].sort().join("→");
}

function compatible(a: FlowEdge, b: FlowEdge): boolean {
  return a.source === b.source || a.source === b.target || a.target === b.source || a.target === b.target || edgeKey(a) === edgeKey(b);
}

export function computeBundledEdges(nodes: FlowNode[], edges: FlowEdge[], budgetMs = 4): BundledEdge[] {
  const started = performance.now();
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const bundled = edges.slice(0, MAX_EDGE_SAMPLE).map((edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    const mid = source && target ? midpoint(source, target) : { x: 0, y: 0 };
    return { ...edge, controlPoints: [mid] } satisfies BundledEdge;
  });

  for (let iteration = 0; iteration < MAX_BUNDLE_ITERATIONS; iteration += 1) {
    if (performance.now() - started > budgetMs) break;

    for (let i = 0; i < bundled.length; i += 1) {
      const edge = bundled[i];
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const desired = midpoint(source, target);
      let fx = (desired.x - edge.controlPoints[0].x) * PATH_ATTRACTION * (edge.bundleWeight ?? 1);
      let fy = (desired.y - edge.controlPoints[0].y) * PATH_ATTRACTION * (edge.bundleWeight ?? 1);

      for (let j = i + 1; j < bundled.length; j += 1) {
        const other = bundled[j];
        if (!compatible(edge, other)) continue;
        const point = other.controlPoints[0];
        const dx = point.x - edge.controlPoints[0].x;
        const dy = point.y - edge.controlPoints[0].y;
        const distanceSq = Math.max(dx * dx + dy * dy, 16);
        const force = CROSSING_REPULSION / distanceSq;
        fx -= dx * force;
        fy -= dy * force;
        point.x += dx * force;
        point.y += dy * force;
      }

      edge.controlPoints[0].x += fx;
      edge.controlPoints[0].y += fy;
    }
  }

  return bundled;
}
