# golive.wiki
## Source of truth and deployment
- **Canonical local checkout:** `/Users/brianyeon/Domains/golive.wiki/golivewiki`
- **Canonical branch:** `main`
- **Canonical remote:** `origin` → `git@github.com:koraussie7/goliveb.git`
- `golivewiki-repo` is a second clone of the same repository. Do not edit or commit there; use the canonical checkout above.
- Before changing the source, run `git status -sb` and preserve existing work. Do not reset or overwrite uncommitted changes.

The production hostname `golive.wiki` is routed by Charon to the app on `host.docker.internal:7681`. `/var/www/golive.wiki` is a static fallback/legacy directory, **not the active production source**. Confirm the actual serving path before deploying; a local Vite build alone does not publish changes to the live app.


> Airtasker-inspired gig marketplace UI with **first-class multilingual support** (7 direct native languages + Google Translate fallback).

## 🌐 Languages (직접 번역 7개)

| Code | Language | Native |
|------|----------|--------|
| `ko` | 한국어 | 한국어 |
| `en` | English | English |
| `vi` | Tiếng Việt | Tiếng Việt |
| `ja` | 日本語 | 日本語 |
| `zh` | 中文 | 中文 |
| `hi` | हिन्दी | हिन्दी |
| `es` | Español | Español |

All other languages fall back to **Google Translate**.

## 📁 Project Structure

```
golivewiki/
├── index.html                     # Landing page
├── screens-04-dashboard.html      # Real-time task dashboard
├── screens-05-create-gig.html     # Create new gig wizard
├── screens-06-task-detail.html    # Task detail with offers
├── screens-admin.html             # Admin console
├── styles/
│   └── i18n.js                    # Universal i18n engine + dictionary
├── scripts/
│   └── validate-i18n.mjs          # Coverage validator
├── vite.config.js                 # Multi-page build config
├── package.json
└── README.md
```

## 🚀 Quick start

```bash
# Install dev dependencies (Vite)
npm install

# Run dev server (http://localhost:5173)
npm run dev

# Validate i18n dictionary coverage
npm run validate

# Production build → dist/
npm run build

# Preview built site
npm run preview
```

## 🏗️ Build System

**Vite 5** (Multi-Page App mode).

| Page | Entry point | Output |
|------|-------------|--------|
| Landing | `index.html` | `dist/index.html` + `assets/main-[hash].js` |
| Dashboard | `screens-04-dashboard.html` | `dist/screens-04-dashboard.html` |
| Create gig | `screens-05-create-gig.html` | `dist/screens-05-create-gig.html` |
| Task detail | `screens-06-task-detail.html` | `dist/screens-06-task-detail.html` |
| Admin | `screens-admin.html` | `dist/screens-admin.html` |

The shared `styles/i18n.js` is automatically extracted, minified (Terser), and given a content hash for cache busting.

### i18n.js minification

- **Before**: ~91.8 KB (raw)
- **After build**: ~40-50 KB (terser + comments stripped)

## 🌐 How the language switcher works

1. Page loads → `DOMContentLoaded` fires → `initLanguageSwitcher()` runs
2. Reads `localStorage["golive_lang"]` (defaults to `ko`)
3. `applyLanguage(lang)` walks every `[data-i18n]` and `[data-i18n-ph]` element
4. Lookup: `dict[key] || I18N_DICTIONARY[key][lang]` (flat-key fallback)
5. User clicks a flag in `lang-switcher-wrap` → `switchLanguage(lang)` → re-applies

Adding a new translation:
1. Add `<span data-i18n="my_key">원본 한국어 텍스트</span>` to any HTML
2. Add `my_key: "원본 한국어 텍스트"` to each of the 7 language blocks in `styles/i18n.js`
3. Run `npm run validate` to confirm coverage

## 🧪 Validation

```bash
npm run validate
```

Output:
```
🔍 golive.wiki i18n validator

✅ styles/i18n.js loaded (91.8 KB)
📄 index.html                          12 unique keys
📄 screens-04-dashboard.html           44 unique keys
📄 screens-05-create-gig.html          19 unique keys
📄 screens-06-task-detail.html         30 unique keys
📄 screens-admin.html                  52 unique keys

──────────────────────────────────────────────────────────
Total unique keys:   157
Languages checked:   ko, en, vi, ja, zh, hi, es
Missing entries:     0
──────────────────────────────────────────────────────────

✅ All keys resolve across all 7 languages.
```

## 🤝 Contributing

1. Use `data-i18n="key"` for visible text
2. Use `data-i18n-ph="key"` for input placeholders
3. Always populate all 7 language variants in `styles/i18n.js`
4. Run `npm run validate` before committing

## 📜 License

MIT
