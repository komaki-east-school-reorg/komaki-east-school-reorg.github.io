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

**1. Illegal external links** — exactly **two** city URLs are permitted, both index pages. No PDF direct links, no article subpages.

| Permitted URL | Used by |
|---|---|
| `.../kyoiku/kyouikusoumu/303/index.html` | school reorganization (Education General Affairs Div.) — site-wide |
| `.../kenkouikigai/sasaeai/3/3_2/index.html` | community councils (Mutual Support Div.) — `community.html` only |

```bash
grep -rn "city\.komaki\.aichi\.jp" *.html js/*.js \
  | grep -v -e "303/index\.html" -e "sasaeai/3/3_2/index\.html"
# Any output = violation. Replace with one of the permitted URLs.
```

The same two URLs are encoded in `PERMITTED_LINKS` in `.github/scripts/auto_gates.py` — keep them in sync. Adding a third requires updating this file, `CONTRIBUTING.txt` rule 1, `README.md`, and that gate together.

Two other domains are permitted and are outside this grep. **Chunichi Shimbun Web article URLs** (`chunichi.co.jp/article/<id>`) appear in the 報道 corner on `index.html` via `data/chunichi_news.json`, where each quotation must link to its source — see that file's section below. And the **eight target schools' own homepages** (`komaki-aic.ed.jp/<slug>/`) may be linked: they are a different domain run by the schools, and the URLs are stable. They appear in `map.html` (the 各校ホームページ block) and, via `data/school_news.json`, in the bottom section of `index.html`. The grep above does not cover them — when the set of schools changes, keep `SCHOOLS` in `fetch_schools.py` and the `map.html` block in sync.

**2. i18n JSON syntax** — parse every translation file, not just the ones you edited.

A bare apostrophe is **legal** in JSON and needs no escaping; writing `\'` is what breaks it (invalid escape). The failure modes that actually occur are an unescaped `"` inside a value, a trailing comma, a raw newline inside a string, and a lone backslash. See `CONTRIBUTING.txt` rule 2.

```bash
python3 -c "
import json, glob, sys
bad = 0
for f in sorted(glob.glob('data/i18n/*.json')):
    try:
        json.load(open(f, encoding='utf-8')); print('OK  ', f)
    except Exception as e:
        bad += 1; print('NG  ', f, e)
sys.exit(1 if bad else 0)
"
```

A broken non-`ja` file is easy to miss: `i18n.js` silently falls back, so the page still renders — just in the wrong language.

## i18n architecture

Translations live in `data/i18n/<lang>.json` (ja, en, pt, vi, tl, es, zh, id, tr, my). `js/i18n.js` fetches the files at runtime. For Japanese it loads `ja.json` alone; **for every other language it loads only `en.json` and the target language**, merged as `Object.assign({}, en_dict, lang_dict)`, so a key missing from the target language falls back to English. English is the bridge because a reader who chose Turkish or Burmese is far more likely to read English than Japanese. The minimum requirement when adding a new key is entries in `ja` and `en`.

### Page-scoped dictionaries

`i18n.js` does not fetch the whole-site dictionary. It fetches **`data/i18n/pages/<pageId>.<lang>.json`** — the subset of keys that page actually uses — and falls back to the full `data/i18n/<lang>.json` on a 404. Each page uses only 9–20% of the 661 keys, so this cuts a page view from ~45 KB to 4–10 KB gzip on the critical render path.

Those files are **generated**: run `python3 .github/scripts/build_page_dicts.py` after changing any `data/i18n/*.json` or adding a `data-i18n` attribute to a page, and commit the result. Never hand-edit `data/i18n/pages/`. `check 5` in `auto_gates.py` runs the generator with `--check` and fails if the committed output is stale; the daily workflow regenerates them after the drafter AI edits any dictionary. A *stale* page dictionary is worse than a missing one — a missing file 404s and falls back, while a stale file serves old text with a 200.

Keys that `main.js` attaches at runtime (`status_done`, `event_status_*`) never appear in the HTML, so they are listed in `RUNTIME_KEYS` in the generator and force-included in every page.

