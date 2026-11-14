/**
 * golive.wiki — Banchan 글로벌 음식 네트워크 UI MOCK (Stage 1)
 *
 * ⚠️ PREVIEW ONLY / 플랜 1단계 시안
 * - 모든 가게·메뉴·가격·시간은 demo data 입니다. 실제 예약이 생성되지 않습니다.
 * - 네트워크 호출, supabase, localStorage/sessionStorage 저장을 하지 않습니다.
 * - 결제·선입금·배달 UI는 넣지 않습니다 (가게 수령 + 현장 결제만).
 *
 * 통합 대상 파일: golivewiki/banchan.html, golivewiki/js/banchan-mock.js
 * 의존: styles/tokens.css (CSS 변수), styles/i18n.js (data-i18n 치환).
 * 이 스크립트는 i18n.js보다 나중에 로드되며, 언어 변경 시 window.banchanMock.applyLang()을
 * 호출하면 data-i18n 값이 사전에서 없는 키도 다시 채워집니다.
 */
(() => {
  "use strict";

  // --- i18n (ko / en / vi). 스크립트 내에서 직접 렌더링하는 문구용. ---
  const STR = {
    ko: {
      bn_back_dashboard: "← 대시보드",
      bn_ui_mock: "UI 시안",
      bn_mock_notice:
        "<strong>예시 화면(더미 데이터):</strong> 이 페이지는 1단계 UI 시안입니다. 실제 예약이 생성되지 않고 결제·저장·판매자 전송도 없습니다. 가게·가격·시간은 모두 예시입니다.",
      bn_page_title: "반찬 공동구매 · 글로벌 손맛 지도",
      bn_country: "국가",
      bn_city: "도시",
      bn_view: "보기",
      bn_view_map: "지도",
      bn_view_feed: "숏폼",
      bn_geo: "위치",
      bn_geo_btn: "주변 찾기",
      bn_geo_idle:
        "위치 없이 국가·도시를 직접 선택할 수 있습니다. GPS는 “주변 찾기”를 눌렀을 때만 요청합니다.",
      bn_geo_ask: "브라우저 위치 권한을 요청했습니다.",
      bn_geo_denied:
        "위치 권한이 없습니다. 위에서 국가·도시를 직접 선택해 계속할 수 있습니다.",
      bn_geo_granted:
        "가까운 도시로 이동했습니다: {city}. 위치는 지도에 저장하지 않습니다.",
      bn_geo_unsupported:
        "이 브라우저는 위치를 지원하지 않습니다. 국가·도시를 직접 선택하세요.",
      bn_map_title: "도시별 지도",
      bn_map_sub: "승인 판매자 공개 영업장만 표시 (예시)",
      bn_feed_title: "숏폼 피드",
      bn_feed_sub: "9:16 세로 영상 카드 · 영상 재생만으로 예약되지 않음",
      bn_chicken_title: "오늘의 치킨",
      bn_chicken_sub: "판매자가 당일 등록한 메뉴만 · 매일 자동 판매 아님",
      bn_chicken_none: "이 도시에 오늘 등록된 치킨 메뉴가 없습니다.",
      bn_shops_title: "예약 가능한 가게",
      bn_shops_count: "가게 {n}곳 · 메뉴 {m}개 (예시)",
      bn_empty_title: "이 도시는 준비 중입니다",
      bn_empty_body:
        "승인된 판매자가 아직 없습니다. 가짜 가게나 실시간 주문 수로 채우지 않습니다.",
      bn_close: "닫기",
      bn_qty: "수량",
      bn_pickup: "픽업 시간",
      bn_confirm: "예약하기",
      bn_contact: "픽업 연락처",
      bn_contact_note: "픽업 안내에만 쓰고 지도·공개 목록에 노출하지 않습니다.",
      bn_booking_sending: "예약 요청 중…",
      bn_booking_ok: "예약 완료 · 예약 번호 {code}. 매장에서 수령 시 결제합니다.",
      bn_cancel_ok: "예약을 취소했습니다. 매장에 알려 주세요.",
      bn_collected_ok: "수령·현장 결제를 기록했습니다.",
      bn_loading: "불러오는 중…",
      bn_no_orders: "표시할 예약이 없습니다.",
      bn_cancel_order: "예약 취소",
      bn_mark_collected: "수령 · 결제 기록",
      bn_st_pending: "목표 대기",
      bn_st_confirmed: "확정",
      bn_st_collected: "수령 완료",
      bn_st_cancelled: "취소",
      bn_st_no_show: "노쇼",
      bn_pay_unpaid: "미결제",
      bn_pay_paid: "결제 완료",
      bn_err_auth: "로그인이 필요합니다.",
      bn_err_qty: "수량을 확인해 주세요.",
      bn_err_contact: "연락처를 3자 이상 입력해 주세요.",
      bn_err_not_found: "예약을 찾을 수 없습니다.",
      bn_err_unavailable: "지금은 예약할 수 없는 메뉴입니다.",
      bn_err_closed: "마감된 메뉴입니다.",
      bn_err_deadline: "예약 마감 시간이 지났습니다.",
      bn_err_soldout: "남은 수량이 부족합니다. 수량을 줄여 보세요.",
      bn_err_already: "이 메뉴는 이미 예약했습니다.",
      bn_err_already_cancelled: "이미 취소된 예약입니다.",
      bn_err_collected: "이미 수령한 예약입니다.",
      bn_err_cancel_window: "취소 가능 시간이 지났습니다. 매장에 문의하세요.",
      bn_err_state: "지금 상태에서는 처리할 수 없습니다.",
      bn_err_network: "네트워크 오류입니다. 연결을 확인하고 다시 시도하세요.",
      bn_err_mock_mode: "개발 DB에 연결되지 않아 예약을 저장할 수 없습니다. (UI 시안 모드)",
      bn_err_generic: "예약하지 못했습니다. 잠시 후 다시 시도하세요.",
      bn_pay_note:
        "온라인 결제·선입금 없음. 가게에서 수령 시 현장 결제합니다. 이 화면은 시안이며 예약이 저장되지 않습니다.",
      bn_cat_all: "전체",
      bn_cat_banchan: "반찬",
      bn_cat_chicken: "치킨",
      bn_cat_dessert: "디저트",
      bn_view_detail: "상세 보기",
      bn_group_badge: "공동구매 {n}개 목표",
      bn_progress: "{cur}/{goal}개 참여",
      bn_goal_reached: "목표 달성 · 확정",
      bn_goal_short: "{n}개 부족 → 미달 시 취소 안내",
      bn_lang: "언어",
      bn_instant: "즉시 확정",
      bn_sold_out: "품절",
      bn_closed: "마감",
      bn_video_tap: "영상 카드(예시) · 재생 기능 없음",
      bn_poster_only: "포스터로 표시 · 메뉴는 정상 접근 가능",
      bn_demo_store: "DEMO 가게",
      bn_shop: "가게",
      bn_city_label: "도시",
      bn_price: "가격",
      bn_structure: "구성·분량",
      bn_allergen: "알레르기",
      bn_pickup_place: "픽업 장소",
      bn_cancel_policy: "취소 조건",
      bn_deadline: "예약 마감",
      bn_stock: "잔여 {n}개",
      bn_cancel_until: "픽업 2시간 전까지 취소 가능(예시)",
      bn_actual_pay:
        "가게에서 수령할 때 현장 결제합니다(예시). 온라인 결제는 이번 범위가 아닙니다.",
      bn_mock_confirm:
        "시안 확인: 실제 예약이 생성되지 않았습니다. 결제·저장·판매자 전송 없음.",
      bn_min_order: "최소 {n}개",
      bn_local_date: "현지 날짜 {d} ({tz})",
      bn_map_pins: "{n}곳 표시",
      bn_select_pin: "지도의 핀을 선택하면 가게 정보가 표시됩니다.",
      bn_disclaimer:
        "가격·가게·시간은 예시이며 실제 판매 조건이 아닙니다. 판매 자격·위생·법규 확인 전에는 실제 거래를 열지 않습니다.",
      bn_video_play: "재생",
      bn_video_pause: "일시정지",
      bn_video_mute: "음소거",
      bn_video_unmute: "음소거 해제",
      bn_video_loading: "영상 로딩 중…",
      bn_video_failed: "영상을 불러올 수 없습니다. 포스터로 표시합니다.",
      bn_video_caption: "자막",
      bn_feed_one_play: "현재 영상만 재생 중",
    },
    en: {
      bn_back_dashboard: "← Dashboard",
      bn_ui_mock: "UI mock",
      bn_mock_notice:
        "<strong>Demo screen (dummy data):</strong> Stage 1 UI mock. No reservation is created; nothing is paid, saved or sent to a seller. Shops, prices and times are examples.",
      bn_page_title: "Banchan group buy · Global flavour map",
      bn_country: "Country",
      bn_city: "City",
      bn_view: "View",
      bn_view_map: "Map",
      bn_view_feed: "Shorts",
      bn_geo: "Location",
      bn_geo_btn: "Near me",
      bn_geo_idle:
        "Pick a country and city without sharing location. GPS is only requested when you tap “Near me”.",
      bn_geo_ask: "Requesting browser location permission.",
      bn_geo_denied:
        "Location denied. Choose a country and city above to continue.",
      bn_geo_granted:
        "Moved to the nearest city: {city}. Your location is not stored on the map.",
      bn_geo_unsupported:
        "This browser has no location support. Pick a city manually.",
      bn_map_title: "City map",
      bn_map_sub: "Approved sellers' public locations only (sample)",
      bn_feed_title: "Vertical shorts feed",
      bn_feed_sub: "9:16 cards · watching a video never creates a reservation",
      bn_chicken_title: "Today's chicken",
      bn_chicken_sub:
        "Only menus the seller listed for today · never auto-sold daily",
      bn_chicken_none: "No chicken menu listed for today in this city.",
      bn_shops_title: "Shops you can pre-order from",
      bn_shops_count: "{n} shops · {m} menus (sample)",
      bn_empty_title: "This city is coming soon",
      bn_empty_body:
        "No approved sellers yet. We do not fill empty screens with fake shops or live order counters.",
      bn_close: "Close",
      bn_qty: "Quantity",
      bn_pickup: "Pickup time",
      bn_confirm: "Book",
      bn_contact: "Pickup contact",
      bn_contact_note: "Used only to arrange pickup. Never shown on the map or in public lists.",
      bn_booking_sending: "Sending reservation…",
      bn_booking_ok: "Reserved · code {code}. Pay at the shop on pickup.",
      bn_cancel_ok: "Reservation cancelled. Please let the shop know.",
      bn_collected_ok: "Recorded pickup and in-store payment.",
      bn_loading: "Loading…",
      bn_no_orders: "No reservations to show.",
      bn_cancel_order: "Cancel reservation",
      bn_mark_collected: "Record pickup · payment",
      bn_st_pending: "Awaiting goal",
      bn_st_confirmed: "Confirmed",
      bn_st_collected: "Collected",
      bn_st_cancelled: "Cancelled",
      bn_st_no_show: "No show",
      bn_pay_unpaid: "Unpaid",
      bn_pay_paid: "Paid",
      bn_err_auth: "Please log in.",
      bn_err_qty: "Check the quantity.",
      bn_err_contact: "Enter a contact of at least 3 characters.",
      bn_err_not_found: "Reservation not found.",
      bn_err_unavailable: "This menu cannot be reserved right now.",
      bn_err_closed: "This menu is closed.",
      bn_err_deadline: "The order deadline has passed.",
      bn_err_soldout: "Not enough left. Try a smaller quantity.",
      bn_err_already: "You already reserved this menu.",
      bn_err_already_cancelled: "This reservation is already cancelled.",
      bn_err_collected: "This reservation was already collected.",
      bn_err_cancel_window: "The cancellation window has closed. Contact the shop.",
      bn_err_state: "This action is not allowed in the current state.",
      bn_err_network: "Network error. Check your connection and retry.",
      bn_err_mock_mode: "No dev database connected, so nothing can be saved. (UI mock mode)",
      bn_err_generic: "Could not reserve. Please try again.",
      bn_pay_note:
        "No online payment or deposit. Pay at the shop when you pick up. This screen is a mock and saves nothing.",
      bn_cat_all: "All",
      bn_cat_banchan: "Banchan",
      bn_cat_chicken: "Chicken",
      bn_cat_dessert: "Dessert",
      bn_view_detail: "View details",
      bn_group_badge: "Group buy goal {n}",
      bn_progress: "{cur}/{goal} reserved",
      bn_goal_reached: "Goal met · confirmed",
      bn_goal_short: "{n} short → cancelled if unmet",
      bn_lang: "Language",
      bn_instant: "Instant confirm",
      bn_sold_out: "Sold out",
      bn_closed: "Closed",
      bn_video_tap: "Video card (sample) · playback disabled",
      bn_poster_only: "Poster shown · menu still accessible",
      bn_demo_store: "DEMO shop",
      bn_shop: "Shop",
      bn_city_label: "City",
      bn_price: "Price",
      bn_structure: "Contents",
      bn_allergen: "Allergens",
      bn_pickup_place: "Pickup place",
      bn_cancel_policy: "Cancellation",
      bn_deadline: "Order deadline",
      bn_stock: "{n} left",
      bn_cancel_until: "Cancel until 2h before pickup (sample)",
      bn_actual_pay:
        "Pay at the shop on pickup (sample). Online payment is out of scope for this stage.",
      bn_mock_confirm:
        "Mock only: no reservation was created. Nothing was paid, saved or sent.",
      bn_min_order: "Min {n}",
      bn_local_date: "Local date {d} ({tz})",
      bn_map_pins: "{n} pins",
      bn_select_pin: "Select a pin to see the shop details.",
      bn_disclaimer:
        "Prices, shops and times are examples, not real offers. No real trade opens before seller eligibility, hygiene and legal checks.",
      bn_video_play: "Play",
      bn_video_pause: "Pause",
      bn_video_mute: "Mute",
      bn_video_unmute: "Unmute",
      bn_video_loading: "Loading video…",
      bn_video_failed: "Cannot load video. Showing poster instead.",
      bn_video_caption: "Captions",
      bn_feed_one_play: "Only current video plays",
    },
    vi: {
      bn_back_dashboard: "← Bảng điều khiển",
      bn_ui_mock: "Bản mẫu UI",
      bn_mock_notice:
        "<strong>Màn hình mẫu (dữ liệu giả):</strong> Bản xem trước bước 1. Không tạo đơn đặt trước, không thanh toán, không lưu, không gửi cho người bán. Cửa hàng, giá và giờ đều là ví dụ.",
      bn_page_title: "Mua chung banchan · Bản đồ hương vị toàn cầu",
      bn_country: "Quốc gia",
      bn_city: "Thành phố",
      bn_view: "Chế độ",
      bn_view_map: "Bản đồ",
      bn_view_feed: "Video ngắn",
      bn_geo: "Vị trí",
      bn_geo_btn: "Gần tôi",
      bn_geo_idle:
        "Có thể chọn quốc gia và thành phố mà không cần vị trí. GPS chỉ được hỏi khi bạn bấm “Gần tôi”.",
      bn_geo_ask: "Đang xin quyền vị trí của trình duyệt.",
      bn_geo_denied:
        "Không có quyền vị trí. Hãy chọn quốc gia và thành phố ở trên để tiếp tục.",
      bn_geo_granted:
        "Đã chuyển đến thành phố gần nhất: {city}. Vị trí của bạn không được lưu trên bản đồ.",
      bn_geo_unsupported:
        "Trình duyệt không hỗ trợ vị trí. Hãy chọn thành phố thủ công.",
      bn_map_title: "Bản đồ theo thành phố",
      bn_map_sub: "Chỉ hiện địa điểm công khai của người bán đã duyệt (mẫu)",
      bn_feed_title: "Bảng tin video dọc",
      bn_feed_sub: "Thẻ 9:16 · xem video không tạo đơn đặt trước",
      bn_chicken_title: "Gà hôm nay",
      bn_chicken_sub:
        "Chỉ món người bán đăng cho hôm nay · không tự động bán hằng ngày",
      bn_chicken_none: "Thành phố này hôm nay chưa có món gà nào được đăng.",
      bn_shops_title: "Cửa hàng có thể đặt trước",
      bn_shops_count: "{n} cửa hàng · {m} món (mẫu)",
      bn_empty_title: "Thành phố này đang chuẩn bị",
      bn_empty_body:
        "Chưa có người bán được duyệt. Chúng tôi không lấp màn hình trống bằng cửa hàng giả hay số đơn giả.",
      bn_close: "Đóng",
      bn_qty: "Số lượng",
      bn_pickup: "Giờ nhận",
      bn_confirm: "Đặt trước",
      bn_contact: "Liên hệ nhận hàng",
      bn_contact_note: "Chỉ dùng để hẹn giờ nhận. Không hiện trên bản đồ hay danh sách công khai.",
      bn_booking_sending: "Đang gửi yêu cầu…",
      bn_booking_ok: "Đã đặt · mã {code}. Thanh toán tại cửa hàng khi nhận.",
      bn_cancel_ok: "Đã huỷ đặt trước. Hãy báo cho cửa hàng.",
      bn_collected_ok: "Đã ghi nhận nhận hàng và thanh toán tại cửa hàng.",
      bn_loading: "Đang tải…",
      bn_no_orders: "Chưa có đơn đặt trước nào.",
      bn_cancel_order: "Huỷ đặt trước",
      bn_mark_collected: "Ghi nhận nhận hàng · thanh toán",
      bn_st_pending: "Chờ đủ mục tiêu",
      bn_st_confirmed: "Đã xác nhận",
      bn_st_collected: "Đã nhận",
      bn_st_cancelled: "Đã huỷ",
      bn_st_no_show: "Không đến",
      bn_pay_unpaid: "Chưa thanh toán",
      bn_pay_paid: "Đã thanh toán",
      bn_err_auth: "Vui lòng đăng nhập.",
      bn_err_qty: "Kiểm tra lại số lượng.",
      bn_err_contact: "Nhập liên hệ ít nhất 3 ký tự.",
      bn_err_not_found: "Không tìm thấy đơn đặt trước.",
      bn_err_unavailable: "Món này hiện không thể đặt trước.",
      bn_err_closed: "Món này đã đóng.",
      bn_err_deadline: "Đã quá hạn đặt trước.",
      bn_err_soldout: "Không đủ số lượng còn lại. Hãy giảm số lượng.",
      bn_err_already: "Bạn đã đặt trước món này.",
      bn_err_already_cancelled: "Đơn này đã bị huỷ.",
      bn_err_collected: "Đơn này đã được nhận.",
      bn_err_cancel_window: "Đã quá thời gian cho phép huỷ. Hãy liên hệ cửa hàng.",
      bn_err_state: "Không thể thực hiện ở trạng thái hiện tại.",
      bn_err_network: "Lỗi mạng. Kiểm tra kết nối và thử lại.",
      bn_err_mock_mode: "Chưa kết nối DB phát triển nên không lưu được. (Chế độ bản mẫu)",
      bn_err_generic: "Không đặt được. Vui lòng thử lại.",
      bn_pay_note:
        "Không thanh toán trực tuyến, không đặt cọc. Thanh toán tại cửa hàng khi nhận. Màn hình này là bản mẫu và không lưu gì.",
      bn_cat_all: "Tất cả",
      bn_cat_banchan: "Banchan",
      bn_cat_chicken: "Gà",
      bn_cat_dessert: "Tráng miệng",
      bn_view_detail: "Xem chi tiết",
      bn_group_badge: "Mua chung mục tiêu {n}",
      bn_progress: "Đã đặt {cur}/{goal}",
      bn_goal_reached: "Đủ mục tiêu · xác nhận",
      bn_goal_short: "Thiếu {n} → huỷ nếu không đủ",
      bn_lang: "Ngôn ngữ",
      bn_instant: "Xác nhận ngay",
      bn_sold_out: "Hết hàng",
      bn_closed: "Đã đóng",
      bn_video_tap: "Thẻ video (mẫu) · không phát",
      bn_poster_only: "Hiện ảnh bìa · vẫn xem được món",
      bn_demo_store: "Cửa hàng DEMO",
      bn_shop: "Cửa hàng",
      bn_city_label: "Thành phố",
      bn_price: "Giá",
      bn_structure: "Thành phần",
      bn_allergen: "Dị ứng",
      bn_pickup_place: "Nơi nhận",
      bn_cancel_policy: "Điều kiện huỷ",
      bn_deadline: "Hạn đặt",
      bn_stock: "Còn {n}",
      bn_cancel_until: "Huỷ trước giờ nhận 2 giờ (mẫu)",
      bn_actual_pay:
        "Thanh toán tại cửa hàng khi nhận (mẫu). Thanh toán trực tuyến ngoài phạm vi bước này.",
      bn_mock_confirm:
        "Chỉ là bản mẫu: chưa tạo đơn đặt trước. Không thanh toán, lưu hay gửi gì.",
      bn_min_order: "Tối thiểu {n}",
      bn_local_date: "Ngày địa phương {d} ({tz})",
      bn_map_pins: "{n} địa điểm",
      bn_select_pin: "Chọn một điểm trên bản đồ để xem thông tin cửa hàng.",
      bn_disclaimer:
        "Giá, cửa hàng và giờ là ví dụ, không phải điều kiện bán thật. Chưa mở giao dịch thật trước khi kiểm tra giấy phép, vệ sinh và pháp luật.",
      bn_video_play: "Phát",
      bn_video_pause: "Tạm dừng",
      bn_video_mute: "Tắt âm",
      bn_video_unmute: "Bật âm",
      bn_video_loading: "Đang tải video…",
      bn_video_failed: "Không thể tải video. Hiện ảnh bìa thay thế.",
      bn_video_caption: "Phụ đề",
      bn_feed_one_play: "Chỉ phát video hiện tại",
    },
  };

  const SUPPORTED = ["ko", "en", "vi"];
  const getLang = () => {
    const l = (() => {
      try {
        return localStorage.getItem("golive_lang");
      } catch {
        return null;
      }
    })();
    return SUPPORTED.includes(l) ? l : "ko";
  };
  const t = (key, vars) => {
    const dict = STR[getLang()] || STR.ko;
    let s = dict[key] ?? STR.ko[key] ?? key;
    // replaceAll 은 구형 WebView에서 없음 → split/join 사용 (Vite target es2018과 동일)
    if (vars)
      for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };

  // --- demo data (명시적 예시). id는 실제 DB PK가 아님. 서버 저장 없음. ---
  const CITIES = [
    {
      id: "seoul-gangnam",
      country: "KR",
      tz: "Asia/Seoul",
      name: { ko: "서울 강남구", en: "Seoul Gangnam", vi: "Seoul Gangnam" },
      lat: 37.5,
      lng: 127.036,
    },
    {
      id: "hanoi-caugiay",
      country: "VN",
      tz: "Asia/Ho_Chi_Minh",
      name: {
        ko: "하노이 카우저이",
        en: "Hanoi Cau Giay",
        vi: "Hà Nội Cầu Giấy",
      },
      lat: 21.031,
      lng: 105.801,
    },
    {
      id: "tokyo-shinjuku",
      country: "JP",
      tz: "Asia/Tokyo",
      name: { ko: "도쿄 신주쿠", en: "Tokyo Shinjuku", vi: "Tokyo Shinjuku" },
      lat: 35.694,
      lng: 139.703,
    },
    {
      id: "sydney-cbd",
      country: "AU",
      tz: "Australia/Sydney",
      name: { ko: "시드니 CBD", en: "Sydney CBD", vi: "Sydney CBD" },
      lat: -33.869,
      lng: 151.207,
    },
  ];
  const COUNTRIES = [
    { code: "KR", name: { ko: "대한민국", en: "South Korea", vi: "Hàn Quốc" } },
    { code: "VN", name: { ko: "베트남", en: "Vietnam", vi: "Việt Nam" } },
    { code: "JP", name: { ko: "일본", en: "Japan", vi: "Nhật Bản" } },
    { code: "AU", name: { ko: "호주", en: "Australia", vi: "Úc" } },
  ];

  // money: { minor: 통화 최소단위 정수, exp: 소수 자릿수 } — 플랜 5장
  const SHOPS = [
    {
      id: "demo-s1",
      cityId: "seoul-gangnam",
      name: "데모 한상 반찬",
      emoji: "🥘",
      lat: 37.508,
      lng: 127.042,
      currency: "KRW",
      exp: 0,
      dishes: [
        {
          id: "demo-d1",
          cat: "banchan",
          name: {
            ko: "정성 반찬 4종 세트",
            en: "4-side-dish banchan set",
            vi: "Set banchan 4 món",
          },
          emoji: "🍱",
          minor: 18000,
          goal: 15,
          cur: 11,
          deadline: "18:00",
          pickup: ["토요일 10:00–12:00", "토요일 16:00–18:00"],
          pickupPlace: "역삼역 2번 출구 앞 상가 1층",
          structure: {
            ko: "4종 · 1인 2~3인분",
            en: "4 sides · serves 2–3",
            vi: "4 món · 2–3 người",
          },
          allergens: {
            ko: "대두, 참깨",
            en: "Soy, sesame",
            vi: "Đậu nành, mè",
          },
          stock: 4,
          status: "open",
          menuDefined: true,
        },
        {
          id: "demo-d2",
          cat: "chicken",
          name: {
            ko: "오늘의 양념치킨 (1마리)",
            en: "Today's yangnyeom chicken (whole)",
            vi: "Gà sốt cay hôm nay (cả con)",
          },
          emoji: "🍗",
          minor: 23000,
          goal: null,
          cur: 0,
          deadline: "17:00",
          pickup: ["토요일 17:00–19:00"],
          pickupPlace: "역삼역 2번 출구 앞 상가 1층",
          structure: {
            ko: "후라이드 1마리 + 양념 소스",
            en: "Whole fried chicken + sauce",
            vi: "Gà rán cả con + sốt",
          },
          allergens: {
            ko: "닭고기, 계란, 대두, 밀",
            en: "Chicken, egg, soy, wheat",
            vi: "Gà, trứng, đậu nành, lúa mì",
          },
          stock: 6,
          status: "open",
          menuDefined: true,
          chickenToday: true,
        },
        {
          id: "demo-d3",
          cat: "banchan",
          name: {
            ko: "김치 1kg (주말 한정)",
            en: "Kimchi 1kg (weekend only)",
            vi: "Kimchi 1kg (cuối tuần)",
          },
          emoji: "🥬",
          minor: 12000,
          goal: null,
          cur: 0,
          deadline: "15:00",
          pickup: ["토요일 16:00–18:00"],
          pickupPlace: "역삼역 2번 출구 앞 상가 1층",
          structure: { ko: "1kg", en: "1kg", vi: "1kg" },
          allergens: {
            ko: "새우젓 함유 가능",
            en: "May contain salted shrimp",
            vi: "Có thể chứa tép mặn",
          },
          stock: 0,
          status: "soldout",
          menuDefined: true,
        },
      ],
    },
    {
      id: "demo-s2",
      cityId: "seoul-gangnam",
      name: "데모 분식집",
      emoji: "🍢",
      lat: 37.492,
      lng: 127.030,
      currency: "KRW",
      exp: 0,
      dishes: [
        {
          id: "demo-d4",
          cat: "chicken",
          name: {
            ko: "오늘의 치킨 (간장 1마리)",
            en: "Today's soy-garlic chicken (whole)",
            vi: "Gà sốt tỏi nành hôm nay (cả con)",
          },
          emoji: "🍗",
          minor: 21000,
          goal: 10,
          cur: 10,
          deadline: "19:00",
          pickup: ["토요일 19:00–21:00"],
          pickupPlace: "선릉역 1번 출구 편의점 앞",
          structure: {
            ko: "간장 치킨 1마리",
            en: "Whole soy-garlic chicken",
            vi: "Gà sốt tỏi nành cả con",
          },
          allergens: {
            ko: "닭고기, 대두, 밀",
            en: "Chicken, soy, wheat",
            vi: "Gà, đậu nành, lúa mì",
          },
          stock: 2,
          status: "open",
          menuDefined: true,
          chickenToday: true,
        },
        {
          id: "demo-d5",
          cat: "banchan",
          name: {
            ko: "어묵 꼬치 10개",
            en: "Fish cake skewers x10",
            vi: "Xiên chả cá 10 cái",
          },
          emoji: "🍥",
          minor: 9000,
          goal: null,
          cur: 0,
          deadline: "15:30",
          pickup: ["토요일 17:00–19:00"],
          pickupPlace: "선릉역 1번 출구 편의점 앞",
          structure: { ko: "10개", en: "10 pieces", vi: "10 cái" },
          allergens: { ko: "생선, 밀", en: "Fish, wheat", vi: "Cá, lúa mì" },
          stock: 8,
          status: "closed",
          menuDefined: true,
        },
      ],
    },
    {
      id: "demo-s3",
      cityId: "hanoi-caugiay",
      name: "Demo Bếp Cô Lan",
      emoji: "🍚",
      lat: 21.036,
      lng: 105.806,
      currency: "VND",
      exp: 0,
      dishes: [
        {
          id: "demo-d6",
          cat: "banchan",
          name: {
            ko: "베트남식 돼지고기 반찬 세트",
            en: "Vietnamese pork sides set",
            vi: "Set món thịt kho trứng",
          },
          emoji: "🥘",
          minor: 95000,
          goal: 12,
          cur: 5,
          deadline: "11:00",
          pickup: ["Chủ nhật 11:30–13:00"],
          pickupPlace: "Cầu Giấy, gần chợ Nghĩa Tân",
          structure: {
            ko: "3종 · 2인분",
            en: "3 dishes · serves 2",
            vi: "3 món · 2 người",
          },
          allergens: { ko: "생선 소스", en: "Fish sauce", vi: "Nước mắm" },
          stock: 7,
          status: "open",
          menuDefined: true,
        },
        {
          id: "demo-d7",
          cat: "dessert",
          name: {
            ko: "치è ngọt 3색",
            en: "Che ba mau (sweet soup)",
            vi: "Chè ba màu",
          },
          emoji: "🍧",
          minor: 25000,
          goal: null,
          cur: 0,
          deadline: "13:00",
          pickup: ["Chủ nhật 14:00–16:00"],
          pickupPlace: "Cầu Giấy, gần chợ Nghĩa Tân",
          structure: { ko: "1컵", en: "1 cup", vi: "1 ly" },
          allergens: {
            ko: "코코넛, 땅콩",
            en: "Coconut, peanut",
            vi: "Dừa, đậu phộng",
          },
          stock: 20,
          status: "open",
          menuDefined: true,
        },
      ],
    },
    {
      id: "demo-s4",
      cityId: "tokyo-shinjuku",
      name: "(예시) おかず工房",
      emoji: "🍙",
      lat: 35.699,
      lng: 139.708,
      currency: "JPY",
      exp: 0,
      dishes: [],
      menuUndefined: true,
    },
    {
      id: "demo-s5",
      cityId: "sydney-cbd",
      name: null,
      emoji: "⬜",
      currency: "AUD",
      dishes: [],
      empty: true,
    },
  ];

  // --- demo video cards (4단계: 실제 <video> 기반 숏폼) ---
  // dish_videos 테이블과 연동: 승인된 영상만 공개, 미승인은 비노출
  const DISH_VIDEOS = [
    {
      id: "vid-1",
      dish_id: "demo-d1",
      seller_id: "demo-s1",
      storage_path: "videos/demo-s1-d1.mp4",
      poster_path: "posters/demo-s1-d1.jpg",
      caption: "정성 반찬 4종 세트 — 오늘만 한정 수량",
      duration_seconds: 20,
      moderation_status: "approved",
    },
    {
      id: "vid-2",
      dish_id: "demo-d2",
      seller_id: "demo-s1",
      storage_path: "videos/demo-s1-d2.mp4",
      poster_path: "posters/demo-s1-d2.jpg",
      caption: "오늘의 양념치킨 (1마리) — 저녁 픽업 가능",
      duration_seconds: 25,
      moderation_status: "approved",
    },
    {
      id: "vid-3",
      dish_id: "demo-d4",
      seller_id: "demo-s2",
      storage_path: "videos/demo-s2-d4.mp4",
      poster_path: "posters/demo-s2-d4.jpg",
      caption: "오늘의 치킨 (간장 1마리) — 매콤달콤",
      duration_seconds: 18,
      moderation_status: "approved",
    },
    {
      id: "vid-4",
      dish_id: "demo-d6",
      seller_id: "demo-s3",
      storage_path: "videos/demo-s3-d6.mp4",
      poster_path: "posters/demo-s3-d6.jpg",
      caption: "베트남식 돼지고기 반찬 세트 — 쌀국수와 함께",
      duration_seconds: 22,
      moderation_status: "approved",
    },
    {
      id: "vid-5",
      dish_id: "demo-d7",
      seller_id: "demo-s3",
      storage_path: "videos/demo-s3-d7.mp4",
      poster_path: "posters/demo-s3-d7.jpg",
      caption: "chè ba màu (달콤 수프) — 검수 대기 중",
      duration_seconds: 15,
      moderation_status: "pending",
    },
  ];

  const videoByDish = {};
  for (const v of DISH_VIDEOS) {
    if (!videoByDish[v.dish_id]) videoByDish[v.dish_id] = [];
    videoByDish[v.dish_id].push(v);
  }

  // 영상·포스터는 비공개 버킷 경로다("videos/…", "posters/…").
  // 공개 URL 로 바꿔 주는 설정이 없으면 파일이 없으므로 <video> 를 달면 안 된다.
  // (4단계 완료 조건: 느린 네트워크·로드 실패 시에도 메뉴·예약 접근 가능)
  function assetUrl(path) {
    if (!path) return "";
    const env = window.__ENV__ || {};
    const base = env.ASSET_BASE_URL || document.body?.dataset.assetBase || "";
    if (!base) return ""; // 설정 전에는 포스터 카드로 대체
    return String(base).replace(/\/$/, "") + "/" + String(path).replace(/^\//, "");
  }

  const CATEGORIES = [
    { id: "all", label: "bn_cat_all" },
    { id: "banchan", label: "bn_cat_banchan" },
    { id: "chicken", label: "bn_cat_chicken" },
    { id: "dessert", label: "bn_cat_dessert" },
  ];

  // --- state ---
  const state = {
    countryCode: "KR",
    cityId: "seoul-gangnam",
    mode: "map",
    cat: "all",
    activeShopId: null,
    dialogDish: null,
    qty: 1,
    geo: "idle",
    geoCity: null,
    // live(DB) 모드에서만 쓰는 값들
    dbCityId: null,     // cities.id (demo id 와 다름: 서버에서 확인)
    liveOffers: null,   // dish_offer_public 결과. 있으면 demo 대신 이걸 그린다
    lastBooking: null,
  };

  const $ = (id) => document.getElementById(id);
  const cityById = (id) => CITIES.find((c) => c.id === id);
  const text = (v) =>
    typeof v === "string" ? v : (v[getLang()] ?? v.ko ?? "");
  const fmtMoney = (minor, currency, exp) => {
    try {
      return new Intl.NumberFormat(getLang(), {
        style: "currency",
        currency,
        minimumFractionDigits: exp,
      }).format(minor / 10 ** exp);
    } catch {
      return `${minor} ${currency}`;
    }
  };
  const localDate = (tz) => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      return "—";
    }
  };
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  // --- i18n hooks for static markup ---
  function syncStaticI18n() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (STR.ko[key]) el.innerHTML = t(key);
    });
    document.documentElement.lang = getLang();
    document.querySelectorAll("[data-local-date]").forEach((el) => {
      const city = cityById(state.cityId);
      el.textContent = t("bn_local_date", {
        d: localDate(city.tz),
        tz: city.tz,
      });
    });
  }

  // --- rendering ---
  function renderCountries() {
    const sel = $("countrySel");
    sel.innerHTML = COUNTRIES.map(
      (c) => `<option value="${esc(c.code)}">${esc(text(c.name))}</option>`,
    ).join("");
    sel.value = state.countryCode;
  }
  function renderCities() {
    const sel = $("citySel");
    const list = CITIES.filter((c) => c.country === state.countryCode);
    sel.innerHTML = list
      .map((c) => {
        const count = SHOPS.filter((s) => s.cityId === c.id && !s.empty).length;
        const tag = count ? ` (${count})` : ` · ${t("bn_empty_title")}`;
        return `<option value="${esc(c.id)}">${esc(text(c.name))}${esc(tag)}</option>`;
      })
      .join("");
    sel.value = state.cityId;
    sel.disabled = list.length === 0;
  }
  function renderChips() {
    $("chips").innerHTML = CATEGORIES.map(
      (c) =>
        `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${state.cat === c.id}">${esc(t(c.label))}</button>`,
    ).join("");
  }
  function visibleDishes() {
    return SHOPS.filter((s) => s.cityId === state.cityId && !s.empty).flatMap(
      (s) =>
        s.dishes
          .filter((d) => state.cat === "all" || d.cat === state.cat)
          .map((d) => ({ shop: s, dish: d })),
    );
  }
  function statusBadge(d) {
    if (d.status === "soldout")
      return `<span class="badge soldout">${esc(t("bn_sold_out"))}</span>`;
    if (d.status === "closed")
      return `<span class="badge closed">${esc(t("bn_closed"))}</span>`;
    // 목표 달성은 상태와 수량을 별도 배지로 분리한다 (한 줄에 붙이면 읽을 수 없다)
    if (d.goal && d.cur >= d.goal)
      return (
        `<span class="badge progress goal-reached">${esc(t("bn_goal_reached"))}</span>` +
        `<span class="badge goal-count">${esc(t("bn_progress", { cur: d.cur, goal: d.goal }))}</span>`
      );
    if (d.goal)
      return `<span class="badge progress">${esc(t("bn_progress", { cur: d.cur, goal: d.goal }))}</span>`;
    return `<span class="badge progress">${esc(t("bn_instant"))}</span>`;
  }
  function cardActions(d) {
    if (d.status === "soldout" || d.status === "closed") {
      return `<div class="actions"><span class="state">${esc(t(d.status === "soldout" ? "bn_sold_out" : "bn_closed"))}</span></div>`;
    }
    return `<div class="actions"><button type="button" class="btn btn-primary" data-open="${esc(d.id)}">${esc(t("bn_view_detail"))}</button></div>`;
  }
  function dishCard(shop, d, withPoster) {
    const stock =
      d.stock > 0
        ? `<span class="pickup">${esc(t("bn_stock", { n: d.stock }))}</span>`
        : "";
    const poster = withPoster
      ? `<div class="thumb"><span class="poster-label">${esc(t("bn_poster_only"))}</span><span class="emoji" aria-hidden="true">${d.emoji}</span><span class="muted-ico" title="${esc(t("bn_video_tap"))}" aria-hidden="true">🔇</span></div>`
      : "";
    return `<article class="card" data-dish="${esc(d.id)}">
      ${poster}
      <div class="body">
        <p class="shop">${esc(text(shop.name))} · ${esc(text(cityById(shop.cityId).name))}</p>
        <h3 class="menu">${esc(text(d.name))}</h3>
        <div class="row">
          <span class="price">${esc(fmtMoney(d.minor, shop.currency, shop.exp))}</span>
          <span class="pickup">⏱ ${esc(d.pickup[0])}</span>
        </div>
        <div class="badges">${statusBadge(d)}${stock}</div>
        ${d.goal ? `<p class="goal-note">${esc(t("bn_group_badge", { n: d.goal }))}${d.cur < d.goal ? ` · ${esc(t("bn_goal_short", { n: d.goal - d.cur }))}` : ""}</p>` : ""}
        ${cardActions(d)}
      </div>
    </article>`;
  }

  // --- Leaflet 지도 (3단계, 지연 로딩) ---
  //
  // 플래그가 꺼져 있으면(기본) 지도를 부르지 않고 로컬 좌표 미리보기로 그린다.
  // 지도 로딩이 실패해도(차단·오프라인·SRI 불일치) 같은 미리보기로 되돌아간다.
  // 즉 지도가 없어도 도시 선택·메뉴·예약은 계속 동작해야 한다 (플랜 3단계 완료 조건).
  let leafletMap = null;
  let leafletReady = false; // 로드 완료 후 true
  let leafletFailed = false;
  const leafletMarkers = [];

  function mapProvider() {
    try {
      return window.__mapCfg ? window.__mapCfg().provider : "none";
    } catch {
      return "none";
    }
  }

  // 지도 로딩을 시도한다. 결과와 무관하게 resolve (실패는 조용히 미리보기 유지).
  function ensureLeaflet() {
    if (leafletReady || leafletFailed) return Promise.resolve(leafletReady);
    if (mapProvider() === "none") return Promise.resolve(false);
    if (typeof window.__loadLeaflet !== "function") return Promise.resolve(false);
    return window
      .__loadLeaflet()
      .then(() => {
        leafletReady = true;
        return true;
      })
      .catch((err) => {
        leafletFailed = true;
        // 사용자에게는 조용히 미리보기로 대체되지만, 원인은 남긴다.
        console.warn("[banchan] 지도를 불러오지 못해 미리보기로 표시합니다:", err.message);
        return false;
      });
  }

  // 지도 제공자별 고지 문구. 잘못된/누락된 고지는 이용약관 위반이므로 제공자에 묶어 둔다.
  function tileAttribution(cfg) {
    const osm =
      '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
    if (cfg.provider === "maptiler" || /maptiler\.com/.test(cfg.tileUrl || "")) {
      return (
        '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a> © ' +
        osm
      );
    }
    if (cfg.provider === "osm") return '© ' + osm;
    return osm;
  }

  function initLeafletMap() {
    if (leafletMap || !leafletReady || typeof L === "undefined") return;
    const city = cityById(state.cityId);
    leafletMap = L.map("map", {
      zoomControl: true,
      attributionControl: true,
      tap: false,
    }).setView([city.lat, city.lng], 13);

    // 운영 제공자를 확정하기 전에는 공개 타일을 기본값으로 두지 않는다.
    // TILE_URL 이 없으면 지도를 그리지 않고 로컬 미리보기를 유지한다.
    const cfg = window.__mapCfg ? window.__mapCfg() : {};
    if (!cfg.tileUrl) {
      leafletFailed = true;
      leafletReady = false;
      leafletMap.remove();
      leafletMap = null;
      console.warn(
        "[banchan] TILE_URL 이 설정되지 않아 지도를 끄고 미리보기로 표시합니다.",
      );
      return;
    }
    // 타일 서버가 거부해도(키 만료·무효·도메인 제한) Leaflet 은 지도를 "정상"으로
    // 본다. 실제로 무효 키에서 오류 타일이 지도 배경으로 깔리고 핀만 떠 있는
    // 깨진 화면을 확인했다. → 아래 probeTiles 로 미리 검증하고 실패하면 지도를 내린다.
    const layer = L.tileLayer(cfg.tileUrl, {
      maxZoom: 19,
      // 고지는 제공자에 따라 다르다. MapTiler 타일을 쓰면서 OSM 만 적으면 약관 위반이다.
      attribution: tileAttribution(cfg),
    });
    // 지도에는 아직 타일 레이어를 붙이지 않는다. 먼저 검증하고 성공했을 때만 붙인다.
    // (붙이면 오류 그림이 화면에 깔린 뒤에야 내릴 수 있다)

    // 왜 tileerror 가 아니라 fetch 인가:
    // MapTiler 는 거부 시에도 403 + 실제 PNG(512x512 "Invalid key" 그림)를 준다.
    // 브라우저는 이미지 로드에 성공했다고 판단하므로 Leaflet 은 tileerror 를
    // 올리지 않고 normal tile-loaded 클래스만 붙인다. 즉 오류 그림이 지도 배경으로
    // 깔린다. 유일하게 믿을 수 있는 신호는 HTTP 상태 코드이므로 직접 확인한다.
    probeTiles(cfg, layer, city);
  }

  // 대표 타일 1장을 fetch 로 받아 상태 코드·내용으로 지도 가용성을 판정한다.
  async function probeTiles(cfg, layer, city) {
    const zoom = 13;
    const { x, y } = lngLatToTile(city.lng, city.lat, zoom);
    const url = cfg.tileUrl
      .replace("{z}", zoom)
      .replace("{x}", x)
      .replace("{y}", y)
      .replace("{s}", "a");
    try {
      const res = await fetch(url, { mode: "cors", cache: "no-store" });
      if (!res.ok) {
        disableLeaflet(`타일 서버가 ${res.status} 응답 (키 만료·무효·도메인 제한 의심)`);
        return;
      }
      // 200 이어도 MapTiler 는 오류를 그림으로 그려 보낸다. 오류 PNG 는 10KB 안팍이고
      // 정상 타일은 훨씬 크다. 크기로 한번 더 거른다(작은 해상도 바다 타일 오탐 방지로 2KB 미만만).
      const blob = await res.blob();
      if (blob.size < 2048) {
        disableLeaflet(`타일 응답이 비정상적으로 작음(${blob.size}B) — 오류 타일 의심`);
        return;
      }
      // 검증 통과: 이제서야 타일 레이어를 붙인다
      if (layer && leafletMap && !leafletFailed) layer.addTo(leafletMap);
    } catch (err) {
      // 검증 불가(CORS 미허용 등)여도 지도는 보여준다 — 기능을 과도하게 막지 않는다
      if (layer && leafletMap && !leafletFailed) layer.addTo(leafletMap);
      // CORS·오프라인 등. 지도는 띄우되 원인은 남긴다.
      console.warn("[banchan] 타일 사전검증 실패(CORS/오프라인 가능):", err.message);
    }
  }

  // 경도/위도 -> 타일 좌표 (Web Mercator)
  function lngLatToTile(lng, lat, z) {
    const n = Math.pow(2, z);
    const x = Math.floor(((lng + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
    );
    return { x, y };
  }

  // 지도를 내리고 로컬 미리보기로 되돌린다. 남은 Leaflet DOM 은 renderMap 에서 치운다.
  function disableLeaflet(reason) {
    if (leafletFailed && !leafletMap) return;
    leafletFailed = true;
    leafletReady = false;
    console.warn("[banchan] 지도를 끄고 미리보기로 표시합니다 —", reason);
    if (leafletMap) {
      try {
        leafletMap.remove();
      } catch (_e) {
        /* 이미 제거됨 */
      }
      leafletMap = null;
    }
    leafletMarkers.length = 0;
    renderMap();
  }

  function renderMap() {
    const mapEl = $("map");
    const city = cityById(state.cityId);
    const shops = SHOPS.filter((s) => s.cityId === state.cityId && !s.empty);

    if (leafletReady && typeof L !== "undefined") {
      if (!leafletMap) initLeafletMap();
      if (leafletMap) {
        leafletMarkers.forEach((m) => leafletMap.removeLayer(m));
        leafletMarkers.length = 0;
        // 지도가 그려지면 로컬 미리보기 핀은 지운다
        [...mapEl.querySelectorAll(".marker")].forEach((n) => n.remove());
        mapEl.classList.add("is-leaflet");
      }
    } else {
      [...mapEl.querySelectorAll(".marker")].forEach((n) => n.remove());
      mapEl.classList.remove("is-leaflet");
      // 지도를 끄거나 실패했으면 Leaflet 이 남긴 컨테이너 클래스/타일을 지운다
      if (leafletFailed && !leafletMap && typeof L !== "undefined") {
        mapEl.classList.remove(
          "leaflet-container",
          "leaflet-touch",
          "leaflet-fade-anim",
          "leaflet-grab",
          "leaflet-touch-drag",
          "leaflet-touch-zoom",
        );
        mapEl
          .querySelectorAll(".leaflet-pane, .leaflet-control-container")
          .forEach((n) => n.remove());
      }
    }

    $("mapEmpty").hidden = shops.length > 0;
    $("mapInfo").hidden = true;

    mapEl.setAttribute(
      "aria-label",
      `${text(city.name)} · ${t("bn_map_pins", { n: shops.length })} · ${t("bn_select_pin")}`,
    );

    shops.forEach((s) => {
      if (s.menuUndefined) return;
      if (leafletReady && leafletMap && typeof s.lat === "number") {
        const marker = L.marker([s.lat, s.lng], {
          title: text(s.name),
          alt: text(s.name),
        }).addTo(leafletMap);
        marker.on("click", () => {
          state.activeShopId = s.id;
          renderMap();
        });
        if (state.activeShopId === s.id) {
          marker.openPopup();
        }
        marker.bindPopup(
          `<strong>${esc(text(s.name))}</strong><br>${esc(
            text(cityById(s.cityId).name),
          )}<br>${esc(
            t("bn_shops_count", { n: 1, m: s.dishes.length }),
          )}`,
          { direction: "top", offset: [0, -10] },
        );
        leafletMarkers.push(marker);
      } else if (!leafletReady) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "marker";
        // x/y 는 예전 수동 좌표다. 지금 데이터는 lat/lng 만 가지므로
        // 도시 중심 기준 상대 위치로 계산한다. 폴백 50% 를 쓰면 모든 핀이
        // 한 점에 겹쳐 가게 하나만 보이게 된다.
        const pos = previewPosition(city, s);
        b.style.left = `${pos.x}%`;
        b.style.top = `${pos.y}%`;
        b.setAttribute("aria-pressed", String(state.activeShopId === s.id));
        b.setAttribute("data-shop", s.id);
        b.innerHTML = `<span class="pin" aria-hidden="true">${s.emoji}</span><span class="tag">${esc(text(s.name))}</span>`;
        mapEl.appendChild(b);
      }
    });

    // 가게 위치에 지도를 맞춘다.
    // 도시 중심 고정(setView 13)만 쓰면 화면이 납작할 때(가로 1048 × 세로 280)
    // 핀이 한쪽에 몰리고 지도의 절반이 빈 공간이 된다. → 마커 전체가 들어오게 맞춘다.
    if (leafletReady && leafletMap && leafletMarkers.length > 0) {
      fitShops(city);
    }

    if (state.activeShopId) showMapInfo(state.activeShopId);
  }

  // 마커가 여럿이면 전체가 보이도록, 하나뿐이면 너무 확대되지 않게 제한해서 맞춘다.
  function fitShops(city) {
    try {
      if (leafletMarkers.length === 1) {
        leafletMap.setView(leafletMarkers[0].getLatLng(), 15, { animate: false });
        return;
      }
      const bounds = L.latLngBounds(leafletMarkers.map((m) => m.getLatLng()));
      leafletMap.fitBounds(bounds, {
        padding: [36, 36],
        maxZoom: 16,
        animate: false,
      });
    } catch (_e) {
      // 경계 계산이 실패해도 지도는 도시 중심으로라도 보여준다
      leafletMap.setView([city.lat, city.lng], 13, { animate: false });
    }
  }

  // 좌표 없이 그리는 미리보기 지도용 위치 계산.
  // 도시 중심 대비 위경도 차이를 화면 비율로 바꾸되, 화면 가장자리에 붙지 않게 10~90% 로 압축한다.
  const PREVIEW_SPAN_DEG = 0.06; // 중심에서 ±0.03도 ≈ 3km 정도를 화면에 담는다
  function previewPosition(city, shop) {
    if (typeof shop.x === "number" && typeof shop.y === "number") {
      return { x: shop.x, y: shop.y };
    }
    if (typeof shop.lat !== "number" || typeof shop.lng !== "number") {
      return { x: 50, y: 50 };
    }
    const clampPct = (v) => Math.max(10, Math.min(90, 50 + v * 40));
    const dx = (shop.lng - city.lng) / PREVIEW_SPAN_DEG;
    // 위도는 북쪽이 위이므로 y 를 뒤집는다
    const dy = -(shop.lat - city.lat) / PREVIEW_SPAN_DEG;
    return { x: clampPct(dx), y: clampPct(dy) };
  }

  function showMapInfo(shopId) {
    const s = SHOPS.find((x) => x.id === shopId);
    const info = $("mapInfo");
    if (!s) return;
    state.activeShopId = shopId;
    const menus = s.dishes.length;
    info.innerHTML = `
      <span class="ph" aria-hidden="true">${s.emoji}</span>
      <div class="grow">
        <p class="name">${esc(text(s.name))} <span class="badge">${esc(t("bn_demo_store"))}</span></p>
        <p class="meta">${esc(text(cityById(s.cityId).name))} · ${esc(t("bn_shops_count", { n: 1, m: menus }))}</p>
      </div>`;
    info.hidden = false;
  }

  // --- 4단계 숏폼: 실제 <video> 기반 피드 ---
  let activeVideoEl = null; // 현재 재생 중인 영상 하나만

  function renderFeed() {
    const list = visibleDishes();
    const feed = $("feed");
    if (!list.length) {
      feed.innerHTML = `<div class="empty"><p class="big">${esc(t("bn_empty_title"))}</p><p>${esc(t("bn_empty_body"))}</p></div>`;
      return;
    }
    feed.innerHTML = list.map(({ shop, dish }) => {
      const videos = (videoByDish[dish.id] || []).filter(
        (v) => v.moderation_status === "approved",
      );
      const candidate = videos[0]; // dish 당 승인 영상 1개만 표시
      // 공개 URL 을 만들 수 없으면 영상 대신 포스터 카드 (승인 안 된 영상은 위에서 이미 제외)
      const videoSrc = candidate ? assetUrl(candidate.storage_path) : "";
      const video = videoSrc ? candidate : null;
      const hasVideo = Boolean(video);
      const stock =
        dish.stock > 0
          ? `<span class="pickup">${esc(t("bn_stock", { n: dish.stock }))}</span>`
          : "";
      return `<article class="feed-card ${hasVideo ? "has-video" : "poster-only"}" data-dish="${esc(dish.id)}">
        ${hasVideo
          ? `<div class="video-wrapper">
              <video
                class="feed-video"
                preload="metadata"
                poster="${esc(assetUrl(video.poster_path))}"
                muted
                playsinline
                data-src="${esc(videoSrc)}"
                data-duration="${esc(video.duration_seconds)}"
                aria-label="${esc(text(dish.name))} ${t("bn_video_caption")}"
              >
                ${t("bn_video_failed")}
              </video>
              <button class="btn-play" type="button" aria-label="${t("bn_video_play")}" data-action="toggle-play">▶</button>
              <button class="btn-mute" type="button" aria-label="${t("bn_video_mute")}" data-action="toggle-mute">🔊</button>
              <div class="video-caption">${esc(video.caption)}</div>
              <div class="video-duration">${video.duration_seconds}초</div>
            </div>`
          : `<div class="video-wrapper poster-placeholder">
              <span class="poster-label">${esc(t("bn_poster_only"))}</span>
              <span class="emoji" aria-hidden="true">${dish.emoji}</span>
            </div>`}
        <div class="feed-body">
          <p class="shop">${esc(text(shop.name))} · ${esc(text(cityById(shop.cityId).name))}</p>
          <h3 class="menu">${esc(text(dish.name))}</h3>
          <div class="row">
            <span class="price">${esc(fmtMoney(dish.minor, shop.currency, shop.exp))}</span>
            <span class="pickup">⏱ ${esc(dish.pickup[0])}</span>
          </div>
          <div class="badges">${statusBadge(dish)}${stock}</div>
          ${dish.goal ? `<p class="goal-note">${esc(t("bn_group_badge", { n: dish.goal }))}${dish.cur < dish.goal ? ` · ${esc(t("bn_goal_short", { n: dish.goal - dish.cur }))}` : ""}</p>` : ""}
          <div class="feed-actions">
            ${dish.status === "soldout" || dish.status === "closed"
              ? `<span class="state">${esc(t(dish.status === "soldout" ? "bn_sold_out" : "bn_closed"))}</span>`
              : `<button type="button" class="btn btn-primary" data-open="${esc(dish.id)}">${esc(t("bn_view_detail"))}</button>`}
          </div>
        </div>
      </article>`;
    }).join("");
    initVideoPlayback();
  }

  function initVideoPlayback() {
    const feed = $("feed");
    if (!feed || typeof IntersectionObserver === "undefined") return;

    const videos = [...feed.querySelectorAll("video")];
    if (!videos.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          const isVisible = entry.isIntersecting && entry.intersectionRatio > 0.5;

          if (isVisible && activeVideoEl === null) {
            // 이 영상을 재생 후보로 설정 (첫 번째 가시 영상만)
            activeVideoEl = video;
            playVideo(video);
          } else if (!isVisible && video === activeVideoEl) {
            pauseVideo(video);
            activeVideoEl = null;
          } else if (!isVisible) {
            pauseVideo(video);
          }
        });
        // 가시 영상이 여러 개면 첫 번째만 재생
        const visible = videos.filter((v) => {
          const rect = v.getBoundingClientRect();
          return rect.top < window.innerHeight * 0.8 && rect.bottom > window.innerHeight * 0.2;
        });
        if (visible.length > 0 && activeVideoEl === null) {
          activeVideoEl = visible[0];
          playVideo(visible[0]);
        } else if (visible.length === 0 && activeVideoEl) {
          pauseVideo(activeVideoEl);
          activeVideoEl = null;
        }
      },
      { threshold: 0.5 }
    );
    videos.forEach((v) => observer.observe(v));
  }

  async function playVideo(video) {
    if (!video) return;
    try {
      // data-src에서 실제 src로 (지연 로딩)
      if (video.dataset.src && !video.src) {
        video.src = video.dataset.src;
      }
      await video.play().catch(() => {
        // 자동 재생 차단 시 사용자 상호작용 대기
      });
    } catch {}
  }

  function pauseVideo(video) {
    if (!video) return;
    try {
      video.pause();
    } catch {}
  }

  // 숏폼 카드 내 재생/음소거 버튼 이벤트 위임
  function bindFeedControls() {
    $("feed").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const card = btn.closest(".feed-card");
      const video = card ? card.querySelector("video") : null;
      if (!video) return;

      if (btn.dataset.action === "toggle-play") {
        if (video.paused || video.ended) {
          // 다른 영상 일시정지 후 이 영상만 재생
          if (activeVideoEl && activeVideoEl !== video) pauseVideo(activeVideoEl);
          activeVideoEl = video;
          playVideo(video);
          btn.textContent = "⏸";
        } else {
          pauseVideo(video);
          activeVideoEl = null;
          btn.textContent = "▶";
        }
      } else if (btn.dataset.action === "toggle-mute") {
        video.muted = !video.muted;
        btn.textContent = video.muted ? "🔇" : "🔊";
        btn.setAttribute("aria-label", video.muted ? t("bn_video_unmute") : t("bn_video_mute"));
      }
    });
  }

  function renderShops() {
    const shops = SHOPS.filter((s) => s.cityId === state.cityId && !s.empty);
    const totalMenus = shops.reduce((n, s) => n + s.dishes.length, 0);
    $("shopsSub").textContent = shops.length
      ? t("bn_shops_count", { n: shops.length, m: totalMenus })
      : "";

    // 도시에 가게가 없음 → 준비 중. 가짜 카드로 채우지 않는다.
    if (!shops.length) {
      $("shopList").innerHTML = "";
      $("emptyState").hidden = false;
      return;
    }
    $("shopList").innerHTML = shops
      .flatMap((s) =>
        s.menuUndefined
          ? [
              `<article class="card"><div class="body">
              <p class="shop">${esc(text(s.name))} <span class="badge">${esc(t("bn_demo_store"))}</span></p>
              <p class="pickup">${esc(t("bn_empty_title"))} · ${esc(t("bn_chicken_none"))}</p>
            </div></article>`,
            ]
          : s.dishes
              .filter((d) => state.cat === "all" || d.cat === state.cat)
              .map((d) => dishCard(s, d, false)),
      )
      .join("");
  }

  function renderChicken() {
    const items = SHOPS.filter(
      (s) => s.cityId === state.cityId && !s.empty,
    ).flatMap((s) =>
      s.dishes
        .filter(
          (d) => d.cat === "chicken" && d.chickenToday && d.status !== "closed",
        )
        .map((d) => ({ s, d })),
    );
    const strip = $("chickenStrip");
    strip.innerHTML = items.length
      ? items
          .map(
            ({
              s,
              d,
            }) => `<button type="button" class="chicken-item" data-open="${esc(d.id)}">
              <div class="top">
                <span class="ico" aria-hidden="true">${d.emoji}</span>
                <div><div class="nm">${esc(text(d.name))}</div><div class="sh">${esc(text(s.name))}</div></div>
              </div>
              <div class="row"><span class="price">${esc(fmtMoney(d.minor, s.currency, s.exp))}</span></div>
              <div class="badges">${statusBadge(d)}</div>
              <div class="pickup">⏱ ${esc(d.pickup[0])} · ${esc(t("bn_deadline"))} ${esc(d.deadline)}</div>
            </button>`,
          )
          .join("")
      : `<div class="empty"><p>${esc(t("bn_chicken_none"))}</p></div>`;
  }

  function setMode(mode) {
    state.mode = mode;
    $("mapPanel").hidden = mode !== "map";
    $("feedPanel").hidden = mode !== "feed";
    ["tabMap", "tabFeed"].forEach((id) => {
      const el = $(id);
      const on = el.dataset.mode === mode;
      el.setAttribute("aria-selected", String(on));
      el.tabIndex = on ? 0 : -1;
    });
  }

  function renderAll() {
    renderCountries();
    renderCities();
    renderChips();
    renderMap();
    renderFeed();
    renderChicken();
    renderShops();
    syncStaticI18n();
    if (state.geo === "denied") {
      $("geoNote").textContent = t("bn_geo_denied");
    } else if (state.geo === "granted") {
      $("geoNote").textContent = t("bn_geo_granted", {
        city: text(cityById(state.cityId).name),
      });
    } else {
      $("geoNote").textContent = t("bn_geo_idle");
    }
  }

  // --- dialog (mock reservation) ---
  function openDish(dishId) {
    const shop = SHOPS.find((s) => s.dishes.some((d) => d.id === dishId));
    const dish = shop && shop.dishes.find((d) => d.id === dishId);
    if (!dish || dish.status !== "open") return;
    state.dialogDish = dish;
    state.qty = 1;
    $("qtyMinus").disabled = true;
    $("qtyPlus").disabled = false;
    $("dishTitle").textContent = text(dish.name);
    $("dishHero").textContent = dish.emoji;
    $("qtyValue").textContent = "1";
    $("pickupSel").innerHTML = dish.pickup
      .map((p) => `<option value="${esc(p)}">${esc(p)}</option>`)
      .join("");
    $("dishFacts").innerHTML = [
      [
        t("bn_shop"),
        `${esc(text(shop.name))} <span class="badge">${esc(t("bn_demo_store"))}</span>`,
      ],
      [t("bn_city_label"), esc(text(cityById(shop.cityId).name))],
      [
        t("bn_price"),
        `<span class="price">${esc(fmtMoney(dish.minor, shop.currency, shop.exp))}</span>`,
      ],
      [t("bn_structure"), esc(text(dish.structure))],
      [t("bn_allergen"), esc(text(dish.allergens))],
      [t("bn_pickup_place"), esc(dish.pickupPlace)],
      [
        t("bn_deadline"),
        `${esc(dish.deadline)} · ${esc(t("bn_stock", { n: dish.stock }))}`,
      ],
      [t("bn_cancel_policy"), esc(t("bn_cancel_until"))],
    ]
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`)
      .join("");
    const dlg = $("dishDialog");
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    $("qtyMinus").focus();
  }
  function closeDish() {
    const dlg = $("dishDialog");
    if (typeof dlg.close === "function" && dlg.open) dlg.close();
    else dlg.removeAttribute("open");
    state.dialogDish = null;
  }
  function setQty(n) {
    const dish = state.dialogDish;
    if (!dish) return;
    const max = Math.min(dish.stock, 10);
    state.qty = Math.max(1, Math.min(n, max));
    $("qtyValue").textContent = String(state.qty);
    $("qtyMinus").disabled = state.qty <= 1;
    $("qtyPlus").disabled = state.qty >= max;
  }

  let toastTimer = 0;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3800);
  }

  // --- events ---
  function bind() {
    $("countrySel").addEventListener("change", (e) => {
      state.countryCode = e.target.value;
      const first = CITIES.find((c) => c.country === state.countryCode);
      state.cityId = first ? first.id : "";
      state.activeShopId = null;
      renderCities();
      renderAll();
    });
    $("citySel").addEventListener("change", (e) => {
      state.cityId = e.target.value;
      state.activeShopId = null;
      if (state.geo === "granted") state.geo = "idle";
      renderAll();
    });
    ["tabMap", "tabFeed"].forEach((id) =>
      $(id).addEventListener("click", () => setMode($(id).dataset.mode)),
    );
    $("chips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]");
      if (!b) return;
      state.cat = b.dataset.cat;
      renderChips();
      renderFeed();
      renderShops();
    });
    $("map").addEventListener("click", (e) => {
      const m = e.target.closest("[data-shop]");
      if (!m) return;
      state.activeShopId = m.dataset.shop;
      renderMap();
    });
    document.addEventListener("click", (e) => {
      const o = e.target.closest("[data-open]");
      if (o) openDish(o.dataset.open);
    });
    // 내 예약/판매자 목록의 취소·수령 버튼 (동적 생성)
    $("ordersDialog").addEventListener("click", (e) => {
      const c = e.target.closest("[data-cancel-order]");
      if (c) return cancelOrder(c.dataset.cancelOrder);
      const k = e.target.closest("[data-collect-order]");
      if (k) return markCollected(k.dataset.collectOrder);
    });
    $("closeOrders").addEventListener("click", () => {
      const d = $("ordersDialog");
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
    });
    $("closeDialog").addEventListener("click", closeDish);
    $("cancelDialog").addEventListener("click", closeDish);
    $("qtyMinus").addEventListener("click", () => setQty(state.qty - 1));
    $("qtyPlus").addEventListener("click", () => setQty(state.qty + 1));
    $("confirmMock").addEventListener("click", submitBooking);
    $("bookingContact").addEventListener("input", () => {
      $("confirmMock").disabled = false; // 입력이 바뀌면 이전 실패 상태 해제
    });
    $("myOrdersBtn").addEventListener("click", showMyOrders);
    $("sellerOrdersBtn").addEventListener("click", showSellerOrders);
    $("geoBtn").addEventListener("click", requestGeo);
    // i18n.js switchLanguage 호출 시 data-i18n 뿐 아니라 동적으로 그린 카드도 갱신
    window.addEventListener("storage", (e) => {
      if (e.key === "golive_lang") renderAll();
    });
    const origSwitch = window.switchLanguage;
    window.switchLanguage = function (lang) {
      if (typeof origSwitch === "function") origSwitch(lang);
      renderAll();
    };
    bindFeedControls();
  }

  // ===========================================================================
  // 예약 제출 (2단계): 서버 RPC 성공 시에만 성공 UI. 실패는 이유를 그대로 보여준다.
  // ===========================================================================
  async function submitBooking() {
    const dish = state.dialogDish;
    if (!dish) return;
    const btn = $("confirmMock");
    const status = $("bookingStatus");
    const contact = $("bookingContact").value.trim();

    // mock 모드: DB 가 없다. 성공처럼 보이게 하지 않고, 왜 안 되는지 알린다.
    if (!window.banchanApi || window.banchanApi.mode() !== "live") {
      status.className = "booking-status error";
      status.textContent = t("bn_err_mock_mode");
      return;
    }
    if (contact.length < 3) {
      status.className = "booking-status error";
      status.textContent = t("bn_err_contact");
      $("bookingContact").focus();
      return;
    }

    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    status.className = "booking-status pending";
    status.textContent = t("bn_booking_sending");
    try {
      const row = await window.banchanApi.createPreorder({
        offerId: dish.id,
        qty: state.qty,
        contactMethod: "phone",
        contactValue: contact,
      });
      // 성공: 서버가 돌려준 예약 번호·상태로만 표시한다
      closeDish();
      toast(t("bn_booking_ok", { code: row.reservation_code }));
      state.lastBooking = row;
      await refreshOffers();
    } catch (err) {
      const key = err && err.key ? err.key : "bn_err_generic";
      status.className = "booking-status error";
      status.textContent = t(key);
      // 실패 시 다이얼로그를 닫지 않는다: 사용자가 다시 시도하거나 이유를 확인할 수 있게
      btn.disabled = false;
    } finally {
      btn.removeAttribute("aria-busy");
    }
  }

  async function cancelOrder(preorderId) {
    if (!window.banchanApi || window.banchanApi.mode() !== "live") {
      toast(t("bn_err_mock_mode"));
      return;
    }
    try {
      await window.banchanApi.cancelPreorder(preorderId);
      toast(t("bn_cancel_ok"));
      await showMyOrders();
      await refreshOffers();
    } catch (err) {
      toast(t(err && err.key ? err.key : "bn_err_generic"));
    }
  }

  async function markCollected(preorderId) {
    if (!window.banchanApi || window.banchanApi.mode() !== "live") {
      toast(t("bn_err_mock_mode"));
      return;
    }
    try {
      await window.banchanApi.markCollected(preorderId);
      toast(t("bn_collected_ok"));
      await showSellerOrders();
    } catch (err) {
      toast(t(err && err.key ? err.key : "bn_err_generic"));
    }
  }

  function orderStatusLabel(s) {
    return t(`bn_st_${s}`);
  }

  async function showMyOrders() {
    const box = $("ordersDialog");
    const list = $("ordersList");
    $("ordersTitle").textContent = t("bn_my_orders");
    list.innerHTML = `<p class="empty-inline">${esc(t("bn_loading"))}</p>`;
    openSheet(box);
    if (!window.banchanApi || window.banchanApi.mode() !== "live") {
      list.innerHTML = `<p class="empty-inline">${esc(t("bn_err_mock_mode"))}</p>`;
      return;
    }
    try {
      const rows = await window.banchanApi.listMyPreorders();
      if (!rows.length) {
        list.innerHTML = `<p class="empty-inline">${esc(t("bn_no_orders"))}</p>`;
        return;
      }
      list.innerHTML = rows
        .map((r) => {
          const canCancel = r.order_status === "pending" || r.order_status === "confirmed";
          return `<div class="order-row">
            <div class="order-main">
              <code class="order-code">${esc(r.reservation_code)}</code>
              <span class="badge">${esc(orderStatusLabel(r.order_status))}</span>
              <span class="badge ${r.payment_status === "paid" ? "progress" : "closed"}">${esc(t("bn_pay_" + r.payment_status))}</span>
            </div>
            <div class="order-sub">${esc(String(r.qty))} × ${esc(fmtMoney(r.unit_price_minor_snapshot, r.currency_snapshot, r.currency_exponent_snapshot))}</div>
            ${canCancel ? `<button type="button" class="btn" data-cancel-order="${esc(r.id)}">${esc(t("bn_cancel_order"))}</button>` : ""}
          </div>`;
        })
        .join("");
    } catch (err) {
      list.innerHTML = `<p class="empty-inline error">${esc(t(err && err.key ? err.key : "bn_err_generic"))}</p>`;
    }
  }

  async function showSellerOrders() {
    const box = $("ordersDialog");
    const list = $("ordersList");
    $("ordersTitle").textContent = t("bn_seller_orders");
    list.innerHTML = `<p class="empty-inline">${esc(t("bn_loading"))}</p>`;
    openSheet(box);
    if (!window.banchanApi || window.banchanApi.mode() !== "live") {
      list.innerHTML = `<p class="empty-inline">${esc(t("bn_err_mock_mode"))}</p>`;
      return;
    }
    try {
      const rows = await window.banchanApi.listSellerOrders();
      if (!rows.length) {
        list.innerHTML = `<p class="empty-inline">${esc(t("bn_no_orders"))}</p>`;
        return;
      }
      list.innerHTML = rows
        .map(
          (r) => `<div class="order-row">
            <div class="order-main">
              <code class="order-code">${esc(r.reservation_code)}</code>
              <span class="badge">${esc(orderStatusLabel(r.order_status))}</span>
              <span class="badge ${r.payment_status === "paid" ? "progress" : "closed"}">${esc(t("bn_pay_" + r.payment_status))}</span>
            </div>
            <div class="order-sub">${esc(String(r.qty))} × ${esc(fmtMoney(r.unit_price_minor_snapshot, r.currency_snapshot, r.currency_exponent_snapshot))}</div>
            <div class="order-sub">${esc(t("bn_contact"))}: ${esc(r.contact_value)}</div>
            ${r.order_status === "pending" || r.order_status === "confirmed" ? `<button type="button" class="btn btn-primary" data-collect-order="${esc(r.id)}">${esc(t("bn_mark_collected"))}</button>` : ""}
          </div>`
        )
        .join("");
    } catch (err) {
      list.innerHTML = `<p class="empty-inline error">${esc(t(err && err.key ? err.key : "bn_err_generic"))}</p>`;
    }
  }

  function openSheet(el) {
    if (typeof el.showModal === "function") {
      if (!el.open) el.showModal();
    } else el.setAttribute("open", "");
  }

  // DB 모드에서는 서버가 진실이다: 예약 후 남은 수량을 다시 읽는다
  async function refreshOffers() {
    if (!window.banchanApi || window.banchanApi.mode() !== "live") return;
    try {
      const rows = await window.banchanApi.listOffers({ cityId: state.dbCityId });
      state.liveOffers = rows;
      renderAll();
    } catch {
      // 새로고침 실패가 예약 성공을 뒤집지는 않는다
    }
  }

  function requestGeo() {
    if (!("geolocation" in navigator)) {
      state.geo = "unsupported";
      $("geoNote").textContent = t("bn_geo_unsupported");
      return;
    }
    $("geoNote").textContent = t("bn_geo_ask");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 브라우저 위치는 저장하지 않고, 가장 가까운 demo 도시 선택에만 사용
        const { latitude, longitude } = pos.coords;
        let best = null;
        let bestD = Infinity;
        CITIES.forEach((c) => {
          const d = (c.lat - latitude) ** 2 + (c.lng - longitude) ** 2;
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        });
        if (best) {
          state.countryCode = best.country;
          state.cityId = best.id;
          state.geo = "granted";
          state.activeShopId = null;
          renderAll();
        }
      },
      () => {
        state.geo = "denied";
        $("geoNote").textContent = t("bn_geo_denied");
      },
      { timeout: 8000, maximumAge: 60000 },
    );
  }

  // 언어 변경 시 다시 렌더링할 수 있도록 노출 (i18n.js switchLanguage 호출 후 사용)
  window.banchanMock = {
    applyLang: renderAll,
    data: { CITIES, SHOPS },
  };

  function init() {
    bind();
    setMode("map");
    renderAll();

    // 지도는 첫 화면에 강제로 붙이지 않는다 (플랜 4장).
    // 플래그가 켜져 있으면 지도 탭이 보일 때 한 번만 지연 로딩하고,
    // 실패·미설정이면 지금 그린 로컬 미리보기를 그대로 둔다.
    if (mapProvider() !== "none") {
      ensureLeaflet().then((ok) => {
        if (!ok) return;
        // 로딩 완료 후 화면을 다시 그려 핀을 지도 마커로 바꾼다
        renderAll();
        // TILE_URL 미설정 등으로 지도를 그리지 못했으면 미리보기로 되돌린다
        if (leafletFailed && !leafletMap) renderAll();
      });
    }
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
