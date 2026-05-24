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

許可されている外部 URL は `.../303/index.html` の公式市ページのみです。
PDF の直リンクやサブページは禁止されています。

```bash
grep -rn "city\.komaki\.aichi\.jp" *.html js/*.js \
  | grep -v "303/index\.html"
# 出力があれば違反。許可 URL に差し替えること。
```

### 2. i18n JSON 内のアポストロフィエスケープ確認

JSON 文字列値内にエスケープされていない `'` があると、全言語の翻訳が壊れます。

```bash
python3 -c "
import json
with open('data/i18n/ja.json', encoding='utf-8') as f:
    data = json.load(f)
print('ja.json OK')
"
# 編集した言語ファイルすべてで実行する。
# パースエラーが出た場合はアポストロフィを \' に修正すること。
```

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

`js/i18n.js` は実行時に該当ファイルを非同期フェッチし、
`Object.assign({}, ja_dict, lang_dict)` で日本語ベースにマージします。
**日本語以外のファイルにキーがなければ自動的に日本語にフォールバック**されます。
新しいキーを追加するときの最低要件は `ja` と `en` への記載です。

### こどもむけモード（ja-kids.json）

`data/i18n/ja-kids.json` は「こどもむけ」トグルが ON のとき（日本語のみ）、
`ja.json` の上にマージされ、キーをひらがな・やさしい日本語に上書きします。
`Object.assign({}, ja_dict, kids_dict)` の形で適用されます。

言語設定とこどもむけ状態は `localStorage` の `komaki_lang` / `komaki_kids` に保存されます。

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

- **トルコ語（`tr`）は現在無効。**
  `i18n.js` の `LANGS` に `tr` は含まれていない。
  構文検証済みの完全な翻訳ブロックなしに追加しないこと。

---

## data/news.json と GitHub Actions

`data/news.json` は GitHub Actions（`.github/workflows/fetch-news.yml`）が
毎日 09:00 JST に自動更新します。

スクリプト（`.github/scripts/fetch_news.py`）は以下を行います：
1. 市公式の2つのインデックスページをスクレイピング
2. 各ページの更新日を取得
3. 直近 30 日以内に更新されたものだけを `items` に格納
4. 変更があれば `[skip ci]` コミットで自動プッシュ

手動実行は GitHub → Actions → "Fetch Official News" → Run workflow。
`items` は次回実行で上書きされるため手動編集不可。`window_days` と `source_url` は編集可。

---

## js/main.js の構成

独立した IIFE ブロックで以下の機能を実装しています：

| ブロック | 機能 |
|---|---|
| HAMBURGER NAV | ハンバーガーメニューの開閉 |
| ACTIVE NAV LINK | 現在ページのナビリンクを `.active` でハイライト |
| AUTO DATE STATUS | `data-event-date` を過ぎた項目に `.done` クラスを付与 |
| UPCOMING SCHEDULE EXPIRY | `data-expires` を過ぎた直近スケジュール項目を非表示 |
| FAQ ACCORDION | FAQ のアコーディオン開閉 |
| VOICE FILTER | 賛否の声のカテゴリフィルター |
| OFFICIAL NEWS | `data/news.json` を取得して公式お知らせを描画 |
| CALENDAR | `schedule.html` のインタラクティブカレンダー（イベントは `events` オブジェクトにハードコード） |

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
</main>
<footer>
  ...
</footer>
<script src="js/i18n.js">
<script src="js/main.js">
```

ページ間で共有テンプレートや SSI は使用していないため、新規ページ追加時は既存ページからヘッダ・フッターブロックをまるごとコピーしてください。

---

## CSS デザイントークン

`css/style.css` の `:root` で定義されています。テーマは「黒板・学校」モチーフです。

| 変数 | 色・用途 |
|---|---|
| `--primary` | #2e5c3a（黒板グリーン） |
| `--accent` | #d4aa30（チョークイエロー） |
| `--for-color` | #2a7a46（賛成：明るい緑） |
| `--against-color` | #b83228（反対：チョークレッド） |
| `--neutral-color` | #5a7898（中立：スレートブルー） |

FOUC（翻訳適用前の一瞬の日本語表示）は、`js/i18n.js` が `<html>` に `.i18n-ready` を付与するまで `body` を非表示にすることで防止しています。

---

## files.txt

全サイトファイルの人間向けインデックス（説明付き）。
ファイルを追加・削除したときは手動で更新してください。
