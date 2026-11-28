# 各ページの決まり（faq・clubs・nationwide・shinooka・about ほか）

> `CLAUDE.md` から移した詳細（2026-11-28）。この作業をするときに読む。要点と禁止事項は `CLAUDE.md` にある。

## `about.html#nearby`（「ほかの地区や、となりのまちでは？」＝近隣他地区の状況）— 随時更新

2026-11-07 追加（ユーザー指示：「篠岡地区以外の小牧市の他地区と春日井市の内容を『近隣他地区の状況』としてまとめる」「随時更新されるように」）。計画概要の「ことばメモ」の次（`#contact` の前）。見出しは 2026-11-07 にユーザー指示で親しみやすい疑問形「ほかの地区や、となりのまちでは？」に変え、ことばメモの下へ移した（id `nearby` は据え置き）。**篠岡地区の計画とは別の計画**であることをリードで断り、**公表された事実だけ**を書く（🔎 は書かない）。

- **手書きの説明（13辞書、`about_nb_*`）＋自動の一覧2つ**。説明の上に時点 `about_nearby_asof`（「2026年11月時点」）。**動きがあったら説明と時点を直す**（`now_text` と同じ「随時更新」の扱い）。合図は2つの Issue：小牧市側は「📡 公式ページ更新検知」（`site-facts.json` の `303-719-kitazatochiku-` → `about_nearby`）、春日井市側は「🏫 春日井市 学校再編ページ更新検知」。about.html は自動更新ジョブの `ALLOWED` 外なので**人が直す**。
- **小牧市のほかの地区**：北里地区（考える会・方向性（案）＝3校を1校に、北里小・中の敷地に小中一貫校を前提）、巾下地区・小牧／小牧南／味岡地区（『新たな学校づくり推進計画』の地区別の記述）。出典は推進計画のページ（`303-718-45169`）と考える会の資料（`data/official_pages/kitazato/`、`fetch_pdf_docs.py` の `kitazato` 群）。一覧は `data/nearby_komaki.json`（`build_nearby_komaki.py` が `303-719-<地区>-*` のスナップショットから作る。篠岡と全市の検討委員会は除く。**市が新しい地区のフォルダを作れば自動で出る**。地区名は `DISTRICTS` と `js/main.js` の NEARBY KOMAKI の `DIST` に足す）。check 14b が古さを止める。
- **春日井市**：坂下中学校区（基本方針 令和8年6月、小学校3校を統合、坂下中の敷地に小中一貫校、令和15〜16年度開校目標）、高蔵寺ニュータウン地区（中間案、2地区に分けて検討、パブコメ23人44件）。取得は `.github/scripts/fetch_kasugai.py`（索引と配下約25ページを毎日、3〜5秒あけて。春日井市も小牧市と同じ Cookie 必須の WAF なので `fetch_news._curl_get` を使う）。スナップショットは `data/official_pages/kasugai/`（サブディレクトリなので fetch_news の剪定の対象外）、添付 PDF は `fetch_pdf_docs.py --only=kasugai`（全編・通信・中間案）→ `kasugai/pdf/`。一覧は `data/kasugai_reorg.json`（更新日の新しい5件、地区の札は索引の見出しから）。**小牧の検知・自動更新には混ぜない**：`fetch-news.yml` で単独コミット（`chore: update Kasugai school reorganization watch`）、メインの `git add` は `':!data/official_pages/kasugai'` で除外。FETCH STATUS の取得元 `kasugai`。
- **両一覧の見出しは元の公式ページへ直リンクする**（2026-11-27 ユーザー指示。`url` は `build_nearby_komaki.py`・`fetch_kasugai.py` が書く。範囲は `official_links.py`）。
- 見出しの訳は `headline_i18n.py` の `current_headlines()`（両一覧）。春日井市の地名のローマ字は `term_rules.json` と `translate-headlines.yml` に固定（Kozoji New Town / Sakashita / Fujiyamadai / Iwanaridai / Takamoridai / Ishiodai）。読みが公表資料で確かめられない名前（巾下・三ツ渕・村中・小木・神屋など）は、外国語では漢字を括弧で添えるか学校名を出さない。
- 連絡先：`about.html#contact` に「近隣の市」（`contact_lv_nearby`）として春日井市 教育委員会 学校教育課 新たな学校づくり推進室（`contacts.json` の `kasugai-aratanagakko`、`level: "nearby"`、`probe.match` で照合）。
- 中身を足したら `ql_about_p`・`meta_desc_about` も直す。


## `nationwide.html` (the nationwide context page)

