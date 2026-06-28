import EventEmitter from "eventemitter3";
import { useEffect, useState, useCallback } from "react";

export interface TrustScoreEvent {
  certificateId: string;
  score: number;
}

export const verificationEvents = new EventEmitter();

export function useCertificateVerification(certificateId: string) {
  const [lastEvent, setLastEvent] = useState<TrustScoreEvent | null>(null);

  useEffect(() => {
    const handler = (event: TrustScoreEvent) => {
      if (event.certificateId === certificateId) {
        setLastEvent(event);
      }
    };

    verificationEvents.on("trustScoreUpdated", handler);

    return () => {
      verificationEvents.off("trustScoreUpdated", handler);
    };
  }, [certificateId]);

  const subscribeToUpdates = useCallback((callback: (score: number) => void) => {
    const handler = (event: TrustScoreEvent) => {
      if (event.certificateId === certificateId) {
        callback(event.score);
      }
    };
    verificationEvents.on("trustScoreUpdated", handler);
    return () => {
        verificationEvents.off("trustScoreUpdated", handler);
    };
  }, [certificateId]);

  return { lastEvent, subscribeToUpdates };
}
