# js/main.js の画面の機能

> `CLAUDE.md` から移した詳細（2026-11-28）。この作業をするときに読む。要点と禁止事項は `CLAUDE.md` にある。

## `js/main.js`

Self-contained IIFE blocks handling: hamburger nav, active nav link highlighting, auto-date status, "last updated" display, upcoming schedule expiry (`data-expires`), FAQ accordion, voice filter, official news rendering, target-school website updates, the share buttons at the bottom of every page, and the interactive calendar on `schedule.html`. Calendar events live in `data/events.json` (`{"events": {"YYYY-MM-DD": {ja, en, pt, vi, tl, es, zh, id, ko, ne, tr, my}}}`), fetched at runtime by the calendar block — edit that file, not `main.js`, to add/change events. All 12 language labels are required per event. **A date may hold more than one event: the value is either that object or an array of them** (added 2026-09-03, when the 就学時健診 and the district music festival both fell on 10/31). The calendar draws one dot per event and the `.ics` writer emits one VEVENT per event — its UID gets a `-2`, `-3` … suffix from the second entry on, so the first event's UID never changes and already-imported calendars do not duplicate it. `check 2` in `auto_gates.py` validates both shapes. If the fetch fails or the file is empty, the calendar section hides itself.

**`"start": "YYYY-MM-DD"`（任意）は月単位・期間の予定の始まり**（2026-10-05 追加）。キーは終わり（月末など）、`start` は始まり（schedule.html の `data-start` と同じ日）。トップの帯が「11月〜12月」と出すのに使う。`"day": true` の予定には付けない。`check 2` は言語キー以外に `day` と `start` と `until`（`EVENT_META`）を認める。**`"until": "YYYY-MM-DD"`（任意、2026-10-23）は `"day": true` の予定が何日か続くときの最終日**（バンブーインスタレーション 11/13〜15）。「カレンダーに追加」がその日まで続く終日予定として書き出す。**schedule.html の一覧と events.json は check 9 が突き合わせる**ので、予定を足すときは両方に書くこと。

**主要イベント一覧の「終わった予定を隠す」**（HIDE PAST EVENTS in `js/main.js`、2026-11-07、日次アイデア 9/10）。ふだんは全部見せ、押すと最終日が今日より前の予定と、中身が全部隠れた h4・年の h3 を `.is-past-hidden`（display:none）で隠す。`hidden` 属性は使わない（PAST COMMUNITY EVENTS の `hidden` と混ぜないため）。状態は `localStorage` の `komaki_hide_done`、文言は `sched_hide_done`、集計は `schedule/hide-done`・`schedule/show-done`。隠せる予定が無ければ切り替えごと出さない。

**何日か続く予定（`"day": true` ＋ `"until"`）は、トップの「今後のスケジュール」の帯に最終日まで出し続ける**（2026-11-15 ユーザー指示。UPCOMING BAR）。日付は「11月13日（金）〜11月15日（日）」と最終日まで書き、始まったあとは「あと◯日」を付けない。

**`"day": true`（任意）は「その日に行われると決まっている予定」の印**（2026-09-26 追加）。月単位・期間の予定（「2026年10月」「11月〜12月頃」）は月末などの日付で置いてあるので、この印を付けない。`check 2` は言語キー以外に `day` だけを認め、値は `true` のみ。トップの「次の予定まであと◯日」（NEXT COUNTDOWN）は**この印の予定だけを数える** — 付け忘れても数えないだけで、存在しない日を数えることはない。予定を足すときは schedule.html の `data-start` と `data-event-date` が同じ日（＝1日の予定）かどうかで判断する。

### SHARE BUTTONS (every page)

Every page carries a `<section class="section share" id="share">` just above `</main>`: the heading, lead and closing note are in the HTML with `data-i18n`, and the buttons themselves are built by the SHARE BUTTONS block in `js/main.js` into `#share-buttons` / `#share-star`.

