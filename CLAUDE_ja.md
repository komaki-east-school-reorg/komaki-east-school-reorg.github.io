# CLAUDE_ja.md

CLAUDE.md（Claude Code 向けガイド）の日本語説明ファイルです。
内容が重複した場合は CLAUDE.md を正とし、このファイルを更新してください。

---

## このサイトについて

小牧市東部（篠岡地区）の学校再編計画に関する**ビルドステップなしの静的な市民情報サイト**です。
GitHub Pages（`komaki-east-school-reorg.github.io`）でホストされており、パッケージマネージャー・バンドラー・テストランナーは使用していません。

---

## ローカル開発

```bash
python3 -m http.server 8000
# ブラウザで http://localhost:8000/ を開く
```

---

## コミット前の検証（毎回必ず実行）

### 1. 不正な外部リンクのチェック

許可されている外部 URL は次の2つのインデックスページのみです。
PDF の直リンクや個別記事ページは禁止されています。

| 許可URL | 用途 |
|---|---|
| `.../kyoiku/kyouikusoumu/303/index.html` | 学校再編（教育総務課）— サイト全体 |
| `.../kenkouikigai/sasaeai/3/3_2/index.html` | 地域協議会（支え合い協働推進課）— community.html のみ |

```bash
grep -rn "city\.komaki\.aichi\.jp" *.html js/*.js \
  | grep -v -e "303/index\.html" -e "sasaeai/3/3_2/index\.html"
# 出力があれば違反。許可 URL に差し替えること。
```

別枠として、文部科学省の4ページ（`mext.go.jp`）を `nationwide.html`（全国の動き）だけで
出典としてリンクできます（2026-08-22 追加）。全国の統計と国が示す基準は市の公式情報では
賄えないためで、索引・通知ページのみ・PDF 直リンク不可という条件は市サイトと同じです。

```bash
grep -rn "mext\.go\.jp" *.html js/*.js data/i18n/*.json \
  | grep -v -e "tekisei/index\.htm" -e "tekisei/1413885_00007\.htm" \
           -e "zyosei/yoyuu_00002\.htm" -e "kihon/1267995\.htm"
# 出力があれば違反。nationwide.html 以外のページに出た場合も違反。
```

`auto_gates.py` の `PERMITTED_MEXT_LINKS` / `MEXT_PAGES` が機械で守っています。
リンク検査は `data/i18n/*.json` も見ます——日本語以外では、実際に表示されるリンクは
HTML ではなく辞書側の文面だからです。

さらに別枠として、全ページ最下部の**共有ボタンの送り先**（`social-plugins.line.me` /
`x.com/intent/post` / `www.facebook.com/sharer/sharer.php` / `b.hatena.ne.jp/entry/panel/` /
`www.threads.net/intent/post` / `bsky.app/intent/compose` / `www.reddit.com/submit`、および
閲覧者が入力した Mastodon サーバー `https://<ホスト>/share`）と、
はてなスターの表示に使う外部スクリプト `s.hatena.ne.jp/js/HatenaStar.js` があります
（2026-08-22 追加）。これらの URL は HTML にも辞書にも書かれておらず、`js/main.js` の
SHARE BUTTONS ブロックが組み立てます。**出典ではないので、サイト本文の事実の根拠には
一切使いません。** 詳しくは下の「共有ボタン（全ページ）」の節を参照。

### 2. i18n JSON の構文チェック（全ファイル）

JSON では**アポストロフィはそのまま書いてよく**、`\'` と書くと逆に構文エラーになります。
実際に壊れるのは、値の中の素の `"`／末尾カンマ／値の中の生の改行／単独のバックスラッシュ
の4パターンです。詳細は [CONTRIBUTING.txt](CONTRIBUTING.txt) の【ルール2】。

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

`ja` 以外が壊れると i18n.js が黙ってフォールバックし、ページ自体は表示される
（言語だけ違う）ため気付きにくい。編集した言語だけでなく必ず全ファイルを通すこと。

---

## i18n（多言語化）の仕組み

翻訳テキストは `data/i18n/<言語コード>.json` に格納されています。

