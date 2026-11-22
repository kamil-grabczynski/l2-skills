import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps every asset path relative, so the built dist/ works from any folder or sub-path.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5173 },
  preview: { port: 4173 },
});
