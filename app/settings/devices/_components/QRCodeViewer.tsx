"use client";

import { useState } from "react";

export function QRCodeViewer() {
  const [qrData, setQrData] = useState("");
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateQR() {
    setLoading(true);
    try {
      const { default: qrcode } = await import("qrcode");
      const svg = await qrcode.toString(qrData || "agritrust:device:pair", { type: "svg" });
      setQrSvg(svg);
    } catch (err) {
      setQrSvg(`<p class="text-red-500">Error: ${err}</p>`);
    } finally {
      setLoading(false);
    }
  }

  async function compressPayload() {
    const { default: pako } = await import("pako");
    const input = new TextEncoder().encode(qrData || "default-payload");
    const compressed = pako.deflate(input);
    const base64 = btoa(String.fromCharCode(...compressed));
    setQrData(base64);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h3 className="mb-4 text-sm font-medium text-zinc-500">Device Pairing QR</h3>
        <div className="space-y-3">
          <input
            type="text"
            value={qrData}
            onChange={(e) => setQrData(e.target.value)}
            placeholder="Device pairing data…"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="flex gap-3">
            <button
              onClick={compressPayload}
              disabled={loading}
              className="rounded-lg bg-zinc-600 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              Compress
            </button>
            <button
              onClick={generateQR}
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "Generating…" : "Generate QR"}
            </button>
          </div>
          {qrSvg && <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
        </div>
      </div>
    </div>
  );
}
