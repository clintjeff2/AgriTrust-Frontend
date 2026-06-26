import type { MetadataRoute } from "next";

/**
 * PWA Web App Manifest for AgriTrust.
 *
 * Next.js 16 App Router serves this automatically at /manifest.webmanifest.
 * Spec requirements (from the PWA offline-support issue):
 *   - display: standalone (native app feel on mobile)
 *   - theme_color: #1A7D36 (AgriTrust brand green)
 *   - icons: 192×192 and 512×512
 *   - start_url: /dashboard
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgriTrust",
    short_name: "AgriTrust",
    description: "Agricultural Supply Chain Trust Platform",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#1A7D36",
    orientation: "portrait-primary",
    scope: "/",
    lang: "en",
    categories: ["agriculture", "business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Open the AgriTrust dashboard",
        url: "/dashboard",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
