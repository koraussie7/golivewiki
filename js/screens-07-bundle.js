/**
 * js/screens-07-bundle.js — Combined for non-module HTML loading.
 */
// === config.js ===
// js/config.js — Browser-safe Supabase config (no import.meta, no Node globals).
// Values are inlined for static-site use. For Vite dev mode, see original repo.
const SUPABASE_URL = "https://acxrgrzbukrvvfivysip.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjeHJncnpidWtydnZmaXZ5c2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNzY0MDAsImV4cCI6MjEwNzk1MjQwMH0.7xJLloYCQ19jshk3OsHDI0wb4EsYJDPyLn3Il3LmTAs";
const SUPABASE_SERVICE_ROLE_KEY = "";

// === data/categories.js ===
/**
 * golive.wiki Categories — Airtasker + Soomgo + inDrive style
 *
 * 15 most-requested service categories (한국 시장 기준 + 글로벌 인기)
 * Each category has icon (emoji for MVP), Korean + English names,
 * suggested price range, and a description.
 */
const CATEGORIES = [
  {
    id: 'moving',
    emoji: '🚚',
    ko: '이사 / 운반',
    en: 'Removalists / Moving',
    desc: '포장이사, 단기 이사, 용달, 매트리스 운반 등',
    avgPrice: '₩150,000',
    top: 1,
  },
  {
    id: 'cleaning',
    emoji: '🧹',
    ko: '가정 / 사무실 청소',
    en: 'House Cleaning',
    desc: '입주청소, 정기청소, 사무실 청소',
    avgPrice: '₩85,000',
    top: 1,
  },
  {
    id: 'handyperson',
    emoji: '🔧',
    ko: '핸디맨 / 간단수리',
    en: 'Handyperson',
    desc: '문/경첩 교체, 행거 설치, 조명 교체 등',
    avgPrice: '₩50,000',
    top: 1,
  },
  {
    id: 'gardening',
    emoji: '🌱',
    ko: '정원 / 잔디깎기',
    en: 'Gardening / Lawn Mowing',
    desc: '잔디 깎기, 나무 전지, 정원 정리',
    avgPrice: '₩70,000',
    top: 1,
  },
  {
    id: 'assembly',
    emoji: '🪑',
    ko: '가구 조립 (IKEA 등)',
    en: 'Furniture Assembly',
    desc: '이케아/한샇/시몬스 가구 조립',
    avgPrice: '₩50,000',
    top: 1,
  },
  {
    id: 'waste',
    emoji: '🗑️',
    ko: '폐기물 / 집짐 정리',
    en: 'Rubbish Removal',
    desc: '폐지/폐家具/스티로폼/비품 수거',
    avgPrice: '₩80,000',
    top: 2,
  },
  {
    id: 'painting',
    emoji: '🎨',
    ko: '페인팅 / 도장',
    en: 'Painting',
    desc: '실내/외부 벽면, 몰딩, 도장 작업',
    avgPrice: '₩200,000',
    top: 2,
  },
  {
    id: 'mechanic',
    emoji: '🚗',
    ko: '자동차 정비',
    en: 'Mechanic',
    desc: '엔진오일, 브레이크, 타이어, 경정비',
    avgPrice: '₩120,000',
    top: 2,
  },
  {
    id: 'delivery',
    emoji: '📦',
    ko: '픽업 / 배달',
    en: 'Pick-up & Delivery',
    desc: '물건 운반, 비대면 픽업/배달',
    avgPrice: '₩30,000',
    top: 2,
  },
  {
    id: 'plumbing',
    emoji: '🚰',
    ko: '배관 / 누수',
    en: 'Plumber',
    desc: '누수탐지, 배관 교체, 싱크대 수리',
    avgPrice: '₩90,000',
    top: 2,
  },
  {
    id: 'appliance',
    emoji: '🔌',
    ko: '가전 수리',
    en: 'Appliance Repair',
    desc: '세탁기, 냉장고, 에어컨, 식기세척기',
    avgPrice: '₩80,000',
    top: 3,
  },
  {
    id: 'computer',
    emoji: '💻',
    ko: '컴퓨터 / IT 수리',
    en: 'Computer Repair',
    desc: 'PC 조립, 데이터 복구, OS 설치',
    avgPrice: '₩70,000',
    top: 3,
  },
  {
    id: 'ac',
    emoji: '❄️',
    ko: '에어컨 설치/청소',
    en: 'Air Conditioning',
    desc: '에어컨 설치, 분해청소, 필터 교체',
    avgPrice: '₩100,000',
    top: 3,
  },
  {
    id: 'pets',
    emoji: '🐶',
    ko: '반려동물 돌봄',
    en: 'Pet Care',
    desc: '산책, 펫시팅, 반려동물 미용',
    avgPrice: '₩40,000',
    top: 3,
  },
  {
    id: 'tutor',
    emoji: '🎓',
    ko: '과외 / 레슨',
    en: 'Tutor / Lesson',
    desc: '외국어, 수학, 피아노, 골프 등',
    avgPrice: '₩50,000/hr',
    top: 2,
  },
  {
    id: 'fitness',
    emoji: '💪',
    ko: '퍼스널 트레이닝',
    en: 'Personal Training',
    desc: '1:1 PT, 홈트레이닝, 식단 코칭',
    avgPrice: '₩80,000/hr',
    top: 3,
  },
  {
    id: 'salon',
    emoji: '💇',
    ko: '미용 / 헤어',
    en: 'Hair & Beauty',
    desc: '커트, 염색, 네일, 홈에스테',
    avgPrice: '₩60,000',
    top: 3,
  },
  {
    id: 'car-detailing',
    emoji: '✨',
    ko: '차량 광택 / 디테일링',
    en: 'Car Detailing',
    desc: '외부 광택, 실내 클리닝, 스크래치 복구',
    avgPrice: '₩150,000',
    top: 3,
  },
];