| ファイル | 言語 |
|---|---|
| `ja.json` | 日本語（デフォルト） |
| `en.json` | 英語 |
| `pt.json` | ポルトガル語（ブラジル） |
| `vi.json` | ベトナム語 |
| `tl.json` | フィリピノ語 |
| `es.json` | スペイン語 |
| `zh.json` | 中国語（簡体字） |
| `id.json` | インドネシア語 |
| `tr.json` | トルコ語 |
| `my.json` | ビルマ語 |

`js/i18n.js` は実行時に辞書を非同期フェッチします。日本語表示では `ja.json` のみ、
**それ以外の言語では `en.json` と対象言語の2ファイルだけ**を取得し、
`Object.assign({}, en_dict, lang_dict)` の順にマージします。
対象言語にキーがなければ英語にフォールバックします。
英語を挟むのは、トルコ語やビルマ語を選んだ閲覧者にとって日本語より英語のほうが
読める可能性が高いためです。新しいキーを追加するときの最低要件は `ja` と `en` への記載です。

### ページ別辞書

`i18n.js` はサイト全体の辞書を取りに行きません。**`data/i18n/pages/<ページID>.<言語>.json`**
（そのページが実際に使うキーだけを切り出したもの）を取得し、404 のときだけ
全体辞書 `data/i18n/<言語>.json` に落ちます。各ページが使うキーは 661 のうち 9〜20% しかないため、
1ページ表示あたり gzip 約45KB → 4〜10KB になります。描画の律速部分がそのまま縮みます。

これらは**生成物**です。`data/i18n/*.json` を変更したとき、またはページに `data-i18n` を
足したときは `python3 .github/scripts/build_page_dicts.py` を実行してコミットしてください。
`data/i18n/pages/` を手で編集してはいけません。`auto_gates.py` のチェック5が `--check` で
生成し直して差分を検出し、古ければ落とします。日次ワークフローも、起案AIが辞書を編集した
あとに再生成します。**古いページ別辞書は、無いページ別辞書より危険**です。無ければ 404 で
全体辞書に落ちますが、古い場合は古い文面を 200 で返すため実行時には救えません。

`main.js` が実行時に付けるキー（`status_done`・`event_status_*`）は HTML に現れないので、
生成スクリプトの `RUNTIME_KEYS` に列挙して全ページの辞書に必ず含めています。

**非日本語表示で `ja.json` を取りに行かないのは意図的です。** 以前は3層の1枚目でしたが、
`ja` と `en` はキー集合が同一なので `en` 層が全キーを上書きしており、
`ja` 層は最終辞書に1キーも寄与しないまま毎回 gzip 約23KB を転送していました。
しかも `body` は `.i18n-ready` が付くまで非表示なので、この転送は描画の律速でした。
万一 `en` にキーが欠けても、HTML には日本語の既定文がそのまま書かれているため、
`ja` 層が供給していたはずの日本語がそのまま表示されます。
この前提（`ja` と `en` のキー集合が一致すること）は
`.github/scripts/auto_gates.py` のチェック3が機械的に検証しています。**このゲートは外さないこと。**

### こどもむけモード（ja-kids.json）

`data/i18n/ja-kids.json` は「こどもむけ」トグルが ON のとき（日本語のみ）、
`ja.json` の上にマージされ、キーをひらがな・やさしい日本語に上書きします。
`Object.assign({}, ja_dict, kids_dict)` の形で適用されます。

**文章は小学校3年生レベルを基準**とする（難しい漢字・熟語はひらがな化／やさしい言葉に、一文は短く）。
ナビ・サブタイトル等の共通キーもこどもむけ表記の対象（例：`nav_about`, `site_sub`）。詳細は [CONTRIBUTING.txt](CONTRIBUTING.txt) の【ルール6】。

言語設定とこどもむけ状態は `localStorage` の `komaki_lang` / `komaki_kids` に保存されます。

### URL での言語指定（`?lang=`）

全ページが `?lang=<コード>`（`LANGS` のコード。例 `about.html?lang=pt`）を受け付けます。
**URL が `localStorage` より優先**されるので、地域のグループで共有されたリンクを
初めて開いた人にも、その言語で表示されます。辞書を適用したあと `i18n.js` は
`history.replaceState` でアドレスバーを選択中の言語に合わせ（履歴は増やしません。
戻るボタンで言語だけが巻き戻るのは分かりにくいため）、`<link rel="canonical">` と
`og:url` も同じ URL に更新します。日本語はパラメータなしの素の URL で、これが正規 URL です。

