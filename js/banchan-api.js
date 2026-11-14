/**
 * golive.wiki — 반찬/치킨 예약 클라이언트 (2단계)
 *
 * 두 가지 모드:
 *  - "live"  : Supabase REST 로 공개 뷰(dish_offer_public)를 읽고,
 *              예약/취소는 RPC(banchan_create_preorder / banchan_cancel_preorder)만 호출한다.
 *  - "mock"  : DB 없이 UI 만 볼 때. 어떤 쓰기도 하지 않고 항상 실패를 돌려준다
 *              (성공처럼 보이는 더미 예약을 만들지 않기 위해서다).
 *
 * 보안 원칙 (플랜 6장)
 *  - 가격·통화·상태를 서버로 보내지 않는다. RPC 는 offer_id/qty/연락처만 받는다.
 *  - 실패하면 UI 는 절대 성공을 표시하지 않는다. 서버 오류 코드를 그대로 노출한다.
 *  - anon 키만 브라우저에 둔다. service_role 키는 절대 넣지 않는다.
 */
(() => {
  "use strict";

  const CONFIG = {
    // 배포 시 .env 로 주입: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
    supabaseUrl:
      (window.__ENV__ && window.__ENV__.SUPABASE_URL) ||
      document.querySelector('meta[name="supabase-url"]')?.content ||
      "",
    supabaseAnonKey:
      (window.__ENV__ && window.__ENV__.SUPABASE_ANON_KEY) ||
      document.querySelector('meta[name="supabase-anon-key"]')?.content ||
      "",
    // 이 값이 없으면 mock 모드. DB 없이 시안만 볼 때 자동으로 그렇게 된다.
    get mode() {
      return this.supabaseUrl && this.supabaseAnonKey ? "live" : "mock";
    },
  };

  // --- 서버 오류 → 사용자 문구 키 (UI 가 i18n 으로 번역) ---------------------
  const ERROR_KEYS = {
    AUTH_REQUIRED: "bn_err_auth",
    INVALID_QTY: "bn_err_qty",
    INVALID_CONTACT: "bn_err_contact",
    OFFER_NOT_FOUND: "bn_err_not_found",
    OFFER_NOT_AVAILABLE: "bn_err_unavailable",
    OFFER_CLOSED: "bn_err_closed",
    DEADLINE_PASSED: "bn_err_deadline",
    SOLD_OUT: "bn_err_soldout",
    ALREADY_RESERVED: "bn_err_already",
    PREORDER_NOT_FOUND: "bn_err_not_found",
    ALREADY_CANCELLED: "bn_err_already_cancelled",
    ALREADY_COLLECTED: "bn_err_collected",
    CANCEL_WINDOW_CLOSED: "bn_err_cancel_window",
    INVALID_STATE: "bn_err_state",
    NETWORK: "bn_err_network",
    MOCK_MODE: "bn_err_mock_mode",
  };

  class BookingError extends Error {
    constructor(code, detail) {
      super(code);
      this.code = code;
      this.detail = detail || "";
      this.key = ERROR_KEYS[code] || "bn_err_generic";
    }
  }

  // PostgREST 는 RAISE EXCEPTION 'SOLD_OUT: ...' 의 메시지를 그대로 준다.
  // 앞부분의 CODE 토큰을 뽑아 UI 가 정확한 이유를 보여주게 한다.
  function codeFromMessage(msg) {
    const m = String(msg || "").match(/^([A-Z][A-Z_]{2,})/);
    return m ? m[1] : "SERVER_ERROR";
  }

  function headers(extra) {
    return {
      apikey: CONFIG.supabaseAnonKey,
      Authorization: `Bearer ${CONFIG.supabaseAnonKey}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  async function rest(path, options = {}) {
    if (CONFIG.mode !== "live") throw new BookingError("MOCK_MODE");
    let res;
    try {
      res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${path}`, {
        ...options,
        headers: headers(options.headers),
      });
    } catch (e) {
      throw new BookingError("NETWORK", e.message);
    }
    if (!res.ok) {
      let body = "";
      try {
        body = await res.text();
      } catch {}
      throw new BookingError(codeFromMessage(body), body.slice(0, 300));
    }
    return res.status === 204 ? null : res.json();
  }

  const api = {
    mode: () => CONFIG.mode,
    BookingError,

    /** 공개 회차 목록. 금액은 최소단위 정수 그대로 온다. */
    async listOffers({ cityId, category } = {}) {
      const params = new URLSearchParams();
      params.set("select", "*");
      // 오늘 이후, 마감 전 회차만 (클라이언트 필터가 아니라 서버 조건)
      params.set("order_deadline", `gte.${new Date().toISOString()}`);
      if (category && category !== "all")
        params.set("category", `eq.${category}`);
      if (cityId) params.set("city_id", `eq.${cityId}`);
      // 품절(max 대비 예약 수량)은 reserved_qty 로 판단하고, 여기서는 마감 전 회차만 받는다.
      return rest(`dish_offer_public?${params}`);
    },

    /** 예약: RPC 만 호출. 가격은 서버가 스냅샷한다. */
    async createPreorder({ offerId, qty, contactMethod, contactValue }) {
      const rows = await rest("rpc/banchan_create_preorder", {
        method: "POST",
        body: JSON.stringify({
          p_offer_id: offerId,
          p_qty: qty,
          p_contact_method: contactMethod,
          p_contact_value: contactValue,
        }),
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw new BookingError("SERVER_ERROR", "empty rpc result");
      return row;
    },

    async cancelPreorder(preorderId) {
      const rows = await rest("rpc/banchan_cancel_preorder", {
        method: "POST",
        body: JSON.stringify({ p_preorder_id: preorderId }),
      });
      return Array.isArray(rows) ? rows[0] : rows;
    },

    /** 로그인 사용자의 예약 (RLS 로 본인 것만) */
    async listMyPreorders() {
      // 연락처 컬럼은 내 예약에서만 보인다(RLS: 본인 것만).
      return rest("banchan_preorders?select=*&order=created_at.desc");
    },

    /** 판매자는 예약 목록에서 연락처를 봐야 픽업 안내가 된다 (RLS 로 자기 가게만) */
    async listSellerOrders() {
      return rest("banchan_preorders?select=*&order=created_at.asc");
    },

    /** 판매자: 자기 가게 예약 */
    async listSellerPreorders() {
      return rest("banchan_preorders?select=*&order=created_at.asc");
    },

    async markCollected(preorderId) {
      const rows = await rest("rpc/banchan_mark_collected", {
        method: "POST",
        body: JSON.stringify({ p_preorder_id: preorderId }),
      });
      return Array.isArray(rows) ? rows[0] : rows;
    },
  };

  window.banchanApi = api;
  window.BanchanBookingError = BookingError;
})();
