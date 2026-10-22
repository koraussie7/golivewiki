/**
 * js/request-drawer.js
 *
 * Right-side drawer that hosts the 3-step service-request flow inside the
 * unified dashboard. The drawer is mounted in screens-04-dashboard.html and
 * is hidden by default; it opens when the user clicks "의뢰 모드" in the
 * topbar mode switcher.
 */
import { store } from "./state-store.js";

function showStep(n) {
  document.querySelectorAll(".drawer-step").forEach((sec) => {
    sec.hidden = String(sec.dataset.step) !== String(n);
  });
  document.querySelectorAll(".drawer .step-pill").forEach((pill) => {
    pill.classList.remove("active", "done");
    const step = Number(pill.dataset.step);
    if (step < n) pill.classList.add("done");
    if (step === n) pill.classList.add("active");
  });
}

function openDrawer({ step = 1 } = {}) {
  const el = document.getElementById("request-drawer");
  if (!el) return;
  el.hidden = false;
  el.classList.add("open");
  showStep(step);
  document.dispatchEvent(new CustomEvent("drawer:opened", { detail: { step } }));
}

function closeDrawer() {
  const el = document.getElementById("request-drawer");
  if (!el) return;
  el.classList.remove("open");
  el.hidden = true;
  store.set({ mode: "idle" });
}

// Wire mode:change → drawer open/close
store.subscribe("mode:change", ({ to }) => {
  if (typeof to !== "string") return;
  if (to.startsWith("request-")) {
    const step = Number(to.split("-").pop()) || 1;
    openDrawer({ step });
  } else if (to === "idle") {
    const el = document.getElementById("request-drawer");
    if (el && !el.hidden) closeDrawer();
  }
});

function bindCloseHandlers() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const el = document.getElementById("request-drawer");
      if (el && !el.hidden) closeDrawer();
    }
  });
  document.addEventListener("click", (e) => {
    const el = document.getElementById("request-drawer");
    if (!el || el.hidden) return;
    if (e.target === el) closeDrawer();
    if (e.target.closest(".drawer-close")) closeDrawer();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindCloseHandlers();
});

window.__drawer__ = { open: openDrawer, close: closeDrawer, showStep };