**`ja.json` is deliberately not fetched for non-Japanese languages.** It used to be the first of three layers, but `ja` and `en` carry identical key sets, so the `en` layer overwrote every one of its keys — the `ja` layer contributed zero keys to the merged dictionary while costing ~23 KB gzip on every page view, on the critical render path (`body` stays hidden until `.i18n-ready`). If a key were ever missing from `en`, the element simply keeps the Japanese default text already written inline in the HTML, which is the same thing the `ja` layer would have supplied. `check 3` in `.github/scripts/auto_gates.py` machine-verifies the `ja` ⇔ `en` key-set equality this relies on — **do not remove that gate.**

There is also `data/i18n/ja-kids.json`: when the kids-mode toggle is active (Japanese only), it is fetched and merged on top of `ja.json` (`Object.assign({}, ja_dict, kids_dict)`), overriding keys with simpler hiragana/easy-Japanese text.

Language preference and kids-mode state are persisted in `localStorage` under `komaki_lang` and `komaki_kids`.

### Language in the URL (`?lang=`)

Every page also accepts `?lang=<code>` (the codes in `LANGS`, e.g. `about.html?lang=pt`). **The URL wins over `localStorage`**, so a link shared in a community group opens in that language for someone who has never visited. After the dictionary is applied, `i18n.js` rewrites the address bar to match the selected language via `history.replaceState` (no history entry — a back button that only rewinds the language is confusing), and updates `<link rel="canonical">` and `og:url` to the same URL. Japanese is the bare URL with no parameter; it is the canonical form.

`js/main.js` resolves the language through the shared `window.KomakiLang()` helper defined at the top of the file, which reads `?lang=` first and `localStorage` second. Use it rather than reading `localStorage` directly — the blocks in `main.js` (official news, school news, changelog, calendar) render before `i18n.js` has finished fetching and written `komaki_lang`, so on a first visit through a shared link they would otherwise render in the wrong language.

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
- **All facts must come from official sources** — the permitted city URL above, or official printed materials (cite the source inline). Do not add speculative or unconfirmed information. The one place newspaper reporting appears is the 報道 corner on `index.html`, where it is clearly attributed as such; see `data/chunichi_news.json` below. It is never evidence for a claim made elsewhere on the site.
- **All ten languages are now fully translated.** Turkish (`tr`) and Burmese (`my`) reached full key coverage on 2026-08-13, so `PARTIAL` in `i18n.js` is empty and the "parts of this page are in English" notice bar no longer appears. `events.json` labels are a strict **10-language** requirement (`LANGS` in `auto_gates.py`). If a new partially-translated language is ever added, put its code in both `PARTIAL` (`i18n.js`) and `PARTIAL_LANGS` (`auto_gates.py`) so the notice bar shows and its event labels are not demanded.

## `data/news.json`

Auto-updated by GitHub Actions (`.github/workflows/fetch-news.yml`), which runs daily at 09:17 JST (off the hour, and with a 3–5 s polite wait between requests, to avoid load on the city server). The script (`.github/scripts/fetch_news.py`) scrapes two official city index pages, visits each item page to read its update date, keeps only items updated within the last `WINDOW_DAYS` (30) days, and commits changes with `[skip ci]`. To trigger manually: GitHub → Actions → "Fetch Official News" → Run workflow. Do not hand-edit `items` — it will be overwritten on the next run. The `window_days` and `source_url` fields are safe to edit.

**The city site is behind an Imperva/Incapsula WAF, so `fetch_html()` shells out to `curl` — do not "simplify" it back to `urllib`.** The first request gets a 302 to the *same* URL carrying `visid_incap_*` / `incap_ses_*` cookies; without keeping those, the client redirects forever. Cookies alone are not enough: Python's `urllib` is answered with a flat **403** even with a browser `User-Agent` and cookie jar (the WAF fingerprints the TLS/HTTP client, not the headers), while `curl` gets 200 for the same URL and UA. `curl` is preinstalled on `ubuntu-latest`. The cookie jar is one temp file reused for the whole run, so the extra WAF round-trip happens only on the first page.

### Watch-only pages (community councils)

