import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Vite options tailored for Tauri development
  clearScreen: false,

  // Configure server for Tauri dev mode
  server: {
    port: 5173,
    strictPort: true,
    // Tauri expects localhost
    host: "localhost",
  },

  // Build configuration
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "safari13",
    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    // Output directory (relative to project root)
    outDir: "dist/app",
  },

  // Root directory for the app
  root: "src/app",
});
