# 小牧市東部（篠岡地区）学校再編計画 市民情報サイト

> **このサイトは市民有志による情報提供サイトです。小牧市の公式サイトではありません。**
> 公式情報は [小牧市教育委員会のページ](https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/index.html) をご確認ください。

## サイト概要

令和9年度（2027年度）実施予定の小牧市東部（篠岡地区）学校再編計画について、公式情報をもとにわかりやすく解説する市民情報サイトです。

- **対象地区**: 小牧市東部（篠岡地区）
- **再編内容**: 小学校5校・中学校3校 → 東西各2校（しのおか学園）
- **実施予定**: 令和9年度（2027年度）
- **公開URL**: https://komaki-east-school-reorg.github.io/

## ページ構成

| ページ | 内容 |
|---|---|
| index.html | トップページ。計画概要・現在の状況・スケジュール |
| about.html | 計画の背景・目的・対象校・新校名 |
| schedule.html | タイムライン・月別カレンダー・イベント一覧 |
| council.html | 市議会での審議内容 |
| community.html | 地域協議会・区長会への報告と住民意見 |
| voices.html | 賛成・反対・中立の住民意見（カード形式） |
| faq.html | よくある質問と回答 |
| bus.html | スクールバスの運行予定・費用 |
| map.html | 各学校の位置マップ |
| nationwide.html | 全国の学校再編の動き（文科省統計・国の基準） |

## 対応言語

**全訳済み（10言語）**: 日本語 / English / Português / Tiếng Việt / Filipino / Español / 中文 / Bahasa Indonesia / Türkçe / မြန်မာ
10言語すべてが全訳済みです（2026-08-13 にトルコ語・ビルマ語が全訳に到達）。新しいキーを追加した直後など、未訳が生じた場合は英語→日本語の順にフォールバックします。

日本語版のみ「こどもむけ」モード（ひらがな・やさしい言葉）に切り替え可能です。

## ローカルで動かす

ビルドステップは不要です。

```bash
python3 -m http.server 8000
# http://localhost:8000/ をブラウザで開く
```

## コンテンツの更新・修正

詳細は [CONTRIBUTING.txt](CONTRIBUTING.txt) を参照してください。主なルール：

1. **外部リンクは公式市ページの2つのインデックスのみ** — 学校再編 `.../kyoiku/kyouikusoumu/303/index.html`（サイト全体）と地域協議会 `.../kenkouikigai/sasaeai/3/3_2/index.html`（community.html のみ）。それ以外の city.komaki.aichi.jp URL は禁止。別枠として、再編対象8校のホームページ（`komaki-aic.ed.jp`）、報道コーナーが出典として張る中日新聞Web の記事（`chunichi.co.jp`）、nationwide.html が出典として張る文部科学省の4つの資料ページ（`mext.go.jp`）、community.html「地域の取組」が発信元として張る市民有志の許可アカウント（`instagram.com`）、そして全ページ下部の共有ボタンの送り先（LINE・X・Facebook・はてなブックマーク・Threads・Bluesky・Reddit・Mastodon／はてなスター）は可。いずれも `auto_gates.py` が機械検査する
2. **翻訳ファイルの構文** — `data/i18n/*.json` はコミット前に全ファイルを JSON パースして確認（アポストロフィのエスケープは不要。`\'` と書くと逆に壊れる）
3. **新しい翻訳キー** — `ja`（日本語）と `en`（英語）への記載が必須。他の言語は未記載でも英語→日本語の順にフォールバック
4. **事実確認** — 掲載する数値・日付は必ず公式情報源に基づく
5. **年表は時系列に並べる** — `index.html`「現在の状況」と `schedule.html`「主要イベント一覧」は全項目に `data-start="YYYY-MM-DD"`（開始日）を付け、見出しごとに昇順で書く。末尾に足さず日付の位置に差し込む

## 自動更新（現在日付・最終更新の反映）

サイトには現在日付に応じて自動で表示が変わる箇所があります（手動更新は不要）。

| 箇所 | 更新タイミング |
|---|---|
| `data/news.json`（公式お知らせ） | 毎日 07:17 JST（GitHub Actions）。手動実行は GitHub → Actions → "Fetch Official News" → Run workflow |
| 「最終更新: 〜」表示（index 現在の状況・schedule 主要イベント一覧） | サイトを再デプロイ（push）するたび（配信ファイルの最終更新日＝デプロイ日を表示） |
| 月別カレンダーの初期表示月（schedule.html） | ページを開くたび（閲覧者の現在月を表示） |
| 「現在の状況」の完了表示・イベント状態バッジ（完了/進行中/予定） | ページを開くたび（予定日を過ぎると自動的に「完了」へ） |
| トップページ「今後のスケジュール」バーの各項目 | ページを開くたび（予定日を過ぎた項目から自動的に非表示。直近の個別日程を表示） |

スケジュールやイベントを追加・編集する際の運用ルールは [CONTRIBUTING.txt](CONTRIBUTING.txt) の【ルール5】（`data-event-date` などの日付属性）と【ルール7】（`data-start` による時系列の並べ方）を参照してください。

## 開発者向けドキュメント

- [CLAUDE.md](CLAUDE.md) — Claude Code 向けガイド（英語）
- [CLAUDE_ja.md](CLAUDE_ja.md) — CLAUDE.md の日本語説明
- [CONTRIBUTING.txt](CONTRIBUTING.txt) — コンテンツ管理ルール
- [files.txt](files.txt) — ファイル一覧と説明
