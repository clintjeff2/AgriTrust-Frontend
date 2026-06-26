"use client";

import { useEffect, useState } from "react";
import { getPendingSyncCount, getTotalAuditCount } from "@/src/services/indexedDbStore";

/**
 * Offline fallback page — served from the PWA shell cache when navigation
 * fails without a network connection.
 *
 * The service worker pre-caches this route during the install event so it is
 * always available regardless of connectivity.
 */
export default function OfflinePage() {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getPendingSyncCount(), getTotalAuditCount()])
      .then(([pending, total]) => {
        setPendingCount(pending);
        setTotalCount(total);
      })
      .catch(() => {
        setPendingCount(0);
        setTotalCount(0);
      });
  }, []);

  return (
    <>
      <style>{`
        @keyframes agri-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .agri-offline-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%);
          font-family: system-ui, -apple-system, sans-serif;
          padding: 24px;
          text-align: center;
        }
        .agri-offline-card {
          background: white;
          border-radius: 20px;
          padding: 48px 40px;
          max-width: 480px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04);
        }
        .agri-offline-logo {
          width: 80px;
          height: 80px;
          background: #1A7D36;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
        }
        .agri-offline-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px;
        }
        .agri-offline-subtitle {
          font-size: 1rem;
          color: #6b7280;
          margin: 0 0 32px;
          line-height: 1.6;
        }
        .agri-offline-banner-inline {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          text-align: left;
        }
        .agri-offline-banner-text {
          font-size: 0.875rem;
          color: #92400e;
          font-weight: 500;
          line-height: 1.5;
        }
        .agri-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 32px;
        }
        .agri-stat-card {
          background: #f9fafb;
          border-radius: 12px;
          padding: 16px;
        }
        .agri-stat-label {
          font-size: 0.75rem;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .agri-stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1A7D36;
        }
        .agri-stat-loading {
          height: 28px;
          background: #e5e7eb;
          border-radius: 4px;
          animation: agri-pulse 1.5s ease-in-out infinite;
        }
        .agri-offline-signal {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.75rem;
          color: #9ca3af;
          background: #f3f4f6;
          padding: 6px 14px;
          border-radius: 9999px;
        }
        .agri-dot-offline {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          animation: agri-pulse 1.5s ease-in-out infinite;
        }
      `}</style>

      <div className="agri-offline-page" id="agritrust-offline-page">
        <div className="agri-offline-card">
          {/* Logo */}
          <div className="agri-offline-logo" aria-hidden="true">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
              <path
                d="M22 8C22 8 12 16 12 26C12 31.5228 16.4772 36 22 36C27.5228 36 32 31.5228 32 26C32 16 22 8 22 8Z"
                fill="white"
              />
              <line x1="22" y1="26" x2="22" y2="38" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>

          <h1 className="agri-offline-title">You are offline</h1>
          <p className="agri-offline-subtitle">
            AgriTrust is working in offline mode. Your audit submissions are
            safely saved and will sync automatically when you reconnect.
          </p>

          {/* Banner */}
          <div className="agri-offline-banner-inline" role="status">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="agri-offline-banner-text">
              You are offline. Data shown may be outdated. All new submissions
              are queued locally and will be uploaded when connectivity returns.
            </p>
          </div>

          {/* Stats */}
          <div className="agri-stats-grid">
            <div className="agri-stat-card">
              <div className="agri-stat-label">Queued</div>
              {pendingCount === null ? (
                <div className="agri-stat-loading" />
              ) : (
                <div className="agri-stat-value">{pendingCount}</div>
              )}
            </div>
            <div className="agri-stat-card">
              <div className="agri-stat-label">Total Audits</div>
              {totalCount === null ? (
                <div className="agri-stat-loading" />
              ) : (
                <div className="agri-stat-value">{totalCount}</div>
              )}
            </div>
          </div>

          {/* Status pill */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span className="agri-offline-signal">
              <span className="agri-dot-offline" aria-hidden="true" />
              No connection — watching for signal
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
