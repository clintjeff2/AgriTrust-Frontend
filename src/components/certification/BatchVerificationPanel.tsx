"use client";

import type { VerificationTask } from "@/src/types/verification";
import { useBatchVerification } from "@/src/hooks/useBatchVerification";

interface BatchVerificationPanelProps {
  tasks: VerificationTask[];
}

export function BatchVerificationPanel({ tasks }: BatchVerificationPanelProps) {
  const { start, cancel, statuses, progress } = useBatchVerification(tasks);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Batch certificate verification</h2>
          <p className="text-sm text-gray-600">
            {progress.completed} of {progress.total} certificates complete ({progress.percent}%).
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void start()} className="rounded bg-green-700 px-3 py-2 text-sm font-medium text-white">
            Start verification
          </button>
          <button type="button" onClick={cancel} className="rounded border border-red-300 px-3 py-2 text-sm font-medium text-red-700">
            Cancel
          </button>
        </div>
      </div>
      <progress className="mt-4 h-2 w-full" max={100} value={progress.percent} aria-label="Batch verification progress" />
      <ul className="mt-4 divide-y divide-gray-100">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center justify-between py-2 text-sm">
            <span className="font-medium text-gray-800">{task.certificateId}</span>
            <span className="capitalize text-gray-600">{statuses[task.id] ?? "pending"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default BatchVerificationPanel;
