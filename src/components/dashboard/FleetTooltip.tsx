"use client";

import type { ReactNode } from "react";
import type { FleetAsset } from "@/src/types/fleet";
import { SafeText } from "@/src/components/common/SafeText";
import { useLocale } from "@/src/hooks/useLocale";

interface FleetTooltipProps {
  asset: FleetAsset | null;
  x: number;
  y: number;
}

export function FleetTooltip({ asset, x, y }: FleetTooltipProps) {
  const { t } = useLocale();
  if (!asset) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(x + 16, window.innerWidth - 260),
    top: Math.min(y + 16, window.innerHeight - 200),
    pointerEvents: "none",
    zIndex: 9999,
    background: "#1e293b",
    color: "#f8fafc",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 12,
    lineHeight: 1.6,
    minWidth: 220,
    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    border: "1px solid #334155",
  };

  const statusColor =
    asset.status === "healthy"
      ? "#22c55e"
      : asset.status === "warning"
        ? "#eab308"
        : "#ef4444";

  return (
    <div style={style}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
        <SafeText>{asset.id}</SafeText>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Row label={t("fleet.type")} value={<SafeText>{asset.assetType}</SafeText>} />
        <Row
          label={t("fleet.temperature")}
          value={`${asset.temperature}°C`}
          color={asset.temperature > 35 ? "#ef4444" : undefined}
        />
        <Row label={t("fleet.status")} value={asset.status} color={statusColor} />
        <Row
          label={t("fleet.battery")}
          value={`${asset.batteryLevel}%`}
          color={asset.batteryLevel < 20 ? "#ef4444" : undefined}
        />
        <Row label={t("fleet.cargo")} value={String(asset.cargoCount)} />
        <Row label={t("fleet.eta")} value={formatETA(asset.eta)} />
        <Row label={t("fleet.gps")} value={`${asset.lastGps.lat.toFixed(4)}, ${asset.lastGps.lng.toFixed(4)}`} />
        <Row label={t("fleet.insurance")} value={<SafeText>{asset.insuranceStatus}</SafeText>} />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: ReactNode;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span style={{ color: color ?? "#f1f5f9", fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

function formatETA(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
