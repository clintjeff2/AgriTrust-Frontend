"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IncrementalForceSimulation,
  aggregateHopsByDay,
  type GraphData,
  type ProvenanceHop,
} from "./graph/forceSimulation";

interface ProvenanceChainGraphProps {
  hops: ProvenanceHop[];
  progressiveZoomThreshold?: number;
}

export function ProvenanceChainGraph({
  hops,
  progressiveZoomThreshold = 1.5,
}: ProvenanceChainGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef(new IncrementalForceSimulation());
  const progressiveModeRef = useRef(true);
  const [zoom, setZoom] = useState(1);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });

  const isProgressiveMode = zoom < progressiveZoomThreshold;
  const visibleHops = useMemo(
    () => (isProgressiveMode ? aggregateHopsByDay(hops) : hops),
    [hops, isProgressiveMode],
  );

  const updateGraphData = useCallback(
    (nextHops: ProvenanceHop[]) => {
      if (progressiveModeRef.current !== isProgressiveMode) {
        progressiveModeRef.current = isProgressiveMode;
        simulationRef.current.reset(nextHops);
        simulationRef.current.tickUntilBudget();
        setGraph(simulationRef.current.getGraphData());
        return;
      }

      const changed = simulationRef.current.applyIncrementalUpdate(nextHops);
      simulationRef.current.tickUntilBudget();
      if (changed) setGraph(simulationRef.current.getGraphData());
    },
    [isProgressiveMode],
  );

  useEffect(() => {
    updateGraphData(visibleHops);
  }, [updateGraphData, visibleHops]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = 760;
    const height = 360;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, width / 2, height / 2);
    ctx.clearRect(-width / 2, -height / 2, width, height);

    ctx.strokeStyle = "#94a3b8";
    for (const edge of graph.edges) {
      const source = graph.nodes.find((node) => node.id === edge.source);
      const target = graph.nodes.find((node) => node.id === edge.target);
      if (!source || !target) continue;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    }

    for (const node of graph.nodes) {
      ctx.fillStyle = "#16a34a";
      ctx.beginPath();
      ctx.arc(node.x, node.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.fillText(node.label, node.x + 14, node.y + 4);
    }
  }, [graph]);

  return (
    <figure aria-label="Provenance chain graph">
      <canvas ref={canvasRef} />
      <input
        aria-label="Graph zoom"
        max={3}
        min={0.5}
        onChange={(event) => setZoom(Number(event.target.value))}
        step={0.25}
        type="range"
        value={zoom}
      />
    </figure>
  );
}

export default ProvenanceChainGraph;
