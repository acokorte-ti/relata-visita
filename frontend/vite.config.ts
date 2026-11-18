import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Em desenvolvimento, o Vite (porta 5173) repassa /api para o FastAPI (porta 8502).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["simbolo-acokorte.png", "apple-touch-icon.png"],
      manifest: {
        name: "Relata Visita - Açokorte",
        short_name: "Relata Visita",
        description: "Relato de visitas a clientes por voz",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#1B1C1E",
        icons: [
          { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,png}"],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8502" },
  },
});
