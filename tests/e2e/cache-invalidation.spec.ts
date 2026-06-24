import { test, expect } from "@playwright/test";

/**
 * End-to-end check of the certification cache-invalidation strategy.
 *
 * Exercises the real `public/sw.js`: the app registers the worker on load, we
 * seed a status-segmented cache entry, broadcast a `cert-status-change` ping on
 * the BroadcastChannel, and assert the worker purges the cert's entry. No cert
 * backend is required — we drive the Cache API and the invalidation channel
 * directly.
 *
 * Run with: `npx playwright test tests/e2e/cache-invalidation.spec.ts`
 * (requires a built app served at baseURL — see playwright.config.ts).
 */

test.describe("Certification cache invalidation", () => {
  test("service worker registers and controls the page", async ({ page }) => {
    await page.goto("/");
    const active = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const registration = await navigator.serviceWorker.ready;
      return Boolean(registration.active);
    });
    expect(active).toBe(true);
  });

  test("a broadcast ping purges the cert's cached entries", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);

    const result = await page.evaluate(async () => {
      const CACHE_NAME = "cert-v1";
      const certId = "e2e-cert-1";
      const url = `${location.origin}/__certcache__/cert-v1-verified-${certId}`;

      const cache = await caches.open(CACHE_NAME);
      const now = Date.now();
      await cache.put(
        new Request(url),
        new Response("{}", {
          headers: {
            "content-type": "application/json",
            "x-sw-size": "2",
            "x-sw-cached-at": String(now),
            "x-sw-last-access": String(now),
            "x-sw-status": "verified",
            "x-sw-cert-id": certId,
          },
        })
      );

      const seeded = Boolean(await cache.match(url));

      const channel = new BroadcastChannel("cert-status-change");
      channel.postMessage({
        type: "cert-status-change",
        certId,
        fromStatus: "verified",
        toStatus: "revoked",
        at: Date.now(),
      });
      channel.close();

      const purged = await new Promise<boolean>((resolve) => {
        const start = Date.now();
        const poll = async () => {
          const hit = await caches
            .open(CACHE_NAME)
            .then((c) => c.match(url));
          if (!hit) return resolve(true);
          if (Date.now() - start > 5000) return resolve(false);
          setTimeout(poll, 100);
        };
        void poll();
      });

      return { seeded, purged };
    });

    expect(result.seeded).toBe(true);
    expect(result.purged).toBe(true);
  });
});
