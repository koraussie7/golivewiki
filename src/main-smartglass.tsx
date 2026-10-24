import React from "react";
import ReactDOM from "react-dom/client";
import { SmartglassPage } from "./features/smartglass/SmartglassPage";

/**
 * Entry point for smartglass.html.
 *
 * Mirrors main.tsx (the drone entry) so both feature pages are mounted the same way
 * and a shared provider or error boundary can later be added in one place.
 */
const container = document.getElementById("root");
if (!container) {
  throw new Error("#root not found in smartglass.html");
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <SmartglassPage />
  </React.StrictMode>,
);