Beyond the school-reorganization subtree, `fetch_news.py` also snapshots a small set of **watch-only** pages under `admin/soshiki/kenkouikigai/sasaeai/3/3_2/` (community councils — a different city department). These are declared as `WATCH_PAGES` / `WATCH_INDEXES` and get slugs prefixed `sasaeai-3-3_2-`. They are **snapshot-monitored only**: they never enter `news.json` `items`, so they never appear in the site's news list and add no external links. `site-facts.json` maps them to the `community` target, so a change opens the usual Issue and the auto-update pipeline may draft edits to `community.html`.

The same script also saves a normalized body-text snapshot of every item page to `data/official_pages/<slug>.txt` (auto-generated — never hand-edit). When any snapshot changes (page added/edited/removed on the city site), the workflow auto-opens a GitHub Issue titled 「📡 公式ページ更新検知 YYYY-MM-DD」 containing the changed-page list, a diff excerpt, and — via `.github/scripts/map_targets.py` — the site locations likely needing an update, looked up in `data/site-facts.json` (a hand-maintained map from official-page slug prefixes to site targets; add an entry when the city publishes a new page). Script exit codes: 0 = content changed, 2 = no change, 1 = fatal error.

### Auto-update pipeline (`auto-update` job)

When a content change is detected, a second job drafts site updates fully automatically: a drafter Claude (via `anthropics/claude-code-action`, subscription OAuth — secret `CLAUDE_CODE_OAUTH_TOKEN`; if the secret is missing the job skips silently and only the detection issue remains) reads the diff and may edit **only** `data/events.json`, `data/i18n/*.json`, `index.html`, `schedule.html`, `community.html`, and must write `auto_update/evidence.json` quoting the exact official-source text for every change. `.github/scripts/auto_gates.py` then machine-verifies scope, schemas (10-language event labels), the external-link rule, and that every quote actually exists in `data/official_pages/` (hallucination check; exit 0 = pass, 3 = no changes, 1 = fail). An independent verifier Claude reviews the diff and writes `auto_update/verdict.json`; only on `approve` is the PR auto-merged (squash) and the detection issue closed with a report from `.github/scripts/auto_report.py`. Kill switch: set repo variable `AUTO_MERGE` to `false` to stop before merge (PR is still created). Any gate/verdict failure leaves `main` untouched.

## `data/school_news.json` (target-school website updates)

The **bottom section of `index.html`** lists recent posts from the eight affected schools' own websites (`komaki-aic.ed.jp/<slug>/` — a different domain, run by each school, not the city). `.github/scripts/fetch_schools.py` scrapes each school's top page once a day from the same workflow, taking the newest 3 article cards (`class="blogtitle"` + 公開日), and writes them here sorted newest-school-first. Cards updated within 7 days get a 新着 badge, computed client-side.

- **Never hand-edit** `data/school_news.json`, and never add it to the auto-update pipeline's `ALLOWED` set — it is regenerated daily.
- The eight schools are hard-coded in `SCHOOLS` in the script, with display names for ja / ja-kids / en / zh (other languages fall back to en).
- Article headlines are shown **untranslated** — they are the schools' own words. Only the surrounding labels are localized (in `js/main.js`, same inline-dict pattern as the official-news block).
- A school whose page can't be fetched or parsed keeps its previous entries rather than being blanked; the workflow step is `continue-on-error` so a school-site outage never fails the run. Exit codes: 0 = changed, 2 = no change, 1 = all eight failed.
- Changes here commit as `chore: update school website news [skip ci]` and do **not** open an Issue or trigger the auto-update job — these are not school-reorganization source facts.

## `data/community_events.json` (community council events)

The bottom of **`community.html`** lists the city's community-council event announcements. `.github/scripts/build_community_events.py` builds it **from the snapshots `fetch_news.py` has already saved** in `data/official_pages/sasaeai-3-3_2-chiikikyougikaievent-*.txt` — it makes **no HTTP request of its own**, so adding this corner did not increase load on the city server. It therefore must run *after* `fetch_news.py` in the workflow.

