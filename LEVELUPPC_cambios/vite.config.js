import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "public",
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
    target: "esnext", // main.ts usa top-level await para cargar el catálogo
    rollupOptions: {
      // ✅ Solo compila el index.html, sin páginas inexistentes
      input: {
        main: "index.html",
      },
    },
  },
});
