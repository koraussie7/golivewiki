/**
 * js/services-app.js
 *
 * inDrive-style multi-category service request flow:
 *   1. Category grid (top-18 by request volume)
 *   2. Form (title, desc, location, when, my-offer slider)
 *   3. Counter-offer negotiation (multiple workers, accept/decline/counter)
 *
 * Uses js/api.js (fetch-based REST) for persistence. Realtime is simulated
 * with setTimeout; if @supabase/supabase-js is installed, Realtime channels
 * would replace the simulation.
 */
// === State ===
const state = {
  selectedCategory: null,
  task: {
    title: "",
    description: "",
    location: "",
    when: "today",
    myOffer: 50000,
    suggested: 85000,
    id: null,
  },
  offers: [],
};

// === Render: Step 1 (Category Grid) ===
function renderCategories() {
  const grid = document.getElementById("cat-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const topIds = CATEGORIES
    .filter((c) => c.top === 1)
    .slice(0, 3)
    .map((c) => c.id);

  for (const cat of CATEGORIES) {
    const card = document.createElement("div");
    card.className = "cat-card";
    card.dataset.id = cat.id;
    card.innerHTML = `
      ${topIds.includes(cat.id) ? '<div class="badge-top">🔥 인기 1위</div>' : ""}
      <div class="emoji">${cat.emoji}</div>
      <div class="name">${cat.ko}</div>
      <div class="desc">${cat.desc}</div>
      <div class="avg">평균 ${cat.avgPrice}</div>
    `;
    card.addEventListener("click", () => selectCategory(cat));
    grid.appendChild(card);
  }
}

// === Step transition ===
window.goStep = function (n) {
  document.querySelectorAll(".step").forEach((s) => s.classList.remove("active"));
  document.getElementById(`step-${n}`).classList.add("active");

  for (let i = 1; i <= 3; i++) {
    const pill = document.getElementById(`step-pill-${i}`);
    pill.classList.remove("active", "done");
    if (i < n) pill.classList.add("done");
    if (i === n) pill.classList.add("active");
  }
};

// === Step 2: Form fill ===
function selectCategory(cat) {
  state.selectedCategory = cat;

  const avg = parseInt(cat.avgPrice.replace(/[^0-9]/g, ""), 10) || 85000;
  state.task.suggested = avg;
  state.task.myOffer = Math.round(avg * 0.8);

  document.getElementById("form-cat-emoji").textContent = cat.emoji;
  document.getElementById("form-cat-name").textContent = cat.ko;

  document.getElementById("suggested-display").textContent =
    "₩" + avg.toLocaleString("ko-KR");
  document.getElementById("my-offer-display").textContent =
    "₩" + state.task.myOffer.toLocaleString("ko-KR");
  document.getElementById("slider-value").textContent =
    "₩" + state.task.myOffer.toLocaleString("ko-KR");
  document.getElementById("offer-slider").value = state.task.myOffer;
  document.getElementById("offer-slider").max = avg * 3;

  document.getElementById("task-title").value = "";
  document.getElementById("task-desc").value = "";
  document.getElementById("task-location").value = "";

  goStep(2);
}

// === Slider update ===
window.updateOffer = function (val) {
  state.task.myOffer = parseInt(val, 10);
  const formatted = "₩" + state.task.myOffer.toLocaleString("ko-KR");
  document.getElementById("my-offer-display").textContent = formatted;
  document.getElementById("slider-value").textContent = formatted;
};

// === Step 3: Submit request ===
window.submitRequest = async function () {
  state.task.title = document.getElementById("task-title").value.trim();
  state.task.description = document.getElementById("task-desc").value.trim();
  state.task.location = document.getElementById("task-location").value.trim();
  state.task.when = document.getElementById("task-when").value;

  if (!state.task.title) {
    alert("작업 제목을 입력해주세요.");
    return;
  }
  if (!state.task.location) {
    alert("작업 위치를 입력해주세요.");
    return;
  }

  goStep(3);
  document.getElementById("empty-state").style.display = "block";
  document.getElementById("offers-list").innerHTML = "";
  state.offers = [];

  try {
    // 1. Save request via REST API
    const result = await insertTask({
      category: state.selectedCategory.id,
      title: state.task.title,
      description: state.task.description,
      location_text: state.task.location,
      when_text: state.task.when,
      poster_offer: state.task.myOffer,
      suggested_price: state.task.suggested,
      status: "open",
    });

    state.task.id = (Array.isArray(result) ? result[0] : result)?.id || "local-" + Date.now();

    // 2. Subscribe to Realtime (if available) — otherwise simulate
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

    // 3. Simulate nearby workers responding (always — Realtime is additive)
    simulateOffers(state.task.id);
  } catch (e) {
    console.error("Submit failed:", e);
    alert("요청 저장 실패: " + e.message + "\n\n그래도 시뮬레이션은 진행합니다.");
    state.task.id = "local-" + Date.now();
    simulateOffers(state.task.id);
  }
};

// === Add offer to UI ===
function addOfferToUI(offer) {
  // Avoid duplicate
  if (state.offers.find((o) => o.id === offer.id)) return;
  state.offers.push(offer);
  document.getElementById("empty-state").style.display = "none";

  const list = document.getElementById("offers-list");
  const card = document.createElement("div");
  card.className = "offer-card";
  card.id = `offer-${offer.id}`;
  card.innerHTML = `
    <div class="offer-head">
      <div class="worker-av">${offer.worker_initial || "?"}</div>
      <div class="worker-info">
        <div class="worker-name">${escapeHtml(offer.worker_name)}</div>
        <div class="worker-rating">★ ${offer.rating || "4.8"} (${offer.review_count || 0}개)</div>
        <div class="worker-meta">📍 ${offer.distance_km || "1.2"}km · ${escapeHtml(offer.vehicle || "차량")}</div>
      </div>
    </div>
    <div class="price-row">
      <span class="yours">내 제안 ₩${(state.task.myOffer || 0).toLocaleString("ko-KR")}</span>
      <span class="arrow">→</span>
      <span class="theirs">₩${(offer.counter_offer || 0).toLocaleString("ko-KR")}</span>
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

  document.getElementById("offer-count-badge").textContent =
    `받은 제안 ${state.offers.length}건`;
}

// Event delegation for offer buttons
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.act === "accept") acceptThis(id);
  if (btn.dataset.act === "decline") declineThis(id);
  if (btn.dataset.act === "counter") counterThis(id);
});

window.acceptThis = function (offerId) {
  document.getElementById(`offer-${offerId}`).style.borderColor = "#14ebc0";
  document.getElementById(`offer-${offerId}`).style.background =
    "rgba(20, 235, 192, 0.05)";
  // Disable other buttons
  const others = document.querySelectorAll(`#offers-list .offer-card:not(#offer-${offerId})`);
  others.forEach((o) => (o.style.opacity = "0.4"));
  alert("✅ 매칭이 확정되었습니다! 워커가 곧 연락드립니다.");
};

window.declineThis = function (offerId) {
  const el = document.getElementById(`offer-${offerId}`);
  if (el) el.style.opacity = "0.3";
};

window.counterThis = function (offerId) {
  const val = parseInt(document.getElementById(`counter-${offerId}`).value, 10);
  if (!val || val < 10000) {
    alert("역제안 금액을 입력해주세요 (최소 10,000원).");
    return;
  }
  alert(`역제안을 보냈습니다: ₩${val.toLocaleString("ko-KR")}`);
  document.getElementById(`offer-${offerId}`).style.borderColor = "#f59e0b";
};

// === Demo: Simulate nearby drivers offering ===
function simulateOffers(taskId) {
  const drivers = [
    {
      id: "drv-1-" + taskId,
      worker_initial: "이",
      worker_name: "이민우 프로",
      rating: "4.9",
      review_count: 84,
      distance_km: "1.2",
      vehicle: "1톤 트럭",
      counter_offer: Math.round((state.task.myOffer || 50000) * 1.05),
      message: "저희 트럭으로 안전하게 운송해드릴게요!",
    },
    {
      id: "drv-2-" + taskId,
      worker_initial: "박",
      worker_name: "박정훈 클린",
      rating: "4.8",
      review_count: 32,
      distance_km: "2.5",
      vehicle: "스타렉스",
      counter_offer: Math.round((state.task.myOffer || 50000) * 0.95),
      message: "주말 가능, 5년 경력입니다. 합리적으로 해드릴게요.",
    },
    {
      id: "drv-3-" + taskId,
      worker_initial: "김",
      worker_name: "김지원",
      rating: "5.0",
      review_count: 156,
      distance_km: "0.8",
      vehicle: "라보",
      counter_offer: Math.round((state.task.myOffer || 50000) * 1.12),
      message: "평점 5.0 / 즉시 출동 가능",
    },
  ];

  drivers.forEach((d, i) =>
    setTimeout(() => addOfferToUI(d), 1500 * (i + 1))
  );
}

// === Utility ===
function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// === Init ===
document.addEventListener("DOMContentLoaded", () => {
  renderCategories();
});