`js/main.js` は先頭で定義している共通ヘルパー `window.KomakiLang()` で言語を解決します。
`localStorage` を直接読まず必ずこれを使ってください。`main.js` の各ブロック
（公式ニュース・学校HP更新・更新履歴・カレンダー）は `i18n.js` が `komaki_lang` を
書き終える前に描画されるため、共有リンクからの初回訪問で言語がずれます。

### HTML 属性

| 属性 | 動作 |
|---|---|
| `data-i18n="key"` | `element.textContent` を設定 |
| `data-i18n-html="key"` | `element.innerHTML` を設定（HTML タグを含む値に使用） |
| `data-i18n-aria="key"` | `aria-label` を設定 |

ページの `<title>` と OG/Twitter メタタグは `meta_title_<pageId>` / `meta_desc_<pageId>` キーで自動更新されます（`pageId` は拡張子なしのファイル名、例：`meta_title_about`）。

### キーの命名規則

`<ページ>_<セクション>_<種別>` の形式（例：`about_whatis_p1`、`faq_a3`）。
ナビ・フッター・お知らせ・ヒーローなど全ページ共通のキーにはページ名プレフィックスはありません。

---

## 重要な制約

- **ヘッダのサイト名は永久に日本語固定。**
  `<a class="site-title">` 要素には `data-i18n` を付けない。
  内部の `<span data-i18n="site_sub">` サブタイトルは翻訳対象だが、メインのサイト名テキストは翻訳しない。

- **全ての事実は公式情報源に基づくこと。**
  許可 URL または公式配布資料（出典を文中に明記）のみ。未確認・推測の情報は掲載しない。
  **全国の統計と国が示す基準は文部科学省の資料**に基づき、`nationwide.html` にのみ置く。
  国の資料を小牧市の計画に関する事実の根拠に使わない（逆も同じ）。

- **10言語すべてが全キー翻訳済み。**
  トルコ語（`tr`）・ビルマ語（`my`）は 2026-08-13 に全661キーが揃ったため、
  `i18n.js` の `PARTIAL` 配列は空で、「未翻訳部分は英語表示」の帯は出ない。
  `events.json` のイベントラベルは**10言語必須**（`auto_gates.py` の `LANGS`）。
  今後あらたに部分翻訳の言語を足すときは、`i18n.js` の `PARTIAL` と
  `auto_gates.py` の `PARTIAL_LANGS` の両方にコードを入れること
  （帯が出て、かつ events.json のラベル必須対象から外れる）。

---

## nationwide.html（全国の動き）

2026-08-22 追加。「これはここだけで起きていることなのか」に、文科省の統計と国が示す基準で
答えるページ。**静的な手書きコンテンツ**で、JSON フィードもスクリプトも日次ワークフローも持たない。

- **事実はすべて文科省の資料から**。許可されている `mext.go.jp` の4URLがそのまま出典一覧。
- **賛否は載せない。市民団体の集会・講演会も載せない。** 賛否は `voices.html` の役割で、
  中立に見える全国ページは立場を紛れ込ませやすい場所なので、記述に徹すること。
- 「国の基準 ⇔ 小牧市東部の計画」の対照表がこのページの主眼。右列はサイト内の既存の事実
  （令和15年に各学年1学級・2km でスクールバス・ガイドラインは未定）の再掲なので、
  そちらが変わったらここも直す。
- 手引は2026年8月に改訂され、今後も改訂される。改訂されたら数値基準は**新しい改訂版で
  確認し直す**こと（そのまま引き継がれる前提で書かない）。
- 自動更新パイプラインの `ALLOWED` には入れない。市のページが変わっても全国統計は動かない。

---

## data/community_events.json（地域協議会イベント案内）

`community.html` の末尾に、市の地域協議会イベント案内を表示します。
`.github/scripts/build_community_events.py` が、**`fetch_news.py` がすでに保存した
スナップショット**（`data/official_pages/sasaeai-3-3_2-chiikikyougikaievent-*.txt`）
を読んで組み立てます。**自分では HTTP リクエストを一切しません**。
このコーナーを足しても市サーバへの負荷は増えていません。
そのためワークフローでは `fetch_news.py` の【あと】に置く必要があります。

