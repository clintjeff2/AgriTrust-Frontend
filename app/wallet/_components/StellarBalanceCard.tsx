"use client";

import { useState } from "react";

export function StellarBalanceCard() {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchBalance() {
    setLoading(true);
    try {
      const sdk = await import("@/services/stellarSdk");
      const bal = await sdk.getAccountBalance();
      setBalance(bal);
    } catch (err) {
      setBalance(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h3 className="mb-4 text-sm font-medium text-zinc-500">Stellar Balance</h3>
      <button
        onClick={fetchBalance}
        disabled={loading}
        className="mb-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? "Loading…" : "Check Balance"}
      </button>
      {balance && <p className="text-lg font-semibold">{balance}</p>}
    </div>
  );
}
