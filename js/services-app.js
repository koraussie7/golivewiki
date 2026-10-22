/**
 * js/services-app.js
 *
 * inDrive-style multi-category service request flow:
 *   1. Category grid (top-18 by request volume)
 *   2. Form (title, desc, location, when, my-offer slider)
 *   3. Counter-offer negotiation (multiple workers, accept/decline/counter)
 *
 * Persistence: js/api.js (REST). Realtime is simulated with setTimeout;
 * if @supabase/supabase-js is installed, Realtime channels replace simulation.
 *
 * Integration notes (Phase 1):
 *  - Internal `state` is a local mirror of the canonical store in state-store.js.
 *    Every mutation also calls store.set(...) or store.emit(...) so
 *    dashboard-app.js can react.
 *  - window.* handlers (goStep, updateOffer, submitRequest, acceptThis,
 *    declineThis, counterThis) are preserved for back-compat with inline
 *    onclick= attributes.
 */
import { CATEGORIES } from "./data/categories.js";
import { formatPrice, getCurrencySymbol } from "./data/currencies.js";
import { insertTask } from "./api.js";
import { supabase } from "./supabase-client.js";
import { store } from "./state-store.js";

const state = {
  selectedCategory: store.get().selectedCategory,
  task: { ...store.get().taskDraft },
  offers: [...store.get().offers],
};


// Read the current UI language. i18n.js stores the user's choice in
// localStorage under "golive_lang" (matches styles/i18n.js). Defaults to "ko".
const SUPPORTED_LANGS = ["ko", "en", "vi", "ja", "zh", "hi", "es"];
function getCurrentLang() {
  // Resolution order matches styles/i18n.js so the two modules always agree:
  //   1. localStorage["golive_lang"]  — user's explicit prior choice
  //   2. navigator.languages          — browser Accept-Language equivalent
  //   3. "ko"                         — safe default
  try {
    const fromLs = localStorage.getItem("golive_lang");
    if (fromLs) return fromLs;
  } catch (_) { /* ignore */ }
  const langs = (typeof navigator !== "undefined")
    ? (navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || navigator.userLanguage || ""])
    : [];
  for (const raw of langs) {
    const short = String(raw).toLowerCase().split("-")[0];
    if (SUPPORTED_LANGS.includes(short)) return short;
  }
  return "ko";
}

// Localize a category field with a ko -> en fallback chain.
function localize(cat, field) {
  const lang = getCurrentLang();
  const src = cat[field] || {};
  return src[lang] || src.ko || src.en || "";
}
function syncDraftToStore() {
  store.set({
    selectedCategory: state.selectedCategory,
    taskDraft: { ...state.task },
    offers: [...state.offers],
  });
}

// === Step 1: Category Grid ===
function renderCategories() {
  const grid = document.getElementById("cat-grid");
  if (!grid) return;
  grid.innerHTML = "";
  const lang = getCurrentLang();
  const topIds = CATEGORIES.filter((c) => c.top === 1).slice(0, 3).map((c) => c.id);
  const topBadgeByLang = {
    ko: "🔥 인기 1위",
    en: "🔥 #1 Trending",
    vi: "🔥 Hạng 1 phổ biến",
    ja: "🔥 1位人気",
    zh: "🔥 第1名热门",
    hi: "🔥 ट्रेंडिंग #1",
    es: "🔥 #1 Tendencia",
  };
  const avgLabelByLang = {
    ko: "평균", en: "Avg", vi: "Trung bình", ja: "平均", zh: "平均", hi: "औसत", es: "Promedio",
  };
  for (const cat of CATEGORIES) {
    const card = document.createElement("div");
    card.className = "cat-card";
    card.dataset.id = cat.id;
    card.innerHTML = `
      ${topIds.includes(cat.id) ? '<div class="badge-top">' + (topBadgeByLang[lang] || topBadgeByLang.en) + '</div>' : ""}
      <div class="emoji">${cat.emoji}</div>
      <div class="name">${escapeHtml(localize(cat, "i18n"))}</div>
      <div class="desc">${escapeHtml(localize(cat, "desc"))}</div>
      <div class="avg">${avgLabelByLang[lang] || avgLabelByLang.en} ${formatPrice(cat.avgKRW, lang)}</div>
    `;
    card.addEventListener("click", () => selectCategory(cat));
    grid.appendChild(card);
  }
}

// === Step transition ===
window.goStep = function (n) {
  // Defensive: in the drawer, the legacy .step / #step-N DOM is absent.
  // We rely on store.mode to drive the drawer's visible step, so this
  // function only needs to emit the right mode.
  // Keep legacy classList hooks for any backward-compatible callers.
  document.querySelectorAll(".step").forEach((el) => el.classList.remove("active"));
  const legacyStep = document.getElementById(`step-${n}`);
  if (legacyStep) legacyStep.classList.add("active");
  const stepToMode = { 1: "request-1", 2: "request-2", 3: "request-3" };
  store.set({ mode: stepToMode[n] || "idle" });
};

