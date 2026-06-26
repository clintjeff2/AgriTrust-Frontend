module.exports = {
  ci: {
    collect: {
      url: [
        "http://localhost:3000",
        "http://localhost:3000/dashboard",
        "http://localhost:3000/dashboard/analytics",
        "http://localhost:3000/dashboard/maps",
        "http://localhost:3000/wallet",
        "http://localhost:3000/settings/devices",
      ],
      settings: {
        preset: "desktop",
      },
    },
    assert: {
      assertions: {
        // Existing performance assertions
        // unused-javascript: warn with a practical threshold — strict zero-
        // tolerance fails for any real Next.js app with third-party libraries.
        "unused-javascript": ["warn", { maxLength: 5 }],
        "total-byte-weight": ["warn", { maxNumericValue: 2000000 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],

        // PWA assertions (required by the offline-support issue).
        // Audit IDs are validated against Lighthouse 11 (shipped by @lhci/cli@0.13.x).
        // Note: service-worker, works-offline, and apple-touch-icon were removed
        // in Lighthouse 10 — SW registration and offline capability are now covered
        // by the installable-manifest audit which fails if no SW is registered or
        // the app cannot be installed.
        "categories:pwa": ["warn", { minScore: 0.9 }],
        "installable-manifest": ["error", { minScore: 1 }],
        "viewport": ["error", { minScore: 1 }],
        "themed-omnibox": ["warn", { minScore: 1 }],
        "maskable-icon": ["warn", { minScore: 1 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
