import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        id: "./",
        name: "Gym희제",
        short_name: "Gym희제",
        description: "나의 세트별 운동 설정",
        lang: "ko",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#f5f7fa",
        theme_color: "#235beb",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      // PrecacheController removes obsolete entries from this app's own stable cache.
      // Avoid generic legacy-cache cleanup, which is broader than our app prefix.
      workbox: {
        cacheId: "gym-heeje",
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        cleanupOutdatedCaches: false,
        navigateFallback: "index.html",
        skipWaiting: false,
        clientsClaim: false,
      },
    }),
  ],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
  },
});