- **Never hand-edit** it, and never add it to the auto-update pipeline's `ALLOWED` set — it is regenerated daily.
- The city's listing covers **all 16 elementary school districts in Komaki**, not just Shinooka. Events are shown in the city's own order, but the five Shinooka councils (`SHINOOKA_COUNCILS` in the script) are flagged `shinooka: true`, sorted first, and badged. Other districts' events are deliberately kept rather than filtered out: as of 2026-08-13 **no Shinooka event is listed at all**, so filtering would leave the corner permanently empty, and seeing what other councils actually run is a useful concrete answer to "what does a community council do?".
- Event titles are shown **untranslated** — they are the city's own words, the same policy as `school_news.json`. Only the surrounding labels are localized, via an inline dict in `js/main.js`.
- The parser stops at 関連イベント / 関連ファイル / この記事に関するお問い合わせ先, because after those headings the page lists unrelated city-wide events.

## `data/chunichi_news.json` (newspaper coverage)

The **「報道でみる東部地域」 section near the bottom of `index.html`** lists Chunichi Shimbun Web articles about eastern Komaki (the Shinooka district) — **not only the school reorganization**, but local news in general. `.github/scripts/fetch_chunichi.py` crawls the paper's Komaki-city area index once a day and stores, per article, **only the headline, the publication date, the article URL, and one quoted sentence from the opening**. The body is never copied — the articles are paywalled part-way through.

- **Never hand-edit** it, and never add it to the auto-update pipeline's `ALLOWED` set — it is regenerated daily.
- **This is reporting, not a primary source.** Facts on the rest of the site (figures, dates, plan contents) must still come only from the city's official information. Never cite a newspaper article as the evidence for a site edit. Because the corner now covers the district generally, most entries are not about the reorganization at all — that is intended.
- Headlines and quotations are shown **untranslated** — they are the newspaper's own words, the same policy as `school_news.json`. Only the surrounding labels are localized (`section_press` / `press_lead` / `press_note` plus an inline dict in `js/main.js`).
- Each entry links to the article and is labelled 出典：中日新聞Web. The link is what makes the quotation properly attributed, so do not strip it.
- **robots.txt**: chunichi.co.jp allows ordinary crawlers (`User-Agent: *` → `Allow: /`) but bans AI crawlers (`ClaudeBot`, `GPTBot`, `CCBot`, …) outright. The script therefore identifies itself with its own UA naming this site, runs once a day, and waits 3–5 s between requests. **Do not fetch this domain with AI browsing tools.**
- Matching is by **place name** (`AREA_KEYWORDS`: 篠岡/しのおか, 桃花台, 光ケ丘・光ヶ丘, 桃ケ丘・桃ヶ丘, 桃陵, 大城, 陶小, 城山, 大草, 上末, 下末, 高根, 大山, 池之内, 野口, 市東部, 東部地区), plus `学校再編` / `しのおか学園` as a safety net for reorganization articles that never name the district. The names are the ones this site itself uses (`about.html` school-district table, `bus.html` routes, `community.html` councils); the newspaper writes 光**ケ**丘 while the school writes 光**ヶ**丘, so both are listed. Bare `陶` is excluded because it collides with 陶芸/陶器 — only `陶小` is matched.
- Scanning only the paper's **Komaki city** area index is what makes bare place names safe: everything in that list is already about Komaki.
- `EXCLUDE_PHRASES` is subtracted from the text before matching. It currently holds `大山廃寺` — a ruin in the eastern 大山 whose excavated items are displayed downtown, so city-history articles mention it without being about the district at all.
- The **photo caption** (`<p class="caption">`, e.g. 「＝小牧市大草の愛知文教大で」) is kept in the text used for *matching* — some articles name the district only there — but stripped from the text used for the *quotation*, which must start at the article's opening sentence.
- Setting `CHUNICHI_CACHE_DIR` makes the script cache article HTML and reuse it, so the matching rules can be re-tuned without hitting the newspaper's server again. It is a development aid only; CI leaves it unset.
- Articles already examined are recorded in `checked_ids` so the same article is never fetched twice; that is why the file is committed even when the displayed list does not change. Older articles that have scrolled off the area index are listed in `SEED_URLS` and fetched once.
- Changes commit as `chore: update newspaper coverage [skip ci]` and do **not** open an Issue or trigger the auto-update job.

## `data/site-updates.json` (this site's own changelog)