Added 2026-08-22. It answers "is this only happening here?" with MEXT statistics and the standards the national government sets, so that a reader can judge the Komaki plan against something. It is **static hand-written content** — no JSON feed, no script, nothing on the daily workflow.

- **Every fact on it must come from MEXT**, and the five permitted `mext.go.jp` URLs are its bibliography. Numbers currently on the page: 8,850 closures FY2004–FY2023 and 298 in FY2023 (191/82/25), 92 in Aichi (62/14/16), 74.4% of 7,612 surviving buildings reused, ~2,000 fewer public schools and ~850,000 fewer pupils in ten years, standards of 12–18 classes (18–27 for compulsory education schools), 4 km / 6 km, "about one hour", the 2026-08-05 revision (notice 8文科初第1125号) and its 広域化 / 総合化 / 現代化 pillars, ~40% / ~50% below 12 classes, ~16% one-elementary-one-JHS municipalities, 5,812,000 / 3,105,000 pupils, 232 public compulsory education schools with 75,828 pupils (FY2024); and, in the 中高一貫 section added 2026-09-26 on the user's instruction, 678 combined junior–senior high schools in FY2023 — 中等教育学校 57 (4/35/18), 併設型 537 (1/105/431), 連携型 84 (0/79/5), system started April 1999 (MEXT「中高一貫教育の概要と設置状況」, the 5th permitted link, plus the 高等学校教育の在り方WG 参考資料5 of 2024-09-12, cited in text only).
- **No 賛否 content, and no resident-run events.** The page deliberately carries no pro/con framing — that belongs in the 賛否の声 section of `faq.html` — and does not advertise meetings or lectures held by any group, whichever side they are on. A neutral-looking national page is the easiest place on this site to smuggle in a position, so keep it descriptive.
- **Class size and teacher numbers (added 2026-10-24)**: the comparison table also has rows for the maximum class size (elementary 35; junior high also 35 under Act No. 7 of 2026, phased in until FY2027 by the supplementary provisions) and teacher numbers (calculated from the number of classes, Art. 7). These cite the Act on Standards for Class Formation and Staff Numbers in text — a national law administered by MEXT — with no new link. The same 2026 amendment is reflected in `rev_n4_f`, `rev_k4_f`, `about_learn_c2_p` and `faq_a25`; if the phase-in changes, change all of them.
- The 国の基準 ⇔ 小牧の計画 table is the point of the page. Its right-hand column restates facts that already exist elsewhere on this site (令和15年に各学年1学級, 2km でスクールバス, ガイドラインは未定) — when those change, change them here too.
- The 手引 was revised in August 2026 and will be revised again. When it is, the numeric standards must be re-checked against the new 改訂版 rather than assumed to carry over.
- Not in the auto-update pipeline's `ALLOWED` set: the city's page changes do not move national statistics.
- 末尾に **国の担当部署の連絡先**（`id="contact"`）がある。数値ごとにどの部署の所管かを並べたもので、番号は文科省が各ページで公表しているものだけ。リンクは増やしていない（出典リンクは上の5つのまま）。中高一貫の所管部署はまだ載せていない。詳しくは「担当部署の連絡先」の節を参照。


### ことばメモ（`about.html#glossary`）

2026-09-22 追加。**こどもむけ表示にしても残ってしまう言葉**（学校再編・適正規模・パブリックコメント・地域協議会など9語）を、子どもが自分で確かめられるようにした欄。平易化は文を易しくするが**言葉そのものは残る**ので、読み上げ・こどもむけと合わせて「子どもが一人で読める」ための3つ目にあたる。

- 対象語は **`ja-kids` にも残っている語**を基準に選んだ（`学校再編`・`パブリックコメント`・`地域協議会`・`義務教育学校`・`学区`・`小中一貫` など）。語を足すときも同じ基準で選ぶこと。
- 説明は**当サイトの言葉**で書いたもので、市の資料の文面ではない。ただし中身（数値・時期）は公表資料にもとづく（5小3中→2小2中、12〜18学級、55件、令和8年度など）。**数字を書くときは既にサイトに載っている事実だけを使うこと。**
- キーは `gloss_t_<key>`（語）と `gloss_d_<key>`（説明）。12言語＋こどもむけが要る。
- **本文中の語に印を付ける方式は採っていない。** 本文は `data-i18n` で辞書から流し込まれるので、印を入れると13辞書すべての値を書き換えることになる。実行時に DOM を書き換える案も、「規模」のような部分一致の誤爆と、READ ALOUD のテキスト走査への影響があるため見送った。

## `map.html#town-lookup`（町名から学校を調べる）

