import React from "react";
import { createRoot } from "react-dom/client";
import { DroneControlPage } from "./features/drone/DroneControlPage";
import "./features/drone/styles/drone-control.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root mount element for Drone Control.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <DroneControlPage />
  </React.StrictMode>,
);