// === Step 2: Form fill ===
function selectCategory(cat) {
  state.selectedCategory = cat;
  const lang = getCurrentLang();
  state.task.suggested = cat.avgKRW;
  state.task.myOffer = Math.round(cat.avgKRW * 0.8);
  syncDraftToStore();
  const byId = (id) => document.getElementById(id);
  if (byId("form-cat-emoji")) byId("form-cat-emoji").textContent = cat.emoji;
  if (byId("form-cat-name")) byId("form-cat-name").textContent = localize(cat, "i18n");
  if (byId("suggested-display")) byId("suggested-display").textContent = formatPrice(cat.avgKRW, lang);
  if (byId("my-offer-display")) byId("my-offer-display").textContent = formatPrice(state.task.myOffer, lang);
  if (byId("slider-value")) byId("slider-value").textContent = formatPrice(state.task.myOffer, lang);
  const slider = byId("offer-slider");
  if (slider) {
    slider.value = state.task.myOffer;
    slider.max = cat.avgKRW * 3;
  }
  if (byId("task-title")) byId("task-title").value = "";
  if (byId("task-desc")) byId("task-desc").value = "";
  if (byId("task-location")) byId("task-location").value = "";
  goStep(2);
}
// === Slider update ===
window.updateOffer = function (val) {
  state.task.myOffer = parseInt(val, 10);
  const formatted = formatPrice(state.task.myOffer, getCurrentLang());
  if (document.getElementById("my-offer-display")) document.getElementById("my-offer-display").textContent = formatted;
  if (document.getElementById("slider-value")) document.getElementById("slider-value").textContent = formatted;
  syncDraftToStore();
};

