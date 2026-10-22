# HANDOFF — golive.wiki Dashboard Integration

## Completed Work

### Phase 0 ✅ - Pre-check
- `styles/i18n.js`: ride_* key conflict analysis completed
- `js/services-app.js` window global dependency check: handlers preserved for back-compat

### Phase 1 ✅ - State Store + Services Refactor
- **NEW:** `js/state-store.js` — Single source of truth (78 lines)
  - `mode`, `userRole`, `selectedCategory`, `taskDraft`, `offers`, `acceptedOffer`, `dashboardTasks`, `activityFeed`, `layers`
  - Pub/sub: `subscribe(event, fn)`, `emit(event, data)`, `set(patch)`
  - Exported as `store` + `window.__store__`

- **REFACTORED:** `js/services-app.js` — 345 lines
  - Imports: `CATEGORIES`, `formatPrice`, `getCurrencySymbol` from data modules
  - `getCurrentLang()` — reads localStorage + navigator + defaults to "ko"
  - `localize(cat, field)` — ko → en fallback chain
  - `syncDraftToStore()` — syncs local state to canonical store
  - Window globals preserved: `goStep`, `updateOffer`, `submitRequest`, `acceptThis`, `declineThis`, `counterThis`

- **NEW:** `js/dashboard-app.js` — 577 lines
  - Leaflet map initialization with inDrive-style minimal design
  - User location auto-center (navigator.geolocation)
  - Tile layer: OSM-DE mirror (tile.openstreetmap.de)
  - Layer toggles: demand, risk, signals, valuation
  - Mode switcher event wiring

### Phase 2 ✅ - Drawer + Mode Switcher
- **NEW:** `js/request-drawer.js` — 71 lines
  - `openDrawer()`, `closeDrawer()`, `showStep(n)`
  - Mode change → drawer open/close wiring via `store.subscribe`
  - ESC key close, backdrop click close

- **MODIFIED:** `screens-04-dashboard.html` — 1125 lines
  - Added `#request-drawer` aside element with 3-step content
  - Drawer structure: header (step-bar), body (3 drawer-step sections)
  - Step 1: Category grid (`#cat-grid`)
  - Step 2: Task form + offer slider
  - Step 3: Counter-offer list (`#offers-list`)
  - Mode switcher: `#mode-switcher` with `[data-mode="worker"]` / `[data-mode="requester"]`

### Phase 3 ✅ - i18n + Routing
- **MODIFIED:** `screens-07-ride.html` — 40 lines (was 617)
  - Converted to meta refresh redirect page
  - Preserved for backwards compatibility with external links
  - Redirect: `0; url=https://golive.wiki/screens-04-dashboard.html?mode=request`

## Verification Results (2026-10-22) — ALL PASSED

### i18n ✅
`reqflow_*` keys: **22 used, 22 defined, 0 missing across 7 languages, 0 orphans.**
Verified with a sandboxed-VM dictionary loader (same technique as `scripts/validate-i18n.mjs`).

### Build ✅
`npm run build` → 73 modules transformed, postbuild minify OK (116.7 kB → 99.1 kB).

### Live regression (headless browser, `python3 -m http.server` over `dist/`) ✅
| Check | Result |
|---|---|
| Requester mode opens drawer | ✅ `#request-drawer.open` |
| Step 1 → 2 (category click) | ✅ `data-step="2"` |
| Step 2 → 3 (submit with title/location) | ✅ `data-step="3"`, offers:1, feed:1 |
| `screens-07-ride.html` redirect | ✅ meta refresh → `?mode=request` |
| Console errors / failed requests | **0 / 0** |

### Supabase schema fix (root cause of the 400) ✅
`js/services-app.js` was inserting the **old** column set. The live `tasks` table
has `region` / `timing` / `budget_krw`; `location_text`, `when_text`,
`poster_offer`, `suggested_price` **no longer exist** (PostgREST `PGRST204`).

```diff
- location_text: state.task.location,
- when_text: state.task.when,
- poster_offer: state.task.myOffer,
- suggested_price: state.task.suggested,
+ region: state.task.location || null,
+ timing: state.task.when || null,
+ budget_krw: Number(state.task.myOffer) || null,
```

Backup: `js/services-app.js.bak-20261022`

### Supabase RLS ✅ (applied via dashboard SQL Editor)
anon INSERT previously failed with `42501 new row violates row-level security policy`.

Policies now active:
```sql
create policy "anon can insert open tasks" on public.tasks
  for insert to anon with check (status = 'open');

create policy "anon can read tasks" on public.tasks
  for select to anon using (true);
```

Verified: anon `POST /rest/v1/tasks` → **201**, and a full UI submit persisted
(`title`, `region`, `timing`, `budget_krw`, `status='open'`) and was read back.

> Note: no DELETE policy is granted for `anon` (DELETE returns 204 but affects 0 rows).
> That is intentional/safe; remove test rows with the service_role key or SQL editor.

## Remaining

- [x] i18n key cleanup
- [x] `npm run build` verification
- [x] Live regression testing
- [ ] Commit changes in `golivewiki/`
- [ ] Deploy: `npm run build` → `rsync -avz --delete ./dist/ root@185.55.240.110:/var/www/golive.wiki/`

## Files Modified/Created

### New Files
- `js/state-store.js`
- `js/dashboard-app.js`
- `js/request-drawer.js`
- `js/data/categories.js`
- `js/data/currencies.js`
- `js/api.js` (modified - used by services-app.js)

### Modified Files
- `screens-04-dashboard.html` — injected drawer, external scripts
- `screens-07-ride.html` — converted to redirect alias

### Key Integration Points
- `<script type="module" src="./js/state-store.js"></script>` — loaded first
- `<script type="module" src="./js/dashboard-app.js"></script>` — map + mode switcher
- `<script type="module" src="./js/request-drawer.js"></script>` — drawer controller
- `<script type="module" src="./js/services-app.js"></script>` — request flow logic

## Environment Notes
- Build target: `es2022` (vite.config.js)
- Map tiles: OSM-DE mirror (avoiding DNS resolution issues with .org)
- Authentication: via existing `js/supabase-client.js`
- Language: 7 languages supported (ko, en, vi, ja, zh, hi, es)

---

All 4 phases complete and verified on 2026-10-22. See **Verification Results** above for the exact evidence. Remaining work is commit + deploy.