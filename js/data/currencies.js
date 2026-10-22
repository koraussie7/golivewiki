/**
 * js/data/currencies.js
 *
 * Static currency + locale table for the 7 languages golive.wiki supports.
 * Each entry maps a language code to:
 *   - code  : ISO 4217 currency code (USD used for both English and Spanish
 *             because the sample audiences we serve — expat/remote workers
 *             in Korea — are paid in USD; real localization would split ES
 *             into ARS/MXN/etc. and split EN into USD/GBP/AUD/etc.)
 *   - symbol: Display symbol used when formatting prices in the UI.
 *   - rate  : How many units of this currency equal 1 KRW.
 *             Sourced from approximate mid-2025 exchange rates; refresh
 *             quarterly via the FX_RATE_BUMP constant if needed.
 *
 * Note: This is intentionally a static table. Real-time FX requires a paid
 * API or a Cloudflare Worker with caching; out of scope for Phase 5.
 */
export const CURRENCY_TABLE = {
  ko: { code: "KRW", symbol: "₩",   rate: 1 },             // base
  en: { code: "USD", symbol: "$",   rate: 0.00073 },
  vi: { code: "VND", symbol: "₫",   rate: 18.7 },
  ja: { code: "JPY", symbol: "¥",   rate: 0.11 },
  zh: { code: "CNY", symbol: "¥",   rate: 0.0053 },
  hi: { code: "INR", symbol: "₹",   rate: 0.062 },
  es: { code: "USD", symbol: "$",   rate: 0.00073 },       // expat-fallback
};

/**
 * Convert a KRW amount to the target language's currency.
 * Returns a Number rounded to a sensible decimal count for that currency.
 */
export function convertFromKRW(krwAmount, lang) {
  const cur = CURRENCY_TABLE[lang] || CURRENCY_TABLE.ko;
  const converted = krwAmount * cur.rate;
  // 0 decimal for KRW/VND/JPY (whole units), 2 decimal for USD/CNY/INR/EUR
  const fractionDigits = (cur.code === "KRW" || cur.code === "VND" || cur.code === "JPY") ? 0 : 2;
  // For VND/JPY, thousands separator is comma; we delegate formatting to formatPrice.
  const factor = Math.pow(10, fractionDigits);
  return Math.round(converted * factor) / factor;
}

/**
 * Format a KRW amount as a localized price string for the given language.
 * Uses Intl.NumberFormat when available, with manual fallback for older
 * browsers and for VND/JPY (which need custom grouping).
 *
 * @param {number} krwAmount  Price expressed in Korean Won (base currency).
 * @param {string} lang       One of: ko, en, vi, ja, zh, hi, es.
 * @returns {string}          e.g. "₩150,000", "$109.50", "₫2,805,000", "¥16,500"
 */
export function formatPrice(krwAmount, lang) {
  const cur = CURRENCY_TABLE[lang] || CURRENCY_TABLE.ko;
  const value = convertFromKRW(krwAmount, lang);

  // Locale tags per language — used by Intl.NumberFormat.
  const localeTag = ({
    ko: "ko-KR",
    en: "en-US",
    vi: "vi-VN",
    ja: "ja-JP",
    zh: "zh-CN",
    hi: "hi-IN",
    es: "es-ES",
  })[lang] || "en-US";

  try {
    return new Intl.NumberFormat(localeTag, {
      style: "currency",
      currency: cur.code,
      maximumFractionDigits: (cur.code === "KRW" || cur.code === "VND" || cur.code === "JPY") ? 0 : 2,
    }).format(value);
  } catch (_) {
    // Fallback for environments without Intl.NumberFormat (very rare in 2025).
    const grouped = String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${cur.symbol}${grouped}`;
  }
}

/**
 * Get the display symbol for the current language (used in slider labels).
 */
export function getCurrencySymbol(lang) {
  const cur = CURRENCY_TABLE[lang] || CURRENCY_TABLE.ko;
  return cur.symbol;
}