- **手編集しないこと。** 自動更新パイプラインの `ALLOWED` にも入れないこと（毎日再生成される）。
- 市の案内は**小牧市内16の小学校区すべて**が対象で、篠岡地区に限りません。
  並び順は市の掲載順ですが、篠岡地区の5協議会（スクリプトの `SHINOOKA_COUNCILS`）は
  `shinooka: true` を立てて先頭に出し、バッジを付けます。
  よその地区のイベントを除外していないのは意図的です。2026-08-13 時点で
  **篠岡地区のイベントは1件も載っていない**ため、絞ると常に空になります。
  また「協議会が実際に何をしているか」は、地域協議会とは何かを知りたい読者に
  とって具体例として役に立ちます。
- イベント名は**翻訳しません**（市の書いた見出しのため。`school_news.json` と同じ方針）。
  まわりのラベルだけ `js/main.js` のインライン辞書で多言語にします。
- 解析は 関連イベント / 関連ファイル / この記事に関するお問い合わせ先 で打ち切ります。
  その先はページに市内の無関係なイベントが並ぶためです。

---

## data/news.json と GitHub Actions

`data/news.json` は GitHub Actions（`.github/workflows/fetch-news.yml`）が
毎日 07:17 JST に自動更新します（正時を避け、リクエスト間に3〜5秒の待機を入れて市サーバへの負荷を抑えています）。

スクリプト（`.github/scripts/fetch_news.py`）は以下を行います：
1. 市公式の2つのインデックスページをスクレイピング
2. 各ページの更新日を取得
3. 直近 30 日以内に更新されたものだけを `items` に格納
4. 変更があれば `[skip ci]` コミットで自動プッシュ

手動実行は GitHub → Actions → "Fetch Official News" → Run workflow。
`items` は次回実行で上書きされるため手動編集不可。`window_days` と `source_url` は編集可。

さらに同スクリプトは、各記事ページの本文テキストを正規化して
`data/official_pages/<slug>.txt` にスナップショット保存します（自動生成・手編集不可）。
市サイト側でページの追加・本文修正・削除があるとスナップショットが変化し、
ワークフローが「📡 公式ページ更新検知 YYYY-MM-DD」という Issue を自動起票します。
Issue には変更ページ一覧・差分抜粋に加え、`data/site-facts.json`（公式ページの
スラッグ前方一致 → サイト内反映箇所の手動管理対応表）を `.github/scripts/map_targets.py`
で引いた「サイト内の更新候補箇所」が載ります。市が新しいページを公開したら
site-facts.json に対応エントリを追記してください。
スクリプトの終了コード：0 = 変更あり、2 = 変更なし、1 = 致命的エラー。

### 全自動更新パイプライン（auto-update ジョブ）

本文変更の検知後、第2ジョブがサイトの修正を全自動で行います：

1. **起案AI**（`anthropics/claude-code-action`・サブスクOAuth、Secret `CLAUDE_CODE_OAUTH_TOKEN`。
   未登録ならジョブはスキップされ検知 Issue のみ）が差分を読解し、
   `data/events.json`・`data/i18n/*.json`・`index.html`・`schedule.html` **のみ**を編集。
   各変更の根拠として公式ページ原文の引用を `auto_update/evidence.json` に必ず書く
2. **機械検証ゲート**（`.github/scripts/auto_gates.py`）：編集範囲・スキーマ
   （イベント10言語必須）・外部リンク規則・**引用の実在照合**（創作検出）。
   exit 0=合格 / 3=変更なし / 1=不合格
3. **監査AI**（起案と独立した別セッション）が差分を審査し `auto_update/verdict.json` を出力。
   approve の場合のみ PR を自動マージ（squash）し、`.github/scripts/auto_report.py` の
   事後報告（出典・監査結果・取り消し手順つき）を検知 Issue にコメントして close
4. **キルスイッチ**：リポジトリ変数 `AUTO_MERGE` を `false` にするとマージ直前で停止
   （PR 作成までは行う）。ゲート・監査で不合格の場合、main は一切変更されない