// === api.js ===
// Supabase REST 클라이언트 (의존성 없는 순수 fetch 기반)

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function getTasks(category = null) {
  let url = `${SUPABASE_URL}/rest/v1/tasks?select=*&order=created_at.desc`;
  if (category) url += `&category=eq.${category}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`GET tasks failed: ${r.status}`);
  return r.json();
}

async function insertTask(task) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(task),
  });
  if (!r.ok) throw new Error(`INSERT task failed: ${r.status}`);
  return r.json();
}

async function getRides() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/rides?select=*&order=requested_at.desc`,
    { headers },
  );
  if (!r.ok) throw new Error(`GET rides failed: ${r.status}`);
  return r.json();
}

async function insertRide(ride) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rides`, {
    method: 'POST',
    headers,
    body: JSON.stringify(ride),
  });
  if (!r.ok) throw new Error(`INSERT ride failed: ${r.status}`);
  return r.json();
}

async function getNearbyDrivers(lat, lng, radiusM = 3000) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/nearby_drivers?lat=${lat}&lng=${lng}&radius_m=${radiusM}`,
    { headers },
  );
  if (!r.ok) throw new Error(`RPC nearby_drivers failed: ${r.status}`);
  return r.json();
}

async function insertActivityEvent(kind, payload, region) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/activity_events`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ kind, payload, region }),
  });
  if (!r.ok) throw new Error(`INSERT activity_event failed: ${r.status}`);
  return r.json();
}

// === supabase-client.js (stub) ===
const supabase = null;
const isStubMode = () => true;


// === services-app.js ===
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


// === Expose to window ===
if (typeof goStep !== 'undefined') window.goStep = goStep;
if (typeof selectCategory !== 'undefined') window.selectCategory = selectCategory;
if (typeof submitRequest !== 'undefined') window.submitRequest = submitRequest;
if (typeof counterThis !== 'undefined') window.counterThis = counterThis;
if (typeof acceptThis !== 'undefined') window.acceptThis = acceptThis;
if (typeof declineThis !== 'undefined') window.declineThis = declineThis;
if (typeof renderCategories !== 'undefined') window.renderCategories = renderCategories;
if (typeof CATEGORIES !== 'undefined') window.CATEGORIES = CATEGORIES;
if (typeof state !== 'undefined') window.state = state;