2026-11-22 追加（日次アイデア 10/01、閲覧数計画の町名早見）。「再編後の4校の位置」の中。大城小学校区の5町（大草・城山二〜五丁目）だけを、令和9年度からの小中学校に対応づける。根拠は市の `48650` のページの計画図と城山三・四丁目の図（大城小は中学校区で分かれ、大草・三丁目＝東、二・四・五丁目＝西）。**三・四丁目の申請による変更、変更で2kmを超えてもバス対象外、四丁目の光ヶ丘中在籍者の扱いは外さない。** 文字は表（`map_tl_*`、JS 無効でも読める）にあり、TOWN LOOKUP（`js/main.js`）がそこからボタンと結果を作る。選んだ町名は保存も送信もしない。区域が変わったら表とこの節を直す。

## `clubs.html`（地域クラブ・課外活動）

2026-09-22 追加（ユーザー指示）。**部活動の地域移行を見越して、校区内で活動している地域クラブと各校の部活動を1ページに並べる。**ナビは「スクールバス」の次。静的な手書きページで、日次の更新も JSON もない（`nationwide.html` と同じ扱い）。

- **節の順は「部活動の地域移行とは（`#transition`）→ 校区をまたぐ・市内全域（`#wide`）→ 学校ごと（`#schools`）→ このページの情報について（`#clubs-note`）」**（2026-09-22 ユーザー指示で `#wide` を `#schools` の上にした）。背景は `section-alt` → `section` → `section-alt` → `section` の交互。
- **分類は「いまの学校名」で、再編後も永続的にこの分け方を使う**（ユーザー指示）。学校名の中はさらに種目で分ける。活動場所が特定の校区に結びつかないものだけ `#wide` に置く。**近隣市（春日井市など）に拠点があって、この地区から通えるもの**も `#wide` に入れ、場所を明記する（`clubs_s3_lead` がその旨を断っている）。**校区が確認できないものを推測で学校に割り当てないこと。** 光ヶ丘チェリーズは当初、名称に「光ヶ丘」を含むだけでは根拠にならないとして `#wide` に置いていたが、2026-09-22 にユーザーから活動場所が光ヶ丘小学校だと示され、光ヶ丘小学校の欄へ移した。**裏づけが得られたら移す、得られないうちは `#wide` に置く**、という順でよい。
- **出典は「その主体自身の公表」**。地域クラブは各クラブの Instagram・ホームページ、学校の部活動は各校のページと学校日記、教室は小牧市スポーツ協会の公表。2026-09-20 のユーザー指示（行政以外の主体はその主体自身の公表を出典にしてよい）に沿う。**ここに載る情報は、計画の内容・数値・日程の根拠には決して使わない**（報道コーナー・地域の取組と同じ扱い）。
- **部活動の一覧は3中学校とも公表されていない**（2026-09-22 に調査）。光ヶ丘中は部活動ページがあるが理念のみ、篠岡中・桃陵中は専用ページなし。そこで **① 各校の部活動ページ・学校日記へリンクする ② 学校日記などで確認できた部名だけ載せる ③ 網羅的でないと明記する** の3つで扱っている（`clubs_bukatsu_none` / `clubs_bukatsu_partial`）。**部名を推測で補わないこと。**
- **文化系・コンピュータ系も載せる**（2026-09-27 ユーザー指示）。合唱（小牧少年少女合唱団＝小牧市音楽連盟の団体紹介）、プログラミング（エンカレッジ小牧＝所在地は高根2丁目だが、通う子は校区に関係ないので `#wide`〈ユーザー指示。教室・塾のように校区を問わず通うものは所在地で学校に割り当てない〉、パソコンスクールビッツ＝小牧市小牧）。**eスポーツ**は Legame（小牧市岩崎の会社。まなび創造館・勤労センターで地域大会「LegameCup」、オンラインのeスポーツ英会話。ユーザー提示。Instagram は取得せず会社サイトで確認）を `#wide` に載せた。（2026-11-05 に「探したが見つからなかった」旨の注記 `clubs_esports_none` と、`#transition` の「確認できていないこと」の箱は外した。部活動の扱いが未公表であることは `clubs_s1_p2` の1段落に書いてある。）小牧市スポーツ協会の**ジュニア育成活動**（市内の小中学生）は、チラシ PDF の会場表で東部の会場を確かめて学校の欄に置いた（桃陵中武道館の剣道・光ヶ丘中グラウンドのサッカー・光ヶ丘中武道館の合気道）。陶運動場のサッカーは校区が未確認なので `#wide`。部名は3中学校の学校日記「部活動」カテゴリから拾い、あいまいな略称（桃陵中の「ソフト部」）は載せていない。野球は学校日記で「桃花台」の合同チーム名で出場している（`clubs_tokadai_bb`）。
- **国の方針は本文に文字で出典を書き、リンクは張らない**（`clubs_s1_src`）。文科省サイトへのリンクは `nationwide.html` 限定のままで、`review.html` と同じ方式。⚠️ **ドメイン名は HTML コメントにも書かない** — `auto_gates.py` check 6 は文字列で検査するので、コメントであっても違反として止まる（実際に一度止まった）。
- **リンク規則**：Instagram 11アカウントは `PERMITTED_INSTAGRAM` に `("clubs.html",)` 付きで登録。クラブ・団体の公式サイト10ドメイン（`komaki-sports.or.jp` / `acmilansoccerschool-aichi.jp` / `seigakan.net` / `komaki-kendo.jp` / `fc-fervor.net` / `komakishion.com`（小牧市音楽連盟）/ `pc-bitz.jp` / `encourage-toukadai.com` / `legameinc.com` / `white700957.studio.site`（ダンススクールD☆vivace））は `PERMITTED_CLUB_SITES` で `clubs.html` 限定。学校サイト（`komaki-aic.ed.jp`）はもともとゲートの検査対象外。増やすときは `CONTRIBUTING.txt` 規則1・`README.md` も同時に更新すること。
- **クラブ名・学校名・会場名は翻訳しない**（固有名詞。部署名・学校名と同じ扱い）。訳すのは種目（`clubs_sp_*`）・対象（`clubs_tg_*`）・ラベルだけ。種目を増やすときは13辞書に `clubs_sp_<種目>` を足す。
- **学校名の見出し（`.clubs-school-h`）は `section-title sub` に独自クラスを重ねている。** `sub` だけだと節見出し（h2）と同じ見た目になって階層が消える。`sub` は外さないこと（READ ALOUD が `h3.section-title.sub` を対象にしている）。読み上げボタンが帯に食い込まないよう `.section-title.clubs-school-h + .tts-row` で余白を取り直してある — **`.section-title.sub + .tts-row` と詳細度を揃えないと効かない**。