---

## js/main.js の構成

独立した IIFE ブロックで以下の機能を実装しています：

| ブロック | 機能 |
|---|---|
| HAMBURGER NAV | ハンバーガーメニューの開閉 |
| ACTIVE NAV LINK | 現在ページのナビリンクを `.active` でハイライト |
| AUTO DATE STATUS | `data-event-date` を過ぎた項目に `.done` を付与。index「現在の状況」はラベルを「完了」に書き換え、`schedule.html` のイベントには状態バッジ（完了 / 進行中 / 予定、キー `event_status_*`）を付与 |
| SECTION LAST UPDATED | `.section-updated` 要素に `document.lastModified` から「最終更新: 〜」を多言語で表示（index 現在の状況・schedule 主要イベント一覧） |
| UPCOMING SCHEDULE EXPIRY | `data-expires` を過ぎた直近スケジュール項目を非表示 |
| FAQ ACCORDION | FAQ のアコーディオン開閉 |
| VOICE FILTER | 賛否の声のカテゴリフィルター |
| OFFICIAL NEWS | `data/news.json` を取得して公式お知らせを描画 |
| SHARE BUTTONS | 全ページ最下部の共有ボタン（LINE / X / Facebook / はてなブックマーク / リンクのコピー / 端末標準の共有）と、はてなスターを組み立てる。→ 下の「共有ボタン」節 |
| CALENDAR | `schedule.html` のインタラクティブカレンダー（イベントは `data/events.json` を実行時に fetch。追加・変更は main.js ではなく JSON を編集。10言語ラベル必須）。初期表示は閲覧者の**現在月**で固定。予定が0件の月でもクランプせず今月を開く（開いた人がまず知りたいのは「今がどこか」のため）。予定のある月へ自動で飛ばさないこと |

---

## 共有ボタン（全ページ）

各ページの `</main>` の直前に `<section class="section share" id="share">` があります。
見出し・リード文・注記は HTML に `data-i18n` 付きで書かれていますが、**ボタンの実体は
`js/main.js` の SHARE BUTTONS ブロックが `#share-buttons` / `#share-star` に組み立てます**。

- **ボタン**（並び順）：LINE・X・Facebook・はてなブックマーク・Threads・Bluesky・Reddit
  （`<a target="_blank">`。URL は `SERVICES` の `url()` が組み立てる）→ Mastodon（`<button>`）
  → Instagram・TikTok（`<button>`。コピーのみ）→「リンクをコピー」→
  `navigator.share` がある端末でのみ「ほかのアプリで共有」。
  最後のボタンが WhatsApp・Zalo・Messenger など個別に並べきれない共有先を引き受けており、
  Instagram・TikTok を実際に「開ける」唯一の経路でもある。
  サービスごとのボタンを増やす代わりにこれを外す、ということはしないこと。
- **Instagram・TikTok はリンクを渡せる共有インテントを公開していない**ため、
  ボタンは投稿画面を開かず、URL をコピーして「{app} に貼り付けてください」と出す。
  押す前に分かるようラベルに「（リンクをコピー）」と入れてある。将来どちらかが本物の
  共有 URL を公開したら `SERVICES` に移してコピー経路を外すこと。存在しない
  エンドポイントを推測で書かないこと。
- **Mastodon は分散型**で送り先が1つに決まらない。初回だけ利用者のサーバーの
  ドメインを聞き、正規化して（`https://`・末尾のパス・`@user@example` 形式を除去）
  `localStorage` の `komaki_mastodon` に保存し、`https://<ホスト>/share?text=` を開く。
  第三者のリダイレクトサービスを使えば簡単だが、外部ホストが1つしかないサイトに
  もう1つ足すことになるので採らない。入力を促す文言は辞書（`share_mastodon_prompt`）に
  あり、非表示の `data-i18n` 要素から読んでいる（main.js は辞書を直接読めないため）。
- **ボタンに文字ラベルは付けず、アイコンだけ**。サービス名は `aria-label`
  （`data-i18n-aria`）に入れ、マウスを載せたときだけ `syncTitles()` が `title` に写す。
  10個が1列に並ぶので、1つずつ文字ラベルを付けると共有欄がページで一番大きな塊に
  なってしまう。アイコンにロゴ画像を使わないのは、外部ホスト（またはバイト数）が
  増えるうえ、10言語で同じ幅に揃わないため。`share_lead` / `share_note` を
  1行の短文にしているのも同じ理由。
