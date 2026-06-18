"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { crop: "Maize", yield: 840 },
  { crop: "Rice", yield: 620 },
  { crop: "Soy", yield: 510 },
  { crop: "Wheat", yield: 730 },
  { crop: "Cotton", yield: 390 },
];

export function YieldHistogram() {
  return (
    <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h3 className="mb-4 text-sm font-medium text-zinc-500">Crop Yield Breakdown</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
          <XAxis dataKey="crop" stroke="currentColor" className="text-xs text-zinc-400" />
          <YAxis stroke="currentColor" className="text-xs text-zinc-400" />
          <Tooltip />
          <Bar dataKey="yield" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