## チェックリストと種目フィルタ（2026-11-13、日次アイデア 9/4・9/25）

- **`bus.html#checklist`「乗り始めるまでのチェックリスト」**（BUS CHECKLIST in `js/main.js`、`#apply` の次の節）。申請受付は 2026-09-30 で締め切られているので、ユーザー決定で中身を「乗り始めるまで」（4項目）＋「家庭で確かめておくこと・毎朝の確認」（6項目）にした。**項目は公表資料で確かめられたものだけ**：だより vol.6、導入スケジュール、保護者等説明会（令和8年6月）の質疑応答と提出された質問への市の回答（`data/official_pages/setsumeikai/`。乗降場所は市が指定・目印は置かない、通学団をもとに集団で移動、乗り遅れてもバスは待たず原則保護者が対応、荷物は膝の上か座席の下、乗車カード、シートベルト）。**まだ決まっていないこと（休む日・運休の連絡の仕組み）は項目にせず、質問集の `rev_o40` に置いた** — 市が公表したら項目に足して問いを外す。項目を足すときも出典を確かめ、当サイトの言葉で書く。印は `localStorage` の `komaki_bus_check`（`data-chk` の配列。この端末だけ）。ラベルの文字は `<label>` の内側の `<span data-i18n>` に付ける（label に付けると input が消える）。進み具合の書式は隠し要素 `[data-chk-fmt]`（`bus_chk_progress`）。`.chk-tools` は読み上げ（`SKIP`）・原文併記（`ORIG_SKIP`）・検索の索引（`SKIP_CLASSES`）から外し、印刷では隠す（項目と印は印刷に出す）。断り書き `bus_chk_note`（市の配布物ではない・端末だけに保存）は外さない。キー `bus_chk_*`、集計は `checklist/check`（最初の1回）・`checklist/reset`（どの項目かは送らない）。**第1期の開校後（2027年4月）は「乗り始めるまで」の4項目を見直す。**
- **`clubs.html` の「種目でしぼる」**（CLUB FILTER in `js/main.js`、`.club-filter`、`#wide` のリードの下。`#wide` と `#schools` の両方に効く）。ボタンは JS がページの種目の札（`.club-sport`、キー `clubs_sp_<種目>`）から作るので、**クラブを足せばボタンも増える**（手で足さない）。ボタンの文字は札の表示中の文字を写し、`komaki:i18n-applied` で付け直す。学校の部活動の行は札を持たないので、**部名が既存の種目に当たるものだけ `data-sports="baseball soccer"` を付ける**（新しい種目は作らない。部活動の行を直したらこの属性も直す）。隠すのは `.is-filtered`（`hidden` は使わない）、空になった `.club-group`・`.club-school` も隠す。印刷では全部出す。キー `clubs_filter_label` / `clubs_filter_all` / `clubs_filter_count`、集計は `clubs/filter`（最初の1回。種目は送らない）。

