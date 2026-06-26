import { describe, expect, it } from "vitest";
import { computeBundledEdges } from "@/src/services/visualization/edgeBundler";
import type { FlowEdge, FlowNode } from "@/src/types/visualization";

describe("computeBundledEdges", () => {
  it("returns control points for valid supply chain edges within the frame budget", () => {
    const nodes: FlowNode[] = [
      { id: "farm", x: 0, y: 0 },
      { id: "processor", x: 100, y: 0 },
      { id: "market", x: 200, y: 100 },
    ];
    const edges: FlowEdge[] = [
      { source: "farm", target: "processor", bundleWeight: 1 },
      { source: "processor", target: "market", bundleWeight: 1 },
    ];

    const bundled = computeBundledEdges(nodes, edges, 4);

    expect(bundled).toHaveLength(edges.length);
    expect(bundled[0].controlPoints[0]).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });
});
