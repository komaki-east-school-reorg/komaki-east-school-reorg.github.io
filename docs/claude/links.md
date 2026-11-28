# 許可する外部リンクの詳細

> `CLAUDE.md` から移した詳細（2026-11-28）。この作業をするときに読む。要点と禁止事項は `CLAUDE.md` にある。

**1. Illegal external links** — exactly **thirty-eight** city URLs are permitted: five index pages, plus article pages that the user explicitly allowed (2026-09-27, 2026-10-26, 2026-10-31, 2026-11-15, 2026-11-22; 29 of them are legacy-card sources, listed under the table and at the end of this file). The authoritative list is `PERMITTED_LINKS` in `auto_gates.py`; the grep below shows only the first fourteen, so rely on check 6 for the rest. No PDF direct links, no other article subpages.

| Permitted URL | Used by |
|---|---|
| `.../kyoiku/kyouikusoumu/303/index.html` | school reorganization (Education General Affairs Div.) — site-wide |
| `.../kenkouikigai/sasaeai/3/3_2/index.html` | community councils (Mutual Support Div.) — `community.html` only |
| `.../toubumachidukuri/tobumachidukurisingikai/index.html` | eastern-district development (Eastern District Office) — the 出典 line of the 地域の取組 corner, built in `js/main.js` (added 2026-09-13 on the user's say-so) |
| `.../tobumachidukurisingikai/toubumatidukurinyu-su/purattofo-mu/38222.html` | 東部まちづくりプラットフォームの説明 — `community.html` `#platform` **only** (added 2026-09-27 on the user's instruction; the one article page allowed). The same block links the city's registration form `logoform.jp/form/uSYk/80018`, also `community.html` only. Both are pinned by `CITY_PAGE_ONLY` / `PERMITTED_FORM_LINKS` in `auto_gates.py` |
| `.../toshiseisakubu/toshikeikaku/1/index.html` | city planning (Urban Planning Division) — the 出典 line of the 都市計画の動き（東部地域） corner on `community.html#toshikeikaku` (review.html → analysis.html on 2026-10-31 → community.html on 2026-11-07), built in `js/main.js` (added 2026-10-17 on the user's say-so; confined to `community.html` / `js/main.js` by `CITY_PAGE_ONLY`). Matched with its `index.html` suffix, so the lower indexes and article pages under it stay forbidden |
| `.../shigikai/index.html` | Komaki City Council top page — `council.html` only, in the 市議会の公式ページ line under the 出典 box (added 2026-10-26 on the user's instruction; `CITY_PAGE_ONLY`). The pages under it (会議録, PDFs) stay forbidden |
| `.../shigikai/houkoku/43556.html` | 市議会だより (the council newsletter page) — `council.html` only, same line (added 2026-10-26 on the user's instruction; `CITY_PAGE_ONLY`). The newsletter PDFs it lists stay forbidden |
| `.../kyoiku/bunkazai/52305.html` | こまき歴史発見館 (the city's history museum on Lapio 4F, Cultural Properties Division) — `community.html` (#legacy) and `analysis.html` (#rev-legacy) only, linked from the museum's name in the 大山廃寺 / 古窯 cards and proposal 8 (added 2026-10-31 on the user's instruction; `CITY_PAGE_ONLY`) |
| `.../shisei/jyohokokai/kaigikoukai/4/53024.html` | 令和8年度第3回 東部まちづくり審議会の会議資料のページ — `community.html` `#tobu-kousou` の出典行 **only** (added 2026-11-15 on the user's instruction; `CITY_PAGE_ONLY`). The PDFs attached to it stay forbidden |

**地域のレガシーのカードの出典（2026-11-22 ユーザー指示、community.html だけ）：市の5ページ shiteibunkazai/1/9109.html・midokoro/kankou/2/10630.html・shiteibunkazai/4/9128.html・sisetuunnei/2_1/3492.html・dragons/51869.html と、komakici.jp・dragons.jp・www.kashiwabara.co.jp・www.blue-style.com・komaki2.jp の各1〜2ページ（`LEGACY_SOURCES`）。PDF へは今までどおり直リンクしない。**

```bash
grep -rn "city\.komaki\.aichi\.jp" *.html js/*.js \
  | grep -v -e "303/index\.html" -e "sasaeai/3/3_2/index\.html" \
           -e "tobumachidukurisingikai/index\.html" -e "purattofo-mu/38222\.html" \
           -e "toshikeikaku/1/index\.html" -e "jp/shigikai/index\.html" \
           -e "shigikai/houkoku/43556\.html" -e "kyoiku/bunkazai/52305\.html" \
           -e "kaigikoukai/4/53024\.html" \
           -e "shiteibunkazai/1/9109\.html" -e "midokoro/kankou/2/10630\.html" \
           -e "shiteibunkazai/4/9128\.html" -e "sisetuunnei/2_1/3492\.html" -e "dragons/51869\.html"
# Any output = violation. Replace with one of the permitted URLs.
```

The same URLs are encoded in `PERMITTED_LINKS` (and `CITY_PATHS`) in `.github/scripts/auto_gates.py` — keep them in sync. The third one is matched with its `index.html` suffix on purpose, so the pages **under** it (`.../tobumachidukurisingikai/34277.html`, `.../toubumatidukurinyu-su/index.html`) stay forbidden. Adding another requires updating this file, `CONTRIBUTING.txt` rule 1, `README.md`, and that gate together.

**Headline links in the automatic lists (2026-11-27, user's instruction).** The headings of the 地域協議会のイベント, 東部まちづくりの動き, 都市計画の動き（東部地域）, 小牧市のほかの地区 and 春日井市 lists link straight to the official page each item came from — **only `.html` pages under** `…/kenkouikigai/sasaeai/3/3_2/` (`data/community_events.json`), `…/toubumachidukuri/tobumachidukurisingikai/` (`data/tobu_actions.json`), `…/toshiseisakubu/toshikeikaku/1/` (`data/toshikeikaku_east.json`), `…/kyoiku/kyouikusoumu/303/719/` (`data/nearby_komaki.json`) and Kasugai's `/kosodate/kyouiku/school/1009208/` (`data/kasugai_reorg.json`); never a PDF. The URL lives **only in the generated JSON's `url`** (the generators read it from line 1 of the snapshot — no extra HTTP), never in HTML, a dictionary or `js/main.js`, which draws it through `window.KomakiTitleLink()`. The scope is one table, `ARTICLE_SCOPES` in `.github/scripts/official_links.py`, used by the generators (`article_url()`) and by `auto_gates.py` check 6b. The same `url` makes the matching headings link on `schedule.html` (the auto-added 協議会・桃花台を考える会・都市計画 items — hand-written items stay unlinked) and in 地域の取組 (the 桃花台を考える会 items link to their 協働提案事業 page, the council items to their article; the hand-maintained items' heading links to the 発信元 `source_url`, the 発信元 line and the mark stay).

**Kasugai City (2026-11-07, user's instruction):** one more government page, outside the nine above — `https://www.city.kasugai.lg.jp/kosodate/kyouiku/school/1009208/index.html` (春日井市「小中学校の適正規模等について」), confined to `about.html` / `js/main.js` (the 出典 line of the Kasugai list in `#nearby`, 「ほかの地区や、となりのまちでは？」) by `KASUGAI_PATHS` / `KASUGAI_PAGES` in `auto_gates.py`. The pages under it and its PDFs stay forbidden.

Several other domains are permitted and are outside this grep. The **eight target schools' own homepages** (`komaki-aic.ed.jp/<slug>/`) may be linked: they are a different domain run by the schools, and the URLs are stable. They appear in `map.html` (the 各校ホームページ block) and, via `data/school_news.json`, in the bottom section of `index.html`. The grep above does not cover them — when the set of schools changes, keep `SCHOOLS` in `fetch_schools.py` and the `map.html` block in sync. And **five MEXT pages** (`mext.go.jp`) are linked from `nationwide.html` only, as the sources for the nationwide figures and the national standards — see that page's section below. And **five Instagram accounts** — three resident-run (`instagram.com/arigato.ohshirosho`, `instagram.com/tokadaidancefestival`, `instagram.com/bamboo_installation_ookusa`) and two of the city's children's centres (`instagram.com/shinookajidoukan`, `instagram.com/warabekan`, added 2026-09-26) — plus `instagram.com/2525marche.komaki` (にこにこマルシェ, organiser of 大にこにこ祭り ニコサイ on 2026-12-05/06, a city-certified 東部地域トライアル活動; added 2026-11-15 on the user's instruction, content passed on by the user) — are linked from the 地域の取組 corner, which appears on `community.html` and — as the same list inside the 最新の動き group — on `index.html` — see `data/community_actions.json` below. One more Instagram account, **`instagram.com/tokadai_komaki`** (桃花台を考える会), is linked from the **PR card** (`aside.pr-card`, the group's member-recruitment poster `img/pr-tokadai-member-xmas.webp` — the Christmas version since 2026-11-18, keys `pr_tk_*`) on `community.html` and `index.html` (under the 地域の取組 list) and `schedule.html` (its own slim section after the event list) — added 2026-11-02 on the user's instruction, **not recorded in the changelog** (user's instruction); keep `pr_tk_note` (「市の募集ではありません」) and the 「PR」 badge. **On phones (≤560px) the badge and `pr_tk_note` come first**, above the heading and the poster, so the card reads as PR from the top (2026-11-05, user's instruction; `.pr-card-body { display: contents }` + `order` in `css/style.css`). The poster carries a date (12/12 定例会 10:00–11:00, 東部市民センター 2F 学習室 — that meeting is also on the schedule, `sched_*48`, since 2026-11-18 at the user's instruction), so replace or remove the card when it passes. **Since 2026-11-07 the card takes itself down**: `aside.pr-card` (and schedule.html's `.pr-section`) carry `data-expires="2026-12-12"`; a dated sentence inside `pr_tk_p` (`data-i18n-html`) can be wrapped in `<span data-until="…">` (the 11/15 音楽まつり one was, until the poster was replaced); DATED TEXT in `js/main.js` hides/removes them the day after (the same idea as NOW BAR, for all of `<main>`). `auto_gates.py` 10b only warns when a `data-expires` has passed — replace the card with the group's next poster, or delete it. The footer's 「参考リンク（住民有志）」 block (the four SNS accounts of 桃花台を考える会【新しいまちづくり】) was **removed on 2026-10-17** on the user's instruction; the footer now carries only 「参考リンク（公式）」. `PERMITTED_SNS` in `auto_gates.py` confines `x.com`, `facebook.com` and `tiktok.com` to the share endpoints (TikTok: nothing at all) and **one more: `facebook.com/city.komaki`** — the city's own Facebook, allowed on 2026-09-24 on the user's instruction so that a 地域の取組 item can link the city post its text relies on (the reader can then read that post themselves). That one **is** a city publication and may be cited; it is only ever the `ref_url` of an entry in `data/community_actions.json`. Finally, the **share buttons** at the bottom of every page point at eight sharing endpoints (`social-plugins.line.me` — `line.me/R/share` on phones, see below —, `x.com/intent/post`, `www.facebook.com/sharer/sharer.php`, `b.hatena.ne.jp/entry/panel/`, `note.com/intent/post` (added 2026-10-06; the official button script `cdn.st-note.com` is **not** loaded), `www.threads.net/intent/post`, `bsky.app/intent/compose`, `www.reddit.com/submit`), at whatever Mastodon server the reader names (`https://<host>/share`), and load one external script (`s.hatena.ne.jp/js/HatenaStar.js`) — see the SHARE BUTTONS section below. Those URLs are built in `js/main.js`, never written into HTML or a dictionary, and are **not sources**: nothing on the site may cite them. Two more (2026-10-24, user's instruction — see 「利用状況の計測・ハッシュタグ・声の窓口」 below): the **GitHub Issue form** `github.com/komaki-east-school-reorg/komaki-east-school-reorg.github.io/issues/new?template=feedback.yml`, linked from `site.html#feedback` only (`PERMITTED_GITHUB`), and its sibling `…/issues/new?template=translation.yml`, linked from `site.html#translation` only (added 2026-11-08), and — not a link — the cookie-free visit counter's endpoint `komaki-saihen.goatcounter.com/count`, written only in the COUNTER block of `js/main.js` (`PERMITTED_COUNTER`).

```bash
grep -rn "mext\.go\.jp" *.html js/*.js data/i18n/*.json \
  | grep -v -e "tekisei/index\.htm" -e "tekisei/1413885_00007\.htm" \
           -e "zyosei/yoyuu_00002\.htm" -e "kihon/1267995\.htm" \
           -e "ikkan/2/1316125\.htm"
# Any output = violation. A hit in any page other than nationwide.html is also a violation.
```

`PERMITTED_MEXT_LINKS` and `MEXT_PAGES` in `auto_gates.py` enforce both halves of that rule, and the link check now also scans `data/i18n/*.json` — for non-Japanese readers the link that actually renders comes from the dictionary, not from the HTML.


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
