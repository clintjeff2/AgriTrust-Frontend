import { describe, expect, it } from "vitest";
import { IncrementalForceSimulation, type ProvenanceHop } from "../graph/forceSimulation";

function makeChain(size: number): ProvenanceHop[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `hop-${index}`,
    label: `Hop ${index}`,
    fromId: index === 0 ? undefined : `hop-${index - 1}`,
    timestamp: `2026-06-${String((index % 7) + 1).padStart(2, "0")}T00:00:00Z`,
  }));
}

describe("IncrementalForceSimulation", () => {
  it("keeps ten sequential provenance updates within the 100ms frame-freeze budget", () => {
    const simulation = new IncrementalForceSimulation();
    const chain = makeChain(32);
    const freezes: number[] = [];

    for (let update = 0; update < 10; update++) {
      const started = performance.now();
      simulation.applyIncrementalUpdate(chain.slice(0, 23 + update));
      simulation.tickUntilBudget(8);
      freezes.push(performance.now() - started);
    }

    expect(Math.max(...freezes)).toBeLessThan(100);
    expect(freezes.reduce((sum, freeze) => sum + freeze, 0)).toBeLessThan(500);
    expect(simulation.getGraphData().nodes).toHaveLength(32);
    expect(simulation.getGraphData().edges).toHaveLength(31);
  });
});
