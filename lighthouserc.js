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
        "unused-javascript": ["error", { maxLength: 0 }],
        "total-byte-weight": ["warn", { maxNumericValue: 2000000 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
