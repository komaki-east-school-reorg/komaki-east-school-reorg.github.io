# 自動取得・自動更新の仕組み

> `CLAUDE.md` から移した詳細（2026-11-28）。この作業をするときに読む。要点と禁止事項は `CLAUDE.md` にある。

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
| `setsumeikai/` | 保護者等説明会6会場の質疑応答、意見提出シートの質問と回答・意見と提案 | `faq.html` のQ&Aと賛否の声、`bus.html` のQ&A |
| `pubcom/` | パブリックコメント55件の意見と市の考え方、実施結果概要、計画修正案 | `faq.html#pubcom` の「実際に言われたこと」 |
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

When a content change is detected, a second job drafts site updates fully automatically: a drafter Claude (via `anthropics/claude-code-action`, subscription OAuth — secret `CLAUDE_CODE_OAUTH_TOKEN`; if the secret is missing the job skips silently and only the detection issue remains) reads the diff (including any newly extracted newsletter text — see above) and may edit **only** `data/events.json`, `data/i18n/*.json`, `index.html`, `schedule.html`, `community.html` and `data/site-updates.json`, and must write `auto_update/evidence.json` quoting the exact official-source text for every change. `.github/scripts/auto_gates.py` then machine-verifies scope, schemas (10-language event labels), the external-link rule, and that every quote actually exists in `data/official_pages/` (hallucination check; exit 0 = pass, 3 = no changes, 1 = fail). An independent verifier Claude reviews the diff and writes `auto_update/verdict.json`; only on `approve` is the PR auto-merged (squash) and the detection issue closed with a report from `.github/scripts/auto_report.py`. Kill switch: set repo variable `AUTO_MERGE` to `false` to stop before merge (PR is still created). Any gate/verdict failure leaves `main` untouched.

