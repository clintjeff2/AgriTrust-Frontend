"use client";

import { useEffect, useRef } from "react";

export function FarmMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    async function init() {
      const L = await import("leaflet");
      if (!containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [9.082, 8.6753] as [number, number],
        zoom: 6,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      mapRef.current = map;
    }

    init();

    return () => {
      if (mapRef.current) {
        (mapRef.current as L.Map).remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h3 className="mb-4 text-sm font-medium text-zinc-500">Farm Map</h3>
      <div ref={containerRef} className="h-[400px] w-full rounded-lg" />
    </div>
  );
}
