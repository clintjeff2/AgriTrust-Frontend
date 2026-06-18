"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FleetAsset, FleetDataSnapshot } from "@/src/types/fleet";
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  COLUMN_COUNT,
  HEADER_HEIGHT,
  drawHeader,
  drawGridLines,
  drawCell,
  drawDirtyCell,
  getCellAtPoint,
} from "@/src/utils/canvasRenderer";
import { FleetTooltip } from "./FleetTooltip";

interface FleetCanvasGridProps {
  data: FleetDataSnapshot;
  totalAssets: number;
  height?: number;
}

export function FleetCanvasGrid({
  data,
  totalAssets,
  height = 600,
}: FleetCanvasGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number>(0);
  const prevDataRef = useRef<FleetAsset[]>([]);
  const selectedRef = useRef<Set<number>>(new Set());
  const hoveredRef = useRef<number | null>(null);
  const scrollTopRef = useRef(0);

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [tooltipAsset, setTooltipAsset] = useState<FleetAsset | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const width = CELL_WIDTH * COLUMN_COUNT;

  const fullHeight = totalAssets * CELL_HEIGHT + HEADER_HEIGHT;

  const renderFrame = useCallback(
    (scrollTop: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const visibleHeight = height;
      canvas.width = width * dpr;
      canvas.height = visibleHeight * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${visibleHeight}px`;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, width, visibleHeight);

      drawHeader(ctx, width);

      const startRow = Math.max(
        0,
        Math.floor(scrollTop / CELL_HEIGHT) - 1,
      );
      const endRow = Math.min(
        totalAssets - 1,
        Math.ceil((scrollTop + visibleHeight) / CELL_HEIGHT) + 1,
      );

      for (let r = startRow; r <= endRow; r++) {
        const asset = data.assets[r];
        if (!asset) continue;
        drawCell(
          ctx,
          asset,
          r,
          scrollTop,
          selectedRef.current.has(r),
          hoveredRef.current === r,
        );
      }

      drawGridLines(ctx, width, visibleHeight, scrollTop);
    },
    [data.assets, totalAssets, height, width],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleScroll = () => {
      scrollTopRef.current = containerRef.current?.scrollTop ?? 0;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() =>
        renderFrame(scrollTopRef.current),
      );
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
    }

    renderFrame(0);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, [renderFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prev = prevDataRef.current;
    const changed = data.changedIndices;
    const scrollTop = scrollTopRef.current;

    if (prev.length === 0) {
      renderFrame(scrollTop);
    } else if (changed.length > 100) {
      renderFrame(scrollTop);
    } else {
      for (const idx of changed) {
        const asset = data.assets[idx];
        if (!asset) continue;
        const isSelected = selectedRef.current.has(idx);
        const isHovered = hoveredRef.current === idx;
        drawDirtyCell(ctx, asset, idx, scrollTop, isSelected, isHovered);
      }
    }

    prevDataRef.current = data.assets;
  }, [data, renderFrame]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cell = getCellAtPoint(x, y, scrollTopRef.current);
      if (!cell) return;

      const newSet = new Set(selectedRef.current);
      if (e.shiftKey) {
        if (newSet.has(cell.row)) {
          newSet.delete(cell.row);
        } else {
          newSet.add(cell.row);
        }
      } else {
        newSet.clear();
        newSet.add(cell.row);
      }
      selectedRef.current = newSet;
      setSelectedIndices(newSet);
      renderFrame(scrollTopRef.current);
    },
    [renderFrame],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cell = getCellAtPoint(x, y, scrollTopRef.current);

      if (cell) {
        const asset = data.assets[cell.row];
        if (asset) {
          if (hoveredRef.current !== cell.row) {
            const prevHovered = hoveredRef.current;
            hoveredRef.current = cell.row;
            if (prevHovered !== null && prevHovered !== cell.row) {
              const shouldRedrawPrev =
                selectedRef.current.has(prevHovered);
              const shouldRedrawCurr =
                selectedRef.current.has(cell.row);
              if (!shouldRedrawPrev) {
                drawDirtyCell(
                  canvasRef.current!.getContext("2d")!,
                  data.assets[prevHovered],
                  prevHovered,
                  scrollTopRef.current,
                  false,
                  false,
                );
              }
              if (!shouldRedrawCurr) {
                drawDirtyCell(
                  canvasRef.current!.getContext("2d")!,
                  asset,
                  cell.row,
                  scrollTopRef.current,
                  false,
                  true,
                );
              }
            }
          }
          setTooltipAsset(asset);
          setTooltipPos({ x: e.clientX, y: e.clientY });
          return;
        }
      }

      if (hoveredRef.current !== null) {
        const prevHovered = hoveredRef.current;
        hoveredRef.current = null;
        if (!selectedRef.current.has(prevHovered)) {
          const prevAsset = data.assets[prevHovered];
          if (prevAsset) {
            drawDirtyCell(
              canvasRef.current!.getContext("2d")!,
              prevAsset,
              prevHovered,
              scrollTopRef.current,
              false,
              false,
            );
          }
        }
      }
      setTooltipAsset(null);
    },
    [data.assets],
  );

  const handleMouseLeave = useCallback(() => {
    if (hoveredRef.current !== null) {
      const prevHovered = hoveredRef.current;
      hoveredRef.current = null;
      const prevAsset = data.assets[prevHovered];
      if (prevAsset && !selectedRef.current.has(prevHovered)) {
        drawDirtyCell(
          canvasRef.current!.getContext("2d")!,
          prevAsset,
          prevHovered,
          scrollTopRef.current,
          false,
          false,
        );
      }
    }
    setTooltipAsset(null);
  }, [data.assets]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        style={{
          width,
          height,
          overflow: "auto",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          position: "relative",
        }}
      >
        <div style={{ width, height: fullHeight, position: "absolute", pointerEvents: "none" }} />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            position: "sticky",
            top: 0,
            left: 0,
            cursor: "pointer",
          }}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          color: "#64748b",
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        <span>{totalAssets.toLocaleString()} assets</span>
        <span>
          {selectedIndices.size > 0
            ? `${selectedIndices.size} selected`
            : "Click to select, Shift+click for multi-select"}
        </span>
      </div>
      <FleetTooltip asset={tooltipAsset} x={tooltipPos.x} y={tooltipPos.y} />
    </div>
  );
}
