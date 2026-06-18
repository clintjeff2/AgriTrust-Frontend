import type { FleetAsset } from "@/src/types/fleet";

export const CELL_WIDTH = 120;
export const CELL_HEIGHT = 40;
export const HEADER_HEIGHT = 36;
export const COLUMN_COUNT = 6;

export const COLORS = {
  bgEven: "#f8fafc",
  bgOdd: "#ffffff",
  headerBg: "#1e293b",
  headerText: "#f8fafc",
  textPrimary: "#1e293b",
  textSecondary: "#64748b",
  healthy: "#22c55e",
  warning: "#eab308",
  critical: "#ef4444",
  insuranceActive: "#22c55e",
  insuranceExpiring: "#eab308",
  insuranceExpired: "#ef4444",
  selected: "rgba(59, 130, 246, 0.15)",
  selectedBorder: "#3b82f6",
  hover: "rgba(59, 130, 246, 0.06)",
  gridLine: "#e2e8f0",
};

const STATUS_DOT_RADIUS = 4;
const CELL_PADDING = 6;

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "\u2026";
}

function formatETA(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
  return ctx;
}

export function drawHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
): void {
  ctx.fillStyle = COLORS.headerBg;
  ctx.fillRect(0, 0, width, HEADER_HEIGHT);

  ctx.fillStyle = COLORS.headerText;
  ctx.font = "600 11px Inter, system-ui, sans-serif";
  ctx.textBaseline = "middle";

  const labels = ["Asset ID", "Type", "Temp", "Status", "Cargo", "ETA"];
  for (let i = 0; i < COLUMN_COUNT; i++) {
    const x = i * CELL_WIDTH + CELL_PADDING;
    ctx.fillText(labels[i], x, HEADER_HEIGHT / 2);
  }
}

export function drawGridLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  visibleHeight: number,
  scrollTop: number,
): void {
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 1;

  const startRow = Math.floor(scrollTop / CELL_HEIGHT);
  const endRow = Math.ceil((scrollTop + visibleHeight) / CELL_HEIGHT);

  for (let r = startRow; r <= endRow; r++) {
    const y = r * CELL_HEIGHT - scrollTop + HEADER_HEIGHT;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (let c = 0; c <= COLUMN_COUNT; c++) {
    const x = c * CELL_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x, HEADER_HEIGHT);
    ctx.lineTo(x, HEADER_HEIGHT + visibleHeight);
    ctx.stroke();
  }
}

export function drawCell(
  ctx: CanvasRenderingContext2D,
  asset: FleetAsset,
  rowIndex: number,
  scrollTop: number,
  isSelected: boolean,
  isHovered: boolean,
): void {
  const y = rowIndex * CELL_HEIGHT - scrollTop + HEADER_HEIGHT;

  if (y + CELL_HEIGHT < 0 || y > ctx.canvas.height) return;

  const bg = rowIndex % 2 === 0 ? COLORS.bgEven : COLORS.bgOdd;
  ctx.fillStyle = bg;
  ctx.fillRect(0, y, CELL_WIDTH * COLUMN_COUNT, CELL_HEIGHT);

  if (isSelected) {
    ctx.fillStyle = COLORS.selected;
    ctx.fillRect(0, y, CELL_WIDTH * COLUMN_COUNT, CELL_HEIGHT);
    ctx.strokeStyle = COLORS.selectedBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, y + 1, CELL_WIDTH * COLUMN_COUNT - 2, CELL_HEIGHT - 2);
  } else if (isHovered) {
    ctx.fillStyle = COLORS.hover;
    ctx.fillRect(0, y, CELL_WIDTH * COLUMN_COUNT, CELL_HEIGHT);
  }

  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = "400 12px Inter, system-ui, sans-serif";
  ctx.textBaseline = "middle";

  const idText = truncateText(asset.id, 12);
  ctx.fillText(idText, 0 * CELL_WIDTH + CELL_PADDING, y + CELL_HEIGHT / 2);

  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = "400 11px Inter, system-ui, sans-serif";
  ctx.fillText(
    asset.assetType.charAt(0).toUpperCase() + asset.assetType.slice(1),
    1 * CELL_WIDTH + CELL_PADDING,
    y + CELL_HEIGHT / 2,
  );

  const tempColor =
    asset.temperature > 35
      ? COLORS.critical
      : asset.temperature > 25
        ? COLORS.warning
        : COLORS.healthy;
  ctx.fillStyle = tempColor;
  ctx.font = "500 11px Inter, system-ui, sans-serif";
  ctx.fillText(
    `${asset.temperature}\u00b0C`,
    2 * CELL_WIDTH + CELL_PADDING,
    y + CELL_HEIGHT / 2,
  );

  const statusColor =
    asset.status === "healthy"
      ? COLORS.healthy
      : asset.status === "warning"
        ? COLORS.warning
        : COLORS.critical;
  ctx.fillStyle = statusColor;
  ctx.beginPath();
  ctx.arc(
    3 * CELL_WIDTH + CELL_PADDING + STATUS_DOT_RADIUS,
    y + CELL_HEIGHT / 2,
    STATUS_DOT_RADIUS,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = "400 11px Inter, system-ui, sans-serif";
  ctx.fillText(
    asset.status.charAt(0).toUpperCase() + asset.status.slice(1),
    3 * CELL_WIDTH + CELL_PADDING + STATUS_DOT_RADIUS * 2 + 4,
    y + CELL_HEIGHT / 2,
  );

  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText(
    String(asset.cargoCount),
    4 * CELL_WIDTH + CELL_PADDING,
    y + CELL_HEIGHT / 2,
  );

  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(
    formatETA(asset.eta),
    5 * CELL_WIDTH + CELL_PADDING,
    y + CELL_HEIGHT / 2,
  );
}

export function drawDirtyCell(
  ctx: CanvasRenderingContext2D,
  asset: FleetAsset,
  rowIndex: number,
  scrollTop: number,
  isSelected: boolean,
  isHovered: boolean,
): void {
  const y = rowIndex * CELL_HEIGHT - scrollTop + HEADER_HEIGHT;
  ctx.clearRect(0, y, CELL_WIDTH * COLUMN_COUNT, CELL_HEIGHT);
  drawCell(ctx, asset, rowIndex, scrollTop, isSelected, isHovered);
}

export function getCellAtPoint(
  x: number,
  y: number,
  scrollTop: number,
): { row: number; col: number } | null {
  const adjustedY = y - HEADER_HEIGHT + scrollTop;
  if (adjustedY < 0 || x < 0 || x > CELL_WIDTH * COLUMN_COUNT) return null;
  const row = Math.floor(adjustedY / CELL_HEIGHT);
  const col = Math.floor(x / CELL_WIDTH);
  return { row, col };
}