// === Step 3: Submit request ===
window.submitRequest = async function () {
  state.task.title = (document.getElementById("task-title")?.value || "").trim();
  state.task.description = (document.getElementById("task-desc")?.value || "").trim();
  state.task.location = (document.getElementById("task-location")?.value || "").trim();
  state.task.when = document.getElementById("task-when")?.value || "today";
  if (!state.task.title) { alert("작업 제목을 입력해주세요."); return; }
  if (!state.task.location) { alert("작업 위치를 입력해주세요."); return; }
  goStep(3);
  if (document.getElementById("empty-state")) document.getElementById("empty-state").style.display = "block";
  const list = document.getElementById("offers-list");
  if (list) list.innerHTML = "";
  state.offers = [];
  syncDraftToStore();

  try {
    // Schema note (2026-10-22): the live `tasks` table uses region / timing /
    // budget_krw. The old location_text / when_text / poster_offer /
    // suggested_price columns no longer exist (PostgREST PGRST204), which made
    // every insert fail with 400.
    const result = await insertTask({
      category: state.selectedCategory.id,
      title: state.task.title,
      description: state.task.description,
      region: state.task.location || null,
      timing: state.task.when || null,
      budget_krw: Number(state.task.myOffer) || null,
      status: "open",
    });
    state.task.id = (Array.isArray(result) ? result[0] : result)?.id || "local-" + Date.now();
    syncDraftToStore();
    store.emit("task:created", {
      id: state.task.id,
      title: state.task.title,
      category: state.selectedCategory,
      myOffer: state.task.myOffer,
    });

    if (supabase && typeof supabase.channel === "function") {
      try {
        supabase
          .channel(`offers-${state.task.id}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "offers", filter: `task_id=eq.${state.task.id}` },
            (payload) => addOfferToUI(payload.new)
          )
          .subscribe();
      } catch (e) {
        console.warn("[realtime] channel subscribe failed:", e);
      }
    }
    simulateOffers(state.task.id);
  } catch (e) {
    console.error("Submit failed:", e);
    alert("요청 저장 실패: " + e.message + "\n\n그래도 시뮬레이션은 진행합니다.");
    state.task.id = "local-" + Date.now();
    store.emit("task:created", {
      id: state.task.id,
      title: state.task.title,
      category: state.selectedCategory,
      myOffer: state.task.myOffer,
      error: e.message,
    });
    simulateOffers(state.task.id);
  }
};

// === Add offer to UI ===
function addOfferToUI(offer) {
  if (state.offers.find((o) => o.id === offer.id)) return;
  state.offers.push(offer);
  syncDraftToStore();
  store.emit("offers:updated", { offer, total: state.offers.length });

  const empty = document.getElementById("empty-state");
  if (empty) empty.style.display = "none";
  const list = document.getElementById("offers-list");
  if (!list) return;
  const lang = getCurrentLang();
  const yoursLabel = {
    ko: "내 제안", en: "Your offer", vi: "Đề nghị của bạn",
    ja: "あなたの提案", zh: "您的报价", hi: "आपका प्रस्ताव", es: "Tu oferta",
  };
  const reviewLabel = { ko: "개", en: "", vi: "", ja: "件", zh: "条", hi: "", es: "" };
  const card = document.createElement("div");
  card.className = "offer-card";
  card.id = `offer-${offer.id}`;
  card.innerHTML = `
    <div class="offer-head">
      <div class="worker-av">${offer.worker_initial || "?"}</div>
      <div class="worker-info">
        <div class="worker-name">${escapeHtml(offer.worker_name)}</div>
        <div class="worker-rating">★ ${offer.rating || "4.8"} (${offer.review_count || 0}${reviewLabel[lang] || ""})</div>
        <div class="worker-meta">📍 ${offer.distance_km || "1.2"}km · ${escapeHtml(offer.vehicle || "차량")}</div>
      </div>
    </div>
    <div class="price-row">
      <span class="yours">${yoursLabel[lang] || yoursLabel.en} ${formatPrice(state.task.myOffer || 0, lang)}</span>
      <span class="arrow">→</span>
      <span class="theirs">${formatPrice(offer.counter_offer || 0, lang)}</span>
    </div>
    <div style="font-size:12px; color:#a1a1aa; margin-bottom:8px;">
      💬 "${escapeHtml(offer.message || "")}"
    </div>
    <div class="offer-actions">
      <button class="btn-accept" data-id="${offer.id}" data-act="accept">✓ 수락</button>
      <button class="btn-decline" data-id="${offer.id}" data-act="decline">✗ 거절</button>
    </div>
    <div class="counter-form">
      <input type="number" id="counter-${offer.id}" placeholder="역제안 금액 (₩)" />
      <button class="btn-secondary" data-id="${offer.id}" data-act="counter">↔ 역제안</button>
    </div>
  `;
  list.appendChild(card);
  const badge = document.getElementById("offer-count-badge");
  if (badge) badge.textContent = `받은 제안 ${state.offers.length}건`;
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.act === "accept") acceptThis(id);
  if (btn.dataset.act === "decline") declineThis(id);
  if (btn.dataset.act === "counter") counterThis(id);
});

window.acceptThis = function (offerId) {
  const el = document.getElementById(`offer-${offerId}`);
  if (el) {
    el.style.borderColor = "#14ebc0";
    el.style.background = "rgba(20, 235, 192, 0.05)";
    const others = document.querySelectorAll(`#offers-list .offer-card:not(#offer-${offerId})`);
    others.forEach((o) => (o.style.opacity = "0.4"));
  }
  const offer = state.offers.find((o) => String(o.id) === String(offerId));
  store.set({ acceptedOffer: offer || { id: offerId } });
  store.emit("offer:accepted", { offerId, offer });
  alert("✅ 매칭이 확정되었습니다! 워커가 곧 연락드립니다.");
};

window.declineThis = function (offerId) {
  const el = document.getElementById(`offer-${offerId}`);
  if (el) el.style.opacity = "0.3";
  store.emit("offer:declined", { offerId });
};

window.counterThis = function (offerId) {
  const val = parseInt(document.getElementById(`counter-${offerId}`)?.value, 10);
  if (!val || val < 10000) {
    alert("역제안 금액을 입력해주세요 (최소 10,000원).");
    return;
  }
  alert(`역제안을 보냈습니다: ₩${val.toLocaleString("ko-KR")}`);
  const el = document.getElementById(`offer-${offerId}`);
  if (el) el.style.borderColor = "#f59e0b";
  store.emit("offer:countered", { offerId, amount: val });
};

// === Demo: Simulate nearby workers offering ===
function simulateOffers(taskId) {
  const drivers = [
    { id: "drv-1-" + taskId, worker_initial: "이", worker_name: "이민우 프로", rating: "4.9", review_count: 84, distance_km: "1.2", vehicle: "1톤 트럭", counter_offer: Math.round((state.task.myOffer || 50000) * 1.05), message: "저희 트럭으로 안전하게 운송해드릴게요!" },
    { id: "drv-2-" + taskId, worker_initial: "박", worker_name: "박정훈 클린", rating: "4.8", review_count: 32, distance_km: "2.5", vehicle: "스타렉스", counter_offer: Math.round((state.task.myOffer || 50000) * 0.95), message: "주말 가능, 5년 경력입니다. 합리적으로 해드릴게요." },
    { id: "drv-3-" + taskId, worker_initial: "김", worker_name: "김지원", rating: "5.0", review_count: 156, distance_km: "0.8", vehicle: "라보", counter_offer: Math.round((state.task.myOffer || 50000) * 1.12), message: "평점 5.0 / 즉시 출동 가능" },
  ];
  drivers.forEach((d, i) => setTimeout(() => addOfferToUI(d), 1500 * (i + 1)));
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, '&#39;');
}

// Phase 4 fix: dynamic import via top-level await can delay module execution
// past DOMContentLoaded, so we must check the current readyState.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => renderCategories());
} else {
  renderCategories();
}


// Phase 5: When i18n.js changes the active language (via the language
// switcher or browser-detected first visit), re-render the category
// grid + form so translations and currency symbols update without a
// page reload.
window.addEventListener("golivewiki:langchange", () => {
  renderCategories();
  // Re-apply form labels for the currently selected category, if any.
  if (state.selectedCategory) selectCategory(state.selectedCategory);
});
