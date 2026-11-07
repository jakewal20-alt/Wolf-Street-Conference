import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png"],
      manifest: {
        name: "Hallway — Wolf Street",
        short_name: "Hallway",
        description: "Conference and relationship intelligence for business development teams, part of the Wolf Street suite",
        theme_color: "#1d2b3e",
        background_color: "#fcf9f8",
        display: "standalone",
        scope: "/",
        start_url: "/",
        orientation: "portrait-primary",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        // Hand-off pages must always run the latest code: an app shell cached
        // from before /sso existed sends people to a plain sign-in and loses
        // the way back to Forecast/SAMklr.
        navigateFallbackDenylist: [/^\/sso/, /^\/reset-password/],
        // Supabase responses (user data, auth) are deliberately NOT cached:
        // a shared/kiosk device must not keep CRM data after sign-out.
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
