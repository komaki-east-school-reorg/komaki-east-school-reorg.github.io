# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this site is

A static, no-build-step local information media site (地域情報メディア — renamed from 市民情報サイト on 2026-09-26 at the user's instruction; the site's Japanese name became 「小牧市東部（篠岡地区）学校再編ナビ｜桃花台エリアの非公式でもわかりやすい地域情報メディア」 on 2026-10-11 — header line 1 「…学校再編ナビ」, `site_sub` the part after 「｜」 — since 2026-10-15 the header is the text-set title logo (`logo_area` / `logo_main` / `site_sub`, translated in every language), see Important constraints, page titles end in 「– …学校再編ナビ」; **the other 11 languages keep their existing names** (user's decision, do not retranslate them) — the header logo's `logo_area` / `logo_main` (2026-10-15) are the one exception — except that their `site_sub` now carries the area name (en 「Tokadai Area Community Info Media (Unofficial)」, zh 「桃花台…」, ko 「도카다이…」, ne 「तोकादाइ…」 — the same spelling as the new school names in each dictionary; 2026-10-11, user's instruction); English name **Community Info Media**, used as a proper noun — in running text write "a community info media outlet", never "a community info media") about the school reorganization plan in Komaki City's eastern (Shinooka) district. Hosted on GitHub Pages at `komaki-east-school-reorg.github.io`. There is no package manager, no bundler, and no test runner.

**Operator (2026-11-05, user's decision; renamed the same day):** the site is run by 「これがまちつくサイトの解。」THE UNIT, a unit of resident volunteers, written 「「これがまちつくサイトの解。」THE UNIT（住民有志）」. **There is no abbreviation** (the earlier 「こまけぇ」 was dropped). In foreign languages the name is **translated by meaning (意訳)**, with THE UNIT kept as is: en “This Is the Answer: A Site for Building Our Town.” THE UNIT, pt “Esta É a Resposta: Um Site para Construir Nossa Cidade.”, es «Esta es la respuesta: un sitio para construir nuestra ciudad.», zh “这就是答案：共建家园的网站。”, ko 「이것이 답이다: 우리 마을을 만드는 사이트.」 and the same sense in vi / tl / id / ne / tr / my. On `site.html` it is **the first section, with its own heading 「運営者」 (`site_op_h`), above 「このサイトを紹介する」** (2026-11-07, user's instruction; it sat just above 「関連するページ」 until then) — an illustrated introduction card (`#operator`, `.op-card`: the illustration `img/illust/unit.svg` 「住民の輪」 on the left — on top on phones —, then the name, 「住民有志のユニットです。小牧市・教育委員会とは関係ありません。」 and a link to `#feedback`; keys `site_op_h` / `site_op_name` / `site_op_note` / `site_op_fb` — `site_op_label`「運営」 is no longer shown, the heading took its place; user's instructions the same day). The name appears in the footer (`footer_copyright`), on that card and in the feed's author line (`build_feed.py`) only — not in the unofficial banner. **The site says 住民, not 市民** (same day): 「住民有志」 etc.; only proper names keep 市民 (東部市民センター, 市民四季の森, 市民球場, 市民窓口課, こまき市民文化財団, 市民まつり, 健全育成市民大会, the city's category 市民活動団体, the old site name …市民情報サイト). Foreign tags follow: en resident-run, pt moradores, es vecinal, zh 居民自发, ko 주민, tr bölge sakinleri, my ဒေသခံ, ne बासिन्दा.

**Version: Ver.1.1 as of 2026-11-22** (user's decision, 2026-11-25: the 東部たんけんクイズ and 「篠岡」の名前の由来 pages were launched that day; Ver.1.0 was 2026-11-01, `site_hist_10` / `site_hist_11`). Shown at the top of `site.html` (`site_version`, 13 dictionaries). Earlier milestones carry retroactive numbers Ver.0.1–0.9 (05-02 first release; new pages 05-09 bus/community, 08-22 nationwide, 08-28 review, 09-22 clubs, 10-31 analysis/site; 05 kids mode; 09-26 and 10-11 renames. **Page launches count; adding foreign languages does not** — user's instruction), listed under it as `site_hist_*` with a note that they were numbered afterwards. The user decides when the version changes; when it does, update `site_version` everywhere and add a changelog line.

## 運営の方針と運用の仕組み（2026-11-08 ユーザー指示）

**2027年4月（第1期再編）以降の方針**：実際の学校の状況を見守りつつ、**第2期再編を避けるためのサイト運営を続ける**（ユーザー決定）。これは運営の目的であって、事実ページの書き方は変えない — 事実は公表資料だけ、当サイトの考えは review / analysis の2ページだけ、【事実】／🔎／💡 の書き分けもそのまま。この目的に沿った中身（子どもを増やす・学校と地域の価値を伝える）は、その2ページの提案か、公表された事実の紹介として書く。

- **閲覧数を増やす計画（2026-11-14 ユーザー承認）**：地元の読者の上限は小さい（東部の0〜17歳は約3,360人）ので、機能を足すのではなく「届け方」と「来る理由」を増やす。順に ⓪ 週報と Search Console で元の数を測る ① 検索の入口（題名・説明文を検索語に合わせる／Q&A の1問ずつのページ＝実装済み／町名から学校がわかる早見／JavaScript 無効の救済＝実装済み）② 再訪の理由（1〜4月の「入学・進級までにやること」、週ごとのまとめ、購読の導線）③ 外国語の読者への経路（サイトの中で）。**目標の数字は決めない・運営者の SNS 発信はしない・紙の案内（配布用の QR つきの案内や印刷用の紹介カード）は作らない・掲載団体への連絡はしない**（2026-11-16 ユーザー決定）。**広告・トラッキング・第三者スクリプト・あおる見出し・閲覧数ねらいの小機能はやらない。** 期限のある作業は `data/ops_calendar.json`（`reach-*`）。題名の書き直しは Search Console の検索語を受け取ってから。
- **引き継ぎ用の1枚は `HANDOVER.md`**（毎週届く Issue の種類と対処、人の手でしか直せないこと、直す手順、触ってはいけないもの、Secrets）。Issue の種類・生成スクリプト・Secrets を足したら、ここも直す。
- **運用カレンダー `data/ops_calendar.json`**（手で書く）＋ `.github/scripts/check_ops_calendar.py`。人の手でしか直せない期限つきの作業（PR カード、`BASE_FY`、4月の組織改編、第1期の開校、月初の点検）を1か所にまとめ、`check-fetch.yml` が毎日（10:20 JST）期限の `notice_days` 日前から Issue（⏰ 運用作業の期限）で知らせる。**HTML の `data-expires` と `ja.json` の `data-until` は書かなくても自動で拾う**（`covers` で手書きの項目に置き換えられる）。各項目は `<!-- ops:ID@期限 -->` の印つきで書かれ、閉じた Issue も含めて同じ期限は二度知らせない。一度きりの項目は済んだら消し、`repeat`（yearly / monthly）は消さない。**新しく期限つきの作業を決めたら（「◯月になったら△△を直す」）、CLAUDE.md に書くだけでなくここに1件足すこと。** 一覧は `--list`。
- **訂正の記録・誤りの一覧は置かない**（2026-11-09 ユーザー指示。11-08 に足した `site.html#corrections` と `data/corrections.json` は廃止した）。事実の誤りに気づいたら黙って直す。この種の欄・データ・運用を、新機能やアイデアとしても作らないこと。
- **翻訳の修正提案の窓口（`site.html#translation`）**：外国語版は AI の訳で母語話者の確認を受けていないことを書き、GitHub の Issue フォーム `.github/ISSUE_TEMPLATE/translation.yml`（ラベル `translation`）で修正提案を受ける。外国語表示のときだけ全ページのフッタに TRANSLATION HELP（js/main.js）が一行（`tr_footer`、`RUNTIME_KEYS`）を足す。キー `tr_*`。**修正提案が来たら、そのキーを英語でも確かめ**（誤りは英語から広がる）、表記の決まりなら `term_rules.json` に足し。集計は `translation/open`・`translation/footer`。⚠️ ご意見の窓口（`#feedback`）の説明に「誤りの報告」を例として書かない方針（2026-10-24）は変わらない — 翻訳の窓口は別の節。
- **外部リンクの死活確認から `logoform.jp` を外した**（ボット確認の画面で毎回 403 を返すため。フォームを案内する市のページは毎日の巡回で見ている）。

## Local development

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```


## Validation checks (run before every commit)

**1. External links** — the authoritative lists are `PERMITTED_LINKS` / `CITY_PATHS` / `PERMITTED_HOSTS` and the other `PERMITTED_*` tables in `.github/scripts/auto_gates.py` (check 6 / 6b). In short: only the 38 permitted city pages (5 index pages + article pages the user allowed), **never a PDF**, MEXT only on `nationwide.html`, each Instagram account / club site / other domain only on its listed pages, share endpoints built only in `js/main.js` and never cited as sources. **Adding a URL or domain means updating `auto_gates.py`, `docs/claude/links.md`, `CONTRIBUTING.txt` rule 1 and `README.md` together** (`site_lint.py` `permitted_sync` checks that the city URLs appear in the docs). The full table, the grep commands and the per-page details are in `docs/claude/links.md`.

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

### 訳語のゆれ（`data/term_rules.json`）

2026-10-23 ユーザー決定。英語で Tokadai East と Tokadai Higashi が混ざると、読者には同じ学校だと分からない。**新校名・学校区（桃花台東／桃花台西）は、ラテン文字の言語と `my` では方角を訳さず `Tokadai Higashi` / `Tokadai Nishi`（ハイフンなし）**、`zh` は 桃花台东／西（学校名は「〇〇中学」で「初中」にしない）、`ko` は 도카다이 동／서、`ne` は तोकादाइ पूर्व／पश्चिम。**英語は -ize**（reorganization）。使わない表記は `data/term_rules.json` に正規表現で書き、`auto_gates.py` check 18 が辞書・`headline_i18n.json`・`events.json`・`community_actions.json` を、`headline_i18n.py apply` が見出しの自動翻訳を検査する（照合は `.github/scripts/term_rules.py`）。ゆれを見つけたら規則を1行足す — 直すだけだと次の翻訳でまた戻る。`translate-headlines.yml` のプロンプトにも同じ表記を書いてある。


### HTML attributes for translated content

| Attribute | Effect |
|---|---|
| `data-i18n="key"` | Sets `element.textContent` |
| `data-i18n-html="key"` | Sets `element.innerHTML` (use for values with HTML tags) |
| `data-i18n-aria="key"` | Sets `aria-label` |

Page `<title>` and OG/Twitter meta tags are updated automatically via keys named `meta_title_<pageId>` and `meta_desc_<pageId>` (where `pageId` is the filename without `.html`, e.g., `meta_title_about`).

### Key naming convention

Keys follow the pattern `<page>_<section>_<type>`, e.g., `about_whatis_p1`, `faq_a3`. Shared/global keys (nav, footer, notice, hero) have no page prefix.

### 見出しの `<small>` 副題

節見出し（`h2.section-title` など）は `見出し本文<small>副題</small>` という形の1キーで、`data-i18n-html` で流し込む。副題の言語は**たった1つの規則**で決まる（2026-09-06 ユーザー指示）：

> **`en` の副題は日本語。それ以外のすべての言語の副題は英語。**

| 辞書 | 見出し本文 | `<small>` 副題 |
|---|---|---|
| `en` | 英語 | **日本語**（`ja` の見出し本文をそのまま） |
| `ja` / `ja-kids` / 他8言語 | その言語 | **英語** |

- **副題に見出しと同じ言語を入れない。** 英語見出し＋英語副題（`Key Points<small>Key Points</small>`）や、ポルトガル語見出し＋ポルトガル語副題（`Pontos-Chave<small>Destaques</small>`）は同じ語が二度出るだけ。`en` に日本語を置くのは、英語話者が市の日本語資料と照合する手がかりになるため。
- **検証と提案の2ページ（review / analysis）の見出しには、2026-11-04 から先頭の絵文字を付けない**（ユーザー指示。挿絵と重なって過剰になるため）。`en` の副題も日本語の見出し本文そのまま（絵文字なし）。
- `ja-kids` は副題を落としてあるキーが多い。**副題が有るものは英語**、という点だけ守ればよい。
- 新しい節見出しを足すときは、`ja` に英語副題・`en` に日本語副題・他言語に英語副題、という形をそろえること。

## Important constraints

- **ページ冒頭の挿絵（`.page-hero-ill`）は PC（≥769px）で `clamp(10rem, 15vw, 13rem)`、パンくずの行まで上げて題名・説明文の高さに見合う大きさ**（トップの `.hero-ill-pc` は `clamp(11rem, 17vw, 15rem)`。2026-11-10 ユーザー指示。モバイルの帯は別）。
- **挿絵と図はサイトのポリシー（2026-10-31 ユーザー指示）。** 既存のページも、**新しいコーナーやページを足すときも**、Claude Design で作った挿絵と図で見やすく・わかりやすく・親しみやすくする。新しい絵は Claude Design の下絵をユーザーに見せてから実装する。挿絵は `img/illust/*.svg`（160×120、**文字を含まない**、`alt=""`、線 `#1b3826`、色はサイトのトークン、下に薄い影の楕円）。文字が入る図は SVG にせず HTML＋CSS で組み、文字は `data-i18n` で13辞書から流す。【事実】／🔎／💡 の色分けと外さない注記は絵のまわりでも崩さない。
- **市の資料の文面をそのまま載せない（ユーザー指示 2026-09-13）。** 計画・パブリックコメントの回答・説明会の質疑応答・市議会だよりなどは、読んで理解したうえで**当サイトの言葉で書き直す**。数値・日付・議決結果のような事実はそのまま使ってよい。**書き直していることはページに明記し**（共通キー `recomposed_note`／`council_ref_box`／`voices_pc_note`）、**その理由は書かない**（同指示）。
- **The header title is the title logo, set in text (HTML + CSS)** (2026-10-15, user's instructions: the OGP image's design is the site's official title logo; then "set it in text, not as an image"; and "in foreign languages, show the main title in each language too"). `<a class="site-title">` holds `.logo > .logo-fr > .logo-bd` with the chalk dots (`.logo-dots`, `aria-hidden`), `.logo-l1` (`logo_area`, 「小牧市東部（篠岡地区）」), `.logo-mn` (`logo_main`, `data-i18n-html`, the highlighted word in `<b>` — 「学校再編<b>ナビ</b>」), the yellow rule `.logo-ru`, and `.logo-sb` (`site_sub`, now `data-i18n-html` so `ja`/`zh` can carry a `<wbr>` at the line break; `word-break: keep-all` stops CJK breaking anywhere else). **This replaces the old "site name is permanently Japanese in the header" rule** — every language, `ja-kids` included, now shows its own `logo_area` / `logo_main` / `site_sub`. The foreign main titles are new logo strings (「ナビ」 rendered as the language's word for "guide", 导航 / 내비 in zh / ko); the footer, `<title>` and `meta_*` names are unchanged. Details of the look and the layout by width: `docs/claude/ui.md`「ヘッダのタイトルロゴ」. Re-measure every width, all 12 languages and ja-kids after any header change.
- **All facts must come from official sources** — the permitted city URL above, or official printed materials (cite the source inline). Do not add speculative or unconfirmed information. Newspaper reporting is never evidence for a claim on the site (the 報道 corner that used to list headlines was removed on 2026-10-10). **Nationwide figures and national standards come from MEXT** and live on `nationwide.html` only; they are never evidence for a statement about the Komaki plan itself, and the city's information is never used for a nationwide claim.
- **All twelve languages are fully translated and `ja-kids` covers every key**, so `PARTIAL` (`i18n.js`) and `PARTIAL_LANGS` (`auto_gates.py`) are empty (`ko` / `ne` sit before Turkish in every language list). `events.json` labels are a strict **12-language** requirement (`LANGS` in `auto_gates.py`). If a partially-translated language is ever added, put its code in both `PARTIAL` and `PARTIAL_LANGS` so the "parts of this page are in English" notice bar shows and its event labels are not demanded.


## 報道コーナーは廃止（2026-10-10 ユーザー指示）

トップの「報道でみる東部地域」（新聞記事の見出しの自動一覧）は廃止済み。**復活させないこと**（ユーザーの明示的な指示があれば別）。⛔ `chunichi.co.jp` は AI 用クローラを拒否しているので、AI のブラウズ機能で取りに行かないことも変わらない。


## `data/site-updates.json` (this site's own changelog)

The **`#site-updates` section of `index.html`** (its own `<h2>` section right after the 最新の動き group since 2026-10-24) shows a changelog of changes made to this site itself. Unlike `news.json` and `school_news.json`, this one is **hand-maintained** — add a new entry at the top of the `updates` array when you ship something a reader would notice (the auto-update drafter may also prepend a line, see the pipeline section — check 22). **One exception** (2026-10-05): when an eastern-district community council event is picked up, `build_community_events.py` prepends an entry carrying `auto_key` (the article URL). Likewise (2026-10-18), when a new eastern city-planning date goes onto the schedule, `build_toshikeikaku.py` prepends one carrying `auto_key: "toshikeikaku:<slug>|<role>|<start>|<date>"` — the only city-planning line the cut-in shows. Do not delete `auto_key` — it is what stops the same event being added twice. The daily workflow commits this file along with the official news data.

- Each entry: `date` (`YYYY-MM-DD`), `type` (`content` / `feature` / `fix`), `ja` (required), `en` (recommended). Other languages fall back `en` → `ja`, matching the i18n chain.
- **`link` (optional, 2026-11-10, user's instruction): the in-site corner the line is about** — `page.html` or `page.html#id`, never an external URL. The line's text becomes a link to it (SITE UPDATE LOG, `a.update-link`) and `feed.xml` points there instead of `index.html#site-updates`. Give every new line one when a reader can go and see the change; leave it off for site-wide features with no single place and for anything since retired. `build_community_events.py` writes `community.html#council-events`, `build_toshikeikaku.py` writes `community.html#toshikeikaku`, and the auto-update drafter adds one too (check 22 accepts the key). **check 26** fails if a link's page or `#id` does not exist (runtime ids are accepted when their source key is on the page: `faq-qN` / `bus-faq-qN` from `faq_qN` / `bus_faq_qN`, `toc-<key>` from the heading key) — when you remove or rename a section, fix the lines that point at it.
- **Length: 30–40 Japanese characters, 45 at the very most.** The corner shows six entries at once; anything longer turns it into a wall of text. Detail that does not fit belongs in the commit message, not here.
- **Style: one short noun-ending line (体言止め), never a sentence.** Write 「トルコ語・ビルマ語を追加」, not 「トルコ語とビルマ語を追加しました。」. No trailing 「。」. English entries follow the same shape — a noun phrase such as "Monthly calendar added to the schedule page", not "We added a monthly calendar."
- Write a **reader-facing summary, not a commit message** — "Turkish and Burmese added", not "feat(i18n): …". Internal refactors and doc fixes do not belong here.
- **Do not record removals.** Retiring a feature or a corner (e.g. the 報道 corner on 2026-10-10) gets no entry — the log lists what was added or changed for the reader (2026-10-11, user's instruction).
- The list is sorted newest-first at render time and **only the newest 6 are displayed** (`MAX_ITEMS` in the `js/main.js` block); keep the full history in the file.
- **Every entry is shown on `site.html#changelog`** (「更新履歴の一覧」, 2026-11-10, user's instruction) — grouped by month with すべて／掲載内容／機能／修正 filter buttons, drawn by the same SITE UPDATE LOG block into `#site-updates-all`. The top page links to it under the six lines (`site_updates_all`). Keys `changelog_h` / `changelog_lead`; the filter and tag labels are the block's inline dict. **Each month is a `<details>`, and only the newest month is open** (2026-11-10, user's instruction: keep the list from looking long), with 「すべての月を開く／閉じる」; filtering recounts each month and hides empty ones.

## 注記は少なく・印で示す（2026-10-30 ユーザー指示）

外部の講評「ほぼ全ブロックに『自動取得です』『当サイトの考えです』が付き、繰り返しが読みにくい」を受けて決めた。

- **自動で取り込む一覧は 🔄 の印で示す。** 断り書きはそのコーナーに固有のこと（リンク先が日本語、各校の最新1件だけ、など）だけを1行で書き、「毎日自動で取得」「見出しは原文」の説明は**グループの冒頭に1回**（index の `latest_lead`）。該当キー：`news_note` / `school_news_note` / `tobu_actions_lead` / `tobu_actions_note` / `comm_events_lead` / `rev_tk_lead` / `rev_tk_note` / `site_updates_note`。**外国語の辞書ではこれらに「自動翻訳」を残す**（`latest_lead` が見えない schedule.html・community.html でも単独で読めるように）。
- **当サイトの見解の断りはページ冒頭の `rev_stance` 1か所。** 節のリード（`rev_s7_lead` / `rev_s10_lead`）で同じことを繰り返さない。ただし `rev_s7_lead` の「市が検討しているものではありません」と `rev_s3_lead` は残す（提案を市の案と取り違えさせないため）。🔎・💡・【事実】の印と左帯は今までどおり。
- **外さない注記**は変わらない：非公式バナー、`rev_stance` / `rev_stance_general`、`voices_about`、`grade_lead`、子どもの数の推定の断り、`bus_map_caveat`、`bus_contact_note`、FETCH STATUS の赤字、`recomposed_note`（各ページ1回）、`fb_li3`。
- 新しいコーナーを足すときも、断り書きを段落で足さず、印と1行で済ませること。
- **強制カラー（Windows の高コントラスト）**（`@media (forced-colors: active)`、2026-11-11）：背景色が消されても【事実】（実線の左帯）と 🔎・💡（二重線の左帯）、カードの枠、押されているボタン、読み上げ中の文が見分けられるよう、枠線とシステム色で示す。色の切り替えボタンは作らない。色だけで区別する部品を足したら、ここにも足す。


## 日付で変わる表示と時系列

### Date-driven auto-display (and when it updates)

Several things reflect the current date automatically — no manual edits needed, but the underlying data must be set correctly.

| What | When it updates | How |
|---|---|---|
| `data/news.json` (official news) | Daily 07:17 JST | GitHub Actions |
| "Last updated: …" line (index *Current Status* / schedule *Key Events*) | Every time the site is re-deployed (push) and files are re-served | `document.lastModified` of the served file (= deploy time on GitHub Pages), shown via `<p class="section-updated">` |
| Calendar initial month (`schedule.html`) | Every page load (viewer's current month) | `new Date()`, no clamping — it always opens on the current month even when that month has no events, because a reader opening the calendar first wants to know where "now" is. Do not "helpfully" jump to the nearest month that has events |
| "完了" labels in *Current Status* (`index.html`) | Every page load (today **>** `data-event-date` — the day itself is not yet done; 2026-10-26, user's decision) | AUTO DATE STATUS |
| Event status badges 完了/進行中/予定 (`schedule.html`, keys `event_status_*`) | Every page load: 完了 once today > `data-event-date`, 進行中 from `data-start` through the last day (so **the day of an event reads 進行中**, never 完了 — 2026-10-26, user's decision; the calendar's [済] follows the same rule) | AUTO DATE STATUS |
| "Upcoming" bar items | Every page load (hidden once past `data-expires`) | UPCOMING SCHEDULE EXPIRY |
| 「今後のスケジュール」の帯（`index.html`） | Every page load | UPCOMING BAR（2026-10-05 ユーザー指示。**随時更新される欄**）— カレンダーと同じ `KomakiEvents()`（`data/events.json`＋自動で足す催し）から、終わっていない予定を始まる日（`start`）の順に5件まで `#upcoming-auto` に描く。いちばん近い `"day": true` の予定は必ず入れる。日付は ja で **「10月12日（月）」**、他言語は Intl で同等。月単位の予定は「10月」「11月〜12月」と月だけ（曜日を作らない）。帯の最後の第1期再編は手書き（`data-event-key` と同じ日の予定は描かない）。**帯に予定を手で書かないこと** — events.json と schedule.html に書けば出る。**各予定の名前は schedule.html のその予定へのリンク**（2026-11-27 ユーザー指示。`schedule.html#at-<キー>-<n>` で、SCHEDULE JUMP が `data-ev` から探して着地し、手書きの予定ならハッシュを `ev-…` に置き換える。手書きの第1期再編は `#ev-2027-04-01-28` へ直接）。`upcoming_date8`/`upcoming_name8` 以外の `upcoming_date*` キーは廃止 |
| 「あと◯日」の札（`index.html` 今後のスケジュールの帯） | Every page load | 帯のうち `"day": true` の予定にだけ DATE COUNTDOWN が付ける（UPCOMING BAR が `data-countdown` を付けたもの。月単位の予定には付けない）。帯を UPCOMING BAR が描くページでは、NEXT COUNTDOWN の `#next-countdown` 行は出さない（いちばん近い予定が必ず帯に入るため） |
| 「あと◯日」の札（**全ページ**。2026-09-28 ユーザー指示） | Every page load | DATE COUNTDOWN — 日付の決まっているものすべてに付ける。スケジュールの項目（`.event-item` / `.status-item` / `.upcoming-item`）は1日の予定で、かつ events.json の `"day": true` があるものだけ。自動描画の一覧は描画側が付ける `data-countdown="YYYY-MM-DD"`（地域の取組＝`date_start` があればそれ・無ければ `date`、東部まちづくりの催し、協議会イベント＝`when` の月日と `updated_at` の年）。文字は `::after`（`attr(data-cd)`）で出し、読み上げ・原文併記に混ぜない。印刷では隠す。複数日の地域の取組には `data/community_actions.json` に `date_start`（初日）を書くこと |

Notes:
- **The 完了／進行中／予定 badges on `schedule.html` are re-attached on every `komaki:i18n-applied`.** They sit inside `.event-date`, which carries `data-i18n`, so every dictionary application wiped them — until 2026-09-26 no badge was visible anywhere. Their text comes from `window.KomakiEventStatus()`, which holds the same strings as `event_status_*` (main.js cannot read the dictionary); change both together.
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

### The "いまの状況" box (`.now-bar`) — hand-written, **updated continually**

`index.html` opens with a `.now-bar` box that states the current situation, sitting between the hero and the upcoming bar. It is driven by four i18n keys:

| Key | Content |
|---|---|
| `now_label` | Box label ("📌 いまの状況") — rarely changes |
| `now_text` | Where things stand. `data-i18n-html`, so `<strong>` and the date marks below are allowed |
| `now_asof` | The month the text describes ("2026年10月時点") |
| `now_more` | Link text to the `#status` anchor (the *Current Status* section) |

**この欄は随時更新する**（2026-10-05 ユーザー指示。「今後のスケジュール」の帯と同じ扱い）。書く順は次の3つ：

1. **済んだこと** — 日付を確かめ、**過去だとはっきり分かる書き方**で（「9月30日で締め切られました」）。`<span data-past="YYYY-MM-DD">…</span>` で囲む。
2. **いまどんな状態で、何をしているのか** — 日付を含めない一文。印は付けない（ずっと残る部分）。
3. **近い先の予定** — `<span data-until="YYYY-MM-DD">…</span>` で囲む。その日を過ぎると NOW BAR（`js/main.js`）が画面から外す（書き直しが間に合わなかったときの保険で、外れたら文面を書き直すこと）。

- **過ぎた日付の内容を「これから」のように残さない。** 2026-10-05 に、9/4 の校章決定と「9/30 まで受付」が10月になっても残っていたことから決めた規則。
- `check 10`（`auto_gates.py`）が守らせる：ja / ja-kids で月・日が印の外にあれば不合格、`data-past` が未来の日付なら不合格、他言語の印の並び（種類と日付）が ja と違えば不合格。期限切れの `data-until` は警告だけ（日付の経過でゲートが落ちないように）。
- Nothing about the wording updates itself. Whenever the situation actually moves (an event finishes, new material is published, a decision is made) — **and whenever a date in it has passed** — update `now_text` **and** `now_asof` **in all 12 languages plus `ja-kids`**.

`data/site-facts.json` lists this as the `now_bar` target and includes it in `default_targets`, so the auto-update pipeline is prompted to maintain it on every detected change; the drafter prompt carries the same three-part rule and the verifier AI checks it too.


## Page structure

Every HTML page follows the same pattern: `notice-banner` → `<header>` (with `.lang-switcher` containing `.kids-toggle` and `.lang-select`) → `<main>` → `<footer>`. Both `js/i18n.js` and `js/main.js` are loaded at the end of `<body>`. Pages are standalone — there is no shared template or server-side include. Every page also carries the SHARE section (`<section class="section share" id="share">`) as the last thing inside `<main>`. When adding a new page, copy the full header/share/footer blocks from an existing page — **and add it to `sitemap.xml` and `files.txt`**, plus `meta_title_<pageId>` / `meta_desc_<pageId>` keys in every language file.

### 目次の下のリンクカード（`.ill-steps`、review は `.rev-steps`）— ページを更新したら見直す

2026-11-07 ユーザー指示でルール化。ページ冒頭の「このページの目次」の下に、挿絵つきで主な節へ飛ぶカードの列がある（about・bus・clubs・community・council・faq・map・nationwide、review は `.rev-steps`）。**節を足す・移す・消す・名前を変えたら、そのページのカードも見直す**（飛び先・文言・挿絵・順番）。カードは主な節だけでよく、すべての節を並べる必要はない。文言は節見出しのキー（`data-i18n-html`）を使い回すのが基本。`auto_gates.py` **check 24** が、カードの `#id` がそのページ（他ページへのリンクはそのページ）に実在することを確かめる — 消した節を指したままのカードを止めるため。

### このページの目次（`.page-toc`）— 全ページ

2026-09-14 に長いページで始め、**2026-09-15 にユーザー指示で全ページに広げた**。`js/main.js` の PAGE TOC が、ヒーロー直下（`index.html` だけは「いまの状況」と直近の予定の帯の下）に「このページの目次」（`page_toc_h`、`RUNTIME_KEYS` 入り）を組み立てる。**中身は `main h2.section-title` から自動で作る**ので、節を足しても目次を直す必要はない。飛び先は「その見出しが先頭の section の id → 見出しの id → 無ければ `toc-<見出しのキー>`」の順で決め、他ページからリンクされている既存のアンカー（`#contact`・`#qa` など）は変えない。スマートフォン幅では閉じた状態で出す。**`<nav>` にしないこと** — ヘッダ用の `nav a` のスタイル（白文字）がかかって文字が見えなくなる。

- `review.html` の手書きの目次（`rev_toc_h` / `rev_nav1`〜`rev_nav9`）はこれに置き換えて**廃止**した（目次が2つ並ぶため）。キーも辞書から消してある。
- ヘッダはナビが1段にも2段にもなる（1000px 前後で約122px）ので、アンカーの `scroll-margin-top` は固定値ではなく、HEADER HEIGHT ブロックが入れる実測値 `--header-h` から計算する。


### 関連するページ（`.related-list`）は各ページ3つ

どのページも末尾の「関連するページ」は **ちょうど3つ**（2026-09-13 にユーザー指示で統一。それまで2つのページと3つのページが混ざっていた）。ナビの再掲ではなく「このページを読んだ人が次に必要とする所」を選ぶ、という方針は変わらない。ページを足すときも3つ選ぶこと。文言キーは `rel_<このページ>_<行き先>`。


## CSS design tokens

All colours and radii are defined as CSS custom properties on `:root` in `css/style.css`. The theme is a blackboard/school aesthetic: `--primary` (#2e5c3a blackboard green), `--accent` (#d4aa30 chalk yellow), `--for-color` / `--against-color` / `--neutral-color` for the 賛否の声 section of `faq.html`. FOUC is prevented by hiding `body` until `js/i18n.js` adds `.i18n-ready` to `<html>`. **Two fallbacks keep the page from staying blank** (2026-11-14): every page's `<head>` has `<noscript><style>html:not(.i18n-ready) body { opacity: 1; }</style></noscript>` for readers with JavaScript off (copy that line when adding a page; the event and Q&A page templates carry it), and the CSS rule itself reveals the body after 4 s (`i18n-fallback-show`) if `i18n.js` never ran.

## `files.txt`

A manually maintained human-readable index of all site files with descriptions. Update it when adding or removing files.


## 詳しい説明の置き場（`docs/claude/`）

この CLAUDE.md には毎回要る決まりだけを置き、詳細は下のファイルに分けてある（2026-11-28 ユーザー指示。CLAUDE.md が大きくなりすぎたため）。**その作業をする前に該当ファイルを読むこと。** 新しい決まりを書くときも、毎回要る決まりならここ、特定の機能・ページの詳細なら該当ファイルに書く（迷ったら詳細ファイルに書き、ここには1行の要点だけ）。

| ファイル | 中身 | 読むとき | 常に守る要点 |
|---|---|---|---|
| `docs/claude/links.md` | 許可URLの表・grep・春日井市・Instagram・SNS・共有の送り先・レガシーの出典一覧・見出しの直リンク | リンクを足す・直す | 上の「1. External links」 |
| `docs/claude/i18n.md` | 原文の併記、ページ別辞書、`?lang=`・初回の言語判定・`?kids=1` | 言語まわりの仕組みを触る | 辞書を直したら `build_page_dicts.py`。`ja`⇔`en` のキー一致（check 3）を外さない。言語は `window.KomakiLang()` で読む |
| `docs/claude/pipelines.md` | news.json・監視ページ・添付PDF・自動更新パイプライン・日次アイデア・学校HP・協議会イベント・東部まちづくり・都市計画・子どもの数の推定・リンク確認・取得状況・site_lint・見出しの翻訳 | 自動取得・ワークフロー・生成スクリプトを触る | 自動生成ファイル（`news.json` `school_news.json` `community_events.json` `tobu_actions.json` `toshikeikaku_east.json` `child_estimate.json` `official_pages/` `headline_i18n.json` の AI 書き込み など）は手で直さない。市サーバへの負荷を増やさない。AI の工程は信用しない前提の手順を外さない |
| `docs/claude/ui.md` | `js/main.js` の各機能（共有・検索・関連リンク・カレンダー・.ics・学年ビュー・カットイン・目次・読み上げ・前回からの印・最新の動き）とヘッダのロゴ | 画面の機能・ヘッダを触る | ヘッダの寸法は `--hr`。共有の送り先は `js/main.js` だけ。外部スクリプトは はてなスター だけ |
| `docs/claude/pages-community.md` | 地域の取組・レガシー・クイズ・東部振興構想 | community.html・クイズ | 地域の取組は必ずスケジュール（schedule.html＋events.json＋`status_digest`）にも載せる。Instagram は機械で読まない。マークと発信元の行を外さない |
| `docs/claude/pages-review.md` | review / analysis / naze（なぜなぜ分析）の構成・節の表・核心と根拠の対応 | review.html・analysis.html・naze.html | 当サイトの見解はこの3ページ（と shinooka.html の見解の節）だけ。【事実】／🔎／💡 の書き分けと `rev_stance` を外さない。わからないことは質問集 `#rev-open` に問いとして足す |
| `docs/claude/pages-other.md` | about の近隣他地区・ことばメモ・町名早見、nationwide、clubs とチェックリスト、faq、教育の質、shinooka | 各ページ | nationwide の事実は文科省だけ。faq の `faq_q<N>` は欠番なし。賛否の声を市の答えと混ぜない |
| `docs/claude/contacts.md` | 担当部署の連絡先・週次照合 | ページを更新したとき（問い合わせ先も見直す） | トップ・site 以外の全ページに市・県・国と「図書館で調べる」（check 15）。番号は公表ページで確かめ `contacts.json` に登録。部署名は日本語のまま |
| `docs/claude/bus-map.md` | 対象エリアの地図の由来 | 地図に触れる前に | ⛔ **地図は凍結。ユーザーの明示的な指示がないかぎり一切変更しない** |
| `docs/claude/seo.md` | SEO の表・直リンク・予定ページ・Q&A ページ・404・QR・フィード・AI クローラ・ウェブアプリ・計測・ハッシュタグ | ページを足す・予定や Q&A を直す | 予定を直したら `build_event_pages.py`、Q&A なら `build_qa_pages.py`、更新履歴なら `build_feed.py`、文を変えたら `build_search_index.py`→`build_crosslinks.py`→`build_llms.py`。トラッキング・第三者スクリプトを増やさない |
| `docs/claude/gates.md` | `auto_gates.py` の各 check の意味 | ゲートが落ちたとき・検査を足すとき | 検査を足すならまず `site_lint.py`（止めない点検）に |
