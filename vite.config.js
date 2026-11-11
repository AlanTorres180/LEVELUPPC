import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { readdirSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pagesDir = resolve(__dirname, "src/pages");
const pages = Object.fromEntries(
  readdirSync(pagesDir)
    .filter((f) => f.endsWith(".html"))
    .map((f) => [f.replace(".html", ""), resolve(pagesDir, f)])
);

export default defineConfig({
  root: ".",
  publicDir: "public",
  server: {
    proxy: { "/api": { target: "http://localhost:3000", changeOrigin: true, secure: false } },
  },
  build: {
    outDir: "dist",
    target: "esnext", // main.ts usa top-level await
    rollupOptions: {
      input: { main: resolve(__dirname, "index.html"), ...pages },
    },
  },
});