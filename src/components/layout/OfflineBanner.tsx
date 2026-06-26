"use client";

import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/src/hooks/useOnlineStatus";
import { getPendingSyncCount } from "@/src/services/indexedDbStore";

/**
 * Sticky top banner displayed when the device has no network connectivity.
 *
 * Shows a brief message and the number of audit submissions queued for sync.
 * Slides in from the top when offline and slides back out when connectivity
 * is restored — no layout shift on the main content.
 *
 * Per the PWA offline-support spec:
 *   "display a cached dashboard view with stale data and a banner
 *    'You are offline. Data shown may be outdated.'"
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [visible, setVisible] = useState(false);

  // Animate: delay unmount until slide-out finishes
  useEffect(() => {
    if (!isOnline) {
      setVisible(true);
    } else {
      // Let the CSS transition finish before removing from DOM
      const t = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(t);
    }
  }, [isOnline]);

  // Refresh pending count whenever we go offline (or on mount)
  useEffect(() => {
    if (!isOnline) {
      getPendingSyncCount()
        .then(setPendingCount)
        .catch(() => setPendingCount(0));
    }
  }, [isOnline]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes agri-slide-down {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes agri-slide-up {
          from { transform: translateY(0);    opacity: 1; }
          to   { transform: translateY(-100%); opacity: 0; }
        }
        .agri-offline-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 16px;
          background: linear-gradient(90deg, #92400e 0%, #b45309 100%);
          color: #fef3c7;
          font-family: inherit;
          font-size: 0.875rem;
          font-weight: 500;
          box-shadow: 0 2px 12px rgba(0,0,0,0.25);
          animation: agri-slide-down 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .agri-offline-banner.agri-going-online {
          animation: agri-slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .agri-offline-icon {
          flex-shrink: 0;
          width: 18px;
          height: 18px;
        }
        .agri-offline-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 9999px;
          background: rgba(0,0,0,0.2);
          font-size: 0.75rem;
          font-weight: 600;
          margin-left: 4px;
        }
      `}</style>

      <div
        role="status"
        aria-live="polite"
        aria-label="Offline status notification"
        className={`agri-offline-banner${isOnline ? " agri-going-online" : ""}`}
        id="agritrust-offline-banner"
      >
        {/* Wi-Fi off icon */}
        <svg
          className="agri-offline-icon"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <circle cx="12" cy="20" r="1" fill="currentColor" />
        </svg>

        <span>
          You are offline — changes will sync when connectivity returns.
        </span>

        {pendingCount > 0 && (
          <span className="agri-offline-badge" aria-label={`${pendingCount} pending submissions`}>
            {pendingCount} queued
          </span>
        )}
      </div>
    </>
  );
}