## `faq.html`（よくある質問と賛否の声）

2026-09-22 に**`voices.html`（賛否の声）を統合**した（ユーザー指示）。もともと「よくある疑問 → 市の答え」と「住民の声」は、`faq_cat4`（意見・参加について）と `voices.html#pubcom` で主題が重なっていた。いまは1ページに3つの節が**この順で**並ぶ。

| 節 | 見出し | 中身 | 性格 |
|---|---|---|---|
| `#qa` | `faq_qa_h`（h2） | よくある質問（`faq_q<N>`。問数は `faq_qa_intro` の「◯問」と合わせる）。カテゴリ4つ（`faq_cat1`〜`4`）は **`h3.section-title.sub`** | 答えが公表されていること |
| `#voices` | `voices_cols_h`（h2） | 賛成・反対・中立の声 18件（3列） | 意見が割れていること。**当サイトによる要約・再構成**で市の見解ではない（`voices_about`） |
| `#pubcom` | `voices_pc_h`（h2） | パブリックコメントの実施結果・論点の横棒グラフ・論点5件・計画が変わったところ | 市が公表した意見と「市の考え方」にもとづく（`voices_pc_note`） |
| `#contact` | `faq_contact_h`（h2） | 教育総務課 学校再編推進係の連絡先 | 他ページの `#contact` と同じ位置づけ |

- **節見出し（h2）の下には必ず説明の1段落を置く**（`faq_qa_intro` / `voices_intro` / `voices_pc_lead`）。他ページと同じ `.section-lead`（`font-size:.95rem` の淡色）で、見出しだけが並んで中身が始まる形にしない（2026-09-22 ユーザー指摘）。`#contact` だけは他ページの `#contact` と同じく説明を置かない。
- **賛否の声の注記（`voices_about`）は見出しの<u>下</u>**。`voices.html` から移したときは見出しの上に来ていて、節が注記から始まっていた。並びは「見出し → 説明（`voices_intro`）→ 注記（`voices_about`）→ 3列」。
- **Q&A のカテゴリ見出しには `faq-cat` クラスが要る。** `section-title sub` だけだと h2 と同じ「左に黄色い帯・緑の太字」になり、すぐ上の `faq_qa_h` と見分けがつかず見出しが二重に見える（同日ユーザー指摘）。`.faq-cat` は左帯を消して下線の小見出しにするもので、その下線に読み上げボタンが食い込まないよう `.section-title.faq-cat + .tts-row` で余白を取り直してある（`.section-title.sub + .tts-row` の負マージンは index の帯用で、下線のある見出しには合わない）。**`sub` は外さないこと** — READ ALOUD が `h2.section-title, h3.section-title.sub` を対象にしているため、外すとカテゴリ単位の読み上げボタンが消える。
- **カテゴリを `h3` にしてあるのは、ページの構成を目次に出すため**（2026-09-22 ユーザー指示で見直し）。統合直後はカテゴリ4つが `h2` のままで、`PAGE TOC`（`main h2.section-title` から自動生成）に「4カテゴリ＋声＋パブコメ」の6つが並び、**3部構成が読み取れなかった**。`h3` に下げて `faq_qa_h` を立てたことで、目次は「よくある質問／賛成・反対・中立の声／パブリックコメント…／市へのお問い合わせ」の4つになる。**読み上げボタンは `h2.section-title, h3.section-title.sub` の両方に付く**ので、カテゴリ単位で読み上げる挙動は変わっていない。
- **`voices_about` は「この欄について」、`voices_pc_lead` は「この欄は」で始める。** どちらも `voices.html` 時代は「このページについて」「ここから下は」だったが、統合後はページ全体の説明にも、節をまたぐ指示にもなってしまう（2026-09-22 ユーザー指摘）。節の注記は**節を指す言葉**で書くこと。
- **パブリックコメントの数は「55名から142件」**（2026-09-24 に訂正）。市の『実施結果概要』は「５５名より計１４２件」で、**55 は人数・142 が件数**。さらに「(参考) 意見提出方法の内訳」の郵送1・メール39・ファックス13・持参2 は**単位が「人」**であって件数ではない。サイトは長く 55 を件数として書いていて、`rev_i5_v`（🔎 当サイトの見方）の「多いとは言えない」という論もその数に乗っていた。**この2つの数を混ぜないこと** — 統計ボックスは「142件・55人・39人・13人・3人」の5枠になっている。
- **論点の横棒グラフ（`.pc-bars`）は市自身の見出しを数えただけのもの。** 市の『提出された意見及び市の考え方』は、回答ごとに `■第１期再編の時期について` のような論点見出しが付いている。その見出しを数えると **143個・53論点**（市の公表は142件）で、上位8つを棒に、残り45論点（計69件）は文で出している。**当サイトが分類したのではない**ので、分類基準を作り直さないこと。数値は `faq.html` に直書き、外部ライブラリは使わない（自動で読む第三者スクリプトを増やさない方針）。棒の長さは最多18を100%とした相対値で、実数は `.pc-bar-n` に必ず併記する。**賛否の色（`--for-color` 等）は使わない** — 「意見が多い＝反対が多い」と読めてしまうため。`voices_pc_themes_note` の「件数は賛成・反対の強さを表さない」も外さないこと。
- 「ほかのページにもＱ＆Ａがあります」（`faq_more_*`）の箱は **`#qa` の末尾**。Q&A の導線なので、問い合わせ先とは別の節に置く。

