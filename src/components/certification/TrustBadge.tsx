import React, { useState, useEffect, useRef } from 'react';
import { useCertificateVerification } from '../../hooks/useCertificateVerification';
import CertificateDetailPanel from './CertificateDetailPanel';

interface TrustBadgeProps {
  certificateId: string;
  initialScore: number;
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({ certificateId, initialScore }) => {
  const [trustScore, setTrustScore] = useState(initialScore);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSettled, setIsSettled] = useState(true);

  const { subscribeToUpdates } = useCertificateVerification(certificateId);

  const debounceTimerRef = useRef<any>(null);
  const settleTimerRef = useRef<any>(null);
  const latestScoreRef = useRef(initialScore);

  useEffect(() => {
    const updateBadge = (newScore: number) => {
      latestScoreRef.current = newScore;
      setIsSettled(false);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        setTrustScore(latestScoreRef.current);

        settleTimerRef.current = setTimeout(() => {
          setIsSettled(true);
        }, 300);
      }, 500);
    };

    const unsubscribe = subscribeToUpdates(updateBadge);
    return () => {
      unsubscribe();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, [certificateId, subscribeToUpdates]);

  const handleBadgeClick = () => {
    setIsPanelOpen(true);
  };

  const getBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="relative inline-block">
      <div
        data-testid="trust-badge"
        className={`w-12 h-12 rounded-full flex items-center justify-center text-white cursor-pointer transition-colors duration-500 ease-in-out ${getBadgeColor(trustScore)}`}
        onClick={handleBadgeClick}
      >
        <span className="text-xs font-bold" data-testid="trust-score-text">{trustScore}%</span>
      </div>

      {isPanelOpen && (
        <CertificateDetailPanel
          certificateId={certificateId}
          score={trustScore}
          isSettled={isSettled}
          onClose={() => setIsPanelOpen(false)}
        />
      )}
    </div>
  );
};

export default TrustBadge;