- **共有する URL は `<link rel="canonical">` ＋ 表示中の言語**から組み立てる。
  アドレスバーからは作らない。`i18n.js` が `?lang=` を書き込むのは辞書取得のあとなので、
  読み込み直後と言語切替の直後は 1 手遅れた URL になるため。canonical を読むのも
  スクリプト読み込み時の1回だけ（`i18n.js` があとで言語別 URL に書き換えるため）。
- **`href` とページ題名は `pointerdown` / `focusin` / 言語切替のたびに組み直す**。
  `document.title` は `i18n.js` が辞書取得後に差し替えるので、描画時の値のままだと
  日本語の題名で共有されてしまう。
- **ラベルはインライン辞書ではなく `data-i18n`**。公式ニュース等のブロックが
  インライン辞書を持つのは辞書取得より先に描くためだが、このブロックは `applyDict` より
  前に DOM を作れるので辞書側に一本化している。HTML に現れないキーなので
  `build_page_dicts.py` の `RUNTIME_KEYS` に列挙してある。
  **共有まわりのキーを増やしたらここにも足すこと**（足さないと日本語のまま出る）。

### はてなスター

ボタンの下に「ラベル → ページ題名のリンク → 星」の順で置いています
（`Hatena.Star.SiteConfig.entryNodes` の標準的な貼り方）。2点は意図的です。

- 登録先 URL は **`?lang=` を付けない素の canonical** に固定。星は「共有」ではなく
  ページへの反応なので、言語別にすると同じページの星が10か所に散ってしまう。
- `HatenaStar.js` は **このサイトが読み込む唯一の外部スクリプト**で、共有欄が
  画面の 200px 手前に入るまで読み込まない（`IntersectionObserver`。この API が無い
  環境では星の欄をクリックしたときに読み込む）。最下部まで来なかった閲覧者には
  はてなへの通信が発生しない。**外部スクリプトを2つ目に増やすときは、この
  「自動では外部と通信しない」性質ごと考え直すこと**（ウィジェット1つより価値がある）。
- **遅れて読み込むには2つのコツが要る**（どちらも最初に間違えた箇所。しかも失敗しても
  エラーは出ず、ラベルだけ出て星が出ない状態になる）：
  1. `Hatena.Star.SiteConfig` は**読み込んだ「あと」に入れる**。先回りして
     `window.Hatena.Star` を作ってはいけない。本体が
     `void 0 === window.Hatena.Star && (window.Hatena.Star = {…})` と書いているため、
     先に空オブジェクトを置くと本体側の代入がスキップされ、初期化に必要な中身が入らない。
  2. 初期化は `window.addEventListener("DOMContentLoaded", …)` に紐づいている。
     欄が画面に入る頃には本物の DOMContentLoaded は過ぎているので、
     `window.dispatchEvent(new Event('DOMContentLoaded'))` で走らせ直す。
     公開された入口は無い（`EntryLoader.loadEntries()` は現行ビルドに存在しない）。
     二重に走っても、はてな側が `[data-hatena-star]` の有無で弾くので安全。
- 現行ビルドは**登録先 URL も表示題名も `uri` のノードから読む**（題名は `title`
  セレクタではなく、そのノードの `innerText`）。題名リンクを実体にしてあるので
  どちらの読み方でも正しい値になる。題名を別ノードに移さないこと。
- 4秒たっても描画されないときは星の欄ごと畳む。星の出ないラベルだけが
  残るのを避けるため。

---

## 日付連動の自動表示と更新タイミング

現在日付に応じて表示が自動で変わる箇所がある。手動更新は不要だが、
データ（`data-event-date` / `events` / 見出し）の持ち方を誤ると正しく動かない。

