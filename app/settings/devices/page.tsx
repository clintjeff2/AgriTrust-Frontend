"use client";

import dynamic from "next/dynamic";

const QRCodeViewer = dynamic(
  () => import("./_components/QRCodeViewer").then((m) => ({ default: m.QRCodeViewer })),
  { ssr: false, loading: () => <div className="h-[300px] animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" /> },
);

export default function DevicesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Devices</h1>
      <p className="text-zinc-500">
        Pair and manage IoT devices connected to your farm.
      </p>
      <QRCodeViewer />
    </div>
  );
}