- **順番と節の区切りを崩さないこと。** 「答えが出ている問い」→「答えが割れている問い」という流れで、背景色も `section-alt` → `section` → `section-alt` → `section` と交互にしてある。声を先に置いたり、Q&A と声を同じ節に混ぜたりすると、**住民の声が市の答えに読めてしまう**。`review.html` の【事実】と 🔎 を版面で分けるのと同じ考え方。
- **`FAQPage` 構造化データに入るのは `#qa` だけ。** `i18n.js` の `applyFaqJsonLd` が `faq_q<N>`/`faq_a<N>` の連番から組み立てる（`pageId === 'faq'` 判定、最初の欠番で止まる）ので、**番号を飛ばさないこと**。声もパブコメも質問でも答えでもないので、構造化データには入れない。
- **キー名は統合前のまま**（`voice_*` / `voices_*` / `col_*` / `pubcom_*` / `stat_*`）。付け替えると12言語＋こどもむけ13辞書の訳をすべて作り直すことになるため、`faq_*` に寄せていない。`voices_` で始まるキーが `faq.html` にあるのは統合の名残で、誤りではない。
- **スマートフォンでは声を列ごとに畳む**（`VOICES COLLAPSE` in `js/main.js`、2026-09-22 ユーザー指示）。Q&A はアコーディオンで畳まれているのに声18枚が開いたままだと、狭い画面では声が本文の大半を占めるため。**PC 幅では件数も ＋/− の記号も外す**（指示は「スマートフォンだけ畳む」であって PC の見た目を変える話ではない）。見出しに足すのは数字と記号だけなので、辞書にキーは増えていない。
  - 畳みは **`display:none`（`.voices-col.is-collapsed .voice-card`）で行う。** `hidden` 属性や `aria-hidden` にすると READ ALOUD の `SKIP` に当たり、畳んだ声が読み上げから丸ごと落ちる。`blocksOf()` の可視判定の例外は `.faq-a, .voice-card` の2つ — **この2つは対で維持すること**。
  - 見出し（`.voices-col-header`）の中身は `i18n.js` が `textContent` ごと書き換えるので、件数と記号は `komaki:i18n-applied` のたびに付け直している。
