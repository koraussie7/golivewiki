/**
 * js/screens-07-bundle.js — Combined for non-module HTML loading.
 */
// === config.js ===
// js/config.js — Browser-safe Supabase config (no import.meta, no Node globals).
// Values are inlined for static-site use. For Vite dev mode, see original repo.
const SUPABASE_URL = "https://acxrgrzbukrvvfivysip.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjeHJncnpidWtydnZmaXZ5c2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNzY0MDAsImV4cCI6MjEwNzk1MjQwMH0.7xJLloYCQ19jshk3OsHDI0wb4EsYJDPyLn3Il3LmTAs";
// Reserved for server-side use only — never expose to browser. Kept as
// placeholder so config shape stays in sync with backend docs.
// eslint-disable-next-line no-unused-vars
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

// Public API helpers — exposed for console/debug + future pages.
// (window 연결이 없으면 no-unused-vars 경고가 발생하므로 명시적 노출)
Object.assign(window, {
  getTasks,
  getRides,
  insertRide,
  getNearbyDrivers,
  insertActivityEvent,
  isStubMode,
});


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

// === Render: Step 1 (inDrive-style category carousel) ===
function renderCategories() {
  const grid = document.getElementById("cat-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const selectedId = state.selectedCategory ? state.selectedCategory.id : null;

  for (const cat of CATEGORIES) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "cat-chip" + (cat.id === selectedId ? " selected" : "");
    chip.dataset.id = cat.id;
    chip.innerHTML = `
      <span class="chip-ico">${cat.emoji}</span>
      <span class="chip-name">${cat.ko}</span>
      <span class="chip-meta">${cat.avgPrice}</span>
    `;
    chip.addEventListener("click", () => selectCategory(cat));
    grid.appendChild(chip);
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

  // Map was hidden while on step 2/3 — re-init / refresh its size on return
  if (n === 1) {
    if (window._rideMap) {
      try { window._rideMap.invalidateSize(); } catch (e) { /* noop */ }
    } else {
      initRideMap();
    }
  }
};

// === Step 1 → select category (highlight only, stay on home) ===
function selectCategory(cat) {
  state.selectedCategory = cat;

  const avg = parseInt(cat.avgPrice.replace(/[^0-9]/g, ""), 10) || 85000;
  state.task.suggested = avg;
  state.task.myOffer = Math.round(avg * 0.8);

  // Update carousel highlight without re-rendering the whole list
  document.querySelectorAll("#cat-grid .cat-chip").forEach((chip) => {
    chip.classList.toggle("selected", chip.dataset.id === cat.id);
  });

  syncHomeFareUI();
}

// === inDrive-style home fare stepper ===
window.stepHomeFare = function (dir) {
  const step = 5000;
  const cur = state.task.myOffer || 50000;
  const next = Math.min(1000000, Math.max(10000, cur + dir * step));
  state.task.myOffer = next;
  syncHomeFareUI();
};

function fmtKRW(n) {
  return "₩" + Number(n || 0).toLocaleString("ko-KR");
}

function syncHomeFareUI() {
  const fareVal = document.getElementById("home-fare-val");
  if (fareVal) fareVal.textContent = fmtKRW(state.task.myOffer);
  const hint = document.getElementById("home-fare-hint");
  if (hint) hint.textContent = "추천 " + fmtKRW(state.task.suggested || 85000);
  const cta = document.getElementById("home-cta");
  if (cta) cta.textContent = `기사 찾기 · ${fmtKRW(state.task.myOffer)} 제안`;
  const sliderVal = document.getElementById("slider-value");
  if (sliderVal) sliderVal.textContent = fmtKRW(state.task.myOffer);
  const myOffer = document.getElementById("my-offer-display");
  if (myOffer) myOffer.textContent = fmtKRW(state.task.myOffer);
}

// === Step 1 → Step 2 (search bar / recent place / CTA) ===
window.proceedFromHome = function (presetLocation) {
  if (!state.selectedCategory) {
    selectCategory(CATEGORIES[0]);
  }
  const cat = state.selectedCategory;
  const avg = state.task.suggested;

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
  const homeFrom = document.getElementById("home-from");
  const homeTo = document.getElementById("home-to");
  const fromVal = presetLocation || (homeFrom ? homeFrom.value.trim() : "");
  document.getElementById("task-location").value = fromVal || "";
  if (homeTo && homeTo.value.trim()) {
    document.getElementById("task-desc").value = `목적지: ${homeTo.value.trim()}`;
  }

  goStep(2);
  if (presetLocation) {
    document.getElementById("task-title").focus();
  }
};

// === Step 1: Leaflet map (inDrive-style home) ===
window._rideMap = null;
window._pickupMarker = null;
window._tileLayer = null;

// Leaflet exposes `window.L` (1.9.x UMD). Use a helper — never bare `L`
// so VSCode/TS/Sonar no longer report `no-undef` (하단 4 에러 원인).
function getLeaflet() {
  if (typeof window !== 'undefined' && window.L) return window.L;
  if (typeof window !== 'undefined' && window.leaflet) return window.leaflet;
  if (typeof globalThis !== 'undefined' && globalThis.L) return globalThis.L;
  return null;
}

// Default center: Seoul Gangnam (used if geolocation denied)
const DEFAULT_CENTER = [37.5063, 127.0533];
const DEFAULT_ZOOM = 15;

// Tile providers in priority order — first one to load wins
const TILE_PROVIDERS = [
  {
    name: "OSM Standard",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    opts: { maxZoom: 19, attribution: "© OpenStreetMap contributors" },
  },
  {
    name: "CARTO Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    opts: { maxZoom: 19, subdomains: "abcd", attribution: "© OpenStreetMap © CARTO" },
  },
  {
    name: "CARTO Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    opts: { maxZoom: 19, subdomains: "abcd", attribution: "© OpenStreetMap © CARTO" },
  },
];

function showMapError(msg) {
  const el = document.getElementById("ride-map");
  if (!el) return;
  el.innerHTML = `
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#e9ebee;color:#52525b;font-size:13px;text-align:center;padding:16px;gap:8px;z-index:1000;">
      <div style="font-size:32px;">🗺️</div>
      <div style="font-weight:700;">지도를 불러올 수 없습니다</div>
      <div style="opacity:0.7;">${msg}</div>
      <button onclick="window.recenterMap()" style="margin-top:8px;padding:6px 14px;border:none;background:#18181b;color:#fff;border-radius:8px;font-weight:700;cursor:pointer;">다시 시도</button>
    </div>`;
}

function addNextTileProvider(idx, L_ref) {
  const L_global = L_ref || getLeaflet();
  if (!window._rideMap || !L_global) return;
  if (idx >= TILE_PROVIDERS.length) {
    showMapError("모든 지도 타일 서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.");
    return;
  }
  const p = TILE_PROVIDERS[idx];
  let loadCount = 0;
  let errorCount = 0;
  const layer = L_global.tileLayer(p.url, p.opts);
  layer.on("tileload", () => {
    loadCount++;
    // Once we have any tiles loaded from this provider, declare success
    if (loadCount >= 3) {
      window._tileLayer = layer;
      // Remove any error overlay
      const err = document.querySelector("#ride-map > div");
      if (err) err.remove();
    }
  });
  layer.on("tileerror", () => {
    errorCount++;
    // After 5 errors with no loads, give up and try next provider
    if (errorCount >= 5 && loadCount === 0) {
      try { window._rideMap.removeLayer(layer); } catch (layerErr) { console.debug('[ride-map] removeLayer ignore:', layerErr && layerErr.message); }
      addNextTileProvider(idx + 1, L_global);
    }
  });
  layer.addTo(window._rideMap);
}

function locateUser() {
  if (!navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeout);
        resolve([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        clearTimeout(timeout);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 3500, maximumAge: 60000 }
    );
  });
}

