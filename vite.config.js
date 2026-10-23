import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * golive.wiki Vite Multi-Page Application config
 *
 * Static HTML pages + shared styles/i18n.js, with React for the drone-control entry.
 * Vite handles:
 *  - Asset hashing for cache busting (i18n-[hash].js)
 *  - Minification via Terser
 *  - Dev server with HMR
 *  - Relative path rewriting for styles/i18n.js
 */
export default defineConfig({
  plugins: [react()],
  base: "./",
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: false,
        passes: 2,
        pure_funcs: ["console.debug"],
      },
      mangle: {
        reserved: [
          "I18N_DICTIONARY",
          "applyLanguage",
          "switchLanguage",
          "toggleLangDropdown",
          "initLanguageSwitcher",
          "AGENT_DEFS",
          "PLAN_TEMPLATES",
          "pickPlanType",
          "agentShowPlan",
          "agentSuggest",
          "agentSubmit",
          "agentApprove",
          "agentCancel",
          "initAgentPanel",
          "_agentBusy",
          "CATEGORIES",
        ],
      },
      format: { comments: false },
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        "screens-04-dashboard": resolve(__dirname, "screens-04-dashboard.html"),
        "screens-05-create-gig": resolve(__dirname, "screens-05-create-gig.html"),
        "screens-06-task-detail": resolve(__dirname, "screens-06-task-detail.html"),
        "screens-admin": resolve(__dirname, "screens-admin.html"),
        "screens-07-ride": resolve(__dirname, "screens-07-ride.html"),
        drone: resolve(__dirname, "drone.html"),
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
    target: "es2018",
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  resolve: {
    alias: {
      "@styles": resolve(__dirname, "styles"),
      "@": resolve(__dirname, "src"),
    },
  },
});
