"use client";

import { useMemo, useState } from "react";
import { useAuditLog } from "@/src/hooks/useAuditLog";
import type { AuditEntry } from "@/src/types/audit";

const PAGE_SIZE = 50;

function IntegrityBadge({ ok }: { ok: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
      {ok ? "Integrity verified" : "Integrity failed"}
    </span>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <tr className="border-b border-slate-200 text-sm">
      <td className="px-3 py-2 font-mono text-xs">#{entry.sequence}</td>
      <td className="px-3 py-2">{new Date(entry.timestamp).toLocaleString()}</td>
      <td className="px-3 py-2 font-mono text-xs">{entry.certId}</td>
      <td className="px-3 py-2">{entry.previousState} → {entry.newState}</td>
      <td className="px-3 py-2 font-mono text-xs">{entry.signer}</td>
      <td className="px-3 py-2 font-mono text-xs" title={entry.merkleRoot}>{entry.merkleRoot.slice(0, 16)}…</td>
    </tr>
  );
}

export function AuditLogViewer() {
  const { entries, integrity, isLoading, error, refresh } = useAuditLog(500);
  const [page, setPage] = useState(0);
  const visibleEntries = useMemo(() => entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [entries, page]);
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Immutable Audit Log</h2>
          <p className="text-sm text-slate-500">Append-only certification state transitions with SHA-256 Merkle proofs.</p>
        </div>
        <div className="flex items-center gap-3">
          {integrity && <IntegrityBadge ok={integrity.ok} />}
          <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" onClick={() => void refresh()} type="button">
            Recheck
          </button>
        </div>
      </div>

      {error && <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
      {integrity && (
        <div className="mb-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
          <span>Entries: {integrity.totalEntries}</span>
          <span>Check: {integrity.durationMs.toFixed(1)}ms</span>
          <span className="font-mono" title={integrity.rootHash}>Root: {integrity.rootHash.slice(0, 24)}…</span>
        </div>
      )}

      <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Seq</th>
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">Cert ID</th>
              <th className="px-3 py-2">Transition</th>
              <th className="px-3 py-2">Signer</th>
              <th className="px-3 py-2">Merkle Root</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={6}>Loading audit log…</td></tr>
            ) : visibleEntries.length === 0 ? (
              <tr><td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={6}>No audit entries yet.</td></tr>
            ) : visibleEntries.map((entry) => <AuditRow entry={entry} key={entry.id} />)}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 text-sm">
        <button className="rounded border px-3 py-1 disabled:opacity-50" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button">Previous</button>
        <span>Page {page + 1} of {pageCount}</span>
        <button className="rounded border px-3 py-1 disabled:opacity-50" disabled={page >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} type="button">Next</button>
      </div>
    </section>
  );
}
