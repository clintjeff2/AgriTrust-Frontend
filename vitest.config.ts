import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000, // Increase timeout to 15 seconds
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
