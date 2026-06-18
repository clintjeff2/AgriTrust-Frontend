"use client";

import { useState } from "react";

export function SorobanTxPanel() {
  const [txHash, setTxHash] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setResult(null);
    try {
      const { Client } = await import("@/services/sorobanClient");
      const { SorobanRpc } = await import("@/services/sorobanClient");
      const client = new Client();
      const rpc = new SorobanRpc();
      const res = await client.submitTransaction(txHash, rpc);
      setResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setResult(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h3 className="mb-4 text-sm font-medium text-zinc-500">Soroban Transaction</h3>
      <div className="space-y-4">
        <input
          type="text"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          placeholder="Transaction hash…"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !txHash}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Submitting…" : "Submit"}
        </button>
        {result && (
          <pre className="overflow-auto rounded-lg bg-zinc-100 p-4 text-xs dark:bg-zinc-900">
            {result}
          </pre>
        )}
      </div>
    </div>
  );
}
