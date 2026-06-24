import EventEmitter from "eventemitter3";
import { useEffect, useState, useCallback } from "react";

export const verificationEvents = new EventEmitter();

export function useCertificateVerification(certificateId: string) {
  const [lastEvent, setLastEvent] = useState<any>(null);

  useEffect(() => {
    const handler = (event: any) => {
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
    const handler = (event: any) => {
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
