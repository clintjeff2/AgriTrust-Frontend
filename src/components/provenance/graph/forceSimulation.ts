export interface ProvenanceHop {
  id: string;
  label?: string;
  timestamp?: string | number | Date;
  fromId?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  aggregatedIds?: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const MAX_FRAME_BUDGET_MS = 8;
const REHEAT_ALPHA = 0.1;

function seededPosition(id: string, index: number) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const angle = (hash % 6283) / 1000;
  const radius = 80 + index * 18;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

export class IncrementalForceSimulation {
  private nodesById = new Map<string, GraphNode>();
  private edgeKeys = new Set<string>();
  private alpha = 0;

  reset(hops: ProvenanceHop[] = []) {
    this.nodesById.clear();
    this.edgeKeys.clear();
    this.alpha = 0;
    this.applyIncrementalUpdate(hops);
  }

  getAlpha() {
    return this.alpha;
  }

  getGraphData(): GraphData {
    return {
      nodes: Array.from(this.nodesById.values()),
      edges: Array.from(this.edgeKeys, (key) => {
        const [source, target] = key.split("→");
        return { source, target };
      }),
    };
  }

  /**
   * Applies only missing nodes/edges and briefly re-heats the simulation instead
   * of rebuilding every body and replaying thousands of warmup ticks.
   */
  applyIncrementalUpdate(hops: ProvenanceHop[]) {
    let changed = false;
    for (const hop of hops) {
      if (!this.nodesById.has(hop.id)) {
        const position = seededPosition(hop.id, this.nodesById.size);
        this.nodesById.set(hop.id, {
          id: hop.id,
          label: hop.label ?? hop.id,
          ...position,
        });
        changed = true;
      }

      if (hop.fromId) {
        const key = `${hop.fromId}→${hop.id}`;
        if (!this.edgeKeys.has(key)) {
          this.edgeKeys.add(key);
          changed = true;
        }
      }
    }

    if (changed) this.alpha = Math.max(this.alpha, REHEAT_ALPHA);
    return changed;
  }

  tickUntilBudget(maxBudgetMs = MAX_FRAME_BUDGET_MS) {
    const started = performance.now();
    let ticks = 0;
    while (this.alpha > 0.001 && performance.now() - started < maxBudgetMs) {
      this.tick();
      ticks += 1;
    }
    return ticks;
  }

  private tick() {
    const nodes = Array.from(this.nodesById.values());
    for (let i = 0; i < nodes.length; i++) {
      const targetX = (i - (nodes.length - 1) / 2) * 72;
      nodes[i].x += (targetX - nodes[i].x) * this.alpha;
      nodes[i].y += (Math.sin(i) * 32 - nodes[i].y) * this.alpha;
    }
    this.alpha *= 0.82;
  }
}

export function aggregateHopsByDay(hops: ProvenanceHop[]): ProvenanceHop[] {
  const groups = new Map<string, ProvenanceHop[]>();
  for (const hop of hops) {
    const date = hop.timestamp ? new Date(hop.timestamp) : new Date(0);
    const key = Number.isNaN(date.getTime()) ? "unknown" : date.toISOString().slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), hop]);
  }
  return Array.from(groups, ([day, items], index) => ({
    id: `day:${day}`,
    label: `${day} (${items.length})`,
    fromId: index === 0 ? undefined : `day:${Array.from(groups.keys())[index - 1]}`,
  }));
}