**The drafter also weighs whether the change deserves a changelog line** (2026-11-04, user's instruction): when a reader would notice it (an event added, a date changed, a new fact published) it prepends one line — at most two — to `data/site-updates.json` (`date` = today, `type`, `ja` in the usual noun-ending style ≤45 chars, `en`), and lists that file in `evidence.json` too. Wording-only changes to いまの状況, typo fixes and the council events that `build_community_events.py` already logs get no line. `auto_gates.py` **check 22** fails the run if any existing line was changed, removed or reordered, if more than two were added, or if a new line breaks the format (other keys, a date more than 3 days from today, tags/URLs, over 45 chars, 「。」/「しました」, 「廃止」, `term_rules.json` spellings in `en`). The workflow then rebuilds `feed.xml` and commits both; the verifier checks that the line matches the change.

**The AI steps are treated as untrusted** (2026-10-26). The drafter reads text nobody here controls — public-comment opinions and briefing Q&A inside the city's PDFs, school blog titles — so a sentence planted there could steer it. Therefore, in all three AI workflows (`fetch-news.yml`, `translate-headlines.yml`, `feature-ideas.yml`): `.git/config` is copied aside before the AI runs and put back after it, `core.hooksPath` is set to `/dev/null`, `.github/` is checked out again from `main` **before any repository script runs**, and the job stops if the working tree has changes outside what that AI may write (drafter: the `ALLOWED` files + `auto_update/` + `report/`; translator: nothing outside `auto_i18n/`; ideas: nothing outside `auto_ideas/ideas.md` and `auto_ideas/recent_commits.txt`). In `fetch-news.yml` the auto-update job's checkout has `persist-credentials: false` and `GH_TOKEN` is given only to the steps that call `gh` / push; `auto_update/verdict.json` is deleted right before the verifier runs, and the same restore-and-check runs again after the verifier. The ideas AI no longer has `Bash(git log:*)` (`--output=` can write files); it reads `auto_ideas/recent_commits.txt` instead. **Do not remove these steps**, and keep the scope regex in the drafter's check in step with `ALLOWED`. `AUTO_MERGE` is unset in the repository as of 2026-10-26, which means "merge".

## 新機能アイデアの日次メール（`.github/workflows/feature-ideas.yml`）

毎日 06:35 JST に、このサイトに足すとよさそうな機能を Claude（`anthropics/claude-code-action`、`CLAUDE_CODE_OAUTH_TOKEN`）に考えさせ、**メールで届ける**だけの仕事。サイトのファイルは一切変更しない。

- **出すのは2種類**（2026-09-22 ユーザー指示で `[内容]` を追加）。`[機能]` は画面の仕組み・操作・見せ方、`[内容]` は載せる中身そのもの。見出しにこの印を付けさせるので、`auto_ideas/history.json` にも印が残り、後から種類が分かる。**`[内容]` の提案には「どの資料のどこを根拠にするか」を必ず書かせる** — 書けない案は出させない。**件数の割合は `[機能]`2 : `[内容]`1 を目安**（1日最大3件なので、ふだんは機能2件＋内容1件。2026-09-24 ユーザー指示）。片方に出すに値する案が無い日は、割合を埋めるために絞り出させず件数を減らす。使ってよい出どころは `data/official_pages/` の取り込み済み資料・市の公表ページ・文科省（`nationwide.html` 限定）・対象8校のHP・行政以外の主体についてはその主体自身の公表で、サイト本体の規則と同じ。
- **求める案は5つ**（2026-11-12 ユーザー指示）：最新のトレンドを反映したもの／最新鋭のもの／子どもが喜ぶもの／人気が出やすいもの／街が活性化する内容。どれか1つ以上に当てはまる案だけを出させ、各案の「ねらい」の行にどれかを書かせる。禁止事項と下の「出さない種類」はこの5つより優先。検査・点検だけの案は週に1件まで。
- **不採用の案は履歴から消さず、`rejected`（日付）と `reason` を付ける**（2026-11-12 に39件。消すとまた提案される）。似た案も止めるため、起案プロンプトに「出さない種類の案」を4つ書いてある：すでにある機能と役目が重なる／読者が気づかない小さな飾り・操作／決めてある方針とぶつかる／手間や副作用が効果に見合わない。**不採用にする案が増えたら、印を付けるだけでなく、この4つに当てはまらない種類ならプロンプトにも足す。** `ideas_digest.py` が毎回書き直す `description` にも同じ説明がある。
- **AI が書いてよいのは `auto_ideas/ideas.md` の1枚だけ。** サイトの実装はさせない（提案と実装を同じ走行で混ぜると、検証されていない変更が毎日入ってくる）。
- **本文はリポジトリに残さない。** 残るのは `auto_ideas/history.json`（過去に出した見出し）だけで、`ideas.md` は `.gitignore` 済み。起案AIはこの履歴を読んで**同じ案を二度出さない**。本文はメールと Actions のアーティファクト（30日）にある。
- **通知は SMTP → だめなら Issue。** `.github/scripts/send_mail.py` は設定が無ければ exit 2 を返し、ワークフローは `gh issue create` に切り替える（Issue を立てれば GitHub の通知メールが届く）。必要な Secrets は `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`（任意で `MAIL_TO`＝未指定なら `SMTP_USER` 宛て、`SMTP_PORT`＝既定 587・465 なら SMTP_SSL、`MAIL_FROM`）。**未設定でも壊れない**のが設計で、設定を促す警告だけが出る。**宛先は1件だけ**で、カンマ区切りで複数渡すと送らずに失敗する（自分宛ての通知がいつのまにか同報配信になる事故を機械で止めるため）。**このリポジトリは公開なので、宛先のアドレスはワークフローにもスクリプトにも書かない** — Secrets に置くか、`SMTP_USER` と同じにする。
- 見出しの抽出・履歴の更新・件名の組み立ては `.github/scripts/ideas_digest.py` が決定的に行う。**AI に JSON を直接書かせない** — 壊れていても気づけないため。件名はシェルの `"..."` を通るので、`"` `` ` `` `$` `\` は見出しから落としてある。
- **SEO・SNS 対策の観点も出させる**（2026-10-11 ユーザー指示）。「桃花台」「Tokadai」の名前で外から検索・共有・引用されたときに見つかり広がるための案（構造化データ、hreflang、SNS カード、直リンク、フィード、QR など）。禁止事項（外部ドメイン・トラッキング・第三者スクリプトを増やさない、宣伝文にしない）はそのまま。
- 起案プロンプトには、この CLAUDE.md の禁止事項（外部ドメインを増やさない／自動読み込みの第三者スクリプトを増やさない／`bus.html` の地図は凍結／自動生成ファイルを手編集する案を出さない）を明記してある。**規則を増やしたらこのプロンプトにも書き足すこと。**
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
- **東部地域の催しは「地域の取組」・スケジュール・更新履歴へ自動で載る**（2026-10-05 ユーザー指示）。`shinooka: true` は「題名に篠岡地区5協議会の名前がある」**または**「会場（`place`）に東部の地名がある」（`EAST_PLACE_KEYWORDS`＝当サイトが東部の地名として使っているもの＋東部市民センター）。各イベントの `date`（ISO）は `when` の月日に `updated_at` の年を補ったもの（更新日より2か月以上前なら翌年）。`shinooka` かつ `date` のある催しは、`window.KomakiTokadaiEvents()`（桃花台を考える会の催しと同じ仕組み。ラベルは見出しの訳＋「（地域協議会）」）を通って、カレンダー・`.ics`・あと◯日・schedule.html の一覧（`.event-item[data-auto="council"]`）・トップの帯と `status_digest` の件数・「地域の取組」（札は `council`、発信元はサイト内の `community.html#council-events` — sasaeai の索引は community.html 限定なので index にも出るこの欄から外へは張らない）に出る。`events.json` / `community_actions.json` に同じ催しを手で書けばそちらが優先され、二重にはならない。更新履歴へはこのスクリプトが1行足す（`auto_key` = 記事 URL。終わった催しはさかのぼって足さない）。東部の催しは会場名も `headline_i18n.json` で訳す。


## `data/tobu_actions.json`（東部まちづくりの取組）

2026-09-13 追加（ユーザー指示）。**「地域の取組」欄の下半分**に、市の東部まちづくり推進室が公表している東部地域の取組を並べる。`community.html` と `index.html` の両方に出る（`#tobu-actions-container` を見つけた所に `js/main.js` の TOBU ACTIONS ブロックが描く）。住民有志の取組（`data/community_actions.json`）とは**見出しを分けてある** — 上は住民自身が始めたもの、下は市の部署が公表したもので、混ぜると「誰が出している情報か」が消えるため。ただし**行の形（カード）は 2026-09-20 のユーザー指示で住民有志の取組（`.action-item`）とそろえた**（上下の欄が続いて見えるようにするため）。出どころの違いは **①「市公式」の札 ②カード左帯の色（市公式は `--primary` の緑、住民有志は `--accent` の黄） ③最後の出典行** の3つで示す — この3つは外さないこと。

- **自動生成・手編集不可。** `fetch_news.py` が監視している `data/official_pages/toubumachidukuri-tobumachidukurisingikai-*.txt` から `.github/scripts/build_tobu_actions.py` が組み立てる（市サーバへのアクセスはゼロ。`fetch_news.py` の**あと**に実行すること）。自動更新パイプラインの `ALLOWED` にも入れない。
- **載せるのは直近2か月ぶんだけ**（`WINDOW_DAYS = 60`、2026-09-13 ユーザー指示）。古い記録が積もると「いま何が起きているか」が読めなくなるため。**ただし、これから開催される催しは日付が未来なので必ず残る** — 参加できる催しを期限切れで落としては、この欄を置く意味がない。画面は「これからの催し」（最大3件）→「最近の動き」（**最大3件**、2026-10-05 ユーザー指示。表記は「さいきん」ではなく「最近」）の順。
- **拾い方は3通り。** ①「開催場所・会場」「開催日・期間」を持つページ＝催し（協働提案事業・団体等のイベント情報）。②年度別『東部まちづくりニュース』と『東部まちづくり審議会』の本文に〈見出し（令和8年8月24日）〉の形で並ぶ行＝記録。③それ以外のページ（トライアル活動の紹介など）はそのページの更新日を日付として扱う。**図やPDFの中は読めないので、載っていない＝存在しない ではない。**
- **出典の索引は1本。** コーナーの出典は `.../toubumachidukuri/tobumachidukurisingikai/index.html`（URL は `js/main.js` の TOBU ACTIONS ブロック）。**2026-11-27 から各項目の見出しは元の個別ページへ直リンクする**（ユーザー指示。`url` は `build_tobu_actions.py` がスナップショットの1行目から書き、範囲は `official_links.py`、check 6b が JSON も見る）。見出し・会場名は日本語以外の表示で `data/headline_i18n.json` の訳に置き換え、「どのページ群から拾ったか」の分類名（協働提案事業など）は TOBU ACTIONS ブロックの `_from` で訳す。市がページ群を増やしたら `_from` に足すこと（足すまでは原文で出る）。
- 監視対象は `TOBU_BASE` 配下。ディレクトリが入れ子なので `fetch_news.py` の watch は `<li class="dir">` も辿るが、**過去年度の記録まで含めると110ページ規模**あるため、ふだんは直下まで（`WATCH_DIR_MAX_DEPTH = 1`）。**日曜だけ `WATCH_DEEP=1` で全階層**を回る（`fetch-news.yml` の "Decide crawl depth" ステップ）。浅い巡回の日は下位ページのスナップショットを `keep_slugs` で守る — 守らないと毎日消えて毎週復活し、差分が無意味に膨らむ。
- **深いところにある2つだけは毎日見る**（2026-09-13 ユーザー指示）：協働提案事業（これからの催しが載る）と東部地域トライアル活動（年度ごとの認定活動）。`WATCH_INDEXES` に直接足してあるが、配下に過去分が数十ページ積もっているので、浅い巡回の日は**末尾（＝新しいほう）だけ**を取る（`WATCH_TAIL_INDEXES` / `WATCH_TAIL_PAGES = 8` / `WATCH_TAIL_DIRS = 1`）。市のインデックスは古い順に並んでいるため末尾が最新。これで毎日の取得は東部まちづくり全体で 40ページ弱に収まる。
- **桃花台を考える会の催しは「地域の取組」（住民側）に出す**（2026-09-26 ユーザー指示）。`build_tobu_actions.py` が催し（`kind: "event"`）に `organizer: "桃花台を考える会"` を付け、TOBU ACTIONS はそれを外し、COMMUNITY ACTIONS が `data/tobu_actions.json` からそれを拾って住民有志の札で並べる。判定は「本文に団体名がある」か「協働提案事業のページで題名が同会の続き物（`TOKADAI_SERIES`：桃花台音楽まつり・我が家の相続セミナー・桃花台を考える講演会・住まいの相談会）」— 第11回桃花台音楽まつりのページには団体名が無いため（第3〜10回はすべて同会との協働提案事業）。本文は「同会が市の東部まちづくり推進室との協働提案事業として開く催し」と書き、発信元は東部まちづくりの索引（掲載しているのが市のページのため）。**スケジュールにも自動で載る**（同日ユーザー指示）。`js/main.js` の `KomakiTokadaiEvents()` がこれを events.json と同じ形（12言語ラベル＝見出しの訳＋「（住民有志）」、`day: true`）に直し、`KomakiEvents()` が events.json に足す。カレンダー・`.ics`・「あと◯日」はこれを読み、TOKADAI SCHEDULE ブロックが `schedule.html` のその年の一覧に `.event-item[data-auto="tokadai"]` を `data-start` 順に差し込み、`index.html` の `status_digest` の件数に足す。**events.json に同じ催し（ja ラベルが題名で始まるもの）があれば足さない**ので、手で丁寧に書いた項目（第11回桃花台音楽まつりの `sched_*44`）が優先される。年表に残すため、`TOKADAI_SINCE`（2026-09-26）以降の同会の催しは `build_tobu_actions.py` で60日の窓・件数上限にかけない。記録（ニュースの〈桃花台を考える会〉行）は市の記録として東部まちづくりの欄に残る。
- `site-facts.json` ではこの接頭辞の `targets` を空にしてある。**一覧は自動で入れ替わるので、検知 Issue を見た人やAIが手でページを直す必要はない。**
## `data/toshikeikaku_east.json`（都市計画の動き・東部地域）

2026-10-17 追加（ユーザー指示）。**`community.html` の `#toshikeikaku`**（「地域の取組」の次。2026-10-31 に review.html から analysis.html へ、**2026-11-07 にユーザー指示で community.html へ**移した。キー名 `rev_s11_h` / `rev_tk_*` は据え置き。古いアンカー `analysis.html#rev-toshikeikaku` / `review.html#rev-toshikeikaku` は MOVED ANCHORS の `RENAMED` が送る。analysis の `#rev-power` の末尾に案内 `rev_tk_moved` がある）に、市の都市計画課の配下（`.../toshiseisakubu/toshikeikaku/1/`：都市計画審議会・景観審議会の会議録、地区計画、公聴会、電子告示、マスタープラン・立地適正化計画、パブコメ）のうち、**題名か本文に東部の地名があるページを更新日の新しい順に5件**（ユーザー指定）並べる。14日以内の更新には「新着」。

- **自動生成・手編集不可。** `fetch_news.py` が保存する `data/official_pages/toshikeikaku-1-*.txt` から `.github/scripts/build_toshikeikaku.py` が組み立てる（市サーバへのアクセスはゼロ。`fetch_news.py` の**あと**に実行。`--check` あり）。`ALLOWED` にも入れない。`site-facts.json` の `targets` は空。
- **東部の判定は `build_community_events.py` の `EAST_PLACE_KEYWORDS` を import して使う**（地名の一覧は1か所）。索引ページと申請書の様式集（`toshikeikaku-1-1-1-*`）は拾わない。図・PDF の中は読めないので、載っていない＝無い ではない（`rev_tk_note` に明記）。
- **巡回の負荷**：配下は索引37・記事約125ページ。ふだんは動きのある索引（`TOSHI_DAILY`：告示・公聴会・パブコメ・地区計画・都市計画審議会・会議の開催案内の最新年度）の**末尾だけ**を見て、最上位の索引からは降りない（`TOSHI_NO_DESCEND`）。全階層は日曜の `WATCH_DEEP`。浅い日は `toshikeikaku-1-` のスナップショットを `keep_slugs` で守る。`WATCH_TAIL_INDEXES` は「索引 → (末尾の記事数, 末尾の下位索引数)」の dict。
- **出典の索引は1本**（5本目の許可URL、`js/main.js` の TOSHIKEIKAKU EAST ブロック）。**2026-11-27 から各項目の見出しは元の個別ページへ直リンクする**（`url` は `build_toshikeikaku.py` が書く。スケジュールに載る日程の見出しも同じ）。題名と「該当した地名」は日本語以外で `headline_i18n.json` の訳に置き換える（`current_headlines()` に追加済み）。
- **決まった日程はスケジュールへ自動で載る**（2026-10-18 ユーザー指示）。東部に関係するページ（表示の5件に限らない）の「開催日時」「開催期日」「閲覧期間」「縦覧期間」「意見募集期間」の次の行から日付を読み、`events`（`role`：`day`＝1日の予定／`viewing`＝案の閲覧・縦覧／`pubcom`＝意見募集、期間は `start`〜`date`）に入れる。`KomakiTokadaiEvents()` が `kind: 'toshi'` として予定の形（ラベル＝見出しの訳＋`TAG_TOSHI[role]`「（都市計画）」など。1日なら `"day": true`、期間は `start` と `span: true`）に直し、カレンダー・`.ics`・schedule.html の一覧（`.event-item[data-auto="toshi"]`、本文は `community.html#toshikeikaku` へ）・トップの帯（`span` は「10月15日（木）〜11月12日（木）」と日付まで）・`status_digest` の件数に出る。**「地域の取組」には出さない**（地域の催しではないため）。`SCHEDULE_SINCE`（2026-10-17）より前に終わった日程はさかのぼって足さない。**新しい日程が載ったら更新履歴に1行足す**（2026-10-18 ユーザー指示。「都市計画「…」の閲覧期間を予定に掲載」、`auto_key` は `toshikeikaku:` 始まり。カットインに出る都市計画の行はこれだけ。生成モードのときだけ書き、`--check` では書かない）。題名に「中止」「延期」があるページは日程を拾わず、「は開催しません」とあるページは開催日だけ落とす（閲覧期間は行われたので残す）。市の「開催予定の審議会等」の索引（`4/2/kaigikaisai_r*`）は議題が無く東部との関係が読めないので拾わない — 会議ページに議題が載り東部の地名が出た時点で載る。
- **【事実】だけの欄。** 札（市公式）・緑の左帯・出典行は東部まちづくりの動きと同じ形（`.tobu-*` を再利用）。🔎・💡 はこの欄に書かない（リードの最後の1文で analysis.html#rev-power の当サイトの考えへ送るだけ）。

## `data/child_estimate.json`（東部地域の0〜17歳・当サイトの推定）

2026-10-22 追加（ユーザー指示）。`index.html` の**トップのヒーローの中**（`.hero-count#child-estimate`。誰の目にも明らかなよう数字を大きく — 同日ユーザー指示）に、**東部地域（篠岡地区）に住む0〜17歳の子どもの数を当サイトの推定で、小数第1位まで**出す。

- **材料は市の人口統計（市民窓口課 住民登録係）だけ**：「指定区別年齢別男女別人口統計表」（年1回・10月1日現在、町字×1歳刻みの xlsx。約5か月遅れで出る）と「人口世帯表」（毎月1日現在、町字別の総人口の csv）。`.github/scripts/fetch_population.py` が索引3枚を見て、**新しい表が出たときだけ**ダウンロードし、東部の行を `data/official_pages/population/` に保存する（手編集不可・古いものも消さない）。**市の統計ページへはリンクしない**（許可外の URL）。出典は `child_est_method` に文字で書いてある。
- **東部＝表の「小針二丁目」の次の「大山」から「城山五丁目」までの連続した塊**（`EAST_TOWNS` の32町字＋塊の中に新設された町字。令和8年の人口世帯表には工業地の長治町・郷西町が入っている）。表の先頭近くの「大山（小牧）」は小牧地区の別の町字。既知の町字が1つでも欠けたら取得を失敗させる（黙って小さくならないように）。
- **推定のしかた**（`build_child_estimate.py`、市サーバへのアクセスなし、`--check` あり）：年次表の新しい2時点から子どもの割合とその変化の速さ、月次表の最新月と1年前から総人口の変化の速さを出し、`base_value`（最新月の1日の推定）× `exp(daily_rate × 経過日数)`。**今日の値はブラウザが日本時間の日付で計算する**（CHILD ESTIMATE in `js/main.js`）ので、ワークフローが止まっても日付が変われば数字は変わる。
- **小数第1位まで出すのは「毎日必ず数字が切り替わる」ため**（ユーザー指示）。一の位だと1日の動き（いまは約0.57人）で変わらない日が出る。1日の動きが 0.1 人を下回る係数になると `build_child_estimate.py` が失敗する（check 17）。**一の位で毎日±1を強制する形は採らない** — 1年で公表値から100人以上ずれるため。
- **増減は画面に出さない**（同日ユーザー指示）。出すのは推定値・その日付・市の公表値（年次表の最新時点）・推定のしかた（`<details>`）だけ。「当サイトの推定」「市が公表した数ではありません」は外さないこと。読み上げ（READ ALOUD）の対象外（ヒーローの題名と同じ扱い）。
- 人口統計の取り込みは学校再編の一次情報ではないので、`fetch-news.yml` では**単独でコミット**し、Issue も自動更新ジョブも動かさない。`ALLOWED` にも `site-facts.json` にも入れない。
- **年齢別の棒グラフ**（2026-11-22、日次アイデア 11/17）：「推定のしかた」の中に、年次表の最新時点を東部で合算した0〜17歳の人数（`official.by_age`）を表＋棒で出す。推定ではなく市の公表値。増減と町字ごとの数は出さない。
- 文言キーは `child_est_*`（12言語＋こどもむけ）。書式（`{n}` / `{date}`）は隠し要素 `[data-ce]` から読む。

## 外部リンクの死活確認と、自動取得の「最後に確かめた日時」（2026-10-23）

- **外部リンクの死活確認**（`.github/workflows/check-links.yml`、毎週月曜 5:40 JST）。`check_links.py` が `*.html`・`js/*.js`・`data/i18n/*.json` と `data/community_actions.json`（まだ終わっていない項目だけ）の URL を、`fetch_news._curl_get` で1本ずつ3〜5秒あけて取りに行く。**Instagram・Facebook は robots.txt が機械での収集を禁じているので見ない**。共有ボタンの送り先と Google マップ（検索語のリンク）も外す。一時的な不調（メンテナンスの 503 など）で騒がないよう、**2週続けて開けない URL だけ**を Issue（🔗、開いているものがあれば追記）で知らせる。記録は `data/link_check.json`（自動生成）。**自動では直さない** — 移転先は発信元の公表で確かめてから差し替え、市・文科省の URL なら許可URLの表と `PERMITTED_LINKS` も直す。
- **自動取得の各コーナーの下に「最後に確かめた日時」**（FETCH STATUS in `js/main.js`）。`news.json` などの `fetched_at` は内容に変化の無い日はコミットされないので使えない。代わりに `fetch-news.yml` の最後のステップ（`if: always()`）が `record_fetch_status.py` で `data/fetch_status.json` に取得元（`city` / `schools`）ごとの `checked_at`・`ok`・`last_ok_at` を毎回書いてコミットする。**取れなかった日は「取得できませんでした。この一覧は◯日に確かめた時点の内容です」、36時間以上確かめていなければ「◯日から確かめられていません」と、一覧が古いことを赤字で書く** — 古い一覧を最新に見せないため（オフラインの断り書きと同じ考え方）。対象は市のお知らせ・学校HP・地域協議会のイベント・東部まちづくりの動き・都市計画の動き。新しい自動取得コーナーを足したら `MAP` にも足す。
- **止まったら運営者に Issue で知らせる**（2026-11-07、日次アイデア 11/2）。`.github/workflows/check-fetch.yml`（毎日 10:20 JST）が `check_fetch_health.py` で `data/fetch_status.json` を読み、`ok:false` か `checked_at` が36時間より古い取得元があれば「⚠️ 自動取得の停止」の Issue を作る（開いていれば追記。自動では閉じない）。毎日の巡回とは別のワークフローなので、巡回そのものが動かなくなっても気づける。外部にはアクセスせず、AI も使わない。取得元を足したら `record_fetch_status.py` の `LABELS` に足せば、ここも自動で見る。

## サイトの点検（`site_lint.py`、週1回。2026-11-11）

日次アイデアにたまっていた検査の案（約20件）を1本にまとめた。**止めない点検**で、`.github/workflows/check-site.yml`（毎週月曜 6:20 JST）が `.github/scripts/site_lint.py` を回し、気になる所があれば Issue「🧹 サイトの点検」1件で知らせる（開いていれば追記、自動では閉じない）。外部にはアクセスせず、AI も使わない。

- 見るもの：使われていない辞書のキー／訳の抜け（12言語・こどもむけ）／言語の一覧のそろい（`i18n.js`・各スクリプト・sitemap）／`meta_desc_*` の長さ／`target="_blank"` の `rel="noopener"`／`<img>` の `alt`・`width`・`height` と挿絵 SVG の文字／`site_version` と `og-image.png?v=` のそろい／文中の数と実数（`faq_qa_intro` の「◯問」、`faq_q` の連番、`rev_open_short` の「◯問」）／1日の予定の `"day": true`／ページ別辞書の重さ／3か月より古い `*_asof`／「市民」の表記（固有名詞の許可リスト `SHIMIN_OK`）／`HANDOVER.md` とワークフロー・Secrets・Issue の印の食い違い。
- 2026-11-22 に3つ足した（日次アイデア 11/11・11/12）：日付と曜日の食い違い（`weekday_mismatch`。年が直前に無い日付は 2025〜2027 年のどれとも合わないものだけ）、許可する市の URL の記載もれ（`permitted_sync`。`auto_gates.py` の `PERMITTED_LINKS` と CLAUDE.md・`CONTRIBUTING.txt`・`README.md`）、関連リンクの偏り（`crosslink_balance`。どこからも指されないページ・3割超が集まるページ）。
- `build_search_index.py` は、1つの `<section>` に h2 が複数あるページ（nationwide.html）を **h2 ごとの項目に分ける**（飛び先は PAGE TOC と同じ規則）。
- **検査を足したいときは、まずここに点検を1つ足す**（関数を書いて `CHECKS` に足す）。`auto_gates.py` に足すのは、壊れると読者に見えるものだけ — 止める検査が増えると、毎日の自動更新が小さなことで止まる。いま上げてあるのは check 28（辞書に無いキー）と 29（サイト内リンク切れ）の2つで、どちらも `site_lint.py` の関数を呼ぶ（実装は1か所）。
- 固有名詞を足したら `SHIMIN_OK`、言語を足したら `LANGS`、Issue の種類を足したら `HANDOVER.md` の表も直す（点検が食い違いを知らせる）。
- 2026-11-11 に、点検で見つかった使われていないキー9つ（`rel_voices_*`・`rev_f11_*`・`rev_f12_*`・`rev_src_pref`・`site_op_label`）を13辞書から消した。


#### 自動取得した見出しの翻訳（2026-09-14 ユーザー指示：見出しを原文のまま残さない）

「最新の動き」の各コーナーと community.html に自動で並ぶ見出し（市のお知らせ・各校HPの記事・地域協議会のイベント・東部まちづくりの取組名と会場名・地域の取組の催し名）は、**日本語以外の表示では訳した見出しに置き換える**。原文を残して下に参考訳を添える形（2026-09-06 に検討・保留した案）は採らない — ユーザーが「原文のまま残すことは禁止」と指示した。日本語とこどもむけでは原文をそのまま出す。

- **訳の置き場は `data/headline_i18n.json`**（`{"items": {"見出しの原文": {"en": …, …, "my": …}}}`）。キーは見出しの原文そのもので、見出しが1文字でも変われば別キーになり訳し直される。いま表示されない見出しの訳は自動で落ちる。
- **毎日の更新は `.github/workflows/translate-headlines.yml`**。「Fetch Official News」が終わると動き、`headline_i18n.py pending` で訳の無い見出しを出し、Claude（sonnet）に `auto_i18n/translations.json` だけを書かせ、`headline_i18n.py apply` が機械検証（9言語そろい・タグ/URL/改行なし・かな残りなし・zh 以外に漢字なし・長さ）して合格分だけ取り込む。市・学校・新聞社のサーバには一切アクセスしない。`CLAUDE_CODE_OAUTH_TOKEN` が無ければ何もしない。
- **⛔ AI に `data/headline_i18n.json` を直接書かせない。** 壊れた JSON や規則違反の訳がそのまま公開されるため。人が誤訳を直すのはよい（見出しが変わらないかぎり上書きされない）。
- **⛔ 自動生成される `news.json` / `school_news.json` などに訳を書き足さないこと。** 毎日上書きされる。
- 画面側は `js/main.js` 冒頭の `window.KomakiHeadline`。各コーナーは見出しの要素に `data-hl="原文"` を付けて描き、描き終えたら `KomakiHeadline.apply(container)` を呼ぶ。帯（TOP CUT-IN）は `KomakiHeadline.text()` で文字列を訳す。**新しい自動取得コーナーを足すときは、この2つと `headline_i18n.py` の `current_headlines()` の3か所をそろえること。**
- **訳がまだ無い見出しだけは原文で出る**（取得直後で翻訳ジョブがまだ走っていない数分〜、または訳が検証に落ちた日）。見出しごと隠すと新着があったこと自体が伝わらないため。
- 読者向けの注記（`news_note` / `school_news_note` / `tobu_actions_lead` / `tobu_actions_note`）には「日本語以外の表示では自動翻訳」と書いてある。訳す範囲を変えたらここも直す。
- 自動取得の日時（「9月23日 13時30分～16時00分」「令和8年11月15日(日曜日)14時から（開場13時）」）は `window.KomakiJaWhen()` が日付と時刻だけを読み取り、表示言語の書式に組み直す。読めない書き方のときは原文が出る。
