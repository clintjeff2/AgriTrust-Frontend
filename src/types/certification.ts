/**
 * Certification lifecycle status definitions, shared by the service-worker
 * cache strategy, the registration layer, and React hooks.
 *
 * Lifecycle: issued → verified → revoked / expired. "issued" and "verified"
 * are active (short cache TTL, since on-chain state can change); "revoked" and
 * "expired" are terminal/historical (longer TTL, they will not change again).
 */

export const CERTIFICATION_STATUSES = [
  "issued",
  "verified",
  "revoked",
  "expired",
] as const;

export type CertificationStatus = (typeof CERTIFICATION_STATUSES)[number];

/** Statuses whose on-chain state can still change → short cache TTL. */
export const ACTIVE_STATUSES: readonly CertificationStatus[] = [
  "issued",
  "verified",
];

export function isCertificationStatus(
  value: string
): value is CertificationStatus {
  return (CERTIFICATION_STATUSES as readonly string[]).includes(value);
}

export function isActiveStatus(status: CertificationStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** Shape of the certificate payload the dashboard caches and renders. */
export interface CertificationRecord {
  id: string;
  status: CertificationStatus;
  trustScore: number;
  certifierName?: string;
  updatedAt: number;
}

/** Payload broadcast when a certificate transitions to a new status. */
export interface CertStatusChangeMessage {
  type: "cert-status-change";
  certId: string;
  fromStatus?: CertificationStatus;
  toStatus: CertificationStatus;
  /** Unix-ms timestamp of the transition. */
  at: number;
}