| 箇所 | 更新タイミング | 仕組み |
|---|---|---|
| `data/news.json`（公式お知らせ） | 毎日 07:17 JST | GitHub Actions |
| 「最終更新: 〜」表示（index 現在の状況 / schedule 主要イベント一覧） | サイトを再デプロイ（push）してファイルが配信し直されるたび | `document.lastModified`（配信ファイルの Last-Modified＝GitHub Pages では再デプロイ時刻）を表示 |
| 月別カレンダーの初期表示月（schedule.html） | ページを開くたび（閲覧者の現在月） | `new Date()`。`events` 範囲にクランプ |
| 「現在の状況」のラベル「完了」化（index.html） | ページを開くたび（現在日付 ≧ `data-event-date`） | AUTO DATE STATUS |
| イベント状態バッジ 完了/進行中/予定（schedule.html） | ページを開くたび（同上） | AUTO DATE STATUS |
| 「これからの予定」バーの表示/非表示 | ページを開くたび（`data-expires` 経過で非表示） | UPCOMING SCHEDULE EXPIRY |

注意点：
- 「最終更新」は**サイトの最終デプロイ日**であり、そのセクションの編集日とは厳密には一致しない（≒ 直近の push 日）。
- 見出しテキストに固定の日付を書かない（例：「現在の状況（2026年5月時点）」は廃止）。直下の `<p class="section-updated">` が自動表示する。
- スケジュール／状況の項目を足すときは `data-event-date="YYYY-MM-DD"`（複数日は終了日）を設定する。恒久的に過去・進行中のものは HTML に `done`/`current` クラスを直接付ける。

### 年表の並び（data-start）

「現在の状況」（index.html）と「主要イベント一覧」（schedule.html）は追記を重ねるほど時系列が崩れる。並べ替えの根拠を `data-start`（開始日）に一本化してある。

- 全項目に `data-start="YYYY-MM-DD"` を付け、各リストを昇順で書く。**末尾に足さず、日付の位置に差し込む**。
- 期間ものは開始日、月だけの記載は月初、ある日付の直後に始まるものはその翌日（例：校章の選考は 5/18 締切の翌日 `2026-05-19`）。同じ日付どうしは元の順序を保つ。
- 昇順を見るのは**見出し（h3/h4）ごとの塊の中だけ**。`schedule.html` の令和7年は「考える会（全5回）」と「その他の取組」の2リストに分かれており、考える会の第5回（2025-10-11）が その他の 2025-06-13 より上にあるのは正しい。
- **並び順は HTML の記述順が正。実行時に並べ替えてはいけない。** AUTO DATE STATUS は以前、完了した項目を最初の `.current` の前へ動かしており、`data-start` で整えた順序がブラウザ上で崩れていた（2026-05-18 と 2026-06-06 が 2026-02-08 より前に出ていた）。あのブロックは状態表示だけを行う。
- 期日が確実に過ぎた項目は HTML 側に `done` クラスと「完了」ラベルを直接書く。JavaScript が無効でも正しく見え、スクリプトは同じ状態を上書きするだけになる。
- `.github/scripts/auto_gates.py` の「年表の並び」が、`data-start` の欠落・時系列の逆転・**AUTO DATE STATUS への並べ替え処理の復活**で落ちる。自動更新パイプラインが index/schedule を編集した場合もここで止まる。
- **属性の使い分け（3つ・役割が違う）**：`data-start`（開始日／並び順専用・全項目に必須）、`data-event-date`（終了日／「完了」判定）、`data-expires`（掲載期限／トップの「今後のスケジュール」バー `.upcoming-item` がその日を過ぎると非表示）。バーは直近の予定を schedule.html・カレンダーと同じ個別日程で記載する（文言は `upcoming_dateN`/`upcoming_nameN`）。
- 詳細な運用ルールは [CONTRIBUTING.txt](CONTRIBUTING.txt) の【ルール5】を参照。

#### ★ 例外：トップ冒頭「いまの状況」枠（`.now-bar`）は自動化されていない

`index.html` のヒーロー直下に、現況を**1文**で伝える枠がある。上の表の項目がすべて日付から自動計算されるのに対し、**この枠だけは手書きの文章**なので、放置すると最も早く古びるうえトップ冒頭なので最も目立つ。

| キー | 内容 |
|---|---|
| `now_label` | 枠のラベル「📌 いまの状況」。ほぼ変えない |
| `now_text` | 現況を1文で要約。`data-i18n-html` なので `<strong>` が使える |
| `now_asof` | その文がいつ時点かを示す月（例「2026年8月時点」） |
| `now_more` | 「現在の状況」セクション（`#status`）へのリンク文言 |

