"use client";

import { useClusterColors } from "@/src/hooks/useClusterColors";
import type { ClusterColorInput } from "@/src/types/visualization";

interface ClusterMapProps {
  clusters: Array<ClusterColorInput & { label?: string; x: number; y: number; radius?: number }>;
  width?: number;
  height?: number;
}

export function ClusterMap({ clusters, width = 640, height = 360 }: ClusterMapProps) {
  const colors = useClusterColors(clusters);

  return (
    <svg role="img" aria-label="Supply chain cluster map" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {clusters.map((cluster) => {
        const color = colors.get(cluster.id);
        return (
          <g key={cluster.id}>
            <circle cx={cluster.x} cy={cluster.y} r={cluster.radius ?? 16} fill={color?.hex ?? "#64748b"} stroke="#0f172a" strokeWidth={1.5} />
            {cluster.label ? <text x={cluster.x} y={cluster.y + (cluster.radius ?? 16) + 14} textAnchor="middle" fontSize={12} fill="#0f172a">{cluster.label}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}
