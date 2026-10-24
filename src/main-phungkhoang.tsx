import React from "react";
import { createRoot } from "react-dom/client";
import { PhungKhoangFarm } from "./features/phungkhoang/PhungKhoangFarm";
import "./features/phungkhoang/styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root mount element for Phung Khoang Farm.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <PhungKhoangFarm />
  </React.StrictMode>,
);