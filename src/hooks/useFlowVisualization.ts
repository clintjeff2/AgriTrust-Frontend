"use client";

import { useEffect, useRef } from "react";
import { FlowEngine } from "@/src/services/visualization/flowEngine";
import type { FlowEdge, FlowNode } from "@/src/types/visualization";

interface UseFlowVisualizationOptions {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export function useFlowVisualization({ nodes, edges }: UseFlowVisualizationOptions) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<FlowEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new FlowEngine(canvas, { nodes: [], edges: [] });
    engineRef.current = engine;
    engine.start();

    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setData(nodes, edges);
  }, [nodes, edges]);

  return canvasRef;
}
