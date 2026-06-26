import { syncCertificationData, type CertificationPayload } from "./certificationCache";

export const CERTIFICATION_BACKGROUND_SYNC_TAG = "agritrust-certification-sync";

export async function handleCertificationBackgroundSync(
  pendingBatches: CertificationPayload[]
): Promise<void> {
  for (const batch of pendingBatches) {
    await syncCertificationData(batch);
  }
}

interface BackgroundSyncEvent extends Event {
  tag: string;
  waitUntil(promise: Promise<unknown>): void;
}

interface BackgroundSyncScope {
  addEventListener(type: "sync", listener: (event: BackgroundSyncEvent) => void): void;
}

export function registerCertificationSyncHandler(
  scope: BackgroundSyncScope,
  loadPendingBatches: () => Promise<CertificationPayload[]>
): void {
  scope.addEventListener("sync", (event) => {
    if (event.tag !== CERTIFICATION_BACKGROUND_SYNC_TAG) return;
    event.waitUntil(loadPendingBatches().then(handleCertificationBackgroundSync));
  });
}
