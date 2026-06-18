"use client";

import { useEffect, useRef } from "react";

type YieldPoint = {
  lat: number;
  lng: number;
  label: string;
  value: number;
};

const yieldData: YieldPoint[] = [
  { lat: 9.082, lng: 8.6753, label: "Maize", value: 840 },
  { lat: 9.072, lng: 7.491, label: "Rice", value: 620 },
  { lat: 8.49, lng: 6.445, label: "Soy", value: 510 },
];

export function YieldHeatmap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    async function init() {
      const L = await import("leaflet");
      if (!containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [9.0, 7.5] as [number, number],
        zoom: 6,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      yieldData.forEach((pt) => {
        const radius = Math.max(pt.value / 10, 5);
        L.circleMarker([pt.lat, pt.lng] as [number, number], {
          radius,
          color: "#10b981",
          fillColor: "#10b981",
          fillOpacity: 0.5,
          weight: 1,
        })
          .addTo(map)
          .bindPopup(`<b>${pt.label}</b><br/>Yield: ${pt.value} kg/ha`);
      });

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
      <h3 className="mb-4 text-sm font-medium text-zinc-500">Yield Heatmap</h3>
      <div ref={containerRef} className="h-[400px] w-full rounded-lg" />
    </div>
  );
}
