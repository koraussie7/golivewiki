#!/usr/bin/env python3
"""
Playwright regression test for the unified Dashboard integration.

Verifies:
  1. Dashboard loads with worker mode default (drawer hidden)
  2. Mode switcher toggles to requester mode (drawer opens)
  3. Category grid renders in drawer step-1
  4. Clicking a category advances to step-2 (form)
  5. Filling the form and clicking submit advances to step-3 (offers)
  6. Counter-offer accept emits offer:accepted -> activity feed updates
  7. screens-07-ride.html redirects to dashboard ?mode=request
  8. No console errors on dashboard load
"""
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = "https://golive.wiki"
SHOTS = Path("/Users/brianyeon/CodeGPT/golivewiki/scripts/tests/shots")
SHOTS.mkdir(parents=True, exist_ok=True)

errors = []
console_errors = []

def step(label):
    print(f"\n=== {label} ===")

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))

    # --- Test 1: Dashboard loads in worker mode ---
    step("1. Dashboard loads in worker mode (drawer hidden)")
    page.goto(f"{BASE}/screens-04-dashboard.html", wait_until="networkidle")
    page.wait_for_selector("#mode-switcher", timeout=5000)
    drawer = page.locator("#request-drawer")
    assert drawer.is_hidden(), "Drawer should be hidden in worker mode"
    page.screenshot(path=str(SHOTS / "01-worker-mode.png"), full_page=True)
    print("  OK — drawer hidden")

    # --- Test 2: Mode switcher -> requester mode opens drawer ---
    step("2. Mode switcher opens drawer (requester mode)")
    page.click('button[data-mode="requester"]')
    page.wait_for_timeout(500)  # slide-in transition
    assert not drawer.is_hidden(), "Drawer should open after requester mode click"
    assert "open" in (drawer.get_attribute("class") or ""), "Drawer should have .open class"
    page.screenshot(path=str(SHOTS / "02-drawer-open-step1.png"), full_page=True)
    print("  OK — drawer opened with .open class")

    # --- Test 3: Category grid renders in step-1 ---
    step("3. Category grid renders 18 categories")
    page.wait_for_selector("#cat-grid .cat-card", timeout=5000)
    cards = page.locator("#cat-grid .cat-card")
    n_cats = cards.count()
    assert n_cats == 18, f"Expected 18 categories, got {n_cats}"
    print(f"  OK — {n_cats} category cards rendered")

    # --- Test 4: Click category -> step-2 ---
    step("4. Click first category -> step-2 form")
    cards.nth(0).click()
    page.wait_for_timeout(300)
    step2 = page.locator('.drawer-step[data-step="2"]')
    assert not step2.is_hidden(), "Step 2 should be visible after category click"
    assert step2.get_attribute("hidden") is None, "Step 2 hidden attribute should be cleared"
    page.screenshot(path=str(SHOTS / "03-step2-form.png"), full_page=True)
    print("  OK — step-2 form visible")

    # --- Test 5: Fill form + submit -> step-3 ---
    step("5. Fill form and submit -> step-3 offers")
    page.fill("#task-title", "테스트 작업: 논현동 청소")
    page.fill("#task-desc", "10평 원룸 입주 청소")
    page.fill("#task-location", "서울 강남구 논현동")
    page.click("#btn-submit-request")
    page.wait_for_timeout(300)
    step3 = page.locator('.drawer-step[data-step="3"]')
    assert not step3.is_hidden(), "Step 3 should be visible after submit"
    page.screenshot(path=str(SHOTS / "04-step3-waiting.png"), full_page=True)
    print("  OK — step-3 visible, waiting for offers (simulate)")

    # --- Test 6: Wait for offers (simulate is ~1.5s/4.5s/...) ---
    step("6. Wait for simulated counter-offers")
    page.wait_for_selector("#offers-list .offer-card", timeout=10000)
    n_offers = page.locator("#offers-list .offer-card").count()
    assert n_offers >= 1, f"Expected at least 1 offer, got {n_offers}"
    print(f"  OK — {n_offers} offer(s) received")

    # --- Test 7: Accept an offer, expect activity feed update ---
    step("7. Accept first offer, expect activity feed append")
    feed_count_before = page.locator("#activity-feed .activity-item").count()
    page.locator('.btn-accept').first.click()
    # alert() dialog auto-dismissed by Playwright default; check feed instead
    page.wait_for_timeout(300)
    # Accept triggers alert() in current impl — that blocks but Playwright auto-dismisses.
    # The activity feed append happens inside the click handler so it should run before alert.
    feed_count_after = page.locator("#activity-feed .activity-item").count()
    assert feed_count_after >= feed_count_before + 1, \
        f"Expected feed to grow (was {feed_count_before}, now {feed_count_after})"
    page.screenshot(path=str(SHOTS / "05-after-accept.png"), full_page=True)
    print(f"  OK — activity feed grew {feed_count_before} -> {feed_count_after}")

    # --- Test 8: Close drawer via ESC ---
    step("8. ESC closes drawer")
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)
    assert drawer.is_hidden(), "Drawer should close on ESC"
    print("  OK — drawer closed via ESC")

    # --- Test 9: screens-07-ride.html meta-refresh redirects ---
    step("9. screens-07-ride.html meta-refresh redirect")
    page.goto(f"{BASE}/screens-07-ride.html")
    # The meta refresh fires within ~0s; wait for URL to settle.
    page.wait_for_url("**/screens-04-dashboard.html?mode=request", timeout=5000)
    page.wait_for_timeout(500)
    # Drawer should be open automatically via ?mode=request
    assert not drawer.is_hidden(), "Drawer should auto-open on ?mode=request landing"
    page.screenshot(path=str(SHOTS / "06-ride-redirected.png"), full_page=True)
    print("  OK — redirected to dashboard, drawer auto-opened")

    browser.close()

print("\n" + "=" * 60)
print(f"Page errors:   {len(errors)}")
for e in errors[:5]:
    print(f"  - {e}")
print(f"Console errors: {len(console_errors)}")
for e in console_errors[:5]:
    print(f"  - {e}")
print(f"Screenshots:    {SHOTS}")
print("=" * 60)

if errors or console_errors:
    sys.exit(1)
print("\nALL TESTS PASSED")