- **旧 `voices.html` は削除せず、移動案内の1枚として残してある。** GitHub Pages は静的で 301 を返せず、このサイトは共有ボタンを前面に出しているので `voices.html?lang=xx` が LINE などに出回っている。`noindex`、`canonical` は `faq.html`、`meta refresh`（JS 無効時の保険）に加えて、**JS が `?lang=` を引き継いで `faq.html?lang=xx#voices` へ送る**。`sitemap.xml` と `hreflang` からは外し、ヘッダのナビからも外した。`meta_title_voices` / `meta_desc_voices` は移動案内の文言として残っている。
- 他ページからの導線は `faq.html#voices`（`community.html`・`review.html`）と `faq.html#pubcom`（`council.html` の `council_warn_link`）。`council.html` は統合前に faq と voices の両方を「関連するページ」に挙げていたので、3つのうち1つを `review.html`（`rel_council_review`）に差し替えてある。
- **ヘッダとフッタのナビだけは短い名前**（`nav_faq`＝「質問・賛否の声」）で、ページ名（`faq_h1` / `ql_faq_h`＝「よくある質問と賛否の声」）とは**わざと違う**（2026-09-22 ユーザー指示）。ナビは9項目が並ぶ場所なので、正式名をそのまま置くと長すぎる。**`community.html` も同じ例外**：ページ名（`community_h1`）は「地域協議会と地域のまちづくり」、ナビ（`nav_community`）は「地域とまちづくり」（2026-09-27 ユーザー指示。旧名「地域協議会と学校再編」／ナビ「地域協議会」）。**ほかのページは `nav_*` と `h1` が一致している。**中点は全角「・」（サイトの他の表記にそろえる）。
- サイトの Q&A が3か所（`faq.html` / `bus.html#faq` / `community.html#qa`）に分かれている方針は統合後も変わらない。`faq_more_*` の箱がその導線。
- **Q&A の絞り込みと「すべて開く」**（FAQ FILTER in `js/main.js`、2026-11-11。日次アイデアの FAQ まわりの案をまとめたもの）。`faq.html#qa` の説明文の下に入力欄と「すべて開く／すべて閉じる」（`.faq-tools`、見出し・挿絵なし）、`bus.html#faq` には「すべて開く」だけ。絞り込みは画面の文字（質問＋答え）を SITE SEARCH と同じ `norm()` で比べ（`window.KomakiSearch` の `norm` / `load` / `hrefFor` を使い回す）、当てはまらない問いと空になったカテゴリ見出しを `.is-filtered`（`display:none`。`hidden` は使わない）で隠す。一覧の下に、bus・community の Q&A で当てはまるもの（検索の索引から最大8件）。0件なら検索と同じ問い合わせ先の案内。「すべて開く」のあいだは `<html>` に `faq-all-open` が付き、FAQ ACCORDION は押した1問だけを開け閉めする。キー `faq_filter_ph` / `faq_filter_count` / `faq_filter_other` / `faq_open_all` / `faq_close_all`（HTML に書いてあるので `RUNTIME_KEYS` 不要）。**入力欄の例（`faq_filter_ph` の「制服」）は、その言語で実際に当たる語にすること**（最初の案「バス 申請」は0件だった）。`.faq-tools` は読み上げ（`SKIP`）・原文併記（`ORIG_SKIP`）・検索の索引（`SKIP_CLASSES`）から外し、印刷では隠して全問を出す。集計は `faq/filter`（最初の入力の1回）・`faq/open-all` で、入力した語は送らない。タグでの絞り込み・「あとで読み返す」印は採らなかった。

## 教育の質の観点（2026-10-24、サイト全体）

ユーザー指示で、サイト全体を教育の質（学力・人間力・教科ごとの力・生き抜く力・健康）の観点で見直した。**見解は analysis.html（`#rev-quality` / `#rev-skills`。2026-10-30 に review.html から移した）だけ**、事実ページは市・国の公表事実だけ：about.html `#learning`、faq.html q25〜q27、nationwide.html の比較表（1学級の人数・教職員の数）、council.html `#council-quality`（このページに既にある答弁をページ内リンクで整理。答弁の位置には `#council-gq2` / `#council-r2q3` / `#council-visit`）、clubs.html `clubs_s1_p3`、community.html `comm_qa3_a`。市議会の答弁「21〜25人程度のクラス替えが可能な学級規模」「総合教育支援センター（閉校後の校舎も候補・未定）」は about・faq にも引いてある — council.html の答弁を直したらそれらも直す。**重複は正本に寄せる**（2026-10-30 ユーザー指示）：1学級の上限・県と国の引き下げ・この答弁の正本は `about.html#learning`（市）と `nationwide.html` の比較表（国）で、`analysis.html` の `rev_k4_f` は数字だけ添えて正本へリンクする。`faq_a25` は構造化データ（FAQPage）に入るので単独で読める形のまま残す。新しく同じ事実を別ページに書くときは、正本へのリンクで済ませること。トップの「ポイント」④は「少人数学級の解消」ではなく「単学級（1学年1学級）の解消」（市は少人数学級を否定していない）。

## `shinooka.html`（「篠岡」の名前の由来と当サイトの見解）

2026-11-22 追加（ユーザー指示）。`community.html#legacy-shinooka` からリンクする。挿絵は `img/illust/shinooka-map.svg`（荘園の古地図の中央に桃）。キーは `sn_*`。**review / analysis のほかに当サイトの見解（🔎）を載せる唯一の例外**で、見解は `#view` の節だけに置き、【事実】の節に混ぜない。