状況が動いたとき（行事の終了・新資料の公表・決定など）は `now_text` と `now_asof` を**全10言語＋ja-kids**そろえて更新する。誤字修正など状況が動かない変更では触らない。`data/site-facts.json` に `now_bar` として登録し `default_targets` にも入れてあるので、自動更新パイプラインも毎回ここを更新候補として扱う。

---

## ページの HTML 構造

全ページ共通のパターン：

```
notice-banner（非公式サイト注意書き）
<header>
  .header-inner
    .site-title（日本語固定）
    <nav>
      ナビリンク一覧
      .lang-switcher
        .kids-toggle（こどもむけトグル）
        .lang-select（言語選択）
</header>
<main>
  ページ固有コンテンツ
  <section class="section share" id="share">（全ページ共通の共有ボタン欄）
</main>
<footer>
  ...
</footer>
<script src="js/i18n.js">
<script src="js/main.js">
```

ページ間で共有テンプレートや SSI は使用していないため、新規ページ追加時は既存ページからヘッダ・共有欄・フッターの各ブロックをまるごとコピーしてください。
あわせて **`sitemap.xml` と `files.txt` への追加**、および全言語ファイルへの
`meta_title_<ページID>` / `meta_desc_<ページID>` の追加も必要です。

---

## SEO

| 要素 | 場所 | 補足 |
|---|---|---|
| `robots.txt` | リポジトリ直下 | 全許可＋サイトマップの場所。こどもモードの除外は `js/i18n.js` の `applyKidsSeoMeta` が付ける `noindex` で行っており、ここには書かない。 |
| `sitemap.xml` | リポジトリ直下 | 手動メンテナンス。10ページ分の `<url>` に、それぞれ全言語の `xhtml:link` を付けている。`lastmod` は書かない（古い日付は無いより悪いため）。 |
| `<link rel="canonical">` | 全ページの `<head>` | 静的な値はパラメータなしの（日本語の）URL。`i18n.js` が表示中の言語の `?lang=` URL に書き換える。 |
| `hreflang` | 全ページの `<head>` | 10言語＋`x-default`。それぞれ**別々の** `?lang=` URL を指す。以前は11本すべてが同一 URL を指しており、これは Search Console がエラーとして報告する状態だった。 |
| JSON-LD `WebSite` | `index.html` のみ | 静的。**`publisher` / `Organization` は意図的に書いていない**。組織名を作ると公式サイトだと誤解させるため。`citation` は許可された市の URL を指す。 |
| JSON-LD `FAQPage` | `faq.html`・実行時生成 | `i18n.js` の `applyFaqJsonLd` が、読み込んだ辞書の `faq_q<N>`/`faq_a<N>` から組み立てる。**`faq.html` に直接書き写さないこと** — `data/i18n/` との二重管理になり黙って食い違う。`faq_q<N>` が欠けた時点でループを止めるので、FAQ のキー番号は連番を保つこと。 |

Google は `FAQPage` のリッチリザルトを政府・医療などの権威あるサイトに限定しているため、
このマークアップがリッチリザルトとして表示される可能性は低いです。
それでも構造化データとしては正当かつ正確で、維持コストもないため残しています。

---

## CSS デザイントークン

`css/style.css` の `:root` で定義されています。テーマは「黒板・学校」モチーフです。

| 変数 | 色・用途 |
|---|---|
| `--primary` | #2e5c3a（黒板グリーン） |
| `--accent` | #d4aa30（チョークイエロー） |
| `--for-color` | #2a7a46（賛成：明るい緑） |
| `--against-color` | #b83228（反対：チョークレッド） |
| `--neutral-color` | #587595（中立：スレートブルー。白背景上 4.54:1 で WCAG AA） |

FOUC（翻訳適用前の一瞬の日本語表示）は、`js/i18n.js` が `<html>` に `.i18n-ready` を付与するまで `body` を非表示にすることで防止しています。

---

## files.txt

全サイトファイルの人間向けインデックス（説明付き）。
ファイルを追加・削除したときは手動で更新してください。
