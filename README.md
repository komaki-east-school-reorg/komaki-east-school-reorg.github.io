# 小牧市東部（篠岡地区）学校再編ナビ｜桃花台エリアの非公式でもわかりやすい地域情報メディア

> **このサイトは住民有志による情報提供サイトです。小牧市の公式サイトではありません。**
> 公式情報は [小牧市教育委員会のページ](https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/index.html) をご確認ください。

## サイト概要

令和9年度（2027年度）実施予定の小牧市東部（篠岡地区）学校再編計画について、公式情報をもとにわかりやすく解説する、桃花台エリアの非公式の地域情報メディアです。

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
| faq.html | よくある質問と賛否の声（Q&A・賛成反対中立の声・パブリックコメントの論点） |
| bus.html | スクールバスの運行予定・費用 |
| clubs.html | 校区内の地域クラブ・課外活動と各校の部活動（部活動の地域移行の説明つき） |
| map.html | 各学校の位置マップ |
| nationwide.html | 全国の学校再編の動き（文科省統計・国の基準） |
| review.html | 計画の検証と提案（要点）。検証の核心10項目と、教育の質・東部の子どもを増やすための提案10項目。各項目から深掘りの根拠へリンク（当サイトの見解を含む） |
| analysis.html | 深掘り検証。教育の質・施策の検証・子どもを増やす提案・高校段階（当サイトの見解を含む） |
| site.html | このサイトについて。紹介用画像・アプリ・フィード（RSS）・広め方・ご意見の送り先・閲覧数の集計 |

## 対応言語

**全訳済み（12言語）**: 日本語 / English / Português / Tiếng Việt / Filipino / Español / 中文 / Bahasa Indonesia / 한국어 / नेपाली / Türkçe / မြန်မာ
12言語すべてが全訳済みです（2026-08-13 にトルコ語・ビルマ語、2026-09-18 に韓国語・ネパール語が全訳に到達）。新しいキーを追加した直後など、未訳が生じた場合は英語→日本語の順にフォールバックします。

ポルトガル語はブラジル、スペイン語は中南米、中国語は中国大陸（簡体字）の語にそろえています。自動取得した見出しの翻訳も同じ基準です。

日本語版のみ「こどもむけ」モード（ひらがな・やさしい言葉）に切り替え可能です。

## ローカルで動かす

ビルドステップは不要です。

```bash
python3 -m http.server 8000
# http://localhost:8000/ をブラウザで開く
```

## コンテンツの更新・修正

詳細は [CONTRIBUTING.txt](CONTRIBUTING.txt) を参照してください。主なルール：

1. **外部リンクは公式市ページの38のURLのみ** — 学校再編 `.../kyoiku/kyouikusoumu/303/index.html`（サイト全体）、地域協議会 `.../kenkouikigai/sasaeai/3/3_2/index.html`（community.html のみ）、東部まちづくり `.../toubumachidukuri/tobumachidukurisingikai/index.html`（「地域の取組」欄の出典）、東部まちづくりプラットフォームの説明 `.../purattofo-mu/38222.html`（community.html の #platform のみ。同じ節で登録フォーム `logoform.jp/form/uSYk/80018` にもリンク）、都市計画 `.../toshiseisakubu/toshikeikaku/1/index.html`（community.html「都市計画の動き（東部地域）」の出典のみ）、市議会のトップ `https://www.city.komaki.aichi.jp/shigikai/index.html` と市議会だより `.../shigikai/houkoku/43556.html`（council.html の出典欄の下のみ）、こまき歴史発見館 `.../kyoiku/bunkazai/52305.html`（community.html の「地域のレガシー」と analysis.html の「既存校のレガシーを引き継ぐ」のみ）、令和8年度第3回 東部まちづくり審議会の会議資料のページ `.../jyohokokai/kaigikoukai/4/53024.html`（community.html「東部振興構想の見直しと桃花台の土地利用」の出典のみ）。それ以外の city.komaki.aichi.jp URL は禁止。別枠として、春日井市「小中学校の適正規模等について」の索引 `https://www.city.kasugai.lg.jp/kosodate/kyouiku/school/1009208/index.html`（about.html「ほかの地区や、となりのまちでは？」の出典のみ）、再編対象8校のホームページ（`komaki-aic.ed.jp`）、nationwide.html が出典として張る文部科学省の5つの資料ページ（`mext.go.jp`）、「地域の取組」（community.html と、同じ一覧を出す index.html）が発信元として張る住民有志の許可アカウント（`instagram.com/arigato.ohshirosho`・`instagram.com/tokadaidancefestival`・`instagram.com/bamboo_installation_ookusa`）と、同じ欄が載せる市の児童館2館のアカウント（`instagram.com/shinookajidoukan`・`instagram.com/warabekan`）、大にこにこ祭り ニコサイの主催者（`instagram.com/2525marche.komaki`、community.html・index.html のみ）、桃花台を考える会の仲間募集の PR（`instagram.com/tokadai_komaki`。community.html・index.html・schedule.html のみ）、「地域の取組」が事実の出どころとして張る小牧市公式Facebookの投稿（`facebook.com/city.komaki`）、「地域の取組」欄の「会場の案内」行にだけ置く会場施設の告知ページ（`peare-toukadai.jp/event_campaign/tokadai-dance-festival/`）、同じ欄の「発信元」行にだけ置くこまき市民文化財団（プラネタリウム）の案内ページ（`www.komaki-bunka.or.jp/planet/news/3579.html`、秋の「星を見る会」）、site.html#feedback の GitHub Issue フォーム（`github.com/komaki-east-school-reorg/komaki-east-school-reorg.github.io/issues/new?template=feedback.yml`）と翻訳の修正提案の Issue フォーム（`…/issues/new?template=translation.yml`、`site.html#translation` だけ）、そして全ページ下部の共有ボタンの送り先（LINE・X・Facebook・はてなブックマーク・note・Threads・Bluesky・Reddit・Mastodon／はてなスター。スマートフォンではアプリが入っていればアプリを開く）は可。いずれも `auto_gates.py` が機械検査する。リンクではないが、Cookie なしの閲覧数の集計の送り先 `komaki-saihen.goatcounter.com/count`（js/main.js の COUNTER のみ。外部スクリプトは読まない）も同じく検査している
   地域のレガシーのカードの出典（2026-11-22 ユーザー指示、community.html だけ）：市の5ページ shiteibunkazai/1/9109.html・midokoro/kankou/2/10630.html・shiteibunkazai/4/9128.html・sisetuunnei/2_1/3492.html・dragons/51869.html と、komakici.jp・dragons.jp・www.kashiwabara.co.jp・www.blue-style.com・komaki2.jp の各1〜2ページ（`LEGACY_SOURCES`）。PDF へは今までどおり直リンクしない。
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
| `data/tobu_actions.json`（東部まちづくりの取組） | 毎日（GitHub Actions）。市の東部まちづくりのページのスナップショットから組み立て、「地域の取組」欄の下半分に表示 |
| `data/child_estimate.json`（東部地域の0〜17歳・当サイトの推定） | 毎日（GitHub Actions）。市の人口統計に新しい表が出たときだけ取り込み、係数を作り直す。表示する数字はブラウザが閲覧日に計算するので毎日変わる |
| `data/toshikeikaku_east.json`（都市計画の動き・東部地域） | 毎日（GitHub Actions）。市の都市計画課のページのスナップショットから東部の地名があるものを新しい順に5件組み立て、analysis.html に表示 |
| 市・県・国の担当部署の連絡先 | 毎週月曜 6:50 JST に公表ページと照合（GitHub Actions "Check Department Contacts"）。電話番号の変更は自動修正、部署名の変更は Issue で通知 |

