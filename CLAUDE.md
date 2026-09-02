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

Several other domains are permitted and are outside this grep. **Chunichi Shimbun Web article URLs** (`chunichi.co.jp/article/<id>`) appear in the 報道 corner on `index.html` via `data/chunichi_news.json`, where each headline must link to its source — see that file's section below. And the **eight target schools' own homepages** (`komaki-aic.ed.jp/<slug>/`) may be linked: they are a different domain run by the schools, and the URLs are stable. They appear in `map.html` (the 各校ホームページ block) and, via `data/school_news.json`, in the bottom section of `index.html`. The grep above does not cover them — when the set of schools changes, keep `SCHOOLS` in `fetch_schools.py` and the `map.html` block in sync. And **four MEXT pages** (`mext.go.jp`) are linked from `nationwide.html` only, as the sources for the nationwide figures and the national standards — see that page's section below. And **one citizen-run Instagram account** (`instagram.com/arigato.ohshirosho`) is linked from the 地域の取組 corner on `community.html` only — see `data/community_actions.json` below. Finally, the **share buttons** at the bottom of every page point at seven sharing endpoints (`social-plugins.line.me`, `x.com/intent/post`, `www.facebook.com/sharer/sharer.php`, `b.hatena.ne.jp/entry/panel/`, `www.threads.net/intent/post`, `bsky.app/intent/compose`, `www.reddit.com/submit`), at whatever Mastodon server the reader names (`https://<host>/share`), and load one external script (`s.hatena.ne.jp/js/HatenaStar.js`) — see the SHARE BUTTONS section below. Those URLs are built in `js/main.js`, never written into HTML or a dictionary, and are **not sources**: nothing on the site may cite them.

```bash
grep -rn "mext\.go\.jp" *.html js/*.js data/i18n/*.json \
  | grep -v -e "tekisei/index\.htm" -e "tekisei/1413885_00007\.htm" \
           -e "zyosei/yoyuu_00002\.htm" -e "kihon/1267995\.htm"
# Any output = violation. A hit in any page other than nationwide.html is also a violation.
```

`PERMITTED_MEXT_LINKS` and `MEXT_PAGES` in `auto_gates.py` enforce both halves of that rule, and the link check now also scans `data/i18n/*.json` — for non-Japanese readers the link that actually renders comes from the dictionary, not from the HTML.

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
- **All facts must come from official sources** — the permitted city URL above, or official printed materials (cite the source inline). Do not add speculative or unconfirmed information. The one place newspaper reporting appears is the 報道 corner on `index.html`, where it is clearly attributed as such; see `data/chunichi_news.json` below. It is never evidence for a claim made elsewhere on the site. **Nationwide figures and national standards come from MEXT** and live on `nationwide.html` only; they are never evidence for a statement about the Komaki plan itself, and the city's information is never used for a nationwide claim.
- **All ten languages are now fully translated**, `review.html` included: its `rev_*` keys plus the twelve review-related keys that appear on other pages (`nav_review`, `ql_review_*`, `rel_*`, `meta_*_review`, `status_digest`) were translated into the remaining eight languages on 2026-09-02. Turkish (`tr`) and Burmese (`my`) reached full key coverage on 2026-08-13, so `PARTIAL` in `i18n.js` is empty and the "parts of this page are in English" notice bar no longer appears. `events.json` labels are a strict **10-language** requirement (`LANGS` in `auto_gates.py`). If a new partially-translated language is ever added, put its code in both `PARTIAL` (`i18n.js`) and `PARTIAL_LANGS` (`auto_gates.py`) so the notice bar shows and its event labels are not demanded.

## `data/news.json`

Auto-updated by GitHub Actions (`.github/workflows/fetch-news.yml`), which runs daily at 09:17 JST (off the hour, and with a 3–5 s polite wait between requests, to avoid load on the city server). The script (`.github/scripts/fetch_news.py`) scrapes two official city index pages, visits each item page to read its update date, keeps only items updated within the last `WINDOW_DAYS` (30) days, and commits changes with `[skip ci]`. To trigger manually: GitHub → Actions → "Fetch Official News" → Run workflow. Do not hand-edit `items` — it will be overwritten on the next run. The `window_days` and `source_url` fields are safe to edit.

**The city site is behind an Imperva/Incapsula WAF, so `fetch_html()` shells out to `curl` — do not "simplify" it back to `urllib`.** The first request gets a 302 to the *same* URL carrying `visid_incap_*` / `incap_ses_*` cookies; without keeping those, the client redirects forever. Cookies alone are not enough: Python's `urllib` is answered with a flat **403** even with a browser `User-Agent` and cookie jar (the WAF fingerprints the TLS/HTTP client, not the headers), while `curl` gets 200 for the same URL and UA. `curl` is preinstalled on `ubuntu-latest`. The cookie jar is one temp file reused for the whole run, so the extra WAF round-trip happens only on the first page.

### Watch-only pages (community councils)

Beyond the school-reorganization subtree, `fetch_news.py` also snapshots a small set of **watch-only** pages under `admin/soshiki/kenkouikigai/sasaeai/3/3_2/` (community councils — a different city department). These are declared as `WATCH_PAGES` / `WATCH_INDEXES` and get slugs prefixed `sasaeai-3-3_2-`. They are **snapshot-monitored only**: they never enter `news.json` `items`, so they never appear in the site's news list and add no external links. `site-facts.json` maps them to the `community` target, so a change opens the usual Issue and the auto-update pipeline may draft edits to `community.html`.

The same script also saves a normalized body-text snapshot of every item page to `data/official_pages/<slug>.txt` (auto-generated — never hand-edit). When any snapshot changes (page added/edited/removed on the city site), the workflow auto-opens a GitHub Issue titled 「📡 公式ページ更新検知 YYYY-MM-DD」 containing the changed-page list, a diff excerpt, and — via `.github/scripts/map_targets.py` — the site locations likely needing an update, looked up in `data/site-facts.json` (a hand-maintained map from official-page slug prefixes to site targets; add an entry when the city publishes a new page). Script exit codes: 0 = content changed, 2 = no change, 1 = fatal error.