function setPickupMarker(latlng, L_ref) {
  const L_global = L_ref || getLeaflet();
  if (!window._rideMap || !L_global) return;
  if (!window._pickupMarker) {
    const icon = L_global.divIcon({
      className: "pickup-pin",
      html: '<div style="width:18px;height:18px;background:#22c55e;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    window._pickupMarker = L_global.marker(latlng, { icon }).addTo(window._rideMap);
  } else {
    window._pickupMarker.setLatLng(latlng);
  }
}

function initRideMap() {
  const el = document.getElementById("ride-map");
  if (!el) return;
  // Leaflet 1.9.x UMD exposes `window.L` (legacy `window.leaflet` fallback kept)
  const L_global = getLeaflet();
  if (!L_global) {
    showMapError("Leaflet 라이브러리가 로드되지 않았습니다. 네트워크 연결을 확인해 주세요.");
    return;
  }
  if (window._rideMap) {
    try { window._rideMap.invalidateSize(); } catch (e) { /* noop */ }
    return;
  }

  try {
    window._rideMap = L_global.map(el, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: true,
      tap: true,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    addNextTileProvider(0, L_global);

    // Resize after sheet layout settles
    setTimeout(() => { try { window._rideMap.invalidateSize(); } catch (sizeErr1) { console.debug('[ride-map] invalidateSize ignore:', sizeErr1 && sizeErr1.message); } }, 300);
    setTimeout(() => { try { window._rideMap.invalidateSize(); } catch (sizeErr2) { console.debug('[ride-map] invalidateSize ignore:', sizeErr2 && sizeErr2.message); } }, 1200);

    // Try geolocation; recenter if granted
    locateUser().then((loc) => {
      if (loc && window._rideMap) {
        window._rideMap.setView(loc, 15);
        setPickupMarker(loc, L_global);
        // Update pickup-card text if available
        const pickupText = document.querySelector(".pickup-card .pickup-label");
        if (pickupText) pickupText.textContent = "내 위치 (실제 GPS)";
      }
    });
  } catch (e) {
    console.warn("[ride-map] Leaflet init failed:", e);
    showMapError(e.message || String(e));
    window._rideMap = null;
  }
}

window.recenterMap = function () {
  // Re-attempt: remove error overlay, re-init
  const err = document.querySelector("#ride-map > div");
  if (err) err.remove();
  if (window._rideMap) {
    try { window._rideMap.remove(); } catch (rmErr) { console.debug('[ride-map] remove ignore:', rmErr && rmErr.message); }
    window._rideMap = null;
    window._pickupMarker = null;
  }
  initRideMap();
};

window.locateUserOnMap = function () {
  locateUser().then((loc) => {
    if (loc && window._rideMap) {
      window._rideMap.setView(loc, 16);
      setPickupMarker(loc);
    } else {
      alert("위치 정보를 가져올 수 없습니다. 브라우저 위치 권한을 허용해 주세요.");
    }
  });
};

// === Slider update ===
window.updateOffer = function (val) {
  state.task.myOffer = parseInt(val, 10);
  const formatted = "₩" + state.task.myOffer.toLocaleString("ko-KR");
  document.getElementById("my-offer-display").textContent = formatted;
  document.getElementById("slider-value").textContent = formatted;
  const fareVal = document.getElementById("home-fare-val");
  if (fareVal) fareVal.textContent = formatted;
  const cta = document.getElementById("home-cta");
  if (cta) cta.textContent = `기사 찾기 · ${formatted} 제안`;
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
    // 1. Save request via REST API (schema: tasks.region/timing/budget_krw)
    const result = await insertTask({
      category: state.selectedCategory.id,
      title: state.task.title,
      description: state.task.description,
      region: state.task.location,
      timing: state.task.when,
      budget_krw: state.task.myOffer,
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
    // RLS/anon policy may block INSERT — degrade gracefully to simulation
    console.warn("[tasks] INSERT skipped (RLS or network):", e.message);
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

// === AI Agent Panel (MuhanAI ↔ GoLive) ===
// Orchestrator: parse request → split into steps → assign 5 specialized agents
// Approval flow: AI proposes → User approves → Server executes (PaymentService)
//
// 5 agents (UI only, all run client-side as mock; production wires to MCP tools):
//   ① Personal      — understand request, user prefs, budget
//   ② Discovery     — search map / providers / tools
//   ③ Task          — execute (booking, quote, registration)
//   ④ Negotiation   — compare offers, relay counter-offers
//   ⑤ Verification  — verify credentials, completion proof, prevent double-billing

const AGENT_DEFS = [
  { id: "personal",     icon: "👤", key: "agent_role_personal" },
  { id: "discovery",    icon: "🗺️", key: "agent_role_discovery" },
  { id: "task",         icon: "⚙️", key: "agent_role_task" },
  { id: "negotiation",  icon: "💬", key: "agent_role_negotiation" },
  { id: "verification", icon: "🛡️", key: "agent_role_verification" },
];

// Plan templates by suggestion / keyword match
const PLAN_TEMPLATES = {
  vehicle: {
    title: "agent_plan_vehicle",
    steps: [
      { agent: "personal",     text: "agent_step_v1_personal",     status: "done" },
      { agent: "discovery",    text: "agent_step_v1_discovery",    status: "active" },
      { agent: "task",         text: "agent_step_v1_task",         status: "pending" },
      { agent: "negotiation",  text: "agent_step_v1_negotiation",  status: "pending" },
      { agent: "verification", text: "agent_step_v1_verification", status: "pending" },
    ],
  },
  repair: {
    title: "agent_plan_repair",
    steps: [
      { agent: "personal",     text: "agent_step_r1_personal",     status: "done" },
      { agent: "discovery",    text: "agent_step_r1_discovery",    status: "active" },
      { agent: "task",         text: "agent_step_r1_task",         status: "pending" },
      { agent: "negotiation",  text: "agent_step_r1_negotiation",  status: "pending" },
      { agent: "verification", text: "agent_step_r1_verification", status: "pending" },
    ],
  },
  purchase: {
    title: "agent_plan_purchase",
    steps: [
      { agent: "personal",     text: "agent_step_p1_personal",     status: "done" },
      { agent: "discovery",    text: "agent_step_p1_discovery",    status: "active" },
      { agent: "negotiation",  text: "agent_step_p1_negotiation",  status: "pending" },
      { agent: "task",         text: "agent_step_p1_task",         status: "pending" },
      { agent: "verification", text: "agent_step_p1_verification", status: "pending" },
    ],
  },
  ai_task: {
    title: "agent_plan_ai_task",
    steps: [
      { agent: "personal",     text: "agent_step_a1_personal",     status: "done" },
      { agent: "discovery",    text: "agent_step_a1_discovery",    status: "active" },
      { agent: "task",         text: "agent_step_a1_task",         status: "pending" },
      { agent: "verification", text: "agent_step_a1_verification", status: "pending" },
    ],
  },
  default: {
    title: "agent_plan_default",
    steps: [
      { agent: "personal",     text: "agent_step_d1_personal",     status: "done" },
      { agent: "discovery",    text: "agent_step_d1_discovery",    status: "active" },
      { agent: "negotiation",  text: "agent_step_d1_negotiation",  status: "pending" },
      { agent: "task",         text: "agent_step_d1_task",         status: "pending" },
      { agent: "verification", text: "agent_step_d1_verification", status: "pending" },
    ],
  },
};

function pickPlanType(text) {
  if (!text) return "default";
  const t = text.toLowerCase();
  if (/(\ucca8\uace0|\ucc28\ub7c5|\ud22c\uc5ec|\ub9e4\uc2e4|\uacf5\ud56d|\uc5d0\uc5b4\ud3ec\ud2b8|\uba54\ud2b8|\ub80c\ud130|\ud0dd\uc2dc|\uac00\uacbd|airport|cab|taxi|vehicle|car)/.test(t)) return "vehicle";
  if (/(\uc218\ub9ac|\ubaa9\uc218|\uc870\ub9bc|\uc124\uce58|\ubc29\uc218|\uac00\uc2a4|\uac90\uad6c|repair|handyman|fix|install)/.test(t)) return "repair";
  if (/(\uad6c\ub9e4|\ub300\ud589|\uc8fc\ubb38|\ubc31\ud654\uc810|purchase|buy|order|shopping|delivery)/.test(t)) return "purchase";
  if (/(\uc791\uc131|\uc791\uc131|\ubd88\ud14c\uc774|\uc790\ub3d9|\ud305|ai|automat|generate|write)/.test(t)) return "ai_task";
  return "default";
}

let _agentBusy = false;

window.agentSuggest = function (kind) {
  const input = document.getElementById("agent-input");
  if (!input) return;
  const text = {
    vehicle: "\ud55c\uad6c\uc5d0\uc11c \uacf5\ud56d\uae4c\uc9c0 \uac00\ub294 \ucc28\ub7c5\uc744 \ucc3e\uace0 \uac00\uc7a5 \ud569\ub824\ud55c \uac00\uaca9\uc744 \ube44\uad50\ud574\uc918.",
    repair: "\uc8fc\ubc29\uc218\uc218\uac00 \uc0bd\ud55c\ub370 \uc218\ub9ac \uc9c1\uc6d0\uc744 \ucc3e\uace0 \uac00\uaca9\uc744 \uc5c6\ub354\ub77c.",
    purchase: "\uc628\ub77c\uc778\uc5d0\uc11c \ud2b9\uc815 \uc81c\ud488\uc744 \uad6c\ub9e4\ud574\uc918. \uac00\uaca9 \ube44\uad50\ud574\uc11c \uac00\uc7a5 \uc2f6\uc740 \uacf5\uc0b0\uc73c\ub85c \uad6c\ub9e4\ud574\uc8fc\uc138\uc694.",
    ai_task: "AI\ub85c \uc6d0\ud558\ub294 \uc791\uc131\uc744 \uc790\ub3d9\ud654\ud574\uc8fc\uc138\uc694. \uc608: \ub9e4\uc77c \ubcf4\ub0b4\ub294 \uc774\uba54\uc77c \uc6d0\uad6c \uc791\uc131."
  }[kind] || "";
  input.value = text;
  input.focus();
};

window.agentSubmit = function () {
  if (_agentBusy) return;
  const input = document.getElementById("agent-input");
  const text = (input?.value || "").trim();
  if (!text) return;
  const planType = pickPlanType(text);
  agentShowPlan(planType, text);
};

window.agentShowPlan = function (planType, userText) {
  const plan = PLAN_TEMPLATES[planType] || PLAN_TEMPLATES.default;
  const planEl = document.getElementById("agent-plan");
  const stepsEl = document.getElementById("agent-plan-steps");
  const agentsEl = document.getElementById("agent-agents-row");
  if (!planEl || !stepsEl) return;

  // Helper: resolve i18n key using the current language dictionary
  const curLang = (window.localStorage && localStorage.getItem("golive_lang")) || "ko";
  const dict = (window.I18N_DICTIONARY && window.I18N_DICTIONARY[curLang]) || {};
  const t = (k) => dict[k] || k;

  // Render steps
  stepsEl.innerHTML = "";
  plan.steps.forEach((s, idx) => {
    const div = document.createElement("div");
    div.className = "agent-plan-step " + s.status;
    div.innerHTML = '<div class="step-icon">' + (idx + 1) + '</div><div>' + t(s.text) + '</div>';
    stepsEl.appendChild(div);
  });

  // Render agent pills (5 specialized agents)
  agentsEl.innerHTML = "";
  AGENT_DEFS.forEach((a) => {
    const stepWithAgent = plan.steps.find((s) => s.agent === a.id);
    const status = stepWithAgent ? stepWithAgent.status : "pending";
    const pill = document.createElement("div");
    pill.className = "agent-pill " + status;
    pill.dataset.agent = a.id;
    pill.innerHTML = '<span class="dot"></span><span>' + a.icon + " " + t(a.key) + "</span>";
    agentsEl.appendChild(pill);
  });

  // Replace the plan header text with the localized plan name
  const planTitleEl = planEl.querySelector(".agent-plan-title");
  if (!planTitleEl) {
    const hdr = planEl.querySelector(".agent-plan-header");
    if (hdr) {
      const titleSpan = document.createElement("div");
      titleSpan.className = "agent-plan-title";
      titleSpan.textContent = t(plan.title);
      hdr.appendChild(titleSpan);
    }
  } else {
    planTitleEl.textContent = t(plan.title);
  }

  planEl.classList.add("visible");

  // Lock input while plan is shown
  const submit = document.getElementById("agent-submit");
  if (submit) submit.disabled = true;
  _agentBusy = true;
};

window.agentApprove = function () {
  const planEl = document.getElementById("agent-plan");
  if (!planEl) return;

  // Animate plan steps from pending → active → done
  const steps = planEl.querySelectorAll(".agent-plan-step");
  let i = 0;
  const tick = () => {
    if (i >= steps.length) {
      // All done — show success
      stepsEl_done();
      return;
    }
    steps[i].classList.remove("pending", "active");
    steps[i].classList.add("done");
    steps[i].querySelector(".step-icon").textContent = "✓";
    // Update agent pill
    const agent = plan.steps[i]?.agent;
    if (agent) {
      // TODO: pills don't carry data-agent yet — highlight matching pill here.
      document.querySelector('#agent-agents-row .agent-pill[data-agent="' + agent + '"]');
    }
    i++;
    setTimeout(tick, 400);
  };
  tick();
};

function stepsEl_done() {
  const stepsEl = document.getElementById("agent-plan-steps");
  if (!stepsEl) return;
  const doneMsg = document.createElement("div");
  doneMsg.style.cssText = "margin-top:10px;padding:8px 10px;background:rgba(20,235,192,0.1);border:1px solid #14ebc0;border-radius:8px;font-size:11px;color:#14ebc0;font-weight:700;text-align:center;";
  doneMsg.textContent = "✓ " + (window.I18N_DICTIONARY?.agent_done || "실행 완료 · 결제는 사용자 승인 후에만 진행됩니다");
  stepsEl.appendChild(doneMsg);

  // Re-enable input
  setTimeout(() => {
    const submit = document.getElementById("agent-submit");
    if (submit) submit.disabled = false;
    _agentBusy = false;
  }, 800);
}

window.agentCancel = function () {
  const planEl = document.getElementById("agent-plan");
  if (planEl) planEl.classList.remove("visible");
  const submit = document.getElementById("agent-submit");
  if (submit) submit.disabled = false;
  _agentBusy = false;
};

window.initAgentPanel = function () {
  // Auto-expand on first load
  const panel = document.getElementById("agent-panel");
  if (panel) panel.classList.add("expanded");

  // Toggle expand/collapse on header click
  const header = panel?.querySelector(".agent-panel-header");
  if (header) {
    header.addEventListener("click", (e) => {
      // Avoid toggling when clicking on the input or buttons inside the body
      if (e.target.closest(".agent-body")) return;
      panel.classList.toggle("expanded");
    });
  }

  const submit = document.getElementById("agent-submit");
  if (submit) submit.addEventListener("click", window.agentSubmit);

  const input = document.getElementById("agent-input");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        window.agentSubmit();
      }
    });
  }

  // Suggestion chips
  document.querySelectorAll(".agent-suggestion").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.agentSuggest(btn.dataset.suggestion);
    });
  });

  // Approve / Cancel
  const approve = document.getElementById("agent-approve");
  if (approve) approve.addEventListener("click", window.agentApprove);
  const cancel = document.getElementById("agent-cancel");
  if (cancel) cancel.addEventListener("click", window.agentCancel);
};

// === Init ===
document.addEventListener("DOMContentLoaded", () => {
  renderCategories();
  initRideMap();
  initAgentPanel();
});


// === Expose to window ===
if (typeof goStep !== 'undefined') window.goStep = goStep;
if (typeof selectCategory !== 'undefined') window.selectCategory = selectCategory;
if (typeof submitRequest !== 'undefined') window.submitRequest = submitRequest;
if (typeof counterThis !== 'undefined') window.counterThis = counterThis;
if (typeof acceptThis !== 'undefined') window.acceptThis = acceptThis;
if (typeof declineThis !== 'undefined') window.declineThis = declineThis;
if (typeof renderCategories !== 'undefined') window.renderCategories = renderCategories;
if (typeof initRideMap !== 'undefined') window.initRideMap = initRideMap;
if (typeof initAgentPanel !== 'undefined') window.initAgentPanel = initAgentPanel;
if (typeof CATEGORIES !== 'undefined') window.CATEGORIES = CATEGORIES;
if (typeof state !== 'undefined') window.state = state;
// services-app.js 등 별도 classic script가 참조할 수 있도록 공개
if (typeof insertTask !== 'undefined') window.insertTask = insertTask;
