"use client";

import { useEffect, useState } from "react";
import { readCertificationData, type CachedCertification } from "@/src/lib/offline/certificationCache";

interface CertificateViewerProps {
  batchId: string;
  onIntegrityMismatch?: (batchId: string) => void;
}

export default function CertificateViewer({ batchId, onIntegrityMismatch }: CertificateViewerProps) {
  const [certification, setCertification] = useState<CachedCertification | null>(null);

  useEffect(() => {
    let cancelled = false;
    readCertificationData(batchId).then((record) => {
      if (cancelled) return;
      setCertification(record);
      if (!record) onIntegrityMismatch?.(batchId);
    });
    return () => {
      cancelled = true;
    };
  }, [batchId, onIntegrityMismatch]);

  if (!certification) {
    return <p role="status">Certification data is unavailable offline. Re-sync required.</p>;
  }

  return (
    <section aria-label={`Certification for batch ${batchId}`}>
      <h2>Batch {batchId}</h2>
      <p>Trust score: {certification.trustScore}</p>
      <pre>{JSON.stringify(certification.certificate, null, 2)}</pre>
      <pre>{JSON.stringify(certification.provenanceChain, null, 2)}</pre>
    </section>
  );
}
