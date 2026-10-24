/** @type {import('tailwindcss').Config} */
export default {
  // Scoped to the React entry points only. The legacy multi-page HTML/CSS
  // screens are hand-written and must not be rewritten by Tailwind's preflight.
  content: [
    "./src/**/*.{ts,tsx}",
    "./phungkhoang.html",
    "./drone.html",
  ],
  theme: { extend: {} },
  plugins: [],
};
