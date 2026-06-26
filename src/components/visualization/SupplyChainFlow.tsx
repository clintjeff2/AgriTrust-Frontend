"use client";

import { useMemo } from "react";
import { useFlowVisualization } from "@/src/hooks/useFlowVisualization";
import type { FlowEdge, FlowNode } from "@/src/types/visualization";

interface SupplyChainFlowProps {
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  className?: string;
}

const DEFAULT_NODES: FlowNode[] = [
  { id: "farm", x: 120, y: 160, color: "#22c55e", size: 15, mass: 1.2 },
  { id: "processor", x: 320, y: 110, color: "#f59e0b", size: 13 },
  { id: "certifier", x: 460, y: 230, color: "#38bdf8", size: 14 },
  { id: "market", x: 650, y: 170, color: "#a78bfa", size: 16, mass: 1.4 },
];

const DEFAULT_EDGES: FlowEdge[] = [
  { source: "farm", target: "processor", bundleWeight: 1.2 },
  { source: "processor", target: "certifier", bundleWeight: 1.5 },
  { source: "certifier", target: "market", bundleWeight: 1.1 },
  { source: "farm", target: "certifier", bundleWeight: 0.8 },
];

export function SupplyChainFlow({ nodes, edges, className }: SupplyChainFlowProps) {
  const data = useMemo(() => ({ nodes: nodes ?? DEFAULT_NODES, edges: edges ?? DEFAULT_EDGES }), [nodes, edges]);
  const canvasRef = useFlowVisualization(data);

  return (
    <div className={className} style={{ position: "relative", minHeight: 360, width: "100%" }}>
      <canvas
        ref={canvasRef}
        aria-label="Real-time supply chain flow visualization"
        role="img"
        style={{ width: "100%", height: "100%", minHeight: 360, display: "block", borderRadius: 16, background: "#020617" }}
      />
    </div>
  );
}
