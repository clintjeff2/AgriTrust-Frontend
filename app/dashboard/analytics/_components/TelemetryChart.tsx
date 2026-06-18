"use client";

import { useId } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const sampleData = [
  { month: "Jan", yield: 400, rainfall: 240 },
  { month: "Feb", yield: 300, rainfall: 180 },
  { month: "Mar", yield: 500, rainfall: 320 },
  { month: "Apr", yield: 450, rainfall: 280 },
  { month: "May", yield: 600, rainfall: 150 },
  { month: "Jun", yield: 550, rainfall: 200 },
];

export function TelemetryChart() {
  const id = useId();

  return (
    <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h3 className="mb-4 text-sm font-medium text-zinc-500">Crop Yield &amp; Rainfall</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={sampleData}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
          <XAxis dataKey="month" stroke="currentColor" className="text-xs text-zinc-400" />
          <YAxis stroke="currentColor" className="text-xs text-zinc-400" />
          <Tooltip />
          <Line type="monotone" dataKey="yield" stroke="#10b981" strokeWidth={2} name="Yield" />
          <Line type="monotone" dataKey="rainfall" stroke="#3b82f6" strokeWidth={2} name="Rainfall" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