The **last section of `index.html`** shows a changelog of changes made to this site itself. Unlike `news.json` and `school_news.json`, this one is **hand-maintained** — add a new entry at the top of the `updates` array when you ship something a reader would notice.

- Each entry: `date` (`YYYY-MM-DD`), `type` (`content` / `feature` / `fix`), `ja` (required), `en` (recommended). Other languages fall back `en` → `ja`, matching the i18n chain.
- **Style: one short noun-ending line (体言止め), never a sentence.** Write 「トルコ語・ビルマ語を追加」, not 「トルコ語とビルマ語を追加しました。」. No trailing 「。」. English entries follow the same shape — a noun phrase such as "Monthly calendar added to the schedule page", not "We added a monthly calendar."
- Write a **reader-facing summary, not a commit message** — "Turkish and Burmese added", not "feat(i18n): …". Internal refactors and doc fixes do not belong here.
- The list is sorted newest-first at render time and **only the newest 6 are displayed** (`MAX_ITEMS` in the `js/main.js` block); keep the full history in the file.

## `js/main.js`

Self-contained IIFE blocks handling: hamburger nav, active nav link highlighting, auto-date status, "last updated" display, upcoming schedule expiry (`data-expires`), FAQ accordion, voice filter, official news rendering, target-school website updates, and the interactive calendar on `schedule.html`. Calendar events live in `data/events.json` (`{"events": {"YYYY-MM-DD": {ja, en, pt, vi, tl, es, zh, id, tr, my}}}`), fetched at runtime by the calendar block — edit that file, not `main.js`, to add/change events. All 10 language labels are required per event. If the fetch fails or the file is empty, the calendar section hides itself.

### Date-driven auto-display (and when it updates)

Several things reflect the current date automatically — no manual edits needed, but the underlying data must be set correctly.

