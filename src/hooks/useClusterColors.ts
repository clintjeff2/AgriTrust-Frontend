"use client";

import { useMemo } from "react";
import { getClusterColorAssignments } from "@/src/services/visualization/clusterColorEngine";
import type { ClusterColorInput, ColorAssignment } from "@/src/types/visualization";

export function useClusterColors(clusters: Array<string | ClusterColorInput>): Map<string, ColorAssignment> {
  return useMemo(() => getClusterColorAssignments(clusters), [clusters]);
}
