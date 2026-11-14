/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  // Relative base so the same build works on GitHub Pages (/Projeto-PAF/) and behind Flask (/).
  base: "./",
  server: {
    port: 8080,
    proxy: { "/api": "http://localhost:5001" },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
  },
});