スケジュールやイベントを追加・編集する際の運用ルールは [CONTRIBUTING.txt](CONTRIBUTING.txt) の【ルール5】（`data-event-date` などの日付属性）と【ルール7】（`data-start` による時系列の並べ方）を参照してください。

## 開発者向けドキュメント

- [CLAUDE.md](CLAUDE.md) — Claude Code 向けガイド（英語）
- [CLAUDE_ja.md](CLAUDE_ja.md) — CLAUDE.md の日本語説明
- [CONTRIBUTING.txt](CONTRIBUTING.txt) — コンテンツ管理ルール
- [files.txt](files.txt) — ファイル一覧と説明


**地域のレガシーの各カードの出典（2026-11-22 ユーザー指示。community.html だけ）で追加した市のページ：**
- `event_1/midokoro/shiminshikinomori/16376.html`
- `event_1/midokoro/shiminshikinomori/16809.html`
- `soshiki/kyoiku/bunkazai/1_1/2/bunkazai/shiteibunkazai/2/9116.html`
- `soshiki/kyoiku/bunkazai/1_1/2/bunkazai/shiteibunkazai/3/9118.html`
- `soshiki/kyoiku/bunkazai/1_1/2/bunkazai/shiteibunkazai/4/9137.html`
- `soshiki/kyoiku/bunkazai/1_1/2/bunkazai/shiteibunkazai/4/9146.html`
- `soshiki/kyoiku/kyouikusoumu/303/52402.html`
- `soshiki/toshiseisakubu/kouen/1/8/1/35746.html`
- `soshiki/toshiseisakubu/kouen/1/8/1/tikukouen/22276.html`
- `soshiki/toshiseisakubu/toshikeikaku/1/1_1/toshikeikan/5901.html`
- `soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/46417.html`
- `soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/toubumatidukurinyu-su/35668.html`
- `soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/toubumatidukurinyu-su/45200.html`
- `soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/toubumatidukurinyu-su/51859.html`
- `soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/toubumatidukurinyu-su/kyoudouteianjigyou/index.html`
- `soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/toubumatidukurinyu-su/purattofo-mu/machidukurisemina/46283.html`
- `soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/toubumatidukurinyu-su/purattofo-mu/trial/reiwa4nendo/39361.html`
- `soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/toubumatidukurinyu-su/purattofo-mu/trial/reiwa4nendo/39418.html`
- `soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/toubumatidukurinyu-su/purattofo-mu/trial/reiwa5nendo/43097.html`
- `soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/toubumatidukurinyu-su/purattofo-mu/trial/reiwa6nendo/45800.html`
- `soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/toubumatidukurinyu-su/purattofo-mu/trial/reiwa6nendo/45889.html`
- `soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/toubumatidukurinyu-su/purattofo-mu/trial/reiwa6nendo/46053.html`
- `soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/toubumatidukurinyu-su/purattofo-mu/trial/reiwa6nendo/48386.html`
ほかに愛知県2ページ（旧桃花台線・風景群リスト）と葵エンジニアリング「地名の由来」9ページ（`LEGACY_SOURCES`）。PDF へは直リンクしない。新篠岡音頭の出典は YouTube の音源1本だけ（`https://www.youtube.com/watch?v=h_WC-X5YbuE`、2026-11-22 ユーザー指示。`YOUTUBE_LEGACY`、community.html だけ）。作詞・作曲者や歌い手の名前は書かない。

- `kyoiku/bunkazai/1_1/2/bunkazai/shiteibunkazai/1/9103.html`（`shiteibunkazai/1/9103.html`、篠岡古窯跡群）と、国立国会図書館サーチの1件 `ndlsearch.ndl.go.jp/books/R100000001-I23111100253640`（『篠岡古窯址群』、昭和46〜47年。古窯のカードの出典、community.html だけ）。
