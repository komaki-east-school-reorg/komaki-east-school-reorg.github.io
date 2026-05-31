# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this site is

A static, no-build-step citizen information site about the school reorganization plan in Komaki City's eastern (Shinooka) district. Hosted on GitHub Pages at `komaki-east-school-reorg.github.io`. There is no package manager, no bundler, and no test runner.

## Local development

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Validation checks (run before every commit)

**1. Illegal external links** — only one external URL is permitted: the official city page at `.../303/index.html`. No PDF direct links or subpages.

```bash
grep -rn "city\.komaki\.aichi\.jp" *.html js/*.js \
  | grep -v "303/index\.html"
# Any output = violation. Replace with the permitted URL.
```

**2. Apostrophe escaping in i18n JSON** — unescaped `'` inside a JSON string value will silently corrupt translations for all languages.

```bash
python3 -c "
import json, sys
with open('data/i18n/ja.json', encoding='utf-8') as f:
    data = json.load(f)
print('ja.json OK')
"
# Repeat for en.json, and any other file you edited.
# A parse error means there is a bare apostrophe that must be escaped as \'
```

## i18n architecture

Translations live in `data/i18n/<lang>.json` (ja, en, pt, vi, tl, es, zh, id). `js/i18n.js` fetches the appropriate file at runtime and merges it with the Japanese base using `Object.assign({}, ja_dict, lang_dict)`, so **any key missing from a non-ja file automatically falls back to Japanese**. The minimum requirement when adding a new key is entries in `ja` and `en`.

There is also `data/i18n/ja-kids.json`: when the kids-mode toggle is active (Japanese only), it is fetched and merged on top of `ja.json` (`Object.assign({}, ja_dict, kids_dict)`), overriding keys with simpler hiragana/easy-Japanese text.

Language preference and kids-mode state are persisted in `localStorage` under `komaki_lang` and `komaki_kids`.

### HTML attributes for translated content

| Attribute | Effect |
|---|---|
| `data-i18n="key"` | Sets `element.textContent` |
| `data-i18n-html="key"` | Sets `element.innerHTML` (use for values with HTML tags) |
| `data-i18n-aria="key"` | Sets `aria-label` |

Page `<title>` and OG/Twitter meta tags are updated automatically via keys named `meta_title_<pageId>` and `meta_desc_<pageId>` (where `pageId` is the filename without `.html`, e.g., `meta_title_about`).

### Key naming convention

Keys follow the pattern `<page>_<section>_<type>`, e.g., `about_whatis_p1`, `faq_a3`. Shared/global keys (nav, footer, notice, hero) have no page prefix.

## Important constraints

- **Header site name is permanently Japanese.** The `<a class="site-title">` element does not get a `data-i18n` attribute. The `<span data-i18n="site_sub">` subtitle inside it is translated, but the main site name text is not.
- **All facts must come from official sources** — the permitted city URL above, or official printed materials (cite the source inline). Do not add speculative or unconfirmed information.
- **Turkish (`tr`) is not in the active language list** — `LANGS` in `i18n.js` does not include `tr`. Do not add it without a full, syntax-validated translation block.

## `data/news.json`

Auto-updated by GitHub Actions (`.github/workflows/fetch-news.yml`), which runs daily at 09:00 JST. The script (`.github/scripts/fetch_news.py`) scrapes two official city index pages, visits each item page to read its update date, keeps only items updated within the last `WINDOW_DAYS` (30) days, and commits changes with `[skip ci]`. To trigger manually: GitHub → Actions → "Fetch Official News" → Run workflow. Do not hand-edit `items` — it will be overwritten on the next run. The `window_days` and `source_url` fields are safe to edit.

## `js/main.js`

Self-contained IIFE blocks handling: hamburger nav, active nav link highlighting, auto-date status, "last updated" display, upcoming schedule expiry (`data-expires`), FAQ accordion, voice filter, official news rendering, and the interactive calendar on `schedule.html`. Calendar events are hardcoded in the `events` object inside `main.js`.

### Date-driven auto-display (and when it updates)

Several things reflect the current date automatically — no manual edits needed, but the underlying data must be set correctly.

| What | When it updates | How |
|---|---|---|
| `data/news.json` (official news) | Daily 09:00 JST | GitHub Actions |
| "Last updated: …" line (index *Current Status* / schedule *Key Events*) | Every time the site is re-deployed (push) and files are re-served | `document.lastModified` of the served file (= deploy time on GitHub Pages), shown via `<p class="section-updated">` |
| Calendar initial month (`schedule.html`) | Every page load (viewer's current month) | `new Date()`, clamped to the `events` date range |
| "完了" labels in *Current Status* (`index.html`) | Every page load (today ≥ `data-event-date`) | AUTO DATE STATUS |
| Event status badges 完了/進行中/予定 (`schedule.html`, keys `event_status_*`) | Every page load (same) | AUTO DATE STATUS |
| "Upcoming" bar items | Every page load (hidden once past `data-expires`) | UPCOMING SCHEDULE EXPIRY |

Notes:
- "Last updated" is the site's **last deploy date**, not the editing date of that specific section (≈ most recent push). Do **not** hardcode a date into the heading text (e.g. the old `現在の状況（2026年5月時点）` was removed in favour of this auto-display).
- When adding schedule/status items, set `data-event-date="YYYY-MM-DD"` (use the end date for multi-day events); permanently-past or in-progress items get a hand-written `done`/`current` class instead.
- Kids mode (`ja-kids.json`) targets a **3rd-grade reading level**; see `CONTRIBUTING.txt` rules 5 & 6 for full content-management rules.

## Page structure

Every HTML page follows the same pattern: `notice-banner` → `<header>` (with `.lang-switcher` containing `.kids-toggle` and `.lang-select`) → `<main>` → `<footer>`. Both `js/i18n.js` and `js/main.js` are loaded at the end of `<body>`. Pages are standalone — there is no shared template or server-side include. When adding a new page, copy the full header/footer block from an existing page.

## CSS design tokens

All colours and radii are defined as CSS custom properties on `:root` in `css/style.css`. The theme is a blackboard/school aesthetic: `--primary` (#2e5c3a blackboard green), `--accent` (#d4aa30 chalk yellow), `--for-color` / `--against-color` / `--neutral-color` for the voices page. FOUC is prevented by hiding `body` until `js/i18n.js` adds `.i18n-ready` to `<html>`.

## `files.txt`

A manually maintained human-readable index of all site files with descriptions. Update it when adding or removing files.
