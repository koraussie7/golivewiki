#!/usr/bin/env python3
"""
Auto language detection regression for golive.wiki.

Verifies the §4 priority chain in styles/i18n.js:
  1. localStorage["golive_lang"]  — user's explicit prior choice
  2. navigator.languages          — browser Accept-Language equivalent
  3. "ko"                         — default fallback

Scenarios covered:
  A. First visit, navigator.language = "ja-JP" -> UI in Japanese
  B. First visit, navigator.languages = ["vi-VN","en-US"] -> UI in Vietnamese
  C. First visit, navigator.language = "de-DE" (unsupported) -> fallback to "ko"
  D. Saved choice wins: navigator="ja-JP" but localStorage="en" -> English
"""
import sys
from playwright.sync_api import sync_playwright

BASE = "https://golive.wiki"
results = []

def check(label, ok, detail=""):
    print(f"  {'✓' if ok else '✗'} {label}{(' — ' + detail) if detail else ''}")
    results.append(ok)

with sync_playwright() as p:
    browser = p.chromium.launch()

    # --- Scenario A: ja-JP navigator -> Japanese
    print("\n=== A. navigator.language = 'ja-JP' (first visit) ===")
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        locale="ja-JP",
        extra_http_headers={"Accept-Language": "ja-JP,ja;q=0.9"},
    )
    page = ctx.new_page()
    page.goto(f"{BASE}/", wait_until="networkidle")
    page.wait_for_timeout(500)
    detected = page.evaluate("window.__i18n__.resolveInitialLang()")
    check("detect returns 'ja'", detected == "ja", f"got: {detected!r}")
    # Verify applied to UI by checking category name after opening drawer
    page.evaluate("localStorage.removeItem('golive_lang')")  # ensure no leftover
    page.goto(f"{BASE}/screens-04-dashboard.html", wait_until="networkidle")
    page.wait_for_timeout(500)
    page.click('button[data-mode="requester"]')
    page.wait_for_timeout(1500)
    first_name = page.locator(".cat-card .name").first.inner_text()
    check("category name is in Japanese", "引" in first_name or "運搬" in first_name or "清掃" in first_name, f"got: {first_name!r}")
    ctx.close()

    # --- Scenario B: vi-VN navigator -> Vietnamese
    print("\n=== B. navigator.languages = ['vi-VN','en-US'] -> Vietnamese ===")
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        locale="vi-VN",
        extra_http_headers={"Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8"},
    )
    page = ctx.new_page()
    page.goto(f"{BASE}/", wait_until="networkidle")
    page.wait_for_timeout(500)
    detected = page.evaluate("window.__i18n__.resolveInitialLang()")
    check("detect returns 'vi'", detected == "vi", f"got: {detected!r}")
    page.goto(f"{BASE}/screens-04-dashboard.html", wait_until="networkidle")
    page.wait_for_timeout(500)
    page.click('button[data-mode="requester"]')
    page.wait_for_timeout(1500)
    first_name = page.locator(".cat-card .name").first.inner_text()
    check("category name is in Vietnamese", any(c in first_name for c in ["Chuyển", "Vệ", "Lắp", "Dọn"]), f"got: {first_name!r}")
    ctx.close()

    # --- Scenario C: de-DE (unsupported) -> fallback to ko
    print("\n=== C. navigator.language = 'de-DE' (unsupported) -> fallback 'ko' ===")
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        locale="de-DE",
        extra_http_headers={"Accept-Language": "de-DE,de;q=0.9"},
    )
    page = ctx.new_page()
    page.goto(f"{BASE}/", wait_until="networkidle")
    page.wait_for_timeout(500)
    detected = page.evaluate("window.__i18n__.resolveInitialLang()")
    check("detect returns 'ko' (default)", detected == "ko", f"got: {detected!r}")
    ctx.close()

    # --- Scenario D: saved choice beats navigator
    print("\n=== D. navigator='ja-JP' but localStorage='en' -> English wins ===")
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        locale="ja-JP",
        extra_http_headers={"Accept-Language": "ja-JP,ja;q=0.9"},
    )
    page = ctx.new_page()
    page.goto(f"{BASE}/", wait_until="networkidle")
    page.evaluate("localStorage.setItem('golive_lang', 'en')")
    page.wait_for_timeout(300)
    detected = page.evaluate("window.__i18n__.resolveInitialLang()")
    check("detect returns 'en' (saved overrides navigator)", detected == "en", f"got: {detected!r}")
    page.goto(f"{BASE}/screens-04-dashboard.html", wait_until="networkidle")
    page.wait_for_timeout(500)
    page.click('button[data-mode="requester"]')
    page.wait_for_timeout(1500)
    first_name = page.locator(".cat-card .name").first.inner_text()
    check("category name is in English", "Moving" in first_name or "Cleaning" in first_name or "Removalists" in first_name, f"got: {first_name!r}")
    ctx.close()

    browser.close()

print("\n" + "=" * 50)
print(f"PASSED: {sum(results)} / {len(results)}")
print("=" * 50)
sys.exit(0 if all(results) else 1)