### 『学校再編だより』の PDF 本文 (`data/official_pages/newsletters/`)

The newsletter page (`303-shinooka_gsaihen-49521`) is snapshotted like any other, but its snapshot is **only a list of PDF titles** — every issue's actual content lives inside an attached PDF. So a new issue used to reach the pipeline as the single line 「篠岡地区学校再編だより（第7号）(PDFファイル:…)」 and nobody downstream could read it. `.github/scripts/fetch_newsletters.py` closes that gap: it extracts each issue's text (pdfminer.six) into `data/official_pages/newsletters/saihen-dayori-<NN>-<pdf-basename>.txt`, which puts it inside the tree `auto_gates.py` checks quotes against — so a newsletter sentence can be cited as evidence for a site edit.

- **Never hand-edit** these files — they are regenerated from the PDFs.
- **It adds almost no load on the city server.** The listing page's HTML is reused from the run-local cache `fetch_news.py` writes (`HTML_CACHE_DIR`), so it is never fetched twice; and a PDF is downloaded **only when its URL is new, or when the file-size label in the link text changed**. On an ordinary day it makes zero requests. It must therefore run *after* `fetch_news.py` in the workflow.
- **Figures, maps and much of the tables are images, so their text is not extracted.** Every file says so in its header. Absence from the text is not evidence that something is absent from the newsletter — the drafter prompt and the verifier prompt both state this.
- **The site must never link to these PDFs.** The extracted text may be quoted and used as a source, but a PDF direct link is still a link-rule violation (`auto_gates.py` check 6).
- **Old issues are never deleted**, even if the city takes them off the page: site text written from an issue must keep its source verifiable. This is unlike the HTML snapshots, which are pruned when the page disappears. (The pruning loop in `fetch_news.py` only looks at `*.txt` directly inside `data/official_pages/`, so the `newsletters/` subdirectory is out of its reach — keep it a subdirectory.)
- Slugs come from the issue number in the **link text**, not the filename: the city's own PDF names are inconsistent (`saihendayori01`, `kawaraban2`, `dayori3_nishi`, `dayori6`). The PDF basename is appended so that vol.3, which exists in a 篠岡西 and a 篠岡東 edition, does not collide.
- `SOURCE_PAGES` / `TITLE_RE` control what is captured. `TITLE_RE` matches 「学校再編だより」 in the link text, which deliberately excludes both the per-issue translations (linked as 「スペイン語」 etc., same content) and the 意見提出フォームから頂いたご意見 PDFs (residents' own opinions) sitting on the same page.

### Auto-update pipeline (`auto-update` job)

When a content change is detected, a second job drafts site updates fully automatically: a drafter Claude (via `anthropics/claude-code-action`, subscription OAuth — secret `CLAUDE_CODE_OAUTH_TOKEN`; if the secret is missing the job skips silently and only the detection issue remains) reads the diff (including any newly extracted newsletter text — see above) and may edit **only** `data/events.json`, `data/i18n/*.json`, `index.html`, `schedule.html`, `community.html`, and must write `auto_update/evidence.json` quoting the exact official-source text for every change. `.github/scripts/auto_gates.py` then machine-verifies scope, schemas (10-language event labels), the external-link rule, and that every quote actually exists in `data/official_pages/` (hallucination check; exit 0 = pass, 3 = no changes, 1 = fail). An independent verifier Claude reviews the diff and writes `auto_update/verdict.json`; only on `approve` is the PR auto-merged (squash) and the detection issue closed with a report from `.github/scripts/auto_report.py`. Kill switch: set repo variable `AUTO_MERGE` to `false` to stop before merge (PR is still created). Any gate/verdict failure leaves `main` untouched.

## 新機能アイデアの日次メール（`.github/workflows/feature-ideas.yml`）

毎日 06:35 JST に、このサイトに足すとよさそうな機能を Claude（`anthropics/claude-code-action`、`CLAUDE_CODE_OAUTH_TOKEN`）に考えさせ、**メールで届ける**だけの仕事。サイトのファイルは一切変更しない。

- **AI が書いてよいのは `auto_ideas/ideas.md` の1枚だけ。** サイトの実装はさせない（提案と実装を同じ走行で混ぜると、検証されていない変更が毎日入ってくる）。
- **本文はリポジトリに残さない。** 残るのは `auto_ideas/history.json`（過去に出した見出し）だけで、`ideas.md` は `.gitignore` 済み。起案AIはこの履歴を読んで**同じ案を二度出さない**。本文はメールと Actions のアーティファクト（30日）にある。
- **通知は SMTP → だめなら Issue。** `.github/scripts/send_mail.py` は設定が無ければ exit 2 を返し、ワークフローは `gh issue create` に切り替える（Issue を立てれば GitHub の通知メールが届く）。必要な Secrets は `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `MAIL_TO`（任意で `SMTP_PORT`＝既定 587、465 なら SMTP_SSL／`MAIL_FROM`）。**未設定でも壊れない**のが設計で、設定を促す警告だけが出る。
- 見出しの抽出・履歴の更新・件名の組み立ては `.github/scripts/ideas_digest.py` が決定的に行う。**AI に JSON を直接書かせない** — 壊れていても気づけないため。件名はシェルの `"..."` を通るので、`"` `` ` `` `$` `\` は見出しから落としてある。
- 起案プロンプトには、この CLAUDE.md の禁止事項（外部ドメインを増やさない／自動読み込みの第三者スクリプトを増やさない／`bus.html` の地図は凍結／`council.html` は対象外／自動生成ファイルを手編集する案を出さない）を明記してある。**規則を増やしたらこのプロンプトにも書き足すこと。**
- 「今日は出すに値する案が無い」日は `## ` 見出しを1つも書かせない。その日はメールも Issue も出ず、履歴も増えない。

## `data/school_news.json` (target-school website updates)

The **bottom section of `index.html`** lists recent posts from the eight affected schools' own websites (`komaki-aic.ed.jp/<slug>/` — a different domain, run by each school, not the city). `.github/scripts/fetch_schools.py` scrapes each school's top page once a day from the same workflow, taking the newest 3 article cards (`class="blogtitle"` + 公開日), and writes them here sorted newest-school-first. Cards updated within 7 days get a 新着 badge, computed client-side.

**Only the newest article of each school is displayed** — the block in `js/main.js` slices `items` to 1, and the article's own date is not repeated next to the headline because the card's footer row already shows 最終更新 (it sits there, not in the header, so it never has to wrap around the school name and badges). The file keeps all three so the display count can be changed without waiting for a re-fetch.

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
- The corner is rendered as **the same plain row list as the 市公式サイト お知らせ block**: the linked title plus 日時, nothing else. `place` and `updated_at` are still collected in the JSON but not displayed — the linked article carries them.
- The parser stops at 関連イベント / 関連ファイル / この記事に関するお問い合わせ先, because after those headings the page lists unrelated city-wide events.

## `data/chunichi_news.json` (newspaper coverage)

The **「報道でみる東部地域」 section near the bottom of `index.html`** lists Chunichi Shimbun Web articles about eastern Komaki (the Shinooka district) — **not only the school reorganization**, but local news in general. `.github/scripts/fetch_chunichi.py` crawls the paper's Komaki-city area index once a day and stores, per article, **only the headline, the publication date, the article URL, and one quoted sentence from the opening**. The body is never copied — the articles are paywalled part-way through.

**The corner displays headlines only** — the headline, its date, and the 出典 line. The stored `quote` is deliberately not rendered (it made the section long enough to bury the site's own content); it stays in the JSON so it can be brought back without re-fetching.

- **Never hand-edit** it, and never add it to the auto-update pipeline's `ALLOWED` set — it is regenerated daily.
- **This is reporting, not a primary source.** Facts on the rest of the site (figures, dates, plan contents) must still come only from the city's official information. Never cite a newspaper article as the evidence for a site edit. Because the corner now covers the district generally, most entries are not about the reorganization at all — that is intended.
- Headlines are shown **untranslated** — they are the newspaper's own words, the same policy as `school_news.json`. Only the surrounding labels are localized (`section_press` / `press_lead` / `press_note` plus an inline dict in `js/main.js`).
- Each entry links to the article and is labelled 出典：中日新聞Web. The link is what makes the headline properly attributed, so do not strip it.
- **robots.txt**: chunichi.co.jp allows ordinary crawlers (`User-Agent: *` → `Allow: /`) but bans AI crawlers (`ClaudeBot`, `GPTBot`, `CCBot`, …) outright. The script therefore identifies itself with its own UA naming this site, runs once a day, and waits 3–5 s between requests. **Do not fetch this domain with AI browsing tools.**
- Matching is by **place name** (`AREA_KEYWORDS`: 篠岡/しのおか, 桃花台, 光ケ丘・光ヶ丘, 桃ケ丘・桃ヶ丘, 桃陵, 大城, 陶小, 城山, 大草, 上末, 下末, 高根, 大山, 池之内, 野口, 市東部, 東部地区), plus `学校再編` / `しのおか学園` as a safety net for reorganization articles that never name the district. The names are the ones this site itself uses (`about.html` school-district table, `bus.html` routes, `community.html` councils); the newspaper writes 光**ケ**丘 while the school writes 光**ヶ**丘, so both are listed. Bare `陶` is excluded because it collides with 陶芸/陶器 — only `陶小` is matched.
- Scanning only the paper's **Komaki city** area index is what makes bare place names safe: everything in that list is already about Komaki.
- `EXCLUDE_PHRASES` is subtracted from the text before matching. It currently holds `大山廃寺` — a ruin in the eastern 大山 whose excavated items are displayed downtown, so city-history articles mention it without being about the district at all.
- The **photo caption** (`<p class="caption">`, e.g. 「＝小牧市大草の愛知文教大で」) is kept in the text used for *matching* — some articles name the district only there — but stripped from the text used for the *quotation*, which must start at the article's opening sentence.
- Setting `CHUNICHI_CACHE_DIR` makes the script cache article HTML and reuse it, so the matching rules can be re-tuned without hitting the newspaper's server again. It is a development aid only; CI leaves it unset.
- Articles already examined are recorded in `checked_ids` so the same article is never fetched twice; that is why the file is committed even when the displayed list does not change. Older articles that have scrolled off the area index are listed in `SEED_URLS` and fetched once.
- Changes commit as `chore: update newspaper coverage [skip ci]` and do **not** open an Issue or trigger the auto-update job.

## `data/community_actions.json` (citizen-run farewell events)

The **地域の取組 section on `community.html`**, sitting directly below the 地域協議会のイベント案内 corner, lists things local residents are doing to mark the closing schools — currently 「ありがとう大城小」, a farewell event at Oshiro Elementary on 2026-12-13. Hand-maintained; rendered by the COMMUNITY ACTIONS block in `js/main.js`. Past events drop off the list automatically (`date` compared with today).

- **This is neither official information nor reporting — it is what residents themselves have posted.** Like the 報道 corner, it is never evidence for a claim made elsewhere on the site, and never a source for the plan's contents, figures or dates.
- Every entry carries a 市民有志 badge and a 発信元 line linking the source. **Do not strip either** — they are what stops the corner reading as a city announcement.
- Event names and school names are shown **untranslated** (the organisers' own words); only the surrounding labels are localized, via an inline dict in `js/main.js`, same policy as `school_news.json`.
- **It sits next to the council-events corner, not merged into it.** Both are things the district does for itself — the councils are the form the city gives that, this is what residents started on their own — so they read as a pair of adjacent sections with their own headings. Do not fold them into one list.
- `source_url` may only point at an account listed in `PERMITTED_INSTAGRAM` in `auto_gates.py`, and Instagram links are allowed on `community.html` only (`INSTAGRAM_PAGES`). Adding an account requires updating this file, `CONTRIBUTING.txt` rule 1, `README.md` and that gate together.
- As of 2026-08-26 only the Oshiro account is known; searches found no equivalent account for 篠岡小・陶小・篠岡中. Do not guess at handles — an account that turns out to be someone else's would be presented here as if it spoke for the school community.

## `data/site-updates.json` (this site's own changelog)

The **last section of `index.html`** shows a changelog of changes made to this site itself. Unlike `news.json` and `school_news.json`, this one is **hand-maintained** — add a new entry at the top of the `updates` array when you ship something a reader would notice.

- Each entry: `date` (`YYYY-MM-DD`), `type` (`content` / `feature` / `fix`), `ja` (required), `en` (recommended). Other languages fall back `en` → `ja`, matching the i18n chain.
- **Length: 30–40 Japanese characters, 45 at the very most.** The corner shows six entries at once; anything longer turns it into a wall of text. Detail that does not fit belongs in the commit message, not here.
- **Style: one short noun-ending line (体言止め), never a sentence.** Write 「トルコ語・ビルマ語を追加」, not 「トルコ語とビルマ語を追加しました。」. No trailing 「。」. English entries follow the same shape — a noun phrase such as "Monthly calendar added to the schedule page", not "We added a monthly calendar."
- Write a **reader-facing summary, not a commit message** — "Turkish and Burmese added", not "feat(i18n): …". Internal refactors and doc fixes do not belong here.
- The list is sorted newest-first at render time and **only the newest 6 are displayed** (`MAX_ITEMS` in the `js/main.js` block); keep the full history in the file.

## `nationwide.html` (the nationwide context page)

Added 2026-08-22. It answers "is this only happening here?" with MEXT statistics and the standards the national government sets, so that a reader can judge the Komaki plan against something. It is **static hand-written content** — no JSON feed, no script, nothing on the daily workflow.

- **Every fact on it must come from MEXT**, and the four permitted `mext.go.jp` URLs are its bibliography. Numbers currently on the page: 8,850 closures FY2004–FY2023 and 298 in FY2023 (191/82/25), 92 in Aichi (62/14/16), 74.4% of 7,612 surviving buildings reused, ~2,000 fewer public schools and ~850,000 fewer pupils in ten years, standards of 12–18 classes (18–27 for compulsory education schools), 4 km / 6 km, "about one hour", the 2026-08-05 revision (notice 8文科初第1125号) and its 広域化 / 総合化 / 現代化 pillars, ~40% / ~50% below 12 classes, ~16% one-elementary-one-JHS municipalities, 5,812,000 / 3,105,000 pupils, 232 public compulsory education schools with 75,828 pupils (FY2024).
- **No 賛否 content, and no citizen-run events.** The page deliberately carries no pro/con framing — that belongs on `voices.html` — and does not advertise meetings or lectures held by any group, whichever side they are on. A neutral-looking national page is the easiest place on this site to smuggle in a position, so keep it descriptive.
- The 国の基準 ⇔ 小牧の計画 table is the point of the page. Its right-hand column restates facts that already exist elsewhere on this site (令和15年に各学年1学級, 2km でスクールバス, ガイドラインは未定) — when those change, change them here too.
- The 手引 was revised in August 2026 and will be revised again. When it is, the numeric standards must be re-checked against the new 改訂版 rather than assumed to carry over.
- Not in the auto-update pipeline's `ALLOWED` set: the city's page changes do not move national statistics.

## `review.html`（計画の検証と提案のページ）

2026-08-28 追加。**このサイトで唯一、当サイト自身の検証と提案を載せるページ**です。他のページは「公式情報をわかりやすく伝える」に徹していますが、ここだけは違います。だからこそ書き分けの規則が重い。

- **事実と意見を版面で分ける。** 【事実】は公表資料にもとづき出典つき（`.rev-fact`、左帯は `--neutral-color`）、🔎 検証・💡 提案は当サイトの考え（`.rev-view`、左帯は `--accent`）。この色分けと帯を外さないこと。冒頭の `rev_stance`（市の見解ではない旨）も外さない。
- **事実の出所は3つだけ** — 市の公式情報、『篠岡地区 学校再編だより』、文部科学省。MEXT の数値は `nationwide.html` 経由で引用し、**このページから `mext.go.jp` に直リンクしない**（`MEXT_PAGES` は `nationwide.html` 限定のまま）。
- **「確認できなかったこと」を必ず残す。** `rev_o1`〜`rev_o6` と各提案の「確認できていないこと」は、当サイトが調べきれていないという意味であって「存在しない」という意味ではない。ここを削ると、検証が断定に化ける。
- **提案は市が検討しているものではない。** `rev_s3_lead` にそう書いてある。市が実際に検討を始めたら、その事実は出典つきで別途書き、提案からは外すこと。
- 翻訳は **10言語すべて**（2026-09-02 に `rev_*` 76キーを pt/vi/tl/es/zh/id/tr/my へ追加）。`rev_*` を足したり書き換えたりしたら、10言語ぶん入れて `build_page_dicts.py` を回すこと。**`ja-kids` は未整備**で、こどもむけ表示では日本語の本文がそのまま出る（事実と見解の書き分けを平易な日本語で崩さずに書けるか未検証のため、意図的に手を付けていない）。

## `js/main.js`

Self-contained IIFE blocks handling: hamburger nav, active nav link highlighting, auto-date status, "last updated" display, upcoming schedule expiry (`data-expires`), FAQ accordion, voice filter, official news rendering, target-school website updates, the share buttons at the bottom of every page, and the interactive calendar on `schedule.html`. Calendar events live in `data/events.json` (`{"events": {"YYYY-MM-DD": {ja, en, pt, vi, tl, es, zh, id, tr, my}}}`), fetched at runtime by the calendar block — edit that file, not `main.js`, to add/change events. All 10 language labels are required per event. If the fetch fails or the file is empty, the calendar section hides itself.

### SHARE BUTTONS (every page)

Every page carries a `<section class="section share" id="share">` just above `</main>`: the heading, lead and closing note are in the HTML with `data-i18n`, and the buttons themselves are built by the SHARE BUTTONS block in `js/main.js` into `#share-buttons` / `#share-star`.

- **Buttons**, in row order: LINE, X, Facebook, はてなブックマーク, Threads, Bluesky, Reddit (`<a target="_blank">`, URL built by the entry's `url()`), Mastodon (`<button>`, see below), Instagram / TikTok (`<button>`, copy-only, see below), リンクをコピー, and — only where `navigator.share` exists — ほかのアプリで共有. The native-share button is what covers WhatsApp / Zalo / Messenger and is the only route that actually *opens* Instagram / TikTok, so do not drop it in favour of adding more per-service buttons.
- **Instagram and TikTok publish no share intent that accepts a link**, so their buttons copy the URL and show 「{app} に貼り付けてください」 instead of opening anything. Their labels say （リンクをコピー） so that is visible before the press. If either ever ships a real intent URL, move it into `SERVICES` and drop the copy path — do not invent an endpoint for them in the meantime.
- **Mastodon is decentralized**, so there is no single endpoint: the button asks once for the reader's server domain, normalizes it (`https://`, trailing path and `@user@` forms are all stripped), keeps it in `localStorage` under `komaki_mastodon`, and opens `https://<host>/share?text=`. A third-party redirect service would be simpler but would add an external host to a site that has exactly one; don't. The prompt text lives in the dictionary (`share_mastodon_prompt`) and is read out of a hidden `data-i18n` node, because `main.js` has no access to the dictionary itself.
- **The buttons carry no text label — only an icon**, with the service name in `aria-label` (via `data-i18n-aria`) and mirrored into `title` on hover by `syncTitles()`. With ten of them in one row, per-button text labels made the share box the largest block on the page. The icons are letters and symbols set in the site's own font, not brand logo images: an image would add an external host (or bytes) and a fixed width that the ten languages do not share. `share_lead` / `share_note` are deliberately one short line each for the same reason.
- **The shared URL is built from `<link rel="canonical">` plus the current language**, not from `location.href`. `i18n.js` writes `?lang=` into the address bar only *after* the dictionary fetch resolves, so reading the address bar gives a one-step-stale URL right after load and right after a language switch. The block captures the canonical value once, at parse time, because `i18n.js` later rewrites that element to the per-language URL.
- **`href` and the page title are recomputed on `pointerdown` / `focusin` / language change**, since `document.title` is replaced by `i18n.js` after its fetch. Without that the page would be shared under its Japanese title.
- **Labels use `data-i18n`, not an inline dictionary.** The news/press blocks carry inline dicts because they render before the dictionary arrives; this block builds its DOM before `applyDict` runs, so the dictionary can own the text. The keys are invisible to the HTML scanner, so they are listed in `RUNTIME_KEYS` in `build_page_dicts.py` — **add any new share key there too**, or non-Japanese pages will silently fall back to the inline Japanese default.

**はてなスター** sits below the buttons as ラベル → page-title link → star container, the standard Hatena Star arrangement (`Hatena.Star.SiteConfig.entryNodes`). Two things about it are deliberate:

- Its URL is the **bare canonical URL with no `?lang=`**. A star is a reaction to the page, not a share; keying it per language would scatter one page's stars across ten URLs.
- `HatenaStar.js` is **the only external script this site loads**, and it is not loaded until the share section comes within 200 px of the viewport (`IntersectionObserver`; a click on the star row is the fallback where that API is missing). A reader who never reaches the bottom of the page causes no request to Hatena. If a second third-party script is ever added, revisit this — the "no automatic third-party traffic" property is worth more than any one widget.
- **Loading it late takes two non-obvious steps** (both were got wrong first time round, and the failure is silent — the label renders with no star next to it):
  1. Set `Hatena.Star.SiteConfig` **after** the script loads, never before. The script's own line is `void 0 === window.Hatena.Star && (window.Hatena.Star = {…})`, so pre-creating `window.Hatena.Star` to hold the config makes it skip its own assignment and never initialize.
  2. Its initializer is registered as `window.addEventListener("DOMContentLoaded", …)`, which has long since fired by the time the section scrolls into view, so it must be re-triggered with `window.dispatchEvent(new Event('DOMContentLoaded'))`. There is no public entry point for this — `Hatena.Star.EntryLoader.loadEntries()` does not exist in the current build. Double-firing is safe: it skips any entry node that already contains `[data-hatena-star]`.
- In the current build **both the star's URL and its displayed title are read from the `uri` node** (the title comes from that element's `innerText`, not from the `title` selector). The permalink's text is the page title, so both readings give the right answer — keep it that way rather than moving the title into a separate node.
- If nothing renders within 4 s the whole star row hides itself, so a broken widget never leaves a label with no star beside it.

### 学年ビュー（`schedule.html`）と回覧板シート（全ページ）

2026-08-30 追加。どちらも「共有」を広げるための機能で、扱いに注意が要る。

**学年ビュー（`GRADE VIEW` in `js/main.js`）** — `?grade=` で学年を1つ選ぶと、`.event-item` の各予定に「そのときお子さんは何年生か」を添える。`window.KomakiGrade()`（`main.js` 冒頭）が `?grade=` → `localStorage`（`komaki_grade`）の順で解決する。

- **これは公表日付に対する学年の足し算にすぎない。** 市の計画に学年別の扱いがあるという意味ではなく、どの学校に通うかは住所で決まる。その旨は `grade_lead` に書いてある — **消さないこと**。ここを外すと、ただの計算が「市の学年別方針」に読めてしまう。
- 学年コードは**令和8年度（2026年度）の学年**。`y3/y4/y5`＝年少・年中・年長、`e1`〜`e6`＝小1〜小6、`j1`〜`j3`＝中1〜中3。基準は `BASE_FY = 2026`。**年度が変わったら `BASE_FY` を上げる**（上げないと1年ずれた学年が出る）。年度は4月始まりで、1〜3月の日付は前年度として数える。
- 予定の選り分けはしない。「この予定はこの学年に関係する」という判断は公表資料に無く、当サイトが作ると事実になってしまうため、**全部の予定に学年を添えるだけ**にしてある。
- `.ics` は静的ファイルではなく、押されたときに `data/events.json` から組み立てる。`events.json` は自動更新パイプラインの編集対象なので、静的な `.ics` を置くと更新のたびに古くなる。折り返しは RFC 5545 の**75オクテット**規定で、日本語は1文字3バイトなので文字数で数えないこと。
- 共有 URL にも `grade` が乗る（`shareUrl()`）。同学年の保護者にそのまま渡せる。

**回覧板シート（`BOARD SHEET` in `js/main.js`）** — A4 1枚を2種類刷る。共有欄いちばん右の「回」ボタンが**そのページの要約**、`index.html` の「最新の動き」内のボタン（`#latest-print-btn`）が**4コーナーの新着一覧**。この地区で実際に情報が回るのは回覧板と掲示板で、SNS のリンクでは届かない層がいる。

- **シートの文章はページ内の既存要素からしか取らない。** ページ要約は `main h1`・`meta[name=description]`・`main h2.section-title` と**その見出しが受け持つ範囲**（次の見出しの手前まで）の先頭段落、最新の動きは `h3.section-title.sub` と各コーナーの描画済み一覧（`.official-news-item` / `.school-card` / `.press-item` / `.update-item`）。ここで独自の要約を書き起こすと、出典のない二次情報が紙になって出て行く。コーナーの描画クラス名を変えたら、この抽出も直すこと。
- **ページ要約シートは「いま近づいている予定」で始める**（`urgentBlock()`、見出しは `board_now`）。紙が回っているのは「いま」なので、節の要約をページ順に並べただけではサイトの目次を刷ったものにしかならない。中身はそのページの `.deadline-box[data-expires]` / `.upcoming-item[data-expires]`（期限切れは除く）と、足りなければ年表の未来ぶん（`.status-item` / `.event-item` の `data-start` が今日以降）。**最大3行**にし、ここに出た行は下の節から取り除く（狭い紙面で同じ予定が二度出ると目立つ）。期限も予定も無いページ（`about` / `review` / `map` など）ではこのブロックは出ない。
- **最新の動きシートは直近7日ぶんだけ**（`LATEST_DAYS`）。画面のコーナーは30日ぶりを出すが、紙は「いまどうなっているか」を短く伝えるためのもので、1か月ぶんを刷ると読み飛ばされる。絞り込みは各コーナーが描画時に付ける **`data-date="YYYY-MM-DD"`**（`.official-news-item` / `.school-items li` / `.press-item` / `.update-item`）で行う。**コーナーの描画を書き換えるときは `data-date` を落とさないこと** — 日付が無い項目は「直近1週間」として配れないので黙って落ちる。紙の説明文は画面の `latest_lead` ではなく、`board_latest_range` で「いつからいつまでの分か」を出す（該当なしのときは `board_latest_none`）。
- **範囲は `<section>` ではなく見出し単位で切る。** `faq.html` のように1つの節へ `h2` が4つ並ぶページがあり、節で切ると4つとも同じ本文がぶら下がる。
- **文は絶対に途中で切らない。** 字数で切ると「…」で尻切れになり、回覧板として読めない。本文は句点で文に割って入る本数だけを載せ、一覧の各行も句点で終わる分（最大2文）だけを残す。長さの調整は「文の本数 → 一覧の項目数 → 文字の倍率 → 末尾の見出しごと落とす」でやる。**字数での切り詰めを復活させないこと。**
- **紙に載せたくないものは HTML 側で外す。** 節ごとなら `<section data-board="skip">`、1文だけなら `<p data-board="skip">`。現在の指定は `index.html` の「各ページへのリンク」節と「最新の動き」の帯（どちらも他ページへの案内で、紙に刷っても内容が伝わらない）、`index.html` の `status_digest`、`community.html` の `comm_sec5_disclaimer`（どちらも案内文・注記）。**判定を賢くしようとしないこと** — 「カードの中は見ない」等のヒューリスティックを入れると、内容がカードで出来ている節（スクールバスの運行の概要など）まで巻き添えで落ちる。
- **文が取れない見出しは載せない。** 見出しの羅列は要約として読めないので、「見出しを全部入れる」ことより「読める文が付いていること」を優先する。`voices.html` はこの結果ブロックが0になり、題名＋説明＋QRだけの紙になる。賛否の声は選び方しだいで意味が変わるので、機械的に抜粋しないほうがよい。
- **年表は「これからの予定」を優先する。** 日付（`data-start`）を持つ並びは、今日以降のものがあればそれだけを載せる。紙で配るものが去年の実績から始まっていては回覧板として役に立たない。
- **回覧板の体裁**：左肩に「回覧」の枠（`board_stamp`）、その横に発行元と非公式である旨。発行元を枠のすぐ横に置くのは、自治会や市が出した回覧と取り違えられないようにするため — **この並びを崩さないこと**。回し読みを促す文や確認欄のマスは置かない。
- **A4 1枚に収める仕掛けが `#board-sheet` を `display:none` にできない理由。** シートは常に DOM にあり、印刷と同じ幅 178mm（A4 210mm − 左右16mm）で画面外（`position:fixed; left:-10000px`）に置いてある。だから刷る前に実寸で高さを測れる。`fit()` が上限 265mm（297mm − 上下16mm、実測 px に換算）に収まるまで「1行の字数」「1コーナーの行数」「文字の倍率」を `LADDER` の順に詰め、それでも溢れたら**末尾のコーナーから落とす**（先頭ほど重要なため）。`display:none` に戻すと高さが 0 になり、常に最も詰めた版が刷られる。
- 切り詰めたことは `board_excerpt` として紙面にも書く。全文はサイトにある、と紙の上で分かるようにするため。
- **QR は自前生成しない。** `.github/scripts/build_qr.py`（segno）が `qr/<pageId>.<lang>.svg` を110枚（11ページ×10言語、誤り訂正 H）書き出し、それをコミットしてある。ページ側は `<img>` を1枚読むだけ。JS の QR エンコーダを自作すると壊れていても「QR に見える絵」が出て、印刷して配ったあとまで気づけない。CDN から読めば「自動で読む外部スクリプトははてなスター1本だけ」という方針が崩れる。**ページを増減したら `build_qr.py` を実行してコミットすること。**
- 印刷指定は `@media print` の `html.board-printing`。**ふつうの Ctrl+P はページをそのまま印刷する**（本文を刷りたい読者がいるので既定は変えない）。ボタンを押したときだけシート1枚になる。`body > *:not(#board-sheet)` の `:not()` は必須 — `!important` は詳細度に勝つので、除外しないとシート自身も消える。
- `board_btn` は実行時に作るボタンの `aria-label` で HTML に現れないため、`build_page_dicts.py` の `RUNTIME_KEYS` に入れてある。

### 新機能カットイン（`index.html` 上部）

`NEW FEATURE CUT-IN` in `js/main.js`。`data/site-updates.json` の `type: "feature"` のうち、`date` が**今日から14日以内**（`WINDOW_DAYS`）のものを、ヘッダの上にスライドインする帯で出す。

- **カットイン専用のお知らせデータを作らないこと。** 文面は更新履歴そのもの。別データにすると更新履歴と食い違ったまま気づけなくなる。**機能を足したら更新履歴に `type: "feature"` の1行を足すだけ**でここは自動的に出て、14日で自動的に消える（消し忘れが起きない）。
- 閉じるとその項目は二度と出ない（`localStorage: komaki_feature_seen`）。複数あるときは最大3件を7秒ごとに入れ替え、マウスやフォーカスが乗ったら止まる。`prefers-reduced-motion` では動きを出さない。
- 帯は `position: sticky` のヘッダの**上**（通常フロー）に置く。ヘッダに重ねると本文が読めなくなる。
- `.feature-cutin` の `display:flex` は UA の `[hidden]{display:none}` に勝つので、`.feature-cutin[hidden] { display:none; }` が要る。無いと出す前と閉じたあとに padding ぶんの帯が残る。
- リンク先は `index.html#site-updates`。そのアンカーを外すとカットインの「くわしく」がどこにも飛ばなくなる。

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
- **Three date attributes, three jobs — do not conflate them.** `data-start` (**required on every** `.status-item` and `.event-item`) is the item's *start* date and is **only** used to keep the list in chronological order; `data-event-date` is the *end* date and drives the 完了 badge; `data-expires` hides an `.upcoming-item` once past. List the bar's near-term items individually, mirroring `schedule.html`/the calendar (text via `upcoming_dateN`/`upcoming_nameN` keys).
- Kids mode (`ja-kids.json`) targets a **3rd-grade reading level**; see `CONTRIBUTING.txt` rules 5 & 6 for full content-management rules.

### Keeping the two timelines in order

The *Current Status* list (`index.html`) and the *Key Events* list (`schedule.html`) are appended to constantly, and appending is exactly what breaks them: a June item added after an August one reads as though June came later. So:

- **Every `.status-item` and every `.event-item` carries `data-start="YYYY-MM-DD"`**, and each list is written in ascending `data-start` order. When you add an item, put it in its chronological place — do not append to the end.
- `data-start` is the **start** date. For a span (「2026年〜2027年3月」) use the start; for a month with no day (「2026年10月」) use the first of the month; for something that begins right after a dated event, use the day after it (e.g. 校章の選考 starts 2026-05-19, the day after the 5/18 deadline).
- Ties keep their existing relative order, so two items in the same month stay where you put them.
- **A list is a `<h3>`/`<h4>` heading's worth of items.** `schedule.html` 令和7年 deliberately holds two lists — 「学校を考える会（全5回）」 then 「その他の取組」 — so the 5th 考える会 (2025-10-11) sitting above 2025-06-13 is correct. Order is checked *within* each heading's block, never across headings.
- **DOM order is authoritative — nothing may reorder these lists at runtime.** AUTO DATE STATUS used to move a newly-done item above the first `.current` one; with the source now sorted by `data-start` that silently undid the sorting in the browser (2026-05-18 and 2026-06-06 jumped above 2026-02-08). That block sets state only.
- Items whose date has definitively passed carry a hand-written `done` class **and** the 完了 label in the HTML, so the list reads correctly with JavaScript disabled; the script then just re-applies the same state.
- `check 8` in `.github/scripts/auto_gates.py` fails the build on a missing `data-start`, a reversed pair, **or a reordering call reappearing in AUTO DATE STATUS** — so this survives the auto-update pipeline's edits too.

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

Every HTML page follows the same pattern: `notice-banner` → `<header>` (with `.lang-switcher` containing `.kids-toggle` and `.lang-select`) → `<main>` → `<footer>`. Both `js/i18n.js` and `js/main.js` are loaded at the end of `<body>`. Pages are standalone — there is no shared template or server-side include. Every page also carries the SHARE section (`<section class="section share" id="share">`) as the last thing inside `<main>`. When adding a new page, copy the full header/share/footer blocks from an existing page — **and add it to `sitemap.xml` and `files.txt`**, plus `meta_title_<pageId>` / `meta_desc_<pageId>` keys in every language file.

### The 「最新の動き」 group on `index.html`

The bottom of `index.html` is split in two. Everything down to **現在の状況** is the site's own hand-written explanation; everything below the `.group-head` band (`<section id="latest">`, key `section_latest`) is **automatically refreshed every day** — 市公式サイト お知らせ (`id="news"`), 対象校ホームページの更新, 報道でみる東部地域, サイトの更新履歴. The band's `<h2>` groups them, so those four corner headings are `<h3 class="section-title sub">`, not `<h2>` — do not promote them back. The reader benefit is that "what this site says" and "what just happened" are no longer interleaved.

- `.group-head` and `.group-head + .section` in `css/style.css` trim the padding so the band and the first corner read as one block. If a corner is inserted between them, that pairing breaks.
### The map on `bus.html`

> **⛔ この地図は完成・凍結。ユーザーの明示的な指示がないかぎり、図形・枠・縮尺・色・線を一切変更しないこと。**
> 2026-08-30 に市の公表図と同じ枠・同じ縮尺に合わせ、紫の対象エリアを公表図からの読み取りに置き換えて完了した。
> 「もっと良くできそう」に見えても手を出さない。以下は変更するためではなく、なぜこうなっているかを保存するための記録。

The 対象エリアの地図 draws **three sources with different accuracy** — see the header comment of the BUS SERVICE AREA MAP block in `js/main.js`. The two that matter:

- **The 通学区域 (red line) is not traced — it is built from government open data**, and must not be redrawn by eye. It composes the five current elementary-school districts from 国土数値情報「小学校区」 (MLIT, A27-21) exactly the way the newsletter says they merge, and splits 大城小学校区 along 町丁 boundaries from the e-Stat census small-area data (Statistics Bureau): 大草・城山三丁目 go east, 城山二・四・五丁目 go west. The resulting areas are **桃花台東 20.31 km² and 桃花台西 6.89 km²** against the newsletter vol.3 published 20.3 and 6.9 — a match to the first decimal in both, which is what validates the composition. Note 城山一丁目 belongs to 桃ヶ丘小 (hence west), not to 大城小.
- The previous by-eye trace put **城山四丁目 and 高根三丁目 on the wrong side** and left **大字大山 (5.1 km²) out of the map entirely**, understating 桃花台東 by 9.05 km². If the line ever looks wrong again, re-derive it from the same two datasets rather than adjusting it by hand.
- **The 対象エリア (purple) is no longer a by-eye trace — it is read off the city's own figure.** The coloured pixels of `R9sinooka_busarea.png` are extracted by colour (`b - r > 15`), the red 学校区 line drawn on top of them is added back where it touches purple, and the result is clipped to the district polygons above and vectorised (Douglas–Peucker at 2 px ≈ 7.6 m). Error against the original figure is about one pixel (~4 m); the old trace was off by up to ~300 m. **Re-derive it the same way rather than adjusting it by hand.**
- **The area cross-checks against the city's published figures.** Inside the frame: bus area **12.28 km²**, district 20.72 km², so the walking area comes to **8.42 km²** against the published 8.7 km² (5.2 + 3.5). District outside the frame is 6.48 km², and the bus area missing from the frame is 18.5 − 12.28 = 6.22 km² — the two agree to within 0.03 km². If a future edit moves these numbers, that arithmetic is the check.
- **Inside the frame, uncoloured land inside the red line now means "walking area", not "missing from the figure"** — the frame *is* the figure. Only the land beyond the frame is undrawn. `bus_map_legend_walk` and `bus_map_caveat` were rewritten for this; do not reinstate the old "not in the original figure" wording for the in-frame area.
- **The purple is a single polygon with a hole** (a non-bus pocket on the east side, ~0.005 km²), so `js/main.js` keeps `busPolys` as an array of ring-arrays and paints with `fill-rule="evenodd"`. Do not go back to drawing `coordinates[0]` only.
- **The map frame is the city's own figure's frame.** `view_bbox` at the top of the geojson is the ground extent of `R9sinooka_busarea.png` (the 対象エリア図 on the city's `48603.html`), obtained by aligning the district boundary onto that image's 学校区 line: **1639×1179 px at 3.785 m/px**, i.e. 6203.6 × 4462.6 m. `VIEW_W = 1639` in `main.js` matches it, so one SVG unit is one pixel of the official figure and the two are at the same scale in the same frame. There is no padding — the map fills the frame exactly, as the original does; `UI_PAD` insets only the scale bar and the north arrow. 桃花台東 continues past the north-east corner, and it is cut in the original figure too — that is intended, and `bus_map_caveat` / `bus_map_legend_line` both say the district continues beyond the frame. Both district labels must stay inside `view_bbox`. Remove `view_bbox` and `main.js` falls back to fitting everything (a much wider frame that shrinks the built-up part of 桃花台 by about a third).
- **`px()`/`py()` use the real length of a degree in each axis** (`MPD_LON` / `MPD_LAT` series), not `cos(lat)` alone — the plain-cosine form stretched the map vertically by ~0.5%, which is enough to break the exact-scale match above.
- `boundary_note` on each `district` feature records the derivation; `bus_map_caveat` states the two accuracy levels to the reader; `bus_map_osm` credits OSM **plus** 国土数値情報 and e-Stat. Do not drop any of the three.
- **`cls: 'local'` roads are the 桃花台 main local streets (OSM `tertiary`) plus 桃花台鳥居松線** (named 桃花台・春日井線 in OSM). They live in the `localroad` layer so a reader can switch them off; the 幹線 keep the `road` layer and are drawn above them.

- **Two anchors are linked from other pages and must not be removed**: `index.html#news` (from `actions_note` on `community.html`) and `community.html#qa` (from the 「ほかのページにもQ&A」 box on `faq.html`). Both carry an HTML comment saying so.
- The site's Q&A deliberately lives in three places — `faq.html`, the FAQ section of `bus.html` (`#faq`), and the よくある疑問 section of `community.html` (`#qa`). Keeping each next to its context is the point; the box at the bottom of `faq.html` (`faq_more_*`) is what stops the other two from being unreachable for a reader who treats `faq.html` as the index of questions.

## SEO

| Piece | Where | Notes |
|---|---|---|
| `robots.txt` | repo root | Allows everything; points at the sitemap. Kids mode is excluded via a JS-injected `noindex` (`applyKidsSeoMeta`), not here. |
| `sitemap.xml` | repo root | Hand-maintained, one `<url>` per page (11), each carrying the full `xhtml:link` alternate set. No `lastmod` — a stale date is worse than none. |
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
| 6 | External links (city / MEXT / Instagram) | Each domain is confined to its permitted URLs, and MEXT/Instagram additionally to their permitted pages |
| 8 | Timelines are in ascending `data-start` order | Both lists are append-targets; an out-of-order entry silently misstates when things happened |
