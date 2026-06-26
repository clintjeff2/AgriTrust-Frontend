import { useEffect, useRef } from "react";
import type { ProvenanceHop } from "@/src/components/provenance/graph/forceSimulation";

export function useDebouncedProvenanceUpdates(
  onBatch: (hops: ProvenanceHop[]) => void,
  debounceMs = 500,
) {
  const queueRef = useRef<ProvenanceHop[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (hop: ProvenanceHop) => {
    queueRef.current.push(hop);
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      const batch = queueRef.current;
      queueRef.current = [];
      timerRef.current = null;
      if (batch.length > 0) onBatch(batch);
    }, debounceMs);
  };
}