**2026-09: a fixed bar (`.share-sticky`, id `#share-buttons-sticky` for its button row) follows scroll at the bottom of every page**, showing the exact same button set as `#share-buttons` (built by the same code, see below) so a way to share is always on screen without scrolling to the end. Since 2026-09-15 (user's instruction) it also carries a はてなスター ☆ at its right end, loaded only when the reader touches it (see that section). It carries only the sharing buttons and the star. It is created entirely by JS and appended to `document.body`, so no page needs HTML for it. `html.has-share-sticky` is added to the root only once the bar exists, and `body` gets bottom padding only under that class — so a reader with JS disabled gets no dead space reserved for a bar that was never built. Hidden on `@media print` (a `position:fixed` bar has no sensible printed form) and given `z-index:90`, below the sticky header's 100, so the mobile hamburger dropdown still covers it when open.

- **Buttons**, in row order: LINE, X, Facebook, はてなブックマーク, note, Threads, Bluesky, Reddit (`<a target="_blank">`, URL built by the entry's `url()`), Mastodon (`<button>`, see below), Instagram / TikTok (`<button>`, copy-only, see below), リンクをコピー, and — only where `navigator.share` exists — ほかのアプリで共有. The native-share button is what covers WhatsApp / Zalo / Messenger and is the only route that actually *opens* Instagram / TikTok, so do not drop it in favour of adding more per-service buttons.
- **Open the app when it is installed** (2026-09-15, user's instruction). `serviceHref()` picks the link per device. **Android**: `intent://…#Intent;scheme=…;package=<app>;S.browser_fallback_url=<the web share URL>;end` for LINE (`line.me/R/share`), X (`twitter://post`), Facebook, Threads, Bluesky and Reddit — if the app is missing or rejects the URL, Chrome silently opens the web URL, so nothing breaks. **iPhone/iPad**: never a custom scheme (Safari shows an "invalid address" alert when the app is absent); only https universal links, i.e. the normal URLs, except LINE, which switches to LINE's own `line.me/R/share` because `social-plugins.line.me` is not an app link. はてなブックマーク and Mastodon stay web-only (no app can be named reliably). PCs get the unchanged web URLs.
- **There is no Facebook いいね (Like) button, and none can be added**: Meta discontinued the Like/Comment plugins for external sites on 2026-02-10 (they now render as a 0×0 frame). A reader asked for one on 2026-09-15; the existing Facebook *share* button (`sharer.php`) still works and is the substitute. Do not embed `facebook.com/plugins/like.php` or the SDK — it would send every reader's visit to Meta and show nothing.
- **Button colours follow each service's own button.** note is black (`#1a1a1a`, matching note's official button — 2026-10-11, user's instruction), not its old green.
- **Instagram and TikTok publish no share intent that accepts a link**, so their buttons copy the URL and show 「{app} に貼り付けてください」 instead of opening anything. Their labels say （リンクをコピー） so that is visible before the press. If either ever ships a real intent URL, move it into `SERVICES` and drop the copy path — do not invent an endpoint for them in the meantime.
- **Mastodon is decentralized**, so there is no single endpoint: the button asks once for the reader's server domain, normalizes it (`https://`, trailing path and `@user@` forms are all stripped), keeps it in `localStorage` under `komaki_mastodon`, and opens `https://<host>/share?text=`. A third-party redirect service would be simpler but would add an external host to a site that has exactly one; don't. The prompt text lives in the dictionary (`share_mastodon_prompt`) and is read out of a hidden `data-i18n` node, because `main.js` has no access to the dictionary itself.
- **The buttons carry no text label — only an icon**, with the service name in `aria-label` (via `data-i18n-aria`) and mirrored into `title` on hover by `syncTitles()`. With ten of them in one row, per-button text labels made the share box the largest block on the page. The icons are letters and symbols set in the site's own font, not brand logo images: an image would add an external host (or bytes) and a fixed width that the ten languages do not share. `share_lead` / `share_note` are deliberately one short line each for the same reason.
- **The shared URL is built from `<link rel="canonical">` plus the current language**, not from `location.href`. `i18n.js` writes `?lang=` into the address bar only *after* the dictionary fetch resolves, so reading the address bar gives a one-step-stale URL right after load and right after a language switch. The block captures the canonical value once, at parse time, because `i18n.js` later rewrites that element to the per-language URL.
- **`href` and the page title are recomputed on `pointerdown` / `focusin` / language change**, since `document.title` is replaced by `i18n.js` after its fetch. Without that the page would be shared under its Japanese title.
- **Labels use `data-i18n`, not an inline dictionary.** The news blocks carry inline dicts because they render before the dictionary arrives; this block builds its DOM before `applyDict` runs, so the dictionary can own the text. The keys are invisible to the HTML scanner, so they are listed in `RUNTIME_KEYS` in `build_page_dicts.py` — **add any new share key there too**, or non-Japanese pages will silently fall back to the inline Japanese default.
- **The button-building code runs once per container** (`boxes.forEach(...)`, `boxes = [mainBox, stickyBox]`), so `#share-buttons` and `#share-buttons-sticky` end up with independent DOM nodes for every button — a `<button>`/`<a>` cannot exist in two places at once, so nothing is shared between them except the closures (`shareUrl()`, `shareTitle()`, `copyLink()`, …) and the `links` array used by `refresh()` to rebuild every `<a href>` in both containers at once. Each container gets its **own** copy-result toast (`makeToast(box)`), so feedback appears next to whichever row the reader actually used — but the toast **text itself** (`share_copied`, `share_mastodon_prompt`, …) is a single set of hidden `data-i18n` templates (`tpl`), read via `.textContent` rather than duplicated, so there is exactly one translation to keep in sync per key. `syncTitles()` queries `.share-btn` globally (not scoped to one box) for the same reason — it has to reach both rows.

**The two notes under the buttons are one block** (2026-10-15, user's instruction): SHARE BUTTONS moves the ★ note (`share_star_note`) next to the closing `.share-note` inside `.share-notes`, a wrapping flex row — one line when both fit (PC), one sentence per row when they don't. The ★ note hides with the star row (`hideStar()`) when Hatena fails to load.

**The common print stylesheet** (2026-09-14). The `@media print` block near the end of `css/style.css` makes an ordinary Ctrl+P usable: it hides the on-screen machinery (header and language switcher, share section, sticky bar padding, related pages, the page TOC, the footer's page list) and **forces every Q&A answer (`.faq-a`) open**. It does **not** touch the body text, tables or figures, and it deliberately **keeps the unofficial-site banner (`.notice-banner`) and the footer's operator line**, so a printed page cannot pass for a city handout. **The 🖨 print button, the 回覧板 sheet (BOARD SHEET) and the URL/date line at the end of a print (PRINT STAMP) were retired on 2026-11-04 at the user's instruction** — do not bring them back; the print stylesheet stays for Ctrl+P.

**はてなスター** sits below the buttons as ラベル → page-title link → star container, the standard Hatena Star arrangement (`Hatena.Star.SiteConfig.entryNodes`). Two things about it are deliberate:

- Its URL is the **bare canonical URL with no `?lang=`**. A star is a reaction to the page, not a share; keying it per language would scatter one page's stars across ten URLs.
- `HatenaStar.js` is **the only external script this site loads**, and it is not loaded until the share section comes within 200 px of the viewport (`IntersectionObserver`; a click on the star row is the fallback where that API is missing). A reader who never reaches the bottom of the page causes no request to Hatena. **The sticky bar's ☆** (`.share-sticky-star`, added 2026-09-15) cannot use that trigger — the bar is always on screen — so it loads the script on `pointerenter` / `focusin` / `touchstart` / click of that ☆; until then it is a plain `.share-btn--star` button, which hides itself once Hatena draws into its holder. Its title link is `.visually-hidden` (Hatena still reads its `innerText`). Do not give `.share-sticky-star` `overflow:hidden`: Hatena floats its colour-star picker above the ☆+ as an iframe, and clipping cuts it off. If a second third-party script is ever added, revisit this — the "no automatic third-party script" property is worth more than any one widget. (Since 2026-10-24 there is one automatic outside request besides this: the cookie-free visit count, an image GET with no script — see 「利用状況の計測・ハッシュタグ・声の窓口」.)
- **Loading it late takes two non-obvious steps** (both were got wrong first time round, and the failure is silent — the label renders with no star next to it):
  1. Set `Hatena.Star.SiteConfig` **after** the script loads, never before. The script's own line is `void 0 === window.Hatena.Star && (window.Hatena.Star = {…})`, so pre-creating `window.Hatena.Star` to hold the config makes it skip its own assignment and never initialize.
  2. Its initializer is registered as `window.addEventListener("DOMContentLoaded", …)`, which has long since fired by the time the section scrolls into view, so it must be re-triggered with `window.dispatchEvent(new Event('DOMContentLoaded'))`. There is no public entry point for this — `Hatena.Star.EntryLoader.loadEntries()` does not exist in the current build. Double-firing is safe: it skips any entry node that already contains `[data-hatena-star]`.
- In the current build **both the star's URL and its displayed title are read from the `uri` node** (the title comes from that element's `innerText`, not from the `title` selector). The permalink's text is the page title, so both readings give the right answer — keep it that way rather than moving the title into a separate node.
- If nothing renders within 4 s the whole star row hides itself, so a broken widget never leaves a label with no star beside it.

### サイト内検索（全ページ、2026-11-05）

ユーザーが過去の提案から選んだ（2026-09-17「サイト内横断検索窓」）。**索引は事前に作る**：`.github/scripts/build_search_index.py` が各ページの `<main>` を読み、辞書の文で `data/search/<言語>.json`（12言語＋`ja-kids`、各約300KB）を書く。1件は `<section>` ごと（飛び先は PAGE TOC と同じ規則）、その中の id を持つ要素（予定 `ev-…`、根拠のカード `rev-…`、`legacy-…` など）、Q&A の1問ずつ（`.faq-item`、飛び先は SECTION LINKS と同じ「質問のキーの `_` を `-` に」）。共有欄・関連ページ・目次・隠し要素は入れない。自動取得の一覧は入らない。**辞書や HTML の文を変えたら実行してコミット**（`--check` あり、`auto_gates.py` check 23。毎日の自動更新と週1回の番号照合のワークフローも作り直す）。手編集不可。

- 画面は `js/main.js` の SITE SEARCH。PC はヘッダの言語切替の行の右端（📲 の右、`.search-open-btn`、寸法は `--hr`）、**モバイルはハンバーガーメニューの最後**（`li.nav-search`。モバイルのヘッダには置かない — 📲 と同じ理由）、404 はページ内の欄（`#site-search-inline`）。窓を初めて開いたときだけ表示言語（こどもむけなら `ja-kids`）の索引を読む。空白区切りの語をすべて含む所を、見出し一致＞ページ名一致＞本文の出現数の順に最大30件。日本語・中国語は NFKC・カタカナ→ひらがな・空白を無視して比べる。0件なら問い合わせ先（about.html#contact）へ案内し、`magnifier.svg` を添える。
- 🔍 を足してもヘッダの高さは変わらない（2026-11-05 に 769〜1280px × 13表示で実測）。ヘッダに手を入れたら測り直すこと。
- 文言は `search_*`（`RUNTIME_KEYS`）。集計は `search/open`・`search/go` だけで、入力した語は送らない。

- **候補の一覧（SEARCH SUGGEST、2026-11-28 ユーザー指示）**：検索窓（トップの欄・検索の窓とも）を押すと、入力欄のすぐ下に「おすすめの言葉」（`search_hints`）、打ち始めると「もしかして」として、打った文字を含む候補（おすすめの言葉・言い換え語 `data/search_aliases.json`・索引の見出し）を最大8件（おすすめと言い換え語を先に、次に先頭一致、短い順）。押すか上下キー＋Enter でその言葉を入れて検索。Esc は一覧だけを閉じる（窓は閉じない）。combobox / listbox の ARIA。**打った語は保存も送信もしない**（集計は `search/suggest` の機能名を1回だけ）。文言 `search_sug_pop` / `search_sug_guess`（`RUNTIME_KEYS`）。トップの欄は、ふだんは入力欄1本のまま（一覧は押したときだけ重なって出る）。
- **検索語を URL で渡せる**（2026-11-07、日次アイデア 11/6 の案）。`?q=語` で開くと、トップ・404 はページ内の欄に、他のページは検索の窓を開いて、その語で検索した状態になる。結果の件数の行に「🔗 この検索のリンクをコピー」（`search_link_copy` / `search_link_copied`、`RUNTIME_KEYS`）— コピーするのはトップの `index.html?q=語`（＋`?lang=`）。index.html の `WebSite` 構造化データに `SearchAction`（同じ URL）。**`q` は集計に送らない**（COUNTER の `pagePath()` は `?lang=` / `?kids=1` しか付けない — ここを変えるときも `q` を入れない）。

### 関連リンク「あわせて読みたい」（全ページ、2026-11-10）

ユーザー指示「サイトの回遊性を高めるため、サイト内で必要と考えられる箇所すべて計算してたくさんリンクを作成」。**手で1本ずつ書かない**（方針として記憶済み）。`.github/scripts/build_crosslinks.py` が検索の索引 `data/search/<言語>.json` の日本語の本文から、文字2-gram の TF-IDF のコサイン類似度でリンク先を選び、`data/crosslinks/<ページ>.json`（手編集不可、`--check`、`auto_gates.py` **check 27**、`--show` で組み合わせを一覧）に書く。画面は `js/main.js` の CROSS LINKS で、そのページの1枚だけを読む。

- **リンク元**：h2 の節（問い合わせ先・更新履歴・運営の節は除く）、Q&A の1問（開いた答えの下）、節の中のカード（`rev-…` の根拠・核心、`legacy-…`、`council-…`、予定 `ev-…`）。**リンク先**：索引の全項目から、同じページ・`site.html`・連絡先・部品の id・本文が 3000字を超える項目（何にでも似てしまう）を除いたもの。
- **選び方**：3ページ以上に出てくる文（書き直しの注記・窓口の部署名など）は計算から外す。似ている順に、1ページにつき1件まで、節は4件・Q&A とカードは2件まで、類似度 0.17 未満は出さない。カード・予定の見出しが親の節と同じときは本文の頭を見出しにする。
- **文を変えたら** `build_search_index.py` → `build_crosslinks.py` の順に回す（毎日の自動更新と週1回の番号照合のワークフローも同じ順で作り直す。`ALLOWED_GENERATED` に入れてある）。新しい節・Q&A・カードは自動で対象になる。
- 文言は `xlinks_label`（`RUNTIME_KEYS`）。読み上げ（`SKIP`）・原文併記（`ORIG_SKIP`）・検索の索引（`SKIP_CLASSES`）から外し、印刷では隠す。集計は `xlink/go`。

### 計画の段階の図と「入学・進級までの流れ」（schedule.html、2026-11-21）

日次アイデア 9/17・11/15 を統合。`#plan-steps` は PLAN STEPS（`js/main.js`）が下の縦の年表（`.tl-item`）の名前と状態から作るので、**段階を直すときは年表だけ直す**。`#prep` は公表済みの予定だけを時期ごとに並べ（キー `prep_*`）、過ぎた時期は `data-until`、節全体は `data-expires="2027-04-30"` で外れる。未公表の日程は項目にせず、バスの持ち物などは `bus.html#checklist` へ送って二重に書かない。予定が変わったら `events.json`・schedule.html の一覧と一緒に `prep_m*` も直す。

### カレンダーの月送りと「この月の予定」（schedule.html、2026-11-11）

日次アイデアのカレンダーまわりの案をまとめたもの。CALENDAR（`js/main.js`）の中。
- 月送りの行の下に「今月に戻る」（`#cal-today`。今月を見ているときは出さない）と「次の予定のある月へ」（`#cal-next-ev`。表示中の月より後で、まだ終わっていない予定がある最初の月。無ければ出さない）。**初期表示は今月のまま**（予定のある月へ自動で飛ばさない方針は変えていない）。
- 升目を左右にはらうと月送り（横に50px以上で、縦の動きの1.5倍より大きいときだけ。縦のスクロールは妨げない）。
- カレンダーの下に「この月の予定」（`#cal-month-list`）：その月の予定を日付順に文字で並べ、押すと日カードが開く。**日付を付けるのは `"day": true` と `span` の予定だけ** — 月単位の予定は月末の日付で置いてあるだけなので、名前だけを出す（日付を作らない）。予定の種類のアイコンは入れていない（種類分けを当サイトが作ることになるため）。
- キー `cal_today` / `cal_next_ev` / `cal_month_h` / `cal_month_none`（HTML にあるので `RUNTIME_KEYS` 不要）。集計は `calendar/today`・`calendar/next-ev`・`calendar/swipe`。

### 購読できるカレンダー（`calendar.<言語>.ics`、2026-11-07）

日次アイデア 10/22 の案をユーザーが採用。schedule.html のカレンダーの下の「🔔 カレンダーアプリで購読する」（`#cal-sub`、`cal_sub_*`）から、`webcal://…/calendar.<表示言語>.ics` を購読するか、URL をコピーして Google カレンダーの「URL で追加」に貼る（外部サービスへのリンクは張らない）。CALENDAR SUBSCRIBE（`js/main.js`）が表示言語に合わせて href を書く。

- **生成は `.github/scripts/build_calendar.py`**（手編集不可、`--check`、`auto_gates.py` check 25）。`events.json` に、`KomakiTokadaiEvents` / `KomakiEvents` と**同じ選び方・同じ並び**で自動の催し（桃花台を考える会・東部の協議会・都市計画の日程）を足し、`KomakiIcs.entry()` と同じ規則で12言語ぶん書く。**UID は「📅 カレンダーに追加」と同じ**（`日付[-n]-komaki-saihen@…`、協議会は `councilUid` と同じハッシュ）なので、1件ずつ足した人が購読しても二重にならない — JS 側の UID・タグ・時刻の読み方を変えたら、このスクリプトも同時に直すこと。2026-11-07 に画面の UID 47件と一致を確認。
- 出力は入力だけで決まる（DTSTAMP は予定の日付から、終わった予定も残す）。`REFRESH-INTERVAL` / `X-PUBLISHED-TTL` は1日。
- 作り直すのは `fetch-news.yml`（毎日・起案AIのあと）と `translate-headlines.yml`（訳が入ると催しの名前が変わる）。自動更新ジョブの `ALLOWED_GENERATED` に `calendar.xx.ics` を入れてある。sitemap には入れない。集計は `calendar/subscribe`・`calendar/sub-copy`。

### 検索の言い換え語・入口の語・着地の強調（2026-11-21）

日次アイデア 9/21・9/27・11/8・11/15・11/21 を統合。**言い換え語**は `data/search_aliases.json`（手編集可。値は本文で実際に使う語だけ。言語は `ja`〈こどもむけも使う〉と `en`）。**入口の語**は `search_hints`（`|` 区切り、`RUNTIME_KEYS`）で、検索の窓の中だけに出す（トップの欄は入力欄1本のまま）。語を変えたら `site_lint.py` の `search_words` が索引に当たるかを見る。**LANDING**（`js/main.js`）は検索結果と「あわせて読みたい」から着いたときだけ見出しを強調し、検索語を CSS Custom Highlight API で示す。語は `sessionStorage` の `komaki_land` に15秒だけ置き、**URL・集計には載せない**。`faq.html`・`bus.html` の Q&A の冒頭にことばメモへの案内（`gloss_pointer`）。

### 自動取得の見出しの原文併記と、質問集のコピー（2026-11-21）

日次アイデア 9/26・11/10。**原文併記**は `data-hl`（見出しの原文）にも効く（`window.KomakiOrigHl`。`KomakiHeadline.apply` のあとにも呼ぶ）。**ASK COPY**（`js/main.js`）は `review.html#rev-open` の問いに印を付けて、宛先の部署ごとに日本語の問い（外国語表示では訳も）をコピーする。先頭の断り書き `ask_copy_note`（運営者が送ったものではない）は外さない。**送信機能は作らない**、選択は保存しない、問いの中身は集計に送らない（`ask/copy` のみ）。問いを足すと印は自動で付く。

### このページの最近の更新と、Q&A の共有 URL（2026-11-22）

日次アイデア 11/11・11/21。**PAGE RECENT**（`js/main.js`）は `data/site-updates.json` の `link` がそのページを指す行を新しい順に3件、目次の下の `<details>` に出し、最新日を `WebPage` の `dateModified` に入れる（トップ・site・予定・Q&A の1問ページには出さない。キー `page_recent_h`）。**更新履歴の行に `link` を付けないと、ここにも出ない。** SECTION LINKS の Q&A の🔗は、`faq-qN` / `bus-faq-qN` なら `qa/<id>.html`（＋`?lang=`）をコピーする（SNS のカードにその質問が出るため）。節の `#` は今までどおり。

### 本文へ移動・上へ戻る（全ページ、2026-11-05）

ユーザーが過去の提案から選んだ（2026-09-02）。`js/main.js` の SKIP LINK / TO TOP。**本文へ移動**は `<body>` の先頭に JS で差し込むリンク（`.skip-link`、Tab の最初、フォーカスで見える）で、`<main>` に id（無ければ `main-content`）と `tabindex=-1` を付けて飛ばす。**上へ戻る**（`.to-top`）は 1.5画面ぶん下で右下に出る。画面下の共有バーの実際の高さを測って（`--share-sticky-h`）その上に浮かせる。`prefers-reduced-motion` では瞬時に移動、印刷では隠す。文言は `skip_to_main` / `to_top`（`RUNTIME_KEYS`）、集計は `nav/top`・`nav/skip`。

### 横長の表の合図・言語切り替えで位置を保つ（全ページ、2026-11-07）

日次アイデア 10/04・9/30。**TABLE SCROLL HINT**（`js/main.js`）は `main .table-wrap` の上に「← 横にスクロールできます →」（`table_scroll_hint`、`RUNTIME_KEYS`）を差し込み、表がはみ出しているときだけ出して、その表を一度横に動かしたら消す（`aria-hidden`・`ORIG_SKIP`・印刷で非表示）。**言語の切り替え**（`js/i18n.js` の `saveReadingPos` / `restoreReadingPos`）は、読み直す前に画面上端にいちばん近い `main` 内の id つき要素とずれを `sessionStorage` の `komaki_lang_pos` に残し、読み直したページで同じ要素へ戻す（30秒以内・同じパスだけ、id が無ければ縦位置の割合。600ms・1500ms 後にも合わせ直し、読者がスクロールしたらやめる）。節・Q&A・予定の id を変えると戻り先がずれるので、id は今までどおり変えないこと。

### 文字の大きさ（全ページ、2026-10-13）

「このページの目次」（PAGE TOC）の横、`<details>` の外に「文字の大きさ [A][A][A]」（小・中・大）を置く（置き場所はユーザー指定。ヘッダには置かない）。状態は `localStorage` の `komaki_fs`（`s` / `l`、無し＝中）で、`i18n.js` の冒頭が同期的に `<html>` へ `fs-s` / `fs-l` を付け、CSS が `:root` の font-size を 14px / 18px にする。本文の字はほぼすべて rem なので一律に効く。

- **ヘッダは大きくしない。** ヘッダの寸法は rem ではなく `:root` の `--hr: 16px`（`calc(X * var(--hr))`）で書いてあり、`header { font-size: var(--hr) }`。既定の 16px では 1rem と同じなので見た目は変わらない（2026-10-13 に変更前とスクリーンショットで一致を確認）。**ヘッダに規則を足すときも rem ではなく `--hr` を使うこと** — rem で書くと「大」でヘッダが膨らみ、ナビが重なる。
- 印刷（Ctrl+P）は選んだ大きさのまま。
- ボタンの「A」は px 固定（押しても跳ねない）。文言は `fs_label` / `aria_fs_*`（`RUNTIME_KEYS`）。目次を作らないページ（見出しが2つ未満：予定ページ・404）にはボタンが無いが、設定は効く。

### `.ics` の共通部品（`window.KomakiIcs`）と「📅 カレンダーに追加」

2026-10-13 に GRADE VIEW から切り出した。**2026-10-23 のユーザー指示で、カレンダーとスケジュールのすべての予定（終わっていないもの）に「📅 カレンダーに追加」を付けた。** 付いている場所：schedule.html の主要イベント一覧（手書きの予定と自動で足す催し）、カレンダーの日カード（予定ごと。2件以上ある日は「この日の予定をカレンダーに追加」も）、トップの「今後のスケジュール」の帯（アイコンだけ）、予定ごとの固有ページ（events/*.html）、community.html の地域協議会イベントの各行（以前からのもの）、**「地域の取組」欄**（2026-10-24 ユーザー指示。community.html と index.html）。

- **ボタンは `[data-ev="<日付>|<その日の何件目>"]` の要素に `KomakiIcs.attach(箱)` が付ける。** 手書きの予定と予定ページの `data-ev` は `build_event_pages.py` が書く（events.json の ja の予定名が本文に最も長く一致するものを選ぶ。期間が重なるだけでは決まらないため）。自動で描く一覧（TOKADAI SCHEDULE・UPCOMING BAR・日カード）は描いたあとに自分で `attach` を呼ぶ。**新しく予定を並べる場所を作ったら、`data-ev` を付けて `attach` を呼ぶこと。**
- **「地域の取組」の上半分（住民有志・協議会・桃花台を考える会の催し）は、スケジュールの同じ予定に結びつけて UID をそろえる。** 取組はすべてスケジュールにも載せる決まりなので、COMMUNITY ACTIONS が `KomakiIcs.findEv()` で `date_start`〜`date` の予定から名前（括弧書きと「」を除く）の一致するものを探して `data-ev` を付ける。見つからない取組（常設の児童館など）には付けない。**下半分の東部まちづくりの「これからの催し」はスケジュールに載らないので、TOBU ACTIONS が `KomakiIcs.addButton()` で単独の予定として書き出す**（UID は `tobu-<題名のハッシュ>-<日付>`）。
- **.ics の組み立ては `KomakiIcs.entry()` の1か所**（一括書き出しも同じ）。`"day": true` はその日の終日（`"until"` があればその日まで）。`"span": true`（都市計画の閲覧・意見募集）は決まった期間。**それ以外の月単位の予定は、公表された時期（`start`〜キー、`start` が無ければキーの月）を終日の期間として入れ、名前に「（日程未定・2026年11月〜12月）」、説明に `ics_tbd_desc` を添える**（2026-10-23 ユーザー決定。日付を作らないため）。
- **UID は `KomakiIcs.schedule()` の「日付[-n]-komaki-saihen@…」で、一括・日カード・各ボタンで同じ。** 地域協議会の催しは `KomakiIcs.councilUid()`（記事 URL のハッシュ）で、community.html の行とスケジュールに自動で足した同じ催しが同じ UID になる。どちらから何度取り込んでも二重にならない。この形を変えないこと。
- 協議会・桃花台を考える会の催しは `KomakiJaWhen.times()` で時刻を読み、日本時間を UTC（`…Z`）に直して書く（`KomakiTokadaiEvents` が `ev.ics` に持たせる）。**終わりの時刻が公表されていなければ `DTEND` を書かない**（推測で作らない）。読めなければ終日。
- 文言は辞書の `ics_add` / `ics_tbd` / `ics_tbd_desc` と `grade_ics_calname` / `grade_ics_desc` / `grade_ics_fail`（すべて `RUNTIME_KEYS`）を、`KomakiIcs` が作る隠し要素 `#ics-strings` で受け取る。ボタンは印刷では消える。

### 学年ビュー（`schedule.html`）

2026-08-30 追加。「共有」を広げるための機能で、扱いに注意が要る。（同時に作った回覧板シートは 2026-11-04 にユーザー指示で廃止した。）

**学年ビュー（`GRADE VIEW` in `js/main.js`）** — `?grade=` で学年を1つ選ぶと、`.event-item` の各予定に「そのときお子さんは何年生か」を添える。`window.KomakiGrade()`（`main.js` 冒頭）が `?grade=` → `localStorage`（`komaki_grade`）の順で解決する。

- **これは公表日付に対する学年の足し算にすぎない。** 市の計画に学年別の扱いがあるという意味ではなく、どの学校に通うかは住所で決まる。その旨は `grade_lead` に書いてある — **消さないこと**。ここを外すと、ただの計算が「市の学年別方針」に読めてしまう。
- 学年コードは**令和8年度（2026年度）の学年**。`y3/y4/y5`＝年少・年中・年長、`e1`〜`e6`＝小1〜小6、`j1`〜`j3`＝中1〜中3。基準は `BASE_FY = 2026`。**年度が変わったら `BASE_FY` を上げる**（上げないと1年ずれた学年が出る）。年度は4月始まりで、1〜3月の日付は前年度として数える。
- 予定の選り分けはしない。「この予定はこの学年に関係する」という判断は公表資料に無く、当サイトが作ると事実になってしまうため、**全部の予定に学年を添えるだけ**にしてある。
- `.ics` は静的ファイルではなく、押されたときに `data/events.json` から組み立てる。`events.json` は自動更新パイプラインの編集対象なので、静的な `.ics` を置くと更新のたびに古くなる。折り返しは RFC 5545 の**75オクテット**規定で、日本語は1文字3バイトなので文字数で数えないこと。
- 共有 URL にも `grade` が乗る（`shareUrl()`）。同学年の保護者にそのまま渡せる。

### カットイン（全ページ、ヘッダの下）

`TOP CUT-IN` in `js/main.js`（2026-09-03 に `NEW FEATURE CUT-IN` から改称・拡張）。**2026-09-20 のユーザー指示で、トップページだけでなく全ページに出す**ようにした（読者が最初に開くページはトップとはかぎらないため）。`#feature-cutin` と `#feature-strings` の2つの `div` は11ページすべての `</header>` 直後にあり、同じブロックがそれを見つけて描く。ヘッダの下にスライドインする帯で、**今日を含む直近5日間**（`WINDOW_DAYS`、2026-11-06 ユーザー指示）の新しい情報を、ページを開くたびに出す。出すのは3種類：

| 札 | 元データ | 飛び先 |
|---|---|---|
| 新機能 | `data/site-updates.json` の `type: "feature"` | `#site-updates` |
| 更新 | 同 `type: "content"` | `#site-updates` |
| 市からのお知らせ | `data/news.json`（日本語以外では見出しを訳して出す） | `#news` |

飛び先の2つのアンカーは `index.html` にしかないので、**トップ以外のページでは `index.html` を前に付ける**（`ON_TOP` / `at()`）。トップでは付けない — 同じページ内の移動をページ再読込にしないため。

`type: "fix"` は出さない（誤字直しや体裁の修正は帯で知らせる話ではない）。**都市計画関連の行も出さない**（2026-10-18 ユーザー指示）：更新履歴の `ja` に「都市計画」を含む行は帯から外す。例外は、都市計画の日程がスケジュールに載ったときに `build_toshikeikaku.py` が足す行（`auto_key` が `toshikeikaku:` 始まり）だけ。市のお知らせでも**飛び先は本文の該当コーナー**にする — 帯から直接市の個別ページへ出すと、読者が説明を読まないまま外へ抜けてしまう。

- **並びは「新しいかつ重要度が高い順」**（2026-09-22 ユーザー指示）。`rank()` が **重要度 + `RECENCY_WEIGHT`（8）× 新しさ** で点を付け、高いものを、下の割合の枠ごとに出す（同点なら新しいほう）。新しさは今日 = 1・5日前 = 0 の線形、重要度は ①種類（お知らせ 6 > 新機能 3 > 更新 2）②緊急語（`URGENT_RE`、+4）③`data/site-updates.json` の任意の `priority`（`high` +6 / `low` −4）で、ふだんの幅は 2〜10。**`RECENCY_WEIGHT` はその幅とほぼ同じ値にしてある** — 片方だけを支配的にしないためで、重要度側の点を動かしたら重みも見直すこと。
- **緊急語（`URGENT_RE`）は市のお知らせにだけ効かせる。** 更新履歴の文面は「説明会の質疑からQ&Aを追加」のように市の催しに言及するだけのことが多く、読者に締切があるわけではない（そのまま当てると全部が緊急になり順位が意味を失う）。更新履歴を上げ下げしたいときは `priority` を使う。語を足すときも「読者が何かをする必要がある言葉」に限ること。
- **判定は日本語の原文（`ja`）で行う。** 訳文で判定すると、表示言語によって帯の順番が入れ替わってしまう。
- **3件の内訳は「市からのお知らせ」1・「更新」1・「新機能」1**（`SLOTS`、2026-10-15 ユーザー指示。2026-10-11 から お知らせ1・更新履歴2 だった）。それぞれの枠の中で `rank()` の点の高いものを取り、ある種類に期間内の項目が無ければ空いた枠を残りの点の高いもので埋める。選んだ3件は点の順に並べる。
- **札とリンクには `data-i18n` を付けない。** 項目ごとに種類が変わるので、辞書に上書きされると札と中身が食い違う。文言は `#feature-strings` の隠し要素から `data-fk` で読む（`label` / `label_update` / `label_news` / `more` / `more_news` / `close` / `news_fmt`）。**市のお知らせは見出しだけを置かず、更新履歴と同じ体言止めの一行にする**（`news_fmt`＝辞書の `feature_new_news_fmt`「市が「{title}」のページを更新」。`{title}` に訳した見出しが入る。2026-10-11 ユーザー指示）。

- **カットイン専用のお知らせデータを作らないこと。** 文面は更新履歴と市のお知らせ、どちらもサイトが既に持っているデータそのもの。別データにすると元の一覧と食い違ったまま気づけなくなる。**更新履歴に1行足す／市がページを更新する**だけでここは自動的に出て、5日で自動的に消える（消し忘れが起きない）。
- **直近5日間の新着は、ページを開くたびに出す**（2026-11-06 ユーザー指示。既読の記録はしない — 以前の `komaki_feature_seen` は読み込み時に消している）。複数あるときは最大3件を7秒ごとに入れ替え、全件を1回ずつ見せたら自動で閉じる（2026-11-04 ユーザー指示。1件だけのときも7秒で閉じる）。マウスやフォーカスが乗ったら止まり、離れたらその項目をもう一度7秒見せてから先へ進む。`prefers-reduced-motion` では動きを出さない。
- 帯は `position: sticky` のヘッダの**下**（`</header>` の直後、通常フロー）に置く（2026-09-20 ユーザー指示。それまではヘッダの上だった）。ヘッダに重ねると本文が読めなくなるので、重ねない。
- **帯の色は上下の背景と同じ黒板グリーンの系統でそろえる**（同日ユーザー指示）。上はヘッダ（`--primary-dark`）、下はヒーロー（`135deg` で `#111f14` → `--primary-dark` → `#2e5c3a`）なので、帯も同じ `135deg` で `--primary-dark` → `#24492e`、つまり両隣の値の内側に収める。同系色が続いて境目が消えないよう、上下に細い線（白 .14 / 黒 .25）を入れてある。
- `.feature-cutin` の `display:flex` は UA の `[hidden]{display:none}` に勝つので、`.feature-cutin[hidden] { display:none; }` が要る。無いと出す前と閉じたあとに padding ぶんの帯が残る。
- リンク先は `index.html#site-updates`。そのアンカーを外すとカットインの「くわしく」がどこにも飛ばなくなる。


### 節ごとの読み上げ（`.tts-row`）

2026-09-15 追加（ユーザー採用）。`js/main.js` の READ ALOUD が、全ページの `main h2.section-title`（と index の「最新の動き」各コーナーの `h3.section-title.sub`、その「地域の取組」の下半分「東部まちづくりの動き」の `h4.section-title.sub` — 見出しが別なので読み上げも別、2026-09-27 ユーザー指示）の下に「🔊 読み上げる」を置き（見出しの無い小さなコーナー — トップの「いまの状況」「今後のスケジュール」— はラベル `.now-label` / `.upcoming-label` を見出しの代わりにして、本文の下／ラベルの横に置く。2026-10-05 ユーザー指示）、その節の本文をブラウザ内蔵の `speechSynthesis` で**表示中の言語のまま**読む。ボタンの文言は `tts_play` / `tts_stop`（`RUNTIME_KEYS` 入り）。

- **声が端末に無い言語ではボタンを出さない。** 注記で断るより、押して無音のほうがまずい。ビルマ語はほぼ出ない。声は端末内（`localService`）を優先する。
- **1文ずつ区切って渡す**（日本語・中国語は70字、他は180字で読点・空白で切る）。Chrome は長い発話を黙って止めることがある。
- 読まないもの：「くわしく見る →」「詳細 →」のような案内リンク（`.now-more` / `.upcoming-more`）、表示されていない要素（閉じた Q&A の答えは読む）、見出しの `<small>` 副題（英語表示では日本語なので英語の声で日本語を読むことになる）、地図と層の切り替え、ボタン、目次、絵文字。表は行ごと、セルの間に読点。札（`tag`/`badge`/`label`/`date` を含むクラス）のあとにも読点。
- **日本語の地名の読み替え（`YOMI`）は、公表資料で読みが確かめられたものだけ**（しのおか・おおくさ）。読みは事実なので推測で足さない。
- **区切りや改行のある所は続けて読まない**（2026-11-11 ユーザー指示）。ひとまとまりは「inline でないいちばん近い祖先」（`unitOf()`。横に並んだ札・日付・名前＝flex の子や、段落・項目が別々のまとまりになる。表だけは行ごとでセルの間は読点）で、`<br>`・`<hr>` をまたいでも新しいまとまりにする。まとまりが変わるときは間（`GAP` 380ms を速さで割る）を置き、同じまとまりの中の文は続けて読む。**横に並べる部品を `display:inline` のままにすると前後とつながって読まれる** — 新しい部品は flex / block で組むこと。
- **声に渡す文字の直し**（`speakable()`、2026-11-11。全ページ×6表示の「声に渡す文」を書き出して不自然な所を直した。画面の文字とハイライトの範囲は変えない）：文頭・文末の矢印、※・■・★・#、Instagram の @アカウント名は渡さない。電話番号は1桁ずつ。**日本語**は、曜日の括弧（（月）→ げつよう）、「〜」→「から」（括弧の頭の「〜11/15」は「まで」）、「11/15」→「11月15日」、番地の「2-4」→「2の4」、H21・R8 → 平成21年・令和8年、km²・㎡・ha、文中の「→」は数字のそばなら「から」・ほかは読点、「／」「｜」「＝」「←」と名前を並べる「・」は読点（カタカナ語の中の中点はそのまま）。**日本語・中国語以外**は、日本語のまま出している部署名・資料名（かな・漢字）を声に渡さない（中国語は、かなを含む部分だけ）。
- **文の切り方**：ピリオドのあとが小文字・数字のとき、略語（No.・Elem.・Art.・p. ej. など `ABBR`）や番号（「1. 」）のあとでは切らない。長い文（日本語・中国語70字、韓国語80、ネパール語120、ほか180）は読点・空白で切り、無ければかぎ括弧の終わりか助詞のあと（次がかな以外）で切る。1.25倍までのはみ出しは切らない（短い切れ端を残さない）。
- **速さと「通して読む」**（目次の横、「文字の大きさ」の隣の `.tts-ctrl`。2026-11-11）。速さは ゆっくり 0.8／ふつう 1／はやい 1.25、`localStorage` の `komaki_tts_rate`（`slow`／`fast`、無し＝ふつう）で、読んでいる途中に変えると次の文から効く。「通して読む」は見出しを上から順に `play()` に渡すだけ（見出しの文字は `blocksOf()` が先頭に拾う）。声の無い言語では節ごとのボタンと一緒に隠れる。目次の無いページ（予定ページ・404）には出ない。キー `tts_all` / `tts_rate_label` / `tts_rate_slow` / `tts_rate_normal` / `tts_rate_fast`（`RUNTIME_KEYS`）。寸法は px 固定（文字の大きさの切り替えで跳ねない）。集計は `tts/all`・`tts/rate-slow|fast`。
- **読みの置き換え（`YOMI`）の出どころ**：篠岡・大草＝市の公表資料、光ヶ丘・桃ヶ丘・陶（陶小・陶小学校のときだけ）・大城・桃陵＝各校が自分のホームページで使っているローマ字（`fetch_schools.py` の slug）、桃花台東・西＝新校名の表記（`term_rules.json`）。**確かめられない名前（巾下・三ツ渕など）は足さない。**
- **読み上げを直したら、声に渡す文を書き出して前後を比べる**：`speechSynthesis` を差し替えて `speak()` に渡った文字を記録する（声の一覧も偽物を返す）。記号・数字・切れ目の不自然さはコードを読むより書き出したほうが早く見つかる。
- こどもむけの切り替えで本文が作り直されると止まる。そのために `i18n.js` は `applyDict` の最後で `komaki:i18n-applied` を `document` に投げる（**本文の DOM を掴んでおく処理を足すときはこれを使う**）。

### 「前回から」の印（index.html「最新の動き」）

2026-09-15 追加（ユーザー採用）。`js/main.js` の SINCE LAST VISIT が、前回このページを見たときに無かった項目に「前回から」の印を付け、`#latest` のリード文の下に「前回ご覧になったあとに増えた項目が N 件」と出す。読者は何も操作しない。

- **比べるのは日付ではなく項目の目印の集合**（リンク先 URL、見出しの原文 `data-hl`、更新履歴は描画時に付ける `data-key`）。表示言語に左右されない。**コーナーの描画クラス名や `data-hl` / `data-key` を変えたら、ブロック冒頭の `CORNERS` も直すこと。**
- 記録は `localStorage` の `komaki_seen_items`（目印→最後に見た日、120日で捨てる）。「前回」の写しは `sessionStorage` の `komaki_seen_prev` に1時間持つ — 開いた瞬間に「見た」と上書きするので、写しが無いと再読み込みで印が消える。
- **初めて来た人には印を付けない**（全部に付くと意味が無い）。
- **印の文字は CSS の `[data-unseen]::after { content: attr(data-unseen) }`。** 読み上げ・原文併記は `textContent` を拾うので、文字で入れると混ざる。**リンク（`<a>`）には付けない** — 外部リンクの「↗」が同じ `::after` を使っていて、印が消える。
- 学校HPの「新着」（7日以内・黄色）とは別物。混同しないよう、言葉も色（青系）も分けてある。


### The 「最新の動き」 group on `index.html`

The bottom of `index.html` is split in two. Everything down to **現在の状況** is the site's own hand-written explanation; everything below the `.group-head` band (`<section id="latest">`, key `section_latest`) is "what just happened" — 市公式サイト お知らせ (`id="news"`), 対象校ホームページの更新, 地域の取組 (the 報道でみる東部地域 corner was removed on 2026-10-10; サイトの更新履歴 was taken out of the group on 2026-10-24 at the user's instruction and is now its own `<h2>` section, `#site-updates`, directly after the group). The band's `<h2>` groups them, so those three corner headings are `<h3 class="section-title sub">`, not `<h2>` — do not promote them back. The reader benefit is that "what this site says" and "what just happened" are no longer interleaved. **Below the changelog** sits only a one-line pointer (`#site-card`, `site_card_p` / `site_card_link`) to **`site.html`（このサイトについて）**, which holds the sections about using this site — このサイトを紹介する (`#site-intro`), アプリとして使う (`#app`), フィード（RSS）で受け取る (`#feed`), 使い方を広める・応援する (`#spread`), ご意見の送り先 (`#feedback`), 閲覧数の集計について (`#privacy`). They moved from `about.html` to the top on 2026-10-24, then to `site.html` on 2026-10-30 (user's instruction: keep the top page on what parents need). Old links such as `index.html#app?lang=pt` are forwarded by MOVED ANCHORS (top of `js/main.js`). `site.html` carries no contact tables (exempt from check 15) and is linked from every page's footer (`footer_site`). `about.html` ends with its contact section. `fb_li3` points readers to the 計画概要 page's contact section for questions about the plan.

**地域の取組 is the corner with two halves.** Its top half is hand-maintained (`data/community_actions.json`, the COMMUNITY ACTIONS block, drawn wherever `#community-actions-container` exists — the same list as on `community.html`); its bottom half, 東部まちづくりの動き, refreshes automatically like the other corners (`data/tobu_actions.json`, the TOBU ACTIONS block, `#tobu-actions-container` — see that file's section above). `latest_lead` says exactly this; keep that caveat accurate if the mix of automatic and manual corners changes again. Because the Instagram source link is rendered here at runtime, `index.html` is in `INSTAGRAM_PAGES` in `auto_gates.py` alongside `community.html` — a third page rendering this corner has to be added there too.


- `.group-head` and `.group-head + .section` in `css/style.css` trim the padding so the band and the first corner read as one block. If a corner is inserted between them, that pairing breaks.

## ヘッダのタイトルロゴ（詳細）

- **Keep the look identical to the OGP image** (user's instruction): accent-yellow frame, `--primary-dark` band, `--primary` board, M PLUS Rounded 1c. **Since 2026-10-16 (user's instruction) 「小牧市東部（篠岡地区）」 and 「学校再編ナビ」 sit side by side** on the top row, then the rule, then the subtitle — `.logo-bd` is a CSS grid `1fr | logo_area | logo_main | 1fr` (the HTML is unchanged; `.logo-dots` is `display: contents`, and `.logo-sb` is `width:0; min-width:100%` so the subtitle never widens the top-row columns); when space runs short the area column shrinks and wraps inside (mobile: 「小牧市東部／（篠岡地区）」), and for non-CJK languages it is capped at `fit-content(11em)` so the main title keeps priority. **The chalk dots sit only in the top-left and bottom-right corners, inside the board's left/right padding** (2026-10-17, user's point that text and dots overlapped at the corners, and the user's suggestion to move the right dots to the bottom-right): every dot is within .62em of the edge (.53em on mobile), so the horizontal padding of `.logo-bd` must never drop below that — measured: no dot touches any text in 12 languages + ja-kids at 360–1280px, heights unchanged. **The yellow rule under the top row spans exactly the area + main-title columns** (`.logo-ru { grid-column: 2 / 4; width: 94% }`, centred, 2026-10-17 — the user asked to stretch it to nearly the title's width, then for it to be "a few percent shorter than the full text width") — a share of the top row, not of the board. Its colour is the accent yellow at `opacity: .72`, a little paler than 「ナビ」 (same day, user's suggestion). Everything inside `.logo` is in `em`, so `.logo`'s `font-size` (= the first line's size) scales the whole logo; that size is set in `--hr`, never `rem`, so the font-size switch never grows the header. The width is fixed per layout (23em at 769–1099px, 29.5em ≈ 300px at ≥1100px — widening it squeezes the nav into wrapping, measured in pt / es / ja-kids) in every language — long languages wrap inside (`text-wrap: balance`) and grow taller; non-CJK languages get a smaller main title (`html:not(:lang(ja/zh/ko))`).
- Layout by width (set by measurement): **the logo's height matches what sits beside it** (2026-10-16, user's instruction): ≥1100px one-line subtitle, ja ~58px against the nav's two rows ~61px; 769–1099px two-line subtitle, ~67px (here the right-hand column, ~97px, sets the header height), with the menu's two rows and the language switcher stacked to the **right** of the logo (thinner than the old two-row header: 122→113px); mobile: `.site-title` is a size container (`container-type: inline-size`, `flex: 1`) and `.logo { width: 100%; font-size: min(8.8px, 100cqi / 19.5) }`, so the logo always fills the width left over by the language switcher and the hamburger (no gap to its right — user's point); once the text reaches 8.8px it stops growing and only the logo widens. Its height is about the language switcher's (ja at 390px: logo 48px, switcher 46px, header 67px — it was 89 / 107px before 2026-10-16, user: "two sizes smaller, the same height as the switcher and the hamburger"); the hamburger lines are 26px with 6px gaps. When the container is ≥300px (tablets) the subtitle goes on one line (`@container`, `wbr` hidden). Re-measure every width, all 12 languages and ja-kids after any header change ([[header nav no overlap]]).