- **出典**：『篠岡村誌』（篠岡村誌編纂部、昭和2年〈1927年〉）第一章冒頭（ユーザーが図書館で複写し、原本の画像で照合済み。画像はコミットしない）。荘園の範囲は郷土史の個人サイト「中世 小牧・春日井周辺の荘園領域についての覚書」と「ローカルヒストリア」の春日井市・小牧市のページ。**どちらも文字で書き、リンクは張らない。『春日井市史』『小牧市史』『張州府志』は孫引きで、原本は未確認**（`sn_src` に明記）。原本を確かめたら直す。
- **村誌の原文の抜粋（`.sn-quote`、ユーザー指示）**：第一章第一節の冒頭3文を、原本の画像と照合して旧字体のまま載せる（`lang="ja" translate="no"`、辞書に入れない）。「木會」「鷹木村」は誤りに見えても印刷どおりで、直さない。
- **資料の食い違いを消さない**：村誌は林・池之内・上末・下末を味岡荘とするが、市史は味岡荘の範囲を「不詳」とし、『張州府志』などはこの4か所を熊野荘（六師荘）に挙げる（`sn_warn`、問い `rev_o48`）。「一字ずつ取った」とも村誌は書いていない。
- **「桃花台＝折衷案」は当サイトの仮説**で、命名の経緯は未確認（問い `rev_o47`）。**棒の手が大草・野口にあることと篠木荘の関係も未確認**（問い `rev_o49`）で、事実としても見解の根拠としても書かない。
- **「しのおか学園」の名前への疑問（`#gakuen`、キー `sn_g_*`）と、トップの囲み `.sn-top`（`idx_sn_*`、2026-11-22 ユーザー指示）**：トップで当サイトの見方を載せる唯一の例外。🔎 の印と左帯を外さない。「篠岡」を使うこと自体が誤りとは書かない。問いは `rev_o50`。
- **「篠岡」の名は村より古い（`#before-village`、キー `sn_e_*`、2026-11-23）**：『篠岡教育七十年』（記念誌編集委員会編、篠岡小学校創立70周年記念事業実行委員会、昭和55年〈1980年〉、校長の言葉と2〜13ページ。写真はコミットしない）によると、明治6年（1873年）に「篠岡学校」（学区は林・野口・大山）が創設された。**これは学校名で、一般的な地名の「篠岡」とは分けて書く**（ユーザー指示。地名として確認できるのは明治39年の篠岡村から。「名前が明治6年にさかのぼる」と書かない）。創設の場の祥雲寺は `community.html#legacy-shoun`（2026-11-23 ユーザー指示で由緒を追加。曹洞宗・少林山・読みは寺の公式サイト `syouunji.net/about/` ＝このカードの出典だけに許可した外部リンク、`SHOUNJI_PATHS`。元の字「正雲寺」・元禄の移転・文正年間の創建は個人サイトとブログを通じた『尾張徇行記』『小牧市史』の孫引きで、カードに明記。創建は資料で分かれるので並べて書く。文化15年の移設説は出所不明なので載せない。**お寺のことは質問集に書かない**（ユーザー指示）。墓碑・家紋・姓は書かない）。東部全体が一つの学校になったのは明治42年（1909年）。反対運動の記述は**村の合併**についてのもので、学校統合への反対とは書かない。問いは `rev_o51`。
- **新篠岡音頭に込められた思い（`#ondo`、キー `sn_o_*`、2026-11-24 ユーザー指示）**：`#view` と `#gakuen` のあいだ。歌詞はユーザーが歌詞カードの画像で渡したもの（画像はコミットしない）。**引用は著作権法32条の範囲で1・4・5番の一部だけ**（`.sn-quote.sn-lyric`、`lang="ja" translate="no"`、辞書に入れずHTMLに固定。全文を載せない・行を足さない）。**出典の行にだけ作詩・作曲 牧すすむ、編曲 山田耕世、歌 わかばちどり、コロムビア・オーケストラを書く**（48条の出所明示のための例外。ユーザー決定。ほかの場所では個人名を書かない）。外国語表示では引用の下に意味の要約 `sn_o_gist`（日本語表示では隠す）。読み解き（`sn_o_v1`〜`3`）と「再編計画を進めるうえで大切なこと」（`sn_o_l_*`）は 🔎 の当サイトの考えで、帯と印を外さない。作られた年・経緯・二山や児の宮が何を指すかは推測で書かない（問い `rev_o52`）。YouTube の音源リンクはこの節にも許可（`auto_gates.py` の YOUTUBE_LEGACY）。クイズに出題しない決まりは変わらない。
- 連絡先は市の文化財課と「図書館で調べる」だけで、check 15 の対象外（`quiz.html` と同じ扱い）。