| What | When it updates | How |
|---|---|---|
| `data/news.json` (official news) | Daily 09:17 JST | GitHub Actions |
| "Last updated: …" line (index *Current Status* / schedule *Key Events*) | Every time the site is re-deployed (push) and files are re-served | `document.lastModified` of the served file (= deploy time on GitHub Pages), shown via `<p class="section-updated">` |
| Calendar initial month (`schedule.html`) | Every page load (viewer's current month) | `new Date()`, no clamping — it always opens on the current month even when that month has no events, because a reader opening the calendar first wants to know where "now" is. Do not "helpfully" jump to the nearest month that has events |
| "完了" labels in *Current Status* (`index.html`) | Every page load (today ≥ `data-event-date`) | AUTO DATE STATUS |
| Event status badges 完了/進行中/予定 (`schedule.html`, keys `event_status_*`) | Every page load (same) | AUTO DATE STATUS |
| "Upcoming" bar items | Every page load (hidden once past `data-expires`) | UPCOMING SCHEDULE EXPIRY |

Notes:
- "Last updated" is the site's **last deploy date**, not the editing date of that specific section (≈ most recent push). Do **not** hardcode a date into the heading text (e.g. the old `現在の状況（2026年5月時点）` was removed in favour of this auto-display).
- When adding schedule/status items, set `data-event-date="YYYY-MM-DD"` (use the end date for multi-day events); permanently-past or in-progress items get a hand-written `done`/`current` class instead.
- **Attribute distinction:** *Current Status* and *Key Events* items use `data-event-date` (drives "done"). The index "今後のスケジュール" (upcoming) bar items (`.upcoming-item`) use `data-expires` (hidden once past). List the bar's near-term items individually, mirroring `schedule.html`/the calendar (text via `upcoming_dateN`/`upcoming_nameN` keys).
- Kids mode (`ja-kids.json`) targets a **3rd-grade reading level**; see `CONTRIBUTING.txt` rules 5 & 6 for full content-management rules.

### The "いまの状況" box (`.now-bar`) — the one thing that is NOT automatic

`index.html` opens with a `.now-bar` box that states the current situation in **a single sentence**, sitting between the hero and the upcoming bar. It is driven by four i18n keys:

| Key | Content |
|---|---|
| `now_label` | Box label ("📌 いまの状況") — rarely changes |
| `now_text` | **One sentence** summarizing where things stand. `data-i18n-html`, so `<strong>` is allowed |
| `now_asof` | The month that sentence describes ("2026年8月時点") |
| `now_more` | Link text to the `#status` anchor (the *Current Status* section) |

Unlike the completion badges, the calendar month, and the "last updated" line, **nothing about this box updates itself** — it is hand-written prose, which makes it the fastest part of the site to go stale and the most visible when it does. Whenever the situation actually moves (an event finishes, new material is published, a decision is made), update `now_text` **and** `now_asof` **in all 10 languages plus `ja-kids`**. Do not touch it for changes that don't move the situation (typo fixes, layout changes on the city site).

`data/site-facts.json` lists this as the `now_bar` target and includes it in `default_targets`, so the auto-update pipeline is prompted to maintain it on every detected change; the verifier AI checks it too.

## Page structure

Every HTML page follows the same pattern: `notice-banner` → `<header>` (with `.lang-switcher` containing `.kids-toggle` and `.lang-select`) → `<main>` → `<footer>`. Both `js/i18n.js` and `js/main.js` are loaded at the end of `<body>`. Pages are standalone — there is no shared template or server-side include. When adding a new page, copy the full header/footer block from an existing page — **and add it to `sitemap.xml` and `files.txt`**, plus `meta_title_<pageId>` / `meta_desc_<pageId>` keys in every language file.

## SEO

| Piece | Where | Notes |
|---|---|---|
| `robots.txt` | repo root | Allows everything; points at the sitemap. Kids mode is excluded via a JS-injected `noindex` (`applyKidsSeoMeta`), not here. |
| `sitemap.xml` | repo root | Hand-maintained, one `<url>` per page (9), each carrying the full `xhtml:link` alternate set. No `lastmod` — a stale date is worse than none. |
| `<link rel="canonical">` | every page `<head>` | Static value is the bare (Japanese) URL. `i18n.js` rewrites it to the `?lang=` URL of the language actually being shown. |
| `hreflang` | every page `<head>` | 10 languages + `x-default`, each pointing at a **distinct** `?lang=` URL. They previously all pointed at the same URL, which is an error Search Console reports. |
| JSON-LD `WebSite` | `index.html` only | Static. Deliberately carries **no `publisher`/`Organization`** — inventing one would imply this site is official, which it is not. `citation` points at the permitted city URL. |
| JSON-LD `FAQPage` | `faq.html`, generated at runtime | Built by `applyFaqJsonLd` in `i18n.js` from the loaded dictionary's `faq_q<N>`/`faq_a<N>` pairs. **Do not hand-write it into `faq.html`** — that would duplicate `data/i18n/` and silently drift. The loop stops at the first missing `faq_q<N>`, so FAQ keys must stay contiguously numbered. |

Google has restricted `FAQPage` rich results to authoritative government and health sites, so this markup will most likely not produce rich results here. It is still valid, accurate structured data and costs nothing to keep.

## CSS design tokens

All colours and radii are defined as CSS custom properties on `:root` in `css/style.css`. The theme is a blackboard/school aesthetic: `--primary` (#2e5c3a blackboard green), `--accent` (#d4aa30 chalk yellow), `--for-color` / `--against-color` / `--neutral-color` for the voices page. FOUC is prevented by hiding `body` until `js/i18n.js` adds `.i18n-ready` to `<html>`.

## `files.txt`

A manually maintained human-readable index of all site files with descriptions. Update it when adding or removing files.

## Machine-checked invariants (`.github/scripts/auto_gates.py`)

Beyond the auto-update pipeline's scope and evidence checks, these run site-wide on every gate invocation and are the things most likely to be broken by an innocent-looking edit:

| # | Check | Why it exists |
|---|---|---|
| 3 | `ja` and `en` have identical key sets | `i18n.js` skips `ja.json` for non-Japanese languages and relies on this |
| 4 | No `ja-kids` line exceeds 65 mora | Kids mode targets 3rd-grade reading; splitting sentences matters more than opening kanji |
| 5 | `data/i18n/pages/` is up to date | A stale page dictionary serves old text with a 200 and cannot be caught at runtime |
