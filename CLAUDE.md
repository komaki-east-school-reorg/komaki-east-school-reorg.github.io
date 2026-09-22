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

**1. Illegal external links** — exactly **three** city URLs are permitted, all index pages. No PDF direct links, no article subpages.

| Permitted URL | Used by |
|---|---|
| `.../kyoiku/kyouikusoumu/303/index.html` | school reorganization (Education General Affairs Div.) — site-wide |
| `.../kenkouikigai/sasaeai/3/3_2/index.html` | community councils (Mutual Support Div.) — `community.html` only |
| `.../toubumachidukuri/tobumachidukurisingikai/index.html` | eastern-district development (Eastern District Office) — the 出典 line of the 地域の取組 corner, built in `js/main.js` (added 2026-09-13 on the user's say-so) |

```bash
grep -rn "city\.komaki\.aichi\.jp" *.html js/*.js \
  | grep -v -e "303/index\.html" -e "sasaeai/3/3_2/index\.html" \
           -e "tobumachidukurisingikai/index\.html"
# Any output = violation. Replace with one of the permitted URLs.
```

The same three URLs are encoded in `PERMITTED_LINKS` in `.github/scripts/auto_gates.py` — keep them in sync. The third one is matched with its `index.html` suffix on purpose, so the pages **under** it (`.../tobumachidukurisingikai/34277.html`, `.../toubumatidukurinyu-su/index.html`) stay forbidden. Adding a fourth requires updating this file, `CONTRIBUTING.txt` rule 1, `README.md`, and that gate together.

Several other domains are permitted and are outside this grep. **Chunichi Shimbun Web article URLs** (`chunichi.co.jp/article/<id>`) appear in the 報道 corner on `index.html` via `data/chunichi_news.json`, where each headline must link to its source — see that file's section below. And the **eight target schools' own homepages** (`komaki-aic.ed.jp/<slug>/`) may be linked: they are a different domain run by the schools, and the URLs are stable. They appear in `map.html` (the 各校ホームページ block) and, via `data/school_news.json`, in the bottom section of `index.html`. The grep above does not cover them — when the set of schools changes, keep `SCHOOLS` in `fetch_schools.py` and the `map.html` block in sync. And **four MEXT pages** (`mext.go.jp`) are linked from `nationwide.html` only, as the sources for the nationwide figures and the national standards — see that page's section below. And **one citizen-run Instagram account** (`instagram.com/arigato.ohshirosho`) is linked from the 地域の取組 corner, which appears on `community.html` and — as the same list inside the 最新の動き group — on `index.html` — see `data/community_actions.json` below. Finally, the **share buttons** at the bottom of every page point at seven sharing endpoints (`social-plugins.line.me` — `line.me/R/share` on phones, see below —, `x.com/intent/post`, `www.facebook.com/sharer/sharer.php`, `b.hatena.ne.jp/entry/panel/`, `www.threads.net/intent/post`, `bsky.app/intent/compose`, `www.reddit.com/submit`), at whatever Mastodon server the reader names (`https://<host>/share`), and load one external script (`s.hatena.ne.jp/js/HatenaStar.js`) — see the SHARE BUTTONS section below. Those URLs are built in `js/main.js`, never written into HTML or a dictionary, and are **not sources**: nothing on the site may cite them.

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

Translations live in `data/i18n/<lang>.json` (ja, en, pt, vi, tl, es, zh, id, ko, ne, tr, my). `js/i18n.js` fetches the files at runtime. For Japanese it loads `ja.json` alone; **for every other language it loads only `en.json` and the target language**, merged as `Object.assign({}, en_dict, lang_dict)`, so a key missing from the target language falls back to English. English is the bridge because a reader who chose Turkish or Burmese is far more likely to read English than Japanese. The minimum requirement when adding a new key is entries in `ja` and `en`.

### 地域差のある3言語（2026-09-17 ユーザー指示）

`pt` / `es` / `zh` は、読者の出身地に合わせた語をつかう。**見出しの自動翻訳（`data/headline_i18n.json`）も同じ基準**で、`translate-headlines.yml` のプロンプトに同じ規則を書いてある — 片方だけ直すと本文と見出しで語がずれる。

| 辞書 | どの地域向けか | 避ける語 → つかう語 |
|---|---|---|
| `pt` | **ブラジル** | autocarro→ônibus、utilizador→usuário、percentagem→porcentagem、facto→fato、sítio→local、「está a + 不定詞」→「está + 動名詞」 |
| `es` | **中南米** | autobús→bus、ordenador→computadora、móvil→celular、ratón→mouse、aparcamiento→estacionamiento、acto→evento、instituto（＝中学の意味で）→secundaria、vosotros は使わない |
| `zh` | **中国大陸・簡体字** | 保护者→家长、出处→来源、手引→指南、小学校→小学、中学校→中学、通学区域→学区、通学路→上学路、通学→上下学 |

- **`pt` の `ginásio` は体育館の意味だけにつかう。** 中学校は `escola secundária`。ブラジルでは ginásio が体育館を指すので、両方に使うと読めない（2026-09-17 に統一）。
- `lang` 属性と `Intl` のロケールは `es-419`（中南米スペイン語）。`hreflang` は `es` のまま（スペイン語圏全体に当てる）。

### Page-scoped dictionaries

`i18n.js` does not fetch the whole-site dictionary. It fetches **`data/i18n/pages/<pageId>.<lang>.json`** — the subset of keys that page actually uses — and falls back to the full `data/i18n/<lang>.json` on a 404. Each page uses only 9–20% of the 661 keys, so this cuts a page view from ~45 KB to 4–10 KB gzip on the critical render path.

Those files are **generated**: run `python3 .github/scripts/build_page_dicts.py` after changing any `data/i18n/*.json` or adding a `data-i18n` attribute to a page, and commit the result. Never hand-edit `data/i18n/pages/`. `check 5` in `auto_gates.py` runs the generator with `--check` and fails if the committed output is stale; the daily workflow regenerates them after the drafter AI edits any dictionary. A *stale* page dictionary is worse than a missing one — a missing file 404s and falls back, while a stale file serves old text with a 200.

Keys that `main.js` attaches at runtime (`status_done`, `event_status_*`) never appear in the HTML, so they are listed in `RUNTIME_KEYS` in the generator and force-included in every page.

**トップの「各ページへのリンク」の説明文（`ql_<ページID>_p`）は、そのページに実際に載っている内容を書く。**ページに節を足したり中身を大きく変えたりしたら、この説明文も12言語＋こどもむけで直すこと（2026-09-20 ユーザー指示。節見出しを機械的に並べる案は試したうえで、要約文を直すほうを採った）。

**`ja.json` is deliberately not fetched for non-Japanese languages.** It used to be the first of three layers, but `ja` and `en` carry identical key sets, so the `en` layer overwrote every one of its keys — the `ja` layer contributed zero keys to the merged dictionary while costing ~23 KB gzip on every page view, on the critical render path (`body` stays hidden until `.i18n-ready`). If a key were ever missing from `en`, the element simply keeps the Japanese default text already written inline in the HTML, which is the same thing the `ja` layer would have supplied. `check 3` in `.github/scripts/auto_gates.py` machine-verifies the `ja` ⇔ `en` key-set equality this relies on — **do not remove that gate.**

There is also `data/i18n/ja-kids.json`: when the kids-mode toggle is active (Japanese only), it is fetched and merged on top of `ja.json` (`Object.assign({}, ja_dict, kids_dict)`), overriding keys with simpler hiragana/easy-Japanese text.

Language preference and kids-mode state are persisted in `localStorage` under `komaki_lang` and `komaki_kids`. (Other per-reader keys: `komaki_grade`, `komaki_mastodon`, `komaki_feature_seen`, `komaki_seen_items` — see their sections.)

### Language in the URL (`?lang=`)

Every page also accepts `?lang=<code>` (the codes in `LANGS`, e.g. `about.html?lang=pt`). **The URL wins over `localStorage`**, so a link shared in a community group opens in that language for someone who has never visited. After the dictionary is applied, `i18n.js` rewrites the address bar to match the selected language via `history.replaceState` (no history entry — a back button that only rewinds the language is confusing), and updates `<link rel="canonical">` and `og:url` to the same URL. Japanese is the bare URL with no parameter; it is the canonical form.

**First visit: the browser's language picks the initial language** (added 2026-09-14). When the URL has no `?lang=` and `localStorage` has no `komaki_lang`, `detectFirstVisitLang()` at the top of `i18n.js` walks `navigator.languages` and takes the first of the 10 supported languages (`fil` → `tl`; a Japanese hit means "stay Japanese"). It writes that language into the URL **synchronously, before `main.js` runs**, so `window.KomakiLang()` and the dictionary agree. Only on that auto-selected visit, a one-line bar under the header says so and offers 「日本語で見る」 (sets `komaki_lang=ja` and reloads the bare URL) — for Japanese speakers whose phones are set to English. **Robots and automation are excluded** (`navigator.webdriver`, and a UA regex for bot/crawl/spider/lighthouse/headless/preview…): a crawler's browser language is usually English, and letting it through would index the Japanese pages as English. Shared links (`?lang=`) and anyone who has visited before are never auto-switched.

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

### 見出しの `<small>` 副題（62キー）

節見出し（`h2.section-title` など）は `見出し本文<small>副題</small>` という形の1キーで、`data-i18n-html` で流し込む。副題の言語は**たった1つの規則**で決まる（2026-09-06 ユーザー指示）：

> **`en` の副題は日本語。それ以外のすべての言語の副題は英語。**

| 辞書 | 見出し本文 | `<small>` 副題 |
|---|---|---|
| `en` | 英語 | **日本語**（`ja` の見出し本文をそのまま） |
| `ja` / `ja-kids` / 他8言語 | その言語 | **英語** |

- **副題に見出しと同じ言語を入れない。** 英語見出し＋英語副題（`Key Points<small>Key Points</small>`）や、ポルトガル語見出し＋ポルトガル語副題（`Pontos-Chave<small>Destaques</small>`）は同じ語が二度出るだけ。`en` に日本語を置くのは、英語話者が市の日本語資料と照合する手がかりになるため。
- **`en` の副題で、見出しの先頭に絵文字があるキーは副題から絵文字を落とす**（`rev_s2_h` など6キー）。両方に付くと同じ絵文字が2つ並ぶ。
- `council_s1_h`〜`s5_h` は 2026-09-06 まで `ja`・`ja-kids`・一部言語で副題が日本語だったが、上の規則に合わせて英語に統一した。
- `ja-kids` は 62キー中 24キーにしか副題がない（`rev_*` など残りは副題ごと落としてある）。**副題が有るものは英語**、という点だけ守ればよい。
- 新しい節見出しを足すときは、`ja` に英語副題・`en` に日本語副題・他言語に英語副題、という形をそろえること。

## Important constraints

- **市の資料の文面をそのまま載せない（ユーザー指示 2026-09-13）。** 計画・パブリックコメントの回答・説明会の質疑応答・市議会だよりなどは、読んで理解したうえで**当サイトの言葉で書き直す**。数値・日付・議決結果のような事実はそのまま使ってよい。**書き直していることはページに明記し**（共通キー `recomposed_note`／`council_ref_box`／`voices_pc_note`）、**その理由は書かない**（同指示）。
- **Header site name is permanently Japanese.** The `<a class="site-title">` element does not get a `data-i18n` attribute. The `<span data-i18n="site_sub">` subtitle inside it is translated, but the main site name text is not.
- **All facts must come from official sources** — the permitted city URL above, or official printed materials (cite the source inline). Do not add speculative or unconfirmed information. The one place newspaper reporting appears is the 報道 corner on `index.html`, where it is clearly attributed as such; see `data/chunichi_news.json` below. It is never evidence for a claim made elsewhere on the site. **Nationwide figures and national standards come from MEXT** and live on `nationwide.html` only; they are never evidence for a statement about the Komaki plan itself, and the city's information is never used for a nationwide claim.
- **Korean (`ko`) and Nepali (`ne`) were added on 2026-09-17** (user's instruction), placed before Turkish in every language list, and reached full key coverage on 2026-09-18 — so `PARTIAL` (`i18n.js`) and `PARTIAL_LANGS` (`auto_gates.py`) are empty again. **All twelve languages are fully translated, and `ja-kids` covers every key** (1011/1011 as of 2026-09-02), `review.html` included: its `rev_*` keys plus the twelve review-related keys that appear on other pages (`nav_review`, `ql_review_*`, `rel_*`, `meta_*_review`, `status_digest`) were translated into the remaining eight languages on 2026-09-02. Turkish (`tr`) and Burmese (`my`) reached full key coverage on 2026-08-13, so `PARTIAL` in `i18n.js` is empty and the "parts of this page are in English" notice bar no longer appears. `events.json` labels are a strict **12-language** requirement (`LANGS` in `auto_gates.py`). If a new partially-translated language is ever added, put its code in both `PARTIAL` (`i18n.js`) and `PARTIAL_LANGS` (`auto_gates.py`) so the notice bar shows and its event labels are not demanded.

## `data/news.json`

Auto-updated by GitHub Actions (`.github/workflows/fetch-news.yml`), which runs daily at 07:17 JST (off the hour, and with a 3–5 s polite wait between requests, to avoid load on the city server). The script (`.github/scripts/fetch_news.py`) scrapes two official city index pages, visits each item page to read its update date, keeps only items updated within the last `WINDOW_DAYS` (30) days, and commits changes with `[skip ci]`. To trigger manually: GitHub → Actions → "Fetch Official News" → Run workflow. Do not hand-edit `items` — it will be overwritten on the next run. The `window_days` and `source_url` fields are safe to edit.

**The city site is behind an Imperva/Incapsula WAF, so `fetch_html()` shells out to `curl` — do not "simplify" it back to `urllib`.** The first request gets a 302 to the *same* URL carrying `visid_incap_*` / `incap_ses_*` cookies; without keeping those, the client redirects forever. Cookies alone are not enough: Python's `urllib` is answered with a flat **403** even with a browser `User-Agent` and cookie jar (the WAF fingerprints the TLS/HTTP client, not the headers), while `curl` gets 200 for the same URL and UA. `curl` is preinstalled on `ubuntu-latest`. The cookie jar is one temp file reused for the whole run, so the extra WAF round-trip happens only on the first page.

### Watch-only pages (community councils)

Beyond the school-reorganization subtree, `fetch_news.py` also snapshots a small set of **watch-only** pages under `admin/soshiki/kenkouikigai/sasaeai/3/3_2/` (community councils — a different city department). These are declared as `WATCH_PAGES` / `WATCH_INDEXES` and get slugs prefixed `sasaeai-3-3_2-`. They are **snapshot-monitored only**: they never enter `news.json` `items`, so they never appear in the site's news list and add no external links. `site-facts.json` maps them to the `community` target, so a change opens the usual Issue and the auto-update pipeline may draft edits to `community.html`.

The same script also saves a normalized body-text snapshot of every item page to `data/official_pages/<slug>.txt` (auto-generated — never hand-edit). When any snapshot changes (page added/edited/removed on the city site), the workflow auto-opens a GitHub Issue titled 「📡 公式ページ更新検知 YYYY-MM-DD」 containing the changed-page list, a diff excerpt, and — via `.github/scripts/map_targets.py` — the site locations likely needing an update, looked up in `data/site-facts.json` (a hand-maintained map from official-page slug prefixes to site targets; add an entry when the city publishes a new page). Script exit codes: 0 = content changed, 2 = no change, 1 = fatal error.

### 添付 PDF の本文 (`data/official_pages/` の下の資料群)

市の掲載ページは HTML だが、肝心の中身が添付 PDF の中にある資料が多い。`fetch_news.py` のスナップショットは PDF の題名しか拾えないので、`.github/scripts/fetch_pdf_docs.py` が PDF の本文テキストを取り出して `data/official_pages/<群>/` に保存する（2026-09-13 に `fetch_newsletters.py` から一般化）。取り込む資料群は同スクリプトの `SOURCES` に宣言する。

| 群 | 中身 | 主な使い道 |
|---|---|---|
| `newsletters/` | 『篠岡地区学校再編だより』各号 | 全般（日程・新校名・通学区域など） |
| `setsumeikai/` | 保護者等説明会6会場の質疑応答、意見提出シートの質問と回答・意見と提案 | `faq.html`・`bus.html` のQ&A、`voices.html` |
| `pubcom/` | パブリックコメント55件の意見と市の考え方、実施結果概要、計画修正案 | `voices.html` の「実際に言われたこと」、`faq.html` |
| `gikai/` | こまき市議会だより | `council.html` |

- **⛔ 市の資料の文面をそのままページに貼らないこと（ユーザー指示 2026-09-13）。** ここに取り込むのは**出典であって原稿ではない**。読んで理解し、当サイトの言葉で書き直す。数値・日付・議決結果のような事実そのものはもちろんそのまま使ってよい。**書き直していることはページに明記する**（共通キー `recomposed_note`、`council_ref_box`、`voices_pc_note`）。ただし**その理由はページに書かない**（同指示）。
- **Never hand-edit** these files — they are regenerated from the PDFs.
- **市サーバへの負荷はほぼ増えない。** 掲載ページの HTML は `fetch_news.py` の run-local キャッシュ（`HTML_CACHE_DIR`）を使い回し、PDF は **URL が新しいか、リンク文字列のファイルサイズ表示が変わったときだけ**落とす。ふつうの日は1本もダウンロードしない。だから `fetch_news.py` の**あと**に実行すること。
- **図・地図・表の多くは画像なので、その中の文字は取り出せない。** 各ファイルの冒頭にその旨が書いてある。テキストに無いことは「載っていない」の証拠にならない。
- **こまき市議会だよりの PDF は文字レイヤを持たない**（紙面がまるごと画像）。抽出結果は「本文テキストを取り出せませんでした」という1行になる。`council.html` を更新するときは、人（かAI）が PDF の紙面を読んで書き起こすしかない。掲載ページ（`gikai-giji-2-2-51603`）は監視対象なので、新しい号が出れば検知はされる。
- **サイトから PDF へ直リンクしてはいけない。** 取り出したテキストを根拠に本文を書くのはよいが、PDF の URL をリンクとして書くと `auto_gates.py` check 6 に引っかかる。
- **古い資料は消さない。** 市がページから下ろしても、それを根拠に書いた記述の裏取りができなくなるため（`newsletters/` などのサブディレクトリは `fetch_news.py` の剪定ループの対象外なので、サブディレクトリに置き続けること）。
- だよりのスラッグは**リンク文字列の号数**から作る（市の PDF 名は `saihendayori01` / `kawaraban2` / `dayori3_nishi` と不統一）。号数の無い資料は PDF のファイル名をそのまま使う。
### Auto-update pipeline (`auto-update` job)

When a content change is detected, a second job drafts site updates fully automatically: a drafter Claude (via `anthropics/claude-code-action`, subscription OAuth — secret `CLAUDE_CODE_OAUTH_TOKEN`; if the secret is missing the job skips silently and only the detection issue remains) reads the diff (including any newly extracted newsletter text — see above) and may edit **only** `data/events.json`, `data/i18n/*.json`, `index.html`, `schedule.html`, `community.html`, and must write `auto_update/evidence.json` quoting the exact official-source text for every change. `.github/scripts/auto_gates.py` then machine-verifies scope, schemas (10-language event labels), the external-link rule, and that every quote actually exists in `data/official_pages/` (hallucination check; exit 0 = pass, 3 = no changes, 1 = fail). An independent verifier Claude reviews the diff and writes `auto_update/verdict.json`; only on `approve` is the PR auto-merged (squash) and the detection issue closed with a report from `.github/scripts/auto_report.py`. Kill switch: set repo variable `AUTO_MERGE` to `false` to stop before merge (PR is still created). Any gate/verdict failure leaves `main` untouched.

## 新機能アイデアの日次メール（`.github/workflows/feature-ideas.yml`）

毎日 06:35 JST に、このサイトに足すとよさそうな機能を Claude（`anthropics/claude-code-action`、`CLAUDE_CODE_OAUTH_TOKEN`）に考えさせ、**メールで届ける**だけの仕事。サイトのファイルは一切変更しない。

- **AI が書いてよいのは `auto_ideas/ideas.md` の1枚だけ。** サイトの実装はさせない（提案と実装を同じ走行で混ぜると、検証されていない変更が毎日入ってくる）。
- **本文はリポジトリに残さない。** 残るのは `auto_ideas/history.json`（過去に出した見出し）だけで、`ideas.md` は `.gitignore` 済み。起案AIはこの履歴を読んで**同じ案を二度出さない**。本文はメールと Actions のアーティファクト（30日）にある。
- **通知は SMTP → だめなら Issue。** `.github/scripts/send_mail.py` は設定が無ければ exit 2 を返し、ワークフローは `gh issue create` に切り替える（Issue を立てれば GitHub の通知メールが届く）。必要な Secrets は `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`（任意で `MAIL_TO`＝未指定なら `SMTP_USER` 宛て、`SMTP_PORT`＝既定 587・465 なら SMTP_SSL、`MAIL_FROM`）。**未設定でも壊れない**のが設計で、設定を促す警告だけが出る。**宛先は1件だけ**で、カンマ区切りで複数渡すと送らずに失敗する（自分宛ての通知がいつのまにか同報配信になる事故を機械で止めるため）。**このリポジトリは公開なので、宛先のアドレスはワークフローにもスクリプトにも書かない** — Secrets に置くか、`SMTP_USER` と同じにする。
- 見出しの抽出・履歴の更新・件名の組み立ては `.github/scripts/ideas_digest.py` が決定的に行う。**AI に JSON を直接書かせない** — 壊れていても気づけないため。件名はシェルの `"..."` を通るので、`"` `` ` `` `$` `\` は見出しから落としてある。
- 起案プロンプトには、この CLAUDE.md の禁止事項（外部ドメインを増やさない／自動読み込みの第三者スクリプトを増やさない／`bus.html` の地図は凍結／`council.html` は対象外／自動生成ファイルを手編集する案を出さない）を明記してある。**規則を増やしたらこのプロンプトにも書き足すこと。**
- 「今日は出すに値する案が無い」日は `## ` 見出しを1つも書かせない。その日はメールも Issue も出ず、履歴も増えない。

## `data/school_news.json` (target-school website updates)

The **bottom section of `index.html`** lists recent posts from the eight affected schools' own websites (`komaki-aic.ed.jp/<slug>/` — a different domain, run by each school, not the city). `.github/scripts/fetch_schools.py` scrapes each school's top page once a day from the same workflow, taking the newest 3 article cards (`class="blogtitle"` + 公開日), and writes them here sorted newest-school-first. Cards updated within 7 days get a 新着 badge, computed client-side.

**Only the newest article of each school is displayed** — the block in `js/main.js` slices `items` to 1, and the article's own date is not repeated next to the headline because the card's footer row already shows 最終更新 (it sits there, not in the header, so it never has to wrap around the school name and badges). The file keeps all three so the display count can be changed without waiting for a re-fetch.

- **Never hand-edit** `data/school_news.json`, and never add it to the auto-update pipeline's `ALLOWED` set — it is regenerated daily.
- The eight schools are hard-coded in `SCHOOLS` in the script, with display names for ja / ja-kids / en / zh (other languages fall back to en).
- Article headlines are **translated for non-Japanese readers** via `data/headline_i18n.json` (see 「自動取得した見出しの翻訳」 below). The surrounding labels are localized in `js/main.js` (same inline-dict pattern as the official-news block).
- A school whose page can't be fetched or parsed keeps its previous entries rather than being blanked; the workflow step is `continue-on-error` so a school-site outage never fails the run. Exit codes: 0 = changed, 2 = no change, 1 = all eight failed.
- Changes here commit as `chore: update school website news [skip ci]` and do **not** open an Issue or trigger the auto-update job — these are not school-reorganization source facts.

## `data/community_events.json` (community council events)

The bottom of **`community.html`** lists the city's community-council event announcements. `.github/scripts/build_community_events.py` builds it **from the snapshots `fetch_news.py` has already saved** in `data/official_pages/sasaeai-3-3_2-chiikikyougikaievent-*.txt` — it makes **no HTTP request of its own**, so adding this corner did not increase load on the city server. It therefore must run *after* `fetch_news.py` in the workflow.

- **Never hand-edit** it, and never add it to the auto-update pipeline's `ALLOWED` set — it is regenerated daily.
- The city's listing covers **all 16 elementary school districts in Komaki**, not just Shinooka. Events are shown in the city's own order, but the five Shinooka councils (`SHINOOKA_COUNCILS` in the script) are flagged `shinooka: true`, sorted first, and badged. Other districts' events are deliberately kept rather than filtered out: as of 2026-08-13 **no Shinooka event is listed at all**, so filtering would leave the corner permanently empty, and seeing what other councils actually run is a useful concrete answer to "what does a community council do?".
- Event titles are **translated for non-Japanese readers** via `data/headline_i18n.json`, and the 日時 text is re-formatted into the reader's language by `window.KomakiJaWhen()` in `js/main.js`. Labels use an inline dict.
- The corner is rendered as **the same plain row list as the 市公式サイト お知らせ block**: the linked title plus 日時, nothing else. `place` and `updated_at` are still collected in the JSON but not displayed — the linked article carries them.
- The parser stops at 関連イベント / 関連ファイル / この記事に関するお問い合わせ先, because after those headings the page lists unrelated city-wide events.

## `data/chunichi_news.json` (newspaper coverage)

The **「報道でみる東部地域」 section near the bottom of `index.html`** lists Chunichi Shimbun Web articles about eastern Komaki (the Shinooka district) — **not only the school reorganization**, but local news in general. `.github/scripts/fetch_chunichi.py` crawls the paper's Komaki-city area index once a day and stores, per article, **only the headline, the publication date, the article URL, and one quoted sentence from the opening**. The body is never copied — the articles are paywalled part-way through.

**The corner displays headlines only** — the headline, its date, and the 出典 line. The stored `quote` is deliberately not rendered (it made the section long enough to bury the site's own content); it stays in the JSON so it can be brought back without re-fetching.

- **Never hand-edit** it, and never add it to the auto-update pipeline's `ALLOWED` set — it is regenerated daily.
- **This is reporting, not a primary source.** Facts on the rest of the site (figures, dates, plan contents) must still come only from the city's official information. Never cite a newspaper article as the evidence for a site edit. Because the corner now covers the district generally, most entries are not about the reorganization at all — that is intended.
- Headlines are **translated for non-Japanese readers** via `data/headline_i18n.json`; `press_note` says they are machine-translated and that the originals' copyright belongs to the paper. Labels: `section_press` / `press_lead` / `press_note` plus an inline dict in `js/main.js`.
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

- **Everything listed here must also be reflected in the schedule** — an `.event-item` in `schedule.html` (in `data-start` order, with `sched_date<N>`/`sched_desc<N>` keys in all 10 languages plus `ja-kids`) and an entry in `data/events.json` for the calendar. A reader who only looks at スケジュール must not miss an event that the 地域の取組 corner announces. When adding one, bump the count in `status_digest` (「全 N 件」) in every dictionary too. Standing instruction from the user (2026-09-03): check this every time this file changes.
- **This is neither official information nor reporting — it is what residents themselves have posted.** Like the 報道 corner, it is never evidence for a claim made elsewhere on the site, and never a source for the plan's contents, figures or dates.
- Every entry carries a 市民有志 badge and a 発信元 line linking the source. **Do not strip either** — they are what stops the corner reading as a city announcement.
- Event names are **translated for non-Japanese readers** via `data/headline_i18n.json` (the script picks up `title_ja`); school names, dates and places come from the entry's own `school_<lang>` / `date_note_<lang>` / `place_<lang>` fields (falling back to `_en`). Labels use an inline dict in `js/main.js`.
- **It sits next to the council-events corner, not merged into it.** Both are things the district does for itself — the councils are the form the city gives that, this is what residents started on their own — so they read as a pair of adjacent sections with their own headings. Do not fold them into one list.
- `source_url` may only point at an account listed in `PERMITTED_INSTAGRAM` in `auto_gates.py`, and Instagram links are allowed on `community.html` and `index.html` only (`INSTAGRAM_PAGES`) — the two pages that render this corner. Adding an account, or another page that renders the corner, requires updating this file, `CONTRIBUTING.txt` rule 1, `README.md` and that gate together.
- As of 2026-08-26 only the Oshiro account is known; searches found no equivalent account for 篠岡小・陶小・篠岡中. Do not guess at handles — an account that turns out to be someone else's would be presented here as if it spoke for the school community.

## `data/tobu_actions.json`（東部まちづくりの取組）

2026-09-13 追加（ユーザー指示）。**「地域の取組」欄の下半分**に、市の東部まちづくり推進室が公表している東部地域の取組を並べる。`community.html` と `index.html` の両方に出る（`#tobu-actions-container` を見つけた所に `js/main.js` の TOBU ACTIONS ブロックが描く）。市民有志の取組（`data/community_actions.json`）とは**見出しを分けてある** — 上は住民自身が始めたもの、下は市の部署が公表したもので、混ぜると「誰が出している情報か」が消えるため。ただし**行の形（カード）は 2026-09-20 のユーザー指示で市民有志の取組（`.action-item`）とそろえた**（上下の欄が続いて見えるようにするため）。出どころの違いは **①「市公式」の札 ②カード左帯の色（市公式は `--primary` の緑、市民有志は `--accent` の黄） ③最後の出典行** の3つで示す — この3つは外さないこと。

- **自動生成・手編集不可。** `fetch_news.py` が監視している `data/official_pages/toubumachidukuri-tobumachidukurisingikai-*.txt` から `.github/scripts/build_tobu_actions.py` が組み立てる（市サーバへのアクセスはゼロ。`fetch_news.py` の**あと**に実行すること）。自動更新パイプラインの `ALLOWED` にも入れない。
- **載せるのは直近2か月ぶんだけ**（`WINDOW_DAYS = 60`、2026-09-13 ユーザー指示）。古い記録が積もると「いま何が起きているか」が読めなくなるため。**ただし、これから開催される催しは日付が未来なので必ず残る** — 参加できる催しを期限切れで落としては、この欄を置く意味がない。画面は「これからの催し」→「さいきんの動き」の順。
- **拾い方は3通り。** ①「開催場所・会場」「開催日・期間」を持つページ＝催し（協働提案事業・団体等のイベント情報）。②年度別『東部まちづくりニュース』と『東部まちづくり審議会』の本文に〈見出し（令和8年8月24日）〉の形で並ぶ行＝記録。③それ以外のページ（トライアル活動の紹介など）はそのページの更新日を日付として扱う。**図やPDFの中は読めないので、載っていない＝存在しない ではない。**
- **リンクは「出典」の1本だけ。** 2026-09-13 にユーザーが `.../toubumachidukuri/tobumachidukurisingikai/index.html` を許可したので、コーナーの出典だけそこへリンクする。**URL は `js/main.js` の TOBU ACTIONS ブロックに置く** — ゲートの検査対象（`js/*.js`）に入れて機械で守らせるため。JSON に持たせると検査をすり抜ける。配下の個別記事ページは今までどおり不可なので、項目ごとのリンクは張らない。見出し・会場名は日本語以外の表示で `data/headline_i18n.json` の訳に置き換え、「どのページ群から拾ったか」の分類名（協働提案事業など）は TOBU ACTIONS ブロックの `_from` で訳す。市がページ群を増やしたら `_from` に足すこと（足すまでは原文で出る）。
- 監視対象は `TOBU_BASE` 配下。ディレクトリが入れ子なので `fetch_news.py` の watch は `<li class="dir">` も辿るが、**過去年度の記録まで含めると110ページ規模**あるため、ふだんは直下まで（`WATCH_DIR_MAX_DEPTH = 1`）。**日曜だけ `WATCH_DEEP=1` で全階層**を回る（`fetch-news.yml` の "Decide crawl depth" ステップ）。浅い巡回の日は下位ページのスナップショットを `keep_slugs` で守る — 守らないと毎日消えて毎週復活し、差分が無意味に膨らむ。
- **深いところにある2つだけは毎日見る**（2026-09-13 ユーザー指示）：協働提案事業（これからの催しが載る）と東部地域トライアル活動（年度ごとの認定活動）。`WATCH_INDEXES` に直接足してあるが、配下に過去分が数十ページ積もっているので、浅い巡回の日は**末尾（＝新しいほう）だけ**を取る（`WATCH_TAIL_INDEXES` / `WATCH_TAIL_PAGES = 8` / `WATCH_TAIL_DIRS = 1`）。市のインデックスは古い順に並んでいるため末尾が最新。これで毎日の取得は東部まちづくり全体で 40ページ弱に収まる。
- `site-facts.json` ではこの接頭辞の `targets` を空にしてある。**一覧は自動で入れ替わるので、検知 Issue を見た人やAIが手でページを直す必要はない。**
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
- 末尾に **国の担当部署の連絡先**（`id="contact"`）がある。数値ごとにどの部署の所管かを並べたもので、番号は文科省が各ページで公表しているものだけ。リンクは増やしていない（出典リンクは上の4つのまま）。詳しくは「担当部署の連絡先」の節を参照。

## 担当部署の連絡先（`data/contacts.json` と週1回の照合）

2026-09-13 追加（ユーザー指示）。読者が「では誰に聞けばいいのか」で止まらないよう、**制度ごとの担当部署と電話番号**をサイトに載せている。置き場所は4か所：

| ページ | 何を載せるか |
|---|---|
| `about.html#contact` / `faq.html` | 学校再編そのもの（教育総務課 学校再編推進係） |
| `bus.html#contact` | スクールバス。市の窓口と、**運行事業者**（あおい交通株式会社・本社と野口営業所）。`bus_contact_*` / `bus_c*_w` キー |
| `council.html#contact` | 市議会。傍聴・請願・会議録は議会事務局 議事課、条例の中身は教育総務課。`council_contact_*` / `council_c*_w` キー |
| `community.html#contact` | 地域協議会（支え合い協働推進課）。`comm_contact_*` キー |
| `review.html#rev-contact` | このページで触れた事柄の市8部署・県5部署。`rev_c_*` / `rev_s9_*` キー |
| `nationwide.html#contact` | 全国の統計と国の基準を所管する文科省3部署。`nw_c*_w` ほか |

トップページの「各ページへのリンク」の下に、この4か所への案内（`contacts_guide_*`）を置いてある。**番号そのものをトップに書かない** — 直す場所が増えると必ず食い違うため。

- **部署名は日本語のまま**（表の「部署」欄に `data-i18n` を付けない）。窓口で見せたり電話で伝えたりするのは日本語の名称そのもので、訳すと用を成さないため。訳すのは「このページで触れた事柄」の欄とラベルだけ。年表の西暦欄と同じ考え方。ただし `about.html`・`faq.html`・`community.html` の `.contact-box` は従来どおり部署名も翻訳する（1部署だけなので窓口で示す用途より読みやすさを優先）。
- **番号は HTML と辞書に直接書く。** `tel:` リンクの数字だけの形と、表示用のハイフン入りの形の2つが本文中にある。
- **出典は「その部署の公表ページ」**。市・県・国のどのページから写したかは `data/contacts.json` の `source` にある。**このURLはサイトからはリンクしない**（許可外部リンクを増やせないため）。
- **週1回、機械で見張る。** `.github/workflows/check-contacts.yml`（日曜 21:50 UTC＝月曜 6:50 JST）が `.github/scripts/check_contacts.py` を回し、17件の連絡先を公表ページと突き合わせる。**電話・FAX番号の変更は `--fix` がそのまま `*.html` と `data/i18n/*.json` を書き換えてコミットし、ページ別辞書も作り直す**（番号は翻訳されないので機械で直せる）。**部署名・所在地の変更は直さず Issue（☎️）で知らせるだけ** — 部署名は12言語＋こどもむけに訳してあるので、人（かAI）が文面を書き直す必要がある。
- 照合のしかたは `probe.kind`（`article_contact` / `kakari` / `pref_group` / `text`）で切り替える。市の記事ページの「この記事に関するお問い合わせ先」、係の一覧表、愛知県の「連絡先」欄、文科省の「お問合せ先」で構造が違うため。**係名はページ上部の目次にも出るので、`kakari` は「次の行が『電話番号』」のものだけを本文の表とみなす** — ここを緩めると隣の係の番号を読む。
- **運行事業者のような民間の連絡先も同じ扱い。** 出所はその会社が自社サイトで公表しているページで、**サイトからリンクはしない**（許可外部リンクを増やせない）。`bus_contact_note` に「制度のことを会社にたずねても答えは出ない」と書いてあるのは、市の窓口へ行くべき問い合わせが会社に流れるのを防ぐため — 外さないこと。
- **議員個人の氏名・連絡先は載せない**（[[個人名は書かない]]の方針）。`council.html` は職と部署だけを書く。**政党名・会派名・議員団名も書かない**（2026-09-14 ユーザー指示）— 一般質問も「だれが聞いたか」ではなく「何が問われ、市がどう答えたか」だけを書く。定例会の本文（質問・答弁の要約を含む）は「です・ます」でそろえる（同指示）。
- 組織改編は4月1日付が多い。**4月の第1週は結果を必ず見ること。**

## `review.html`（計画の検証と提案のページ）

2026-08-28 追加。**このサイトで唯一、当サイト自身の検証と提案を載せるページ**です。他のページは「公式情報をわかりやすく伝える」に徹していますが、ここだけは違います。だからこそ書き分けの規則が重い。

- **🔎・💡 は「一般論にもとづく考察」だと明記する**（2026-09-20 ユーザー指示）。冒頭の `rev_stance_general` が、検証と提案は公表資料に加えて制度のしくみや他地域の例という一般論をもとにした考察であり、当サイトが地区について特別な情報を持っているわけではない、と断っている。`rev_stance` と同じく外さないこと。
- **事実と意見を版面で分ける。** 【事実】は公表資料にもとづき出典つき（`.rev-fact`、左帯は `--neutral-color`）、🔎 検証・💡 提案は当サイトの考え（`.rev-view`、左帯は `--accent`）。この色分けと帯を外さないこと。冒頭の `rev_stance`（市の見解ではない旨）も外さない。
- **中高一貫（高校段階）の節（`rev-highschool`）は 2026-09-20 追加。** 第2期の小中一貫とは別の軸として、閉校する校地に高校段階を置けるかを検討する。**「高校をつくれば子どもが増える」とは書かない**（`rev_s10_note` に明記）— 名古屋造形大学は令和4年に市外へ移転し、愛知文教大学は令和9年度以降の学生募集停止を公表、県立高校も再編で減る局面にある、という事実を同じ節の中に置いてあるためで、この対比を崩さないこと。制度の事実（学校教育法第71条・第4条、同施行規則第75条・第87条、市町村立学校職員給与負担法第1条）は法令そのものを出典にしている。
- **私立学校など行政以外の主体については、その主体自身の公表と報道を出典にしてよい**（2026-09-20 ユーザー指示）。私立の動きは行政資料に出てこないため。愛知文教大学の募集停止は大学の公表（令和8年3月30日の臨時理事会）、誉高校の名古屋市港区への移転（2029年）は学校自身の公表（2026年6月3日）、移転先が名古屋競馬場跡地であることは報道による。**「アジア競技大会の選手村跡地」とは書かない**（2026-09-20 ユーザー指摘。選手村として使う計画は無くなった）。**この例外はその主体自身のことに限る** — 市の計画・数値・日程のような行政の事実を報道で代用しないこと。⛔ `chunichi.co.jp` は AI 用クローラを拒否しているので、AI のブラウズ機能で取りに行かないこと（`data/chunichi_news.json` の節も参照）。
- **事実の出所は「行政が公表した資料」だけ。** 市の公式情報（学校再編計画、人口ビジョン、東部振興構想、立地適正化計画、都市計画決定、産業の現状資料、入札結果など）、『篠岡地区 学校再編だより』、そして **2026-09-06 に追加した県・国の資料**（愛知県、文部科学省、厚生労働省の人口動態統計、内閣官房・こども家庭庁）。新聞報道と市民有志の発信は、このページでも根拠にしない。MEXT の数値は `nationwide.html` 経由で引用し、**このページから `mext.go.jp` に直リンクしない**（`MEXT_PAGES` は `nationwide.html` 限定のまま）。**出典は本文中に文字で書き、外部リンクは張らない** — 許可外部リンクは増やせないため（`auto_gates.py` check 6）。
- **個人名を書かない（ユーザー指示 2026-09-06）。** 市長・市議会議員などの氏名は出さず、責任は職と部署に置いて書く。所管部署名（教育総務課 学校再編推進係、東部まちづくり推進室、こども未来部、企業立地・次世代産業推進課 など）は公表資料に載っているので書いてよい。
- **「確認できなかったこと」を必ず残す。** `rev_o1`〜`rev_o12` と各提案の「確認できていないこと」は、当サイトが調べきれていないという意味であって「存在しない」という意味ではない。ここを削ると、検証が断定に化ける。
- **提案は市が検討しているものではない。** `rev_s3_lead` にそう書いてある。市が実際に検討を始めたら、その事実は出典つきで別途書き、提案からは外すこと。
- 翻訳は **12言語すべて**（2026-09-02 に `rev_*` 76キー、2026-09-06 にさらに 103キーを追加し、`rev_*` は計 179キー）。`rev_*` を足したり書き換えたりしたら、12言語ぶん入れて `build_page_dicts.py` を回すこと。`ja-kids` も同様。**こどもむけでも【わかって いる こと】／🔎／💡 の書き分けを崩さないこと** — 平易にする過程で印を落とすと、検証と事実が地続きに読めてしまう。見出しの `<small>` の英語副題は、他ページの `ja-kids` と同じく落としてある。

### 節の構成（2026-09-06 に4節追加、2026-09-13 に連絡先を追加）

行き先の一覧は、全ページ共通の「このページの目次」（PAGE TOC）が見出しから自動で作る（2026-09-15 に手書きの `rev_nav*` を廃止）。節の `id` は他ページや外部から張られうるので、むやみに変えないこと。

| id | 内容 | 主なキー |
|---|---|---|
| `rev-numbers` | 検証の土台になる数字 | `rev_f1`〜`rev_f10` |
| `rev-gaps` | 🔎 計画から読み取れないこと（6論点） | `rev_i1`〜`rev_i6` |
| `rev-history` | 📊 これまでの市の施策は東部に効いたか（年表＋6論点） | `rev_y1`〜`rev_y15`、`rev_e1`〜`rev_e6` |
| `rev-nation` | 🗾 県と国は何をしてきたか（4論点） | `rev_n1`〜`rev_n4` |
| `rev-power` | 🏛 だれが決め、どこまで市が決められるのか（3論点） | `rev_r1`〜`rev_r3` |
| `rev-should` | 💡 本来どうすべきだったか（10提案） | `rev_q1`〜`rev_q10` |
| `rev-ideas` | 💡 地区全体の子どもを増やすには（7提案。7番目は高校段階の話で、次の節へ送る） | `rev_p1`〜`rev_p7` |
| `rev-highschool` | 🏫 高校段階をこの地区に置けるか（事実5＋提案3。2026-09-20 ユーザー指示で追加） | `rev_s10_*`、`rev_h1`〜`rev_h8` |
| `rev-open` | 確認できなかったこと | `rev_o1`〜`rev_o12` |
| `rev-contact` | 関係する部署の連絡先（市8・県5） | `rev_s9_*`、`rev_c_c1_w`〜`rev_c_c8_w`、`rev_c_p1_w`〜`rev_c_p5_w` |

- **背景色は `section` / `section-alt` の交互**。節を挿入したら、以降のクラスをずらして交互を保つこと。
- **年表（`rev_y*`）の年の欄は翻訳しない。** `<td>` に西暦の数字をそのまま書いてあり `data-i18n` を付けていない。数字は言語に依存せず、これで 15キー分の翻訳を節約している。出典の欄は `rev_src_sangyo` / `rev_src_tobu` / `rev_src_toshi` / `rev_src_komaki` の4つを使い回す。
- **`rev-history`／`rev-nation` の要点は「子育て支援は効かず、住宅・交通・仕事が効いた」という一本の筋**。東部地域の事業所数・従業者数は H21→H26 に増えている（917→1,095、12,388→20,671人）のに人口と子どもは減った、という対比がこの節の背骨なので、数字を落とさないこと。
- **産業の話（`rev_q4`〜`rev_q6`）は「工場・物流以外の入口が制度上ない」という一点**。企業立地促進補助金の要件（延べ 1,000㎡以上・固定資産 5億円以上、中小企業者は1億円以上）が IT・デザイン・アパレル・音楽・映像・文化の仕事に届かない、という事実がその根拠。要件が変わったらここも直すこと。

## `js/main.js`

Self-contained IIFE blocks handling: hamburger nav, active nav link highlighting, auto-date status, "last updated" display, upcoming schedule expiry (`data-expires`), FAQ accordion, voice filter, official news rendering, target-school website updates, the share buttons at the bottom of every page, and the interactive calendar on `schedule.html`. Calendar events live in `data/events.json` (`{"events": {"YYYY-MM-DD": {ja, en, pt, vi, tl, es, zh, id, tr, my}}}`), fetched at runtime by the calendar block — edit that file, not `main.js`, to add/change events. All 10 language labels are required per event. **A date may hold more than one event: the value is either that object or an array of them** (added 2026-09-03, when the 就学時健診 and the district music festival both fell on 10/31). The calendar draws one dot per event and the `.ics` writer emits one VEVENT per event — its UID gets a `-2`, `-3` … suffix from the second entry on, so the first event's UID never changes and already-imported calendars do not duplicate it. `check 2` in `auto_gates.py` validates both shapes. If the fetch fails or the file is empty, the calendar section hides itself.

### SHARE BUTTONS (every page)

Every page carries a `<section class="section share" id="share">` just above `</main>`: the heading, lead and closing note are in the HTML with `data-i18n`, and the buttons themselves are built by the SHARE BUTTONS block in `js/main.js` into `#share-buttons` / `#share-star`.

**2026-09: a fixed bar (`.share-sticky`, id `#share-buttons-sticky` for its button row) follows scroll at the bottom of every page**, showing the exact same button set as `#share-buttons` (built by the same code, see below) so a way to share is always on screen without scrolling to the end. Since 2026-09-15 (user's instruction) it also carries a はてなスター ☆ at its right end, loaded only when the reader touches it (see that section). It does not carry the ページ要約 concept (already retired, see BOARD SHEET below) — only the sharing buttons, the star, plus the 回覧板 button on `index.html` (added by BOARD SHEET into `#share-buttons-sticky` alongside `#share-buttons`). It is created entirely by JS and appended to `document.body`, so no HTML changes were needed on any of the 11 pages. `html.has-share-sticky` is added to the root only once the bar exists, and `body` gets bottom padding only under that class — so a reader with JS disabled gets no dead space reserved for a bar that was never built. Hidden on `@media print` (a `position:fixed` bar has no sensible printed form) and given `z-index:90`, below the sticky header's 100, so the mobile hamburger dropdown still covers it when open.

- **Buttons**, in row order: LINE, X, Facebook, はてなブックマーク, Threads, Bluesky, Reddit (`<a target="_blank">`, URL built by the entry's `url()`), Mastodon (`<button>`, see below), Instagram / TikTok (`<button>`, copy-only, see below), リンクをコピー, and — only where `navigator.share` exists — ほかのアプリで共有. The native-share button is what covers WhatsApp / Zalo / Messenger and is the only route that actually *opens* Instagram / TikTok, so do not drop it in favour of adding more per-service buttons.
- **Open the app when it is installed** (2026-09-15, user's instruction). `serviceHref()` picks the link per device. **Android**: `intent://…#Intent;scheme=…;package=<app>;S.browser_fallback_url=<the web share URL>;end` for LINE (`line.me/R/share`), X (`twitter://post`), Facebook, Threads, Bluesky and Reddit — if the app is missing or rejects the URL, Chrome silently opens the web URL, so nothing breaks. **iPhone/iPad**: never a custom scheme (Safari shows an "invalid address" alert when the app is absent); only https universal links, i.e. the normal URLs, except LINE, which switches to LINE's own `line.me/R/share` because `social-plugins.line.me` is not an app link. はてなブックマーク and Mastodon stay web-only (no app can be named reliably). PCs get the unchanged web URLs.
- **There is no Facebook いいね (Like) button, and none can be added**: Meta discontinued the Like/Comment plugins for external sites on 2026-02-10 (they now render as a 0×0 frame). A reader asked for one on 2026-09-15; the existing Facebook *share* button (`sharer.php`) still works and is the substitute. Do not embed `facebook.com/plugins/like.php` or the SDK — it would send every reader's visit to Meta and show nothing.
- **Instagram and TikTok publish no share intent that accepts a link**, so their buttons copy the URL and show 「{app} に貼り付けてください」 instead of opening anything. Their labels say （リンクをコピー） so that is visible before the press. If either ever ships a real intent URL, move it into `SERVICES` and drop the copy path — do not invent an endpoint for them in the meantime.
- **Mastodon is decentralized**, so there is no single endpoint: the button asks once for the reader's server domain, normalizes it (`https://`, trailing path and `@user@` forms are all stripped), keeps it in `localStorage` under `komaki_mastodon`, and opens `https://<host>/share?text=`. A third-party redirect service would be simpler but would add an external host to a site that has exactly one; don't. The prompt text lives in the dictionary (`share_mastodon_prompt`) and is read out of a hidden `data-i18n` node, because `main.js` has no access to the dictionary itself.
- **The buttons carry no text label — only an icon**, with the service name in `aria-label` (via `data-i18n-aria`) and mirrored into `title` on hover by `syncTitles()`. With ten of them in one row, per-button text labels made the share box the largest block on the page. The icons are letters and symbols set in the site's own font, not brand logo images: an image would add an external host (or bytes) and a fixed width that the ten languages do not share. `share_lead` / `share_note` are deliberately one short line each for the same reason.
- **The shared URL is built from `<link rel="canonical">` plus the current language**, not from `location.href`. `i18n.js` writes `?lang=` into the address bar only *after* the dictionary fetch resolves, so reading the address bar gives a one-step-stale URL right after load and right after a language switch. The block captures the canonical value once, at parse time, because `i18n.js` later rewrites that element to the per-language URL.
- **`href` and the page title are recomputed on `pointerdown` / `focusin` / language change**, since `document.title` is replaced by `i18n.js` after its fetch. Without that the page would be shared under its Japanese title.
- **Labels use `data-i18n`, not an inline dictionary.** The news/press blocks carry inline dicts because they render before the dictionary arrives; this block builds its DOM before `applyDict` runs, so the dictionary can own the text. The keys are invisible to the HTML scanner, so they are listed in `RUNTIME_KEYS` in `build_page_dicts.py` — **add any new share key there too**, or non-Japanese pages will silently fall back to the inline Japanese default.
- **The button-building code runs once per container** (`boxes.forEach(...)`, `boxes = [mainBox, stickyBox]`), so `#share-buttons` and `#share-buttons-sticky` end up with independent DOM nodes for every button — a `<button>`/`<a>` cannot exist in two places at once, so nothing is shared between them except the closures (`shareUrl()`, `shareTitle()`, `copyLink()`, …) and the `links` array used by `refresh()` to rebuild every `<a href>` in both containers at once. Each container gets its **own** copy-result toast (`makeToast(box)`), so feedback appears next to whichever row the reader actually used — but the toast **text itself** (`share_copied`, `share_mastodon_prompt`, …) is a single set of hidden `data-i18n` templates (`tpl`), read via `.textContent` rather than duplicated, so there is exactly one translation to keep in sync per key. `syncTitles()` queries `.share-btn` globally (not scoped to one box) for the same reason — it has to reach both rows.

**Print button and the common print stylesheet** (added 2026-09-14). The row also carries 🖨 (`share_print`, in `RUNTIME_KEYS`), which just calls `window.print()` — an ordinary print of the page, distinct from index.html's 回 button (the one-sheet board summary). The `@media print` block at the end of `css/style.css` is what makes an ordinary print usable: it hides the on-screen machinery (header and language switcher, share section, sticky bar padding, related pages, the page TOC, the footer's page list) and **forces every Q&A answer (`.faq-a`) open** — before this, a printed FAQ carried questions only. It does **not** touch the body text, tables or figures, and it deliberately **keeps the unofficial-site banner (`.notice-banner`) and the footer's operator line**, so a printed page cannot pass for a city handout. Every rule is scoped `html:not(.board-printing)` so the board-sheet print keeps working exactly as before.

**はてなスター** sits below the buttons as ラベル → page-title link → star container, the standard Hatena Star arrangement (`Hatena.Star.SiteConfig.entryNodes`). Two things about it are deliberate:

- Its URL is the **bare canonical URL with no `?lang=`**. A star is a reaction to the page, not a share; keying it per language would scatter one page's stars across ten URLs.
- `HatenaStar.js` is **the only external script this site loads**, and it is not loaded until the share section comes within 200 px of the viewport (`IntersectionObserver`; a click on the star row is the fallback where that API is missing). A reader who never reaches the bottom of the page causes no request to Hatena. **The sticky bar's ☆** (`.share-sticky-star`, added 2026-09-15) cannot use that trigger — the bar is always on screen — so it loads the script on `pointerenter` / `focusin` / `touchstart` / click of that ☆; until then it is a plain `.share-btn--star` button, which hides itself once Hatena draws into its holder. Its title link is `.visually-hidden` (Hatena still reads its `innerText`). Do not give `.share-sticky-star` `overflow:hidden`: Hatena floats its colour-star picker above the ☆+ as an iframe, and clipping cuts it off. If a second third-party script is ever added, revisit this — the "no automatic third-party traffic" property is worth more than any one widget.
- **Loading it late takes two non-obvious steps** (both were got wrong first time round, and the failure is silent — the label renders with no star next to it):
  1. Set `Hatena.Star.SiteConfig` **after** the script loads, never before. The script's own line is `void 0 === window.Hatena.Star && (window.Hatena.Star = {…})`, so pre-creating `window.Hatena.Star` to hold the config makes it skip its own assignment and never initialize.
  2. Its initializer is registered as `window.addEventListener("DOMContentLoaded", …)`, which has long since fired by the time the section scrolls into view, so it must be re-triggered with `window.dispatchEvent(new Event('DOMContentLoaded'))`. There is no public entry point for this — `Hatena.Star.EntryLoader.loadEntries()` does not exist in the current build. Double-firing is safe: it skips any entry node that already contains `[data-hatena-star]`.
- In the current build **both the star's URL and its displayed title are read from the `uri` node** (the title comes from that element's `innerText`, not from the `title` selector). The permalink's text is the page title, so both readings give the right answer — keep it that way rather than moving the title into a separate node.
- If nothing renders within 4 s the whole star row hides itself, so a broken widget never leaves a label with no star beside it.

### 学年ビュー（`schedule.html`）と回覧板シート（`index.html` のみ）

2026-08-30 追加。どちらも「共有」を広げるための機能で、扱いに注意が要る。

**学年ビュー（`GRADE VIEW` in `js/main.js`）** — `?grade=` で学年を1つ選ぶと、`.event-item` の各予定に「そのときお子さんは何年生か」を添える。`window.KomakiGrade()`（`main.js` 冒頭）が `?grade=` → `localStorage`（`komaki_grade`）の順で解決する。

- **これは公表日付に対する学年の足し算にすぎない。** 市の計画に学年別の扱いがあるという意味ではなく、どの学校に通うかは住所で決まる。その旨は `grade_lead` に書いてある — **消さないこと**。ここを外すと、ただの計算が「市の学年別方針」に読めてしまう。
- 学年コードは**令和8年度（2026年度）の学年**。`y3/y4/y5`＝年少・年中・年長、`e1`〜`e6`＝小1〜小6、`j1`〜`j3`＝中1〜中3。基準は `BASE_FY = 2026`。**年度が変わったら `BASE_FY` を上げる**（上げないと1年ずれた学年が出る）。年度は4月始まりで、1〜3月の日付は前年度として数える。
- 予定の選り分けはしない。「この予定はこの学年に関係する」という判断は公表資料に無く、当サイトが作ると事実になってしまうため、**全部の予定に学年を添えるだけ**にしてある。
- `.ics` は静的ファイルではなく、押されたときに `data/events.json` から組み立てる。`events.json` は自動更新パイプラインの編集対象なので、静的な `.ics` を置くと更新のたびに古くなる。折り返しは RFC 5545 の**75オクテット**規定で、日本語は1文字3バイトなので文字数で数えないこと。
- 共有 URL にも `grade` が乗る（`shareUrl()`）。同学年の保護者にそのまま渡せる。

**回覧板シート（`BOARD SHEET` in `js/main.js`）** — A4 1枚を刷る。中身は「最新の動き」4コーナーの新着一覧で、`index.html` 限定の機能。呼び出し口は3つあり、**すべて同じ内容**を刷る：`index.html` の共有欄いちばん右の「回」ボタン、画面下部の固定バー（`.share-sticky`）内の同じ「回」ボタン、「最新の動き」節内の専用ボタン（`#latest-print-btn`）。この地区で実際に情報が回るのは回覧板と掲示板で、SNS のリンクでは届かない層がいる。

- **2026-09 に「ページ要約シート」（各ページの共有欄の「回」ボタンが、そのページの見出しと代表文を集めて刷っていたもの）をユーザーの指示で廃止し、最新の動きシートを `index.html` の共有欄に一本化した。** そのため `js/main.js` の当該 IIFE は `#latest-print-btn`（＝`index.html`）が無いページでは何もしない。`pageBlocks()` / `scopeOf()` / `pick()` / `urgentBlock()` / `sentencesOf()` / `leadSentences()` と、抽出除外用の `data-board="skip"` 属性（HTML 側）はこの廃止に伴って削除済み — 復活させないこと。
- **シートの文章はページ内の既存要素からしか取らない。** `h3.section-title.sub` と各コーナーの描画済み一覧（`.official-news-item` / `.school-card` / `.press-item` / `.update-item`）から `latestBlocks()` が拾う。ここで独自の要約を書き起こすと、出典のない二次情報が紙になって出て行く。コーナーの描画クラス名を変えたら、この抽出も直すこと。
- **直近7日ぶんだけ**（`LATEST_DAYS`）。画面のコーナーは30日ぶんを出すが、紙は「いまどうなっているか」を短く伝えるためのもので、1か月ぶんを刷ると読み飛ばされる。絞り込みは各コーナーが描画時に付ける **`data-date="YYYY-MM-DD"`**（`.official-news-item` / `.school-items li` / `.press-item` / `.update-item`）で行う。**コーナーの描画を書き換えるときは `data-date` を落とさないこと** — 日付が無い項目は「直近1週間」として配れないので黙って落ちる。紙の説明文は画面の `latest_lead` ではなく、`board_latest_range` で「いつからいつまでの分か」を出す（該当なしのときは `board_latest_none`）。
- **東部まちづくりの動きは「これからの催し」のすぐ前**（`tobuBlock()`、2026-09-14 ユーザー指示）。市の記録は月に数件しか増えず7日の窓ではほぼ空になるので、これから開かれる催しぜんぶ＋さいきんの動きの新しい3件（`TOBU_RECENT_ON_SHEET`）を、どの行にも日付を付けて載せる。出どころが市なので、住民・協議会の催しとは塊を分けたままにすること。
- **これからの催し（地域の取組）は紙のいちばん最後**（`upcomingActionsBlock()`）。7日の窓とは別枠で、終わった催しは COMMUNITY ACTIONS が描画時に落としているのでここで日付を見る必要はない。詳細は「トップの『最新の動き』グループ」節を参照。
- **回覧板の体裁**：左肩に「回覧」の枠（`board_stamp`）、その横に発行元と非公式である旨。発行元を枠のすぐ横に置くのは、自治会や市が出した回覧と取り違えられないようにするため — **この並びを崩さないこと**。回し読みを促す文や確認欄のマスは置かない。
- **A4 1枚に収める仕掛けが `#board-sheet` を `display:none` にできない理由。** シートは常に DOM にあり、印刷と同じ幅 178mm（A4 210mm − 左右16mm）で画面外（`position:fixed; left:-10000px`）に置いてある。だから刷る前に実寸で高さを測れる。`fit()` が上限 **250mm**（`SHEET_MAX_MM`。印刷できる 265mm＝297mm − 上下16mm から 15mm のゆとりを残す。実測 px に換算）に収まるまで「1コーナーの行数」「文字の倍率」を `LADDER` の順に詰め、それでも溢れたら**末尾のコーナーから落とす**（先頭ほど重要なため）。`display:none` に戻すと高さが 0 になり、常に最も詰めた版が刷られる。
- **2026-09-15 に「2枚になる」不具合を直した。** 原因は固定バーのぶんの `html.has-share-sticky body` の下余白（約58px）が回覧板の印刷にも残っていたこと。`html.board-printing body { padding:0; margin:0 }` で消してある — 外さないこと。上限を 265mm ぎりぎりにしないのは、画面での計測と印刷の組版の差や、余白を大きめに取るプリンタで最後の行がこぼれるため。検証は Playwright の `page.pdf()` で1ページ（上下余白 22mm でも1ページ）。ko / ne を足した 2026-09-18 にも ja・ko・ne・es・pt・zh・my で再確認した。
- 切り詰めたことは `board_excerpt` として紙面にも書く。全文はサイトにある、と紙の上で分かるようにするため。
- **QR は自前生成しない。** `.github/scripts/build_qr.py`（segno）が `qr/index.<lang>.svg` を12枚（回覧板は `index.html` にしか無いので index のみ×12言語、誤り訂正 H）書き出し、それをコミットしてある。ページ側は `<img>` を1枚読むだけ。JS の QR エンコーダを自作すると壊れていても「QR に見える絵」が出て、印刷して配ったあとまで気づけない。CDN から読めば「自動で読む外部スクリプトははてなスター1本だけ」という方針が崩れる。
- 印刷指定は `@media print` の `html.board-printing`。**ふつうの Ctrl+P はページをそのまま印刷する**（本文を刷りたい読者がいるので既定は変えない）。ボタンを押したときだけシート1枚になる。`body > *:not(#board-sheet)` の `:not()` は必須 — `!important` は詳細度に勝つので、除外しないとシート自身も消える。
- `board_btn` は実行時に作るボタンの `aria-label` で HTML に現れないため、`build_page_dicts.py` の `RUNTIME_KEYS` に入れてある（他ページでは使われないが、RUNTIME_KEYS は個別ページの実際の使用有無を見ない仕組みなので全ページ辞書に入ったままでよい）。

### カットイン（全11ページ、ヘッダの下）

`TOP CUT-IN` in `js/main.js`（2026-09-03 に `NEW FEATURE CUT-IN` から改称・拡張）。**2026-09-20 のユーザー指示で、トップページだけでなく全ページに出す**ようにした（読者が最初に開くページはトップとはかぎらないため）。`#feature-cutin` と `#feature-strings` の2つの `div` は11ページすべての `</header>` 直後にあり、同じブロックがそれを見つけて描く。ヘッダの下にスライドインする帯で、**今日から14日以内**（`WINDOW_DAYS`）の新しい情報を出す。出すのは3種類：

| 札 | 元データ | 飛び先 |
|---|---|---|
| 新機能 | `data/site-updates.json` の `type: "feature"` | `#site-updates` |
| 更新 | 同 `type: "content"` | `#site-updates` |
| 市からのお知らせ | `data/news.json`（日本語以外では見出しを訳して出す） | `#news` |

飛び先の2つのアンカーは `index.html` にしかないので、**トップ以外のページでは `index.html` を前に付ける**（`ON_TOP` / `at()`）。トップでは付けない — 同じページ内の移動をページ再読込にしないため。

`type: "fix"` は出さない（誤字直しや体裁の修正は帯で知らせる話ではない）。市のお知らせでも**飛び先は本文の該当コーナー**にする — 帯から直接市の個別ページへ出すと、読者が説明を読まないまま外へ抜けてしまう。

- **並びは「新しいかつ重要度が高い順」**（2026-09-22 ユーザー指示）。`rank()` が **重要度 + `RECENCY_WEIGHT`（8）× 新しさ** で点を付け、高いものから3件出す（同点なら新しいほう）。新しさは今日 = 1・14日前 = 0 の線形、重要度は ①種類（お知らせ 6 > 新機能 3 > 更新 2）②緊急語（`URGENT_RE`、+4）③`data/site-updates.json` の任意の `priority`（`high` +6 / `low` −4）で、ふだんの幅は 2〜10。**`RECENCY_WEIGHT` はその幅とほぼ同じ値にしてある** — 片方だけを支配的にしないためで、重要度側の点を動かしたら重みも見直すこと。
- **緊急語（`URGENT_RE`）は市のお知らせにだけ効かせる。** 更新履歴の文面は「説明会の質疑からQ&Aを追加」のように市の催しに言及するだけのことが多く、読者に締切があるわけではない（そのまま当てると全部が緊急になり順位が意味を失う）。更新履歴を上げ下げしたいときは `priority` を使う。語を足すときも「読者が何かをする必要がある言葉」に限ること。
- **判定は日本語の原文（`ja`）で行う。** 訳文で判定すると、表示言語によって帯の順番が入れ替わってしまう。
- **市のお知らせが3件に1件も入らなかったときだけ、末尾をいちばん点の高いお知らせと入れ替える。** サイト側の更新を続けた日に、いちばん知らせたい公式の新着が一度も出ないまま14日が過ぎるのを防ぐ保険。
- **札とリンクには `data-i18n` を付けない。** 項目ごとに種類が変わるので、辞書に上書きされると札と中身が食い違う。文言は `#feature-strings` の隠し要素から `data-fk` で読む（`label` / `label_update` / `label_news` / `more` / `more_news` / `close`）。

- **カットイン専用のお知らせデータを作らないこと。** 文面は更新履歴と市のお知らせ、どちらもサイトが既に持っているデータそのもの。別データにすると元の一覧と食い違ったまま気づけなくなる。**更新履歴に1行足す／市がページを更新する**だけでここは自動的に出て、14日で自動的に消える（消し忘れが起きない）。
- 閉じるとその項目は二度と出ない（`localStorage: komaki_feature_seen`）。複数あるときは最大3件を7秒ごとに入れ替え、マウスやフォーカスが乗ったら止まる。`prefers-reduced-motion` では動きを出さない。
- 帯は `position: sticky` のヘッダの**下**（`</header>` の直後、通常フロー）に置く（2026-09-20 ユーザー指示。それまではヘッダの上だった）。ヘッダに重ねると本文が読めなくなるので、重ねない。
- **帯の色は上下の背景と同じ黒板グリーンの系統でそろえる**（同日ユーザー指示）。上はヘッダ（`--primary-dark`）、下はヒーロー（`135deg` で `#111f14` → `--primary-dark` → `#2e5c3a`）なので、帯も同じ `135deg` で `--primary-dark` → `#24492e`、つまり両隣の値の内側に収める。同系色が続いて境目が消えないよう、上下に細い線（白 .14 / 黒 .25）を入れてある。
- `.feature-cutin` の `display:flex` は UA の `[hidden]{display:none}` に勝つので、`.feature-cutin[hidden] { display:none; }` が要る。無いと出す前と閉じたあとに padding ぶんの帯が残る。
- リンク先は `index.html#site-updates`。そのアンカーを外すとカットインの「くわしく」がどこにも飛ばなくなる。

### Date-driven auto-display (and when it updates)

Several things reflect the current date automatically — no manual edits needed, but the underlying data must be set correctly.

| What | When it updates | How |
|---|---|---|
| `data/news.json` (official news) | Daily 07:17 JST | GitHub Actions |
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

### このページの目次（`.page-toc`）— 全ページ

2026-09-14 に長いページで始め、**2026-09-15 にユーザー指示で全11ページに広げた**。`js/main.js` の PAGE TOC が、ヒーロー直下（`index.html` だけは「いまの状況」と直近の予定の帯の下）に「このページの目次」（`page_toc_h`、`RUNTIME_KEYS` 入り）を組み立てる。**中身は `main h2.section-title` から自動で作る**ので、節を足しても目次を直す必要はない。飛び先は「その見出しが先頭の section の id → 見出しの id → 無ければ `toc-<見出しのキー>`」の順で決め、他ページからリンクされている既存のアンカー（`#contact`・`#qa` など）は変えない。スマートフォン幅では閉じた状態で出す。**`<nav>` にしないこと** — ヘッダ用の `nav a` のスタイル（白文字）がかかって文字が見えなくなる。

- `review.html` の手書きの目次（`rev_toc_h` / `rev_nav1`〜`rev_nav9`）はこれに置き換えて**廃止**した（目次が2つ並ぶため）。キーも辞書から消してある。
- ヘッダはナビが1段にも2段にもなる（1000px 前後で約122px）ので、アンカーの `scroll-margin-top` は固定値ではなく、HEADER HEIGHT ブロックが入れる実測値 `--header-h` から計算する。

### 節ごとの読み上げ（`.tts-row`）

2026-09-15 追加（ユーザー採用）。`js/main.js` の READ ALOUD が、全ページの `main h2.section-title`（と index の「最新の動き」各コーナーの `h3.section-title.sub`）の下に「🔊 読み上げる」を置き、その節の本文をブラウザ内蔵の `speechSynthesis` で**表示中の言語のまま**読む。ボタンの文言は `tts_play` / `tts_stop`（`RUNTIME_KEYS` 入り）。

- **声が端末に無い言語ではボタンを出さない。** 注記で断るより、押して無音のほうがまずい。ビルマ語はほぼ出ない。声は端末内（`localService`）を優先する。
- **1文ずつ区切って渡す**（日本語・中国語は70字、他は180字で読点・空白で切る）。Chrome は長い発話を黙って止めることがある。
- 読まないもの：表示されていない要素（閉じた Q&A の答えは読む）、見出しの `<small>` 副題（英語表示では日本語なので英語の声で日本語を読むことになる）、地図と層の切り替え、ボタン、目次、絵文字。表は行ごと、セルの間に読点。札（`tag`/`badge`/`label`/`date` を含むクラス）のあとにも読点。
- **日本語の地名の読み替え（`YOMI`）は、公表資料で読みが確かめられたものだけ**（しのおか・おおくさ）。読みは事実なので推測で足さない。
- こどもむけの切り替えで本文が作り直されると止まる。そのために `i18n.js` は `applyDict` の最後で `komaki:i18n-applied` を `document` に投げる（**本文の DOM を掴んでおく処理を足すときはこれを使う**）。

### 「前回から」の印（index.html「最新の動き」）

2026-09-15 追加（ユーザー採用）。`js/main.js` の SINCE LAST VISIT が、前回このページを見たときに無かった項目に「前回から」の印を付け、`#latest` のリード文の下に「前回ご覧になったあとに増えた項目が N 件」と出す。読者は何も操作しない。

- **比べるのは日付ではなく項目の目印の集合**（リンク先 URL、見出しの原文 `data-hl`、更新履歴は描画時に付ける `data-key`）。表示言語に左右されない。**コーナーの描画クラス名や `data-hl` / `data-key` を変えたら、ブロック冒頭の `CORNERS` も直すこと。**
- 記録は `localStorage` の `komaki_seen_items`（目印→最後に見た日、120日で捨てる）。「前回」の写しは `sessionStorage` の `komaki_seen_prev` に1時間持つ — 開いた瞬間に「見た」と上書きするので、写しが無いと再読み込みで印が消える。
- **初めて来た人には印を付けない**（全部に付くと意味が無い）。
- **印の文字は CSS の `[data-unseen]::after { content: attr(data-unseen) }`。** 回覧板シートは描画済みの一覧の `textContent` を拾うので、文字で入れると紙に刷られる。**リンク（`<a>`）には付けない** — 外部リンクの「↗」が同じ `::after` を使っていて、印が消える。
- 学校HPの「新着」（7日以内・黄色）とは別物。混同しないよう、言葉も色（青系）も分けてある。

### 関連するページ（`.related-list`）は各ページ3つ

どのページも末尾の「関連するページ」は **ちょうど3つ**（2026-09-13 にユーザー指示で統一。それまで2つのページと3つのページが混ざっていた）。ナビの再掲ではなく「このページを読んだ人が次に必要とする所」を選ぶ、という方針は変わらない。ページを足すときも3つ選ぶこと。文言キーは `rel_<このページ>_<行き先>`。

### The 「最新の動き」 group on `index.html`

The bottom of `index.html` is split in two. Everything down to **現在の状況** is the site's own hand-written explanation; everything below the `.group-head` band (`<section id="latest">`, key `section_latest`) is "what just happened" — 市公式サイト お知らせ (`id="news"`), 対象校ホームページの更新, 地域の取組, 報道でみる東部地域, サイトの更新履歴. The band's `<h2>` groups them, so those five corner headings are `<h3 class="section-title sub">`, not `<h2>` — do not promote them back. The reader benefit is that "what this site says" and "what just happened" are no longer interleaved.

**地域の取組 is the corner with two halves.** Its top half is hand-maintained (`data/community_actions.json`, the COMMUNITY ACTIONS block, drawn wherever `#community-actions-container` exists — the same list as on `community.html`); its bottom half, 東部まちづくりの動き, refreshes automatically like the other four (`data/tobu_actions.json`, the TOBU ACTIONS block, `#tobu-actions-container` — see that file's section above). `latest_lead` says exactly this; keep that caveat accurate if the mix of automatic and manual corners changes again. Because the Instagram source link is rendered here at runtime, `index.html` is in `INSTAGRAM_PAGES` in `auto_gates.py` alongside `community.html` — a third page rendering this corner has to be added there too.

**On the 回覧板 sheet the corner is a block of its own at the very end** (`upcomingActionsBlock()` in `js/main.js`, heading `board_actions`／「これからの催し」), on both sheet kinds. It sits outside the 7-day `data-date` window on purpose: the rest of the 最新の動き sheet reports what has happened, while these are events still to come — which is exactly what a circulated paper is for. Do not give the action items a `data-date` to fold them into the window. The 地域の取組 section on `community.html` carries `data-board="skip"` so the page-summary sheet prints this list instead of the section's lead paragraph.

- `.group-head` and `.group-head + .section` in `css/style.css` trim the padding so the band and the first corner read as one block. If a corner is inserted between them, that pairing breaks.

#### 自動取得した見出しの翻訳（2026-09-14 ユーザー指示：見出しを原文のまま残さない）

「最新の動き」の各コーナーと community.html に自動で並ぶ見出し（市のお知らせ・各校HPの記事・中日新聞・地域協議会のイベント・東部まちづくりの取組名と会場名・地域の取組の催し名）は、**日本語以外の表示では訳した見出しに置き換える**。原文を残して下に参考訳を添える形（2026-09-06 に検討・保留した案）は採らない — ユーザーが「原文のまま残すことは禁止」と指示した。日本語とこどもむけでは原文をそのまま出す。

- **訳の置き場は `data/headline_i18n.json`**（`{"items": {"見出しの原文": {"en": …, …, "my": …}}}`）。キーは見出しの原文そのもので、見出しが1文字でも変われば別キーになり訳し直される。いま表示されない見出しの訳は自動で落ちる。
- **毎日の更新は `.github/workflows/translate-headlines.yml`**。「Fetch Official News」が終わると動き、`headline_i18n.py pending` で訳の無い見出しを出し、Claude（sonnet）に `auto_i18n/translations.json` だけを書かせ、`headline_i18n.py apply` が機械検証（9言語そろい・タグ/URL/改行なし・かな残りなし・zh 以外に漢字なし・長さ）して合格分だけ取り込む。市・学校・新聞社のサーバには一切アクセスしない。`CLAUDE_CODE_OAUTH_TOKEN` が無ければ何もしない。
- **⛔ AI に `data/headline_i18n.json` を直接書かせない。** 壊れた JSON や規則違反の訳がそのまま公開されるため。人が誤訳を直すのはよい（見出しが変わらないかぎり上書きされない）。
- **⛔ 自動生成される `news.json` / `school_news.json` / `chunichi_news.json` などに訳を書き足さないこと。** 毎日上書きされる。
- 画面側は `js/main.js` 冒頭の `window.KomakiHeadline`。各コーナーは見出しの要素に `data-hl="原文"` を付けて描き、描き終えたら `KomakiHeadline.apply(container)` を呼ぶ。帯（TOP CUT-IN）は `KomakiHeadline.text()` で文字列を訳す。**新しい自動取得コーナーを足すときは、この2つと `headline_i18n.py` の `current_headlines()` の3か所をそろえること。**
- **訳がまだ無い見出しだけは原文で出る**（取得直後で翻訳ジョブがまだ走っていない数分〜、または訳が検証に落ちた日）。見出しごと隠すと新着があったこと自体が伝わらないため。
- 読者向けの注記（`news_note` / `school_news_note` / `press_note` / `tobu_actions_lead` / `tobu_actions_note`）には「日本語以外の表示では自動翻訳」と書いてある。訳す範囲を変えたらここも直す。
- 自動取得の日時（「9月23日 13時30分～16時00分」「令和8年11月15日(日曜日)14時から（開場13時）」）は `window.KomakiJaWhen()` が日付と時刻だけを読み取り、表示言語の書式に組み直す。読めない書き方のときは原文が出る。

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
- **The map frame is the city's own figure's frame.** `view_bbox` at the top of the geojson is the ground extent of `R9sinooka_busarea.png` (the 対象エリア図 on the city's `48603.html`), obtained by aligning the district boundary onto that image's 学校区 line: **1639×1179 px at 3.785 m/px**, i.e. 6203.6 × 4462.6 m. `VIEW_W = 1639` in `main.js` matches it, so one SVG unit is one pixel of the official figure and the two are at the same scale in the same frame. There is no padding — the map fills the frame exactly, as the original does; `UI_PAD` insets only the scale bar and the north arrow. 桃花台東 continues past the frame's **top edge (from about 30% in from the left) and the upper part of its right edge** — not just the north-east corner — and it is cut in the original figure too. That is intended, and `bus_map_caveat` / `bus_map_legend_line` both say the district continues beyond the top and right edges (they said "top-right corner" until 2026-09-15, which sent readers looking at the wrong place). Both district labels must stay inside `view_bbox`. Remove `view_bbox` and `main.js` falls back to fitting everything (a much wider frame that shrinks the built-up part of 桃花台 by about a third).
- **`px()`/`py()` use the real length of a degree in each axis** (`MPD_LON` / `MPD_LAT` series), not `cos(lat)` alone — the plain-cosine form stretched the map vertically by ~0.5%, which is enough to break the exact-scale match above.
- `boundary_note` on each `district` feature records the derivation; `bus_map_caveat` states the two accuracy levels to the reader; `bus_map_osm` credits OSM **plus** 国土数値情報 and e-Stat. Do not drop any of the three.
- **The legend swatches must match what is actually painted** (fixed 2026-09-15): the walking area is *inside* the red line, so it carries the pale yellow/blue district tint — it is not white, and `bus_map_legend_walk` must not call it uncoloured; the new-school swatch has the yellow (`--accent`) ring the map draws; the purple swatch uses the map's own fill/stroke values. The 表示する情報 checkboxes carry the same marks (学・園・公・店・C・神, road lines) as the map. These are legend-only changes — the map itself stays frozen.
- **The same map is also shown on `map.html`** (section `#bus-area`, added 2026-09-15 at the user's instruction). It is the same BUS SERVICE AREA MAP block — it finds its elements by id, so it runs on whichever page carries them. The layer checkboxes, legend, zoom controls and **`bus_map_caveat`** are copied from `bus.html`; **change both pages together**, and never show the map on either page without the caveat.
- **Zoom and pan were added on 2026-09-15 at the user's explicit instruction** — the one change to the frozen map's *display* so far. Only the SVG `viewBox` moves; no coordinate, colour or frame changes, and **at zoom 1 the rendering is pixel-identical to the frozen map** (checked by screenshot diff against the previous commit — keep it that way). Range is confined to the original frame, zoom 1–`MAX_ZOOM` (6). Labels, marks and line widths are redrawn at 1/√z (`SCALE_ITEMS` / `STROKES`) so they grow only √z on screen; the scale bar and north arrow stay screen-fixed and the bar switches 1 km → 500 m → 200 m → 100 m. Controls: the `.bus-map-zoom` buttons (`bus_map_zoom_in/out/reset`), Ctrl/⌘ + wheel, double-click, drag while zoomed; on touch, two fingers pinch, and one finger pans only while zoomed — at zoom 1 a single finger still scrolls the page, so the map never traps a phone reader. A plain wheel is left to page scrolling. `bus_map_zoom_hint` explains this under the map.
- **`cls: 'local'` roads are the 桃花台 main local streets (OSM `tertiary`) plus 桃花台鳥居松線** (named 桃花台・春日井線 in OSM). They live in the `localroad` layer so a reader can switch them off; the 幹線 keep the `road` layer and are drawn above them.

- **Three anchors are linked from other pages and must not be removed**: `index.html#news` (from `actions_note` on `community.html`), `community.html#qa` (from the 「ほかのページにもQ&A」 box on `faq.html`), and `bus.html#area-map` (the 対象エリアの地図 heading, linked from the 通学区域とスクールバスの対象エリア section on `map.html`, added 2026-09-15). Both carry an HTML comment saying so.
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
