/**
 * state-store.js — Single source of truth for the unified Dashboard.
 */
const state = {
  mode: "idle",
  userRole: "worker",
  selectedCategory: null,
  taskDraft: {
    title: "",
    description: "",
    location: "",
    when: "today",
    myOffer: 50000,
    suggested: 85000,
    id: null,
  },
  offers: [],
  acceptedOffer: null,
  dashboardTasks: [],
  activityFeed: [],

  // Map layers (golive.wiki own design — inspired by industry-standard
  // toggleable map overlays like Airtasker/Indrive. No third-party code used).
  layers: {
    demand:    false, // 🔥 현재 인기 카테고리 히트맵
    risk:      false, // ⚠️ 안전 알림 폴리곤
    signals:   false, // 📡 실시간 활동 펄스
    valuation: false, // 💎 적정가 가이드 (색상 코딩)
  },
};

const listeners = new Map();

function emit(event, data) {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(data); }
    catch (err) { console.error(`[state-store] listener for "${event}" threw:`, err); }
  }
}

function set(patch) {
  const prev = { mode: state.mode, layers: { ...state.layers } };
  Object.assign(state, patch);
  emit("state:change", state);
  if (patch && patch.mode !== undefined && patch.mode !== prev.mode) {
    emit("mode:change", { from: prev.mode, to: state.mode });
  }
  if (patch && patch.layers) {
    for (const key of Object.keys(patch.layers)) {
      if (patch.layers[key] !== prev.layers[key]) {
        emit("layer:toggle", { layer: key, on: !!patch.layers[key] });
      }
    }
  }
}

/** Convenience: toggle a single map layer on/off. */
function toggleLayer(name) {
  if (!(name in state.layers)) return;
  set({ layers: { ...state.layers, [name]: !state.layers[name] } });
}

function get() { return state; }

function subscribe(event, fn) {
  if (typeof fn !== "function") return () => {};
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => {
    const set = listeners.get(event);
    if (set) set.delete(fn);
  };
}

export const store = { get, set, emit, subscribe, toggleLayer, state };
if (typeof window !== "undefined") window.__store__ = store;
