"use client";

import dynamic from "next/dynamic";
import { InternationalizedText } from "@/src/components/common/InternationalizedText";

const QRCodeViewer = dynamic(
  () => import("./_components/QRCodeViewer").then((m) => ({ default: m.QRCodeViewer })),
  { ssr: false, loading: () => <div className="h-[300px] animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" /> },
);

export default function DevicesPage() {
  return (
    <div className="space-y-6">
      <InternationalizedText as="h1" id="devices.title" className="text-2xl font-bold" />
      <InternationalizedText as="p" id="devices.subtitle" className="text-zinc-500" />
      <QRCodeViewer />
    </div>
  );
}
