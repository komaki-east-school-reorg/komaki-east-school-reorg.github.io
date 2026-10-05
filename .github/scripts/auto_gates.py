#!/usr/bin/env python3
"""
自動更新（Phase 3）のガードレール検証。

起案AIが作業ツリーに加えた変更を機械的に検査する：
  1. 編集範囲チェック  — 許可ファイル以外の変更・新規ファイル作成を拒否
  2. スキーマチェック  — events.json の日付キー・12言語ラベル、i18n の JSON 構文
  3. ja/en キー一致    — i18n.js が非日本語表示で ja.json を取らない前提を守る
  4. こどもモード      — ja-kids.json の1行がモーラ換算で長すぎないか
  5. ページ別辞書      — data/i18n/pages/ が data/i18n/ と HTML に対して最新か
  8. 年表の並び        — 現在の状況・主要イベント一覧が data-start の昇順か
  6. 外部リンク規則    — 市サイトへのリンクは許可URL（303/index.html）のみ、
                       Instagram は許可アカウントかつ index.html のみ、
                          文科省へのリンクは nationwide.html の許可URLのみ
  7. 出典実在チェック  — evidence.json の各引用が data/official_pages/ の
                          スナップショットに実在する文字列か照合（創作の検出）

終了コード: 0 = 合格, 1 = 不合格, 3 = 変更なし（更新不要と判断）
"""
import glob
import json
import os
import re
import subprocess
import sys

# events.json のイベントラベルに必須の言語（この12言語が揃っていないと不合格）。
# tr / my は 2026-08-13 に全キー翻訳が揃ったので必須に含めた。
LANGS = ["ja", "en", "pt", "vi", "tl", "es", "zh", "id", "ko", "ne", "tr", "my"]
# 翻訳が部分的な言語（現在なし。2026-09-18 に ko / ne の全キー翻訳が揃った）。新たに部分翻訳の言語を足すときは、
# i18n.js の PARTIAL と揃えてここに入れ、events.json のラベル必須対象から外す。
PARTIAL_LANGS = []

# events.json の各予定に、言語ラベル以外に書いてよいキー（check 2）。
EVENT_META = ("day", "start")
ALLOWED = {"data/events.json", "index.html", "schedule.html", "community.html"} | {
    f"data/i18n/{l}.json" for l in LANGS + PARTIAL_LANGS + ["ja-kids"]
}
# ページ別辞書は build_page_dicts.py が決定的に生成する。起案AIは触らないが、
# ワークフローが辞書編集のあとに再生成するので、変更ファイルとして現れる。
ALLOWED_PREFIXES = ("data/i18n/pages/",)
# 自動化の作業ファイル置き場（検査対象外）
IGNORE_PREFIXES = ("auto_update/", "report/")
EVIDENCE = "auto_update/evidence.json"
# 市サイトへのリンクを張ってよいページ（この3つのインデックスのみ。PDF直リンク・
# 個別記事ページは不可）。1つ目＝学校再編（教育総務課）、2つ目＝地域協議会（支え合い
# 協働推進課、community.html 用に 2026-08-12 追加）、3つ目＝東部まちづくり（東部まちづくり
# 推進室、「地域の取組」欄の出典として 2026-09-13 にユーザーが許可）。
# 3つ目は末尾まで含めて照合するので、配下の個別ページ（.../tobumachidukurisingikai/34277.html や
# .../toubumatidukurinyu-su/index.html）は今までどおり不可のまま。
# 4つ目＝東部まちづくりプラットフォームの説明ページ（2026-09-27 ユーザー指示）。索引ではなく
# 個別記事だが、ユーザーが明示して許可した。community.html の #platform でだけ張ってよい
# （CITY_PAGE_ONLY で機械的に縛る）。
PERMITTED_LINKS = ("303/index.html", "sasaeai/3/3_2/index.html",
                   "tobumachidukurisingikai/index.html",
                   "purattofo-mu/38222.html")
CITY_PAGE_ONLY = {"purattofo-mu/38222.html": ("community.html",)}
# 東部まちづくりプラットフォームの登録フォーム（市が案内している logoform）。
# community.html の #platform でだけ、この1本に限って張ってよい（2026-09-27 ユーザー指示）。
PERMITTED_FORM_LINKS = ("logoform.jp/form/uSYk/80018",)
FORM_PAGES = ("community.html",)
# 文部科学省へのリンク。全国の動向を扱う nationwide.html でのみ、この4つに限って
# 張ってよい（2026-08-22 追加）。全国の数値・基準は市の公式情報では賄えないため
# 国の一次資料を出典にするが、市サイトと同じく「索引ページのみ・PDF直リンク不可」
# を機械で守らせる。増やすときは CLAUDE.md・CONTRIBUTING.txt 規則1・README.md も同時に更新すること。
PERMITTED_MEXT_LINKS = (
    "shotou/tekisei/index.htm",          # 適正規模・適正配置（索引）
    "shotou/tekisei/1413885_00007.htm",  # 手引の改訂等について（通知・令和8年8月5日）
    "shotou/zyosei/yoyuu_00002.htm",     # 廃校施設活用状況実態調査
    "kihon/1267995.htm",                 # 学校基本調査
    "shotou/ikkan/2/1316125.htm",        # 中高一貫教育の概要と設置状況（2026-09-26）
)
MEXT_PAGES = ("nationwide.html",)
# 閉校を惜しむ市民有志の Instagram アカウント。「地域の取組」欄（community.html と、
# トップの「最新の動き」に同じ一覧を出す index.html）でのみ、
# ここに挙げたアカウントに限って張ってよい（2026-08-26 追加）。
# これは市の公式情報でも報道でもなく【市民有志の発信】であり、
# 計画の内容・数値の根拠には決して使わない（報道コーナーと同じ扱い）。
# 増やすときは CLAUDE.md・CONTRIBUTING.txt 規則1・README.md も同時に更新すること。
# 値は「そのアカウントを張ってよいページ」。None はサイト全体（＝フッタに出るもの）。
PERMITTED_INSTAGRAM = {
    # 閉校を惜しむ市民有志。「地域の取組」欄を描くページだけ
    # （index は「最新の動き」に同じ一覧を出すため。2026-09-03）
    "instagram.com/arigato.ohshirosho": ("community.html", "index.html"),
    # TOKADAI DANCE FESTIVAL（主催：株式会社iサポート）。同じく「地域の取組」欄を描く
    # ページだけ（2026-09-24 ユーザー指示）
    "instagram.com/tokadaidancefestival": ("community.html", "index.html"),
    # バンブーインスタレーション in おおくさ（住民の取組）と、市の児童館2館。
    # 同じく「地域の取組」欄を描くページだけ（2026-09-26 ユーザー指示）
    "instagram.com/bamboo_installation_ookusa": ("community.html", "index.html"),
    "instagram.com/shinookajidoukan": ("community.html", "index.html"),
    "instagram.com/warabekan": ("community.html", "index.html"),
    # 桃花台を考える会【新しいまちづくり】。フッタの「参考リンク（市民団体）」に
    # 全ページで出る（2026-09-22 ユーザー指示）
    "instagram.com/tokadai_komaki": None,
    # 校区内で活動している地域クラブ（clubs.html のみ。2026-09-22 ユーザー指示）。
    # いずれもクラブ自身の発信で、計画の内容・数値・日程の根拠には決して使わない。
    "instagram.com/rikimaru_sport_club": ("clubs.html",),
    "instagram.com/toubukan": ("clubs.html",),
    "instagram.com/hikarigaoka_cherrys": ("clubs.html",),
    "instagram.com/sue_basketball_komaki": ("clubs.html",),
    "instagram.com/seigakan.karate": ("clubs.html",),
    "instagram.com/acmilansoccerschoolaichi": ("clubs.html",),
    "instagram.com/yogosports_komaki": ("clubs.html",),
    "instagram.com/twins.toukadai": ("clubs.html",),
    "instagram.com/legame.esports": ("clubs.html",),      # Legame（小牧市岩崎。地域のeスポーツ大会。2026-09-27）
    "instagram.com/dance_school_dreamvivace": ("clubs.html",),  # ダンススクールD☆vivace（2026-09-27）
    "instagram.com/waiwaidaiko": ("clubs.html",),          # 和祝太鼓（拠点は小牧市二重堀）
    "instagram.com/fc.fervor_official": ("clubs.html",),   # FC.FERVOR（春日井市。この地区から通える）
}

# 地域クラブ・スポーツ団体の公式サイト。clubs.html でだけ張ってよい（2026-09-22 追加）。
# 行政の資料ではないので、計画の内容・数値・日程の根拠には使わない。
# 増やすときは CLAUDE.md・CONTRIBUTING.txt 規則1・README.md も同時に更新すること。
PERMITTED_CLUB_SITES = (
    "komaki-sports.or.jp",           # 公益財団法人 小牧市スポーツ協会
    "acmilansoccerschool-aichi.jp",  # ACミランアカデミー愛知
    "seigakan.net",                  # 聖雅館
    "komaki-kendo.jp",               # 小牧市剣道連盟
    "fc-fervor.net",                 # FC.FERVOR
    "komakishion.com",               # 小牧市音楽連盟（小牧少年少女合唱団の紹介。2026-09-27）
    "pc-bitz.jp",                    # パソコンスクールビッツ（ロボットプログラミング。2026-09-27）
    "encourage-toukadai.com",        # プログラミング教室エンカレッジ小牧（2026-09-27）
    "legameinc.com",                 # Legame（eスポーツ。2026-09-27）
    "white700957.studio.site",       # ダンススクールD☆vivace（2026-09-27）
)
CLUB_PAGES = ("clubs.html",)

# X と Facebook。**共有ボタンの送信先と、住民有志の発信の2種類しかない。**
# 共有ボタンの URL は出典ではなく、サイトのどこからも引用してはいけない。
# 住民有志の発信も、計画の内容・数値の根拠には決して使わない（報道コーナーと同じ扱い）。
# 増やすときは CLAUDE.md・CONTRIBUTING.txt 規則1・README.md も同時に更新すること。
PERMITTED_SNS = {
    "x.com": (
        "x.com/intent/post",         # 共有ボタン（出典ではない）
        "x.com/tokadai_komaki",      # 桃花台を考える会【新しいまちづくり】
    ),
    "facebook.com": (
        "facebook.com/sharer/sharer.php",   # 共有ボタン（出典ではない）
        "facebook.com/TokadaiNT",           # 桃花台を考える会【新しいまちづくり】
        # 小牧市公式 Facebook の投稿。「地域の取組」欄の項目が本文で触れた事実の
        # 出どころとして1本だけ張る（2026-09-24 ユーザー指示。読者が本文を見て
        # 確かめられるため許可）。市の公表なので事実の根拠に使ってよいが、
        # 張れるのは data/community_actions.json の ref_url だけに留めること。
        "facebook.com/city.komaki",
    ),
}
MIN_QUOTE_LEN = 10

fails = []


def fail(msg):
    fails.append(msg)
    print(f"NG: {msg}")


def ok(msg):
    print(f"OK: {msg}")


def normalize(text):
    """空白・改行を除去して比較する（スナップショットは行区切りのため）"""
    return re.sub(r"\s+", "", text)


def changed_paths():
    """作業ツリーの変更ファイル（未追跡含む）。IGNORE_PREFIXES は除外。"""
    out = subprocess.check_output(["git", "status", "--porcelain"], text=True)
    paths = []
    for line in out.splitlines():
        path = line[3:].strip().strip('"')
        if " -> " in path:  # リネーム
            path = path.split(" -> ")[1].strip().strip('"')
        if path.startswith(IGNORE_PREFIXES):
            continue
        paths.append(path)
    return paths


def main():
    changed = changed_paths()

    if not changed:
        print("変更なし（更新不要と判断）")
        sys.exit(3)

    print(f"変更ファイル: {changed}")

    # --- 1. 編集範囲チェック ---
    for p in changed:
        if p not in ALLOWED and not p.startswith(ALLOWED_PREFIXES):
            fail(f"許可されていないファイルの変更: {p}")
    if not fails:
        ok("編集範囲は許可ファイル内")

    # --- 2. スキーマチェック ---
    if "data/events.json" in changed:
        try:
            with open("data/events.json", encoding="utf-8") as f:
                events = json.load(f)["events"]
            n_before = len(fails)
            for date, entry in events.items():
                if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
                    fail(f"events.json: 不正な日付キー: {date}")
                # 1日に複数の予定が入ることがある。値は「1件ならオブジェクト、
                # 複数なら配列」のどちらでもよい（js/main.js のカレンダーと .ics が両方を受ける）。
                # "day": true は任意で、「その日に行われると決まっている予定」の印。トップの
                # 「次の予定まであと◯日」はこの印の付いた予定だけを数える。月単位の予定は
                # 月末の日付で置いてあるので、印が無いものを数えると実在しない日を指してしまう。
                items = entry if isinstance(entry, list) else [entry]
                if not items:
                    fail(f"events.json: {date} の予定が空")
                for labels in items:
                    if not isinstance(labels, dict):
                        fail(f"events.json: {date} の要素がオブジェクトでない")
                    elif "day" in labels and labels["day"] is not True:
                        fail(f"events.json: {date} の day は true だけを書く（日が決まっていない予定には付けない）")
                    # "start" は任意で、月単位・期間の予定の始まり（トップの帯が「11月〜12月」と出すため）。
                    elif "start" in labels and not (isinstance(labels["start"], str)
                                                    and re.match(r"^\d{4}-\d{2}-\d{2}$", labels["start"])
                                                    and labels["start"] <= date):
                        fail(f"events.json: {date} の start は YYYY-MM-DD で、キーの日付以前にする: {labels.get('start')}")
                    elif sorted(k for k in labels if k not in EVENT_META) != sorted(LANGS):
                        fail(f"events.json: {date} の言語キーが{len(LANGS)}言語と一致しない: {sorted(labels)}")
                    elif not all(isinstance(v, str) and v.strip() for k, v in labels.items() if k not in EVENT_META):
                        fail(f"events.json: {date} に空のラベルがある")
            if len(fails) == n_before:
                ok(f"events.json スキーマ（{len(events)}件）")
        except Exception as e:
            fail(f"events.json が読めない: {e}")

    for p in changed:
        if p.startswith("data/i18n/") and p.endswith(".json"):
            try:
                with open(p, encoding="utf-8") as f:
                    d = json.load(f)
                bad = [k for k, v in d.items() if not isinstance(v, str)]
                if bad:
                    fail(f"{p}: 文字列でない値: {bad[:5]}")
                else:
                    ok(f"{p} JSON 構文・型")
            except Exception as e:
                fail(f"{p} が JSON として不正: {e}")

    # --- 3. ja / en のキー集合一致（サイト全体を検査） ---
    # js/i18n.js は非日本語表示で ja.json を取得しない（ja 層は最終辞書に
    # 1キーも寄与しないため）。これは「en が ja と同じキー集合を持つ」ことに
    # 依存した最適化なので、前提が崩れたらここで機械的に止める。
    try:
        with open("data/i18n/ja.json", encoding="utf-8") as f:
            ja_keys = set(json.load(f))
        with open("data/i18n/en.json", encoding="utf-8") as f:
            en_keys = set(json.load(f))
        only_ja = sorted(ja_keys - en_keys)
        only_en = sorted(en_keys - ja_keys)
        if only_ja:
            fail(f"ja.json にあって en.json に無いキー（英語フォールバックが効かない）: {only_ja[:5]}")
        if only_en:
            fail(f"en.json にあって ja.json に無いキー: {only_en[:5]}")
        if not only_ja and not only_en:
            ok(f"ja / en キー集合一致（{len(ja_keys)}キー）")
    except Exception as e:
        fail(f"ja.json / en.json が読めない: {e}")

    # --- 4. こどもモードの1行の長さ（サイト全体を検査） ---
    # ja-kids.json は小3の読解力が目標。漢字をひらがなに開くだけでは足りず、
    # 1文の長さこそが読みやすさを決めるので、ここで上限を機械的に守らせる。
    # 「1行」= <br>/</li>/</p> と 。！？：| で切れる、読者が実際に目にする単位。
    # モーラ換算は「漢字≒1.9・仮名≒1」。ひらがなに開くと文字数が増えるため、
    # 文字数のままでは ja と比較できず、簡易化が効いているか判定できない。
    # 上限 65 は現状の最大 58 に余裕を持たせた値。目標は 45 以下、理想は 30 前後。
    KIDS_MAX_MORA = 65
    KIDS_SKIP = re.compile(r"^(meta_|footer_langs$)")   # ページ題名・言語名リストは文ではない

    def _kids_lines(v):
        t = re.sub(r"<br\s*/?>|</li>|</p>|</h\d>", "\n", str(v))
        t = re.sub(r"<[^>]+>", "", t)
        t = re.sub(r"[。！？：|]", "\n", t)
        return [x.strip() for x in t.split("\n") if x.strip()]

    def _mora(t):
        t = re.sub(r"\s", "", t)
        k = sum(1 for c in t if "\u4e00" <= c <= "\u9fff")
        return (len(t) - k) + 1.9 * k

    try:
        with open("data/i18n/ja-kids.json", encoding="utf-8") as f:
            kids = json.load(f)
        long_keys = []
        for k, v in kids.items():
            if KIDS_SKIP.match(k):
                continue
            lines = _kids_lines(v)
            if lines and max(_mora(x) for x in lines) > KIDS_MAX_MORA:
                long_keys.append((k, max(_mora(x) for x in lines)))
        if long_keys:
            for k, m in sorted(long_keys, key=lambda x: -x[1])[:5]:
                fail(f"ja-kids: 1行が長すぎる（{m:.0f}モーラ / 上限{KIDS_MAX_MORA}）: {k}")
        else:
            ok(f"ja-kids 1行の長さ（{len(kids)}キー / 上限{KIDS_MAX_MORA}モーラ）")
    except Exception as e:
        fail(f"ja-kids.json が読めない: {e}")

    # --- 5. ページ別辞書が最新か（サイト全体を検査） ---
    # 古いページ別辞書は 404 にならず「古い文面を 200 で返す」ので、
    # i18n.js の 404 フォールバックでは救えない。ここで確実に止める。
    try:
        r = subprocess.run(
            [sys.executable, ".github/scripts/build_page_dicts.py", "--check"],
            capture_output=True, text=True)
        if r.returncode != 0:
            fail("ページ別辞書が古い（build_page_dicts.py を実行すること）:\n" + r.stdout.strip())
        else:
            ok("ページ別辞書は最新")
    except Exception as e:
        fail(f"build_page_dicts.py が実行できない: {e}")

    # --- 6. 外部リンク規則（サイト全体を検査） ---
    link_violations = []
    # 翻訳辞書も見る：非日本語ではリンクの実体が data/i18n/*.json 側の文面なので、
    # HTML だけを検査してもすり抜ける。
    for p in glob.glob("*.html") + glob.glob("js/*.js") + glob.glob("data/i18n/*.json"):
        is_dict = p.startswith("data/i18n/")
        with open(p, encoding="utf-8") as f:
            for i, line in enumerate(f, 1):
                for m in re.finditer(r"city\.komaki\.aichi\.jp[^\s\"'<)\\]*", line):
                    if not any(allowed in m.group(0) for allowed in PERMITTED_LINKS):
                        link_violations.append(f"{p}:{i} {m.group(0)[:80]}")
                    for key, pages in CITY_PAGE_ONLY.items():
                        if key in m.group(0) and not (is_dict or p in pages):
                            link_violations.append(f"{p}:{i} この市のページは {'/'.join(pages)} のみ可 {m.group(0)[:60]}")
                for m in re.finditer(r"logoform\.jp[^\s\"'<)\\]*", line):
                    if not any(a in m.group(0) for a in PERMITTED_FORM_LINKS):
                        link_violations.append(f"{p}:{i} 許可外のフォームURL {m.group(0)[:80]}")
                    elif not (is_dict or p in FORM_PAGES):
                        link_violations.append(f"{p}:{i} 登録フォームは {'/'.join(FORM_PAGES)} のみ可")
                for m in re.finditer(r"mext\.go\.jp[^\s\"'<)\\]*", line):
                    if not (is_dict or p in MEXT_PAGES):
                        link_violations.append(f"{p}:{i} 文科省リンクは {'/'.join(MEXT_PAGES)} のみ可 {m.group(0)[:60]}")
                    elif not any(allowed in m.group(0) for allowed in PERMITTED_MEXT_LINKS):
                        link_violations.append(f"{p}:{i} 許可外の文科省URL {m.group(0)[:80]}")
                for m in re.finditer(r"instagram\.com[^\s\"'<)\\]*", line):
                    url = m.group(0)
                    hit = [a for a in PERMITTED_INSTAGRAM if a in url]
                    if not hit:
                        link_violations.append(f"{p}:{i} 許可外の Instagram アカウント {url[:80]}")
                        continue
                    pages = PERMITTED_INSTAGRAM[hit[0]]
                    # pages が None のアカウントはサイト全体で可（フッタに出るもの）
                    if pages and not (is_dict or p in pages):
                        link_violations.append(
                            f"{p}:{i} このアカウントは {'/'.join(pages)} のみ可 {url[:60]}")
                for host in PERMITTED_CLUB_SITES:
                    if host in line and not (is_dict or p in CLUB_PAGES):
                        link_violations.append(
                            f"{p}:{i} 地域クラブのサイトは {'/'.join(CLUB_PAGES)} のみ可 {host}")
                for host, allowed in PERMITTED_SNS.items():
                    for m in re.finditer(re.escape(host) + r"[^\s\"'<)\\]*", line):
                        if not any(a in m.group(0) for a in allowed):
                            link_violations.append(f"{p}:{i} 許可外の {host} URL {m.group(0)[:80]}")
    if link_violations:
        for v in link_violations:
            fail(f"許可外の外部URL: {v}")
    else:
        ok("外部リンク規則")

    # --- 8. 年表の並び（サイト全体を検査） ---
    # 「現在の状況」（index.html）と「主要イベント一覧」（schedule.html）は、
    # 追記を重ねると簡単に時系列が崩れる。並べ替えの根拠を data-start（開始日）に
    # 一本化し、リストごとに昇順であることを機械で守らせる。
    # data-event-date（完了判定・終了日）や data-expires（掲載期限）とは役割が違う。
    TIMELINE_LISTS = [("index.html", "status-item"), ("schedule.html", "event-item")]
    order_problems = []
    for page, cls in TIMELINE_LISTS:
        try:
            with open(page, encoding="utf-8") as f:
                html = f.read()
        except FileNotFoundError:
            continue
        items = re.findall(
            r'<div class="' + cls + r'\b[^"]*"([^>]*)>', html)
        if not items:
            order_problems.append(f"{page}: .{cls} が1件も無い")
            continue
        # 見出し等で区切られた「かたまり」ごとに昇順を見る。
        # 区切りは HTML 上の並び順そのままで判定する（h3/h4 をまたぐ塊は別リスト）。
        blocks = re.split(r"<h[34][^>]*>", html)
        seen = 0
        for bi, block in enumerate(blocks):
            dates = re.findall(
                r'<div class="' + cls + r'\b[^"]*"[^>]*\sdata-start="([\d-]+)"', block)
            missing = len(re.findall(r'<div class="' + cls + r'\b', block)) - len(dates)
            if missing > 0:
                order_problems.append(f"{page}: data-start の無い .{cls} が {missing} 件（{bi} 番目の塊）")
            seen += len(dates)
            for a, b in zip(dates, dates[1:]):
                if a > b:
                    order_problems.append(f"{page}: 時系列が逆転 {a} → {b}")
        if seen == 0:
            order_problems.append(f"{page}: data-start が1件も無い")
    # 実行時に並べ替えられていないか。以前 AUTO DATE STATUS が完了項目を
    # .current の前へ動かしており、HTML で整えた順序がブラウザ上で崩れていた。
    # 並び順は HTML の記述順が正。あのブロックに並べ替えを戻させない。
    try:
        with open("js/main.js", encoding="utf-8") as f:
            js = f.read()
        i = js.find("AUTO DATE STATUS")
        if i >= 0:
            block = js[i:js.find("/* =====", i + 10)]
            if "insertBefore(item" in block or "appendChild(item" in block:
                order_problems.append(
                    "js/main.js の AUTO DATE STATUS が項目を移動している"
                    "（並び順は HTML の data-start 順が正。移動処理を入れないこと）")
    except FileNotFoundError:
        pass

    if order_problems:
        for v in order_problems:
            fail(f"年表の並び: {v}")
    else:
        ok("年表の並び（data-start 昇順）")

    # --- 9. スケジュール一覧と events.json の連動（サイト全体を検査） ---
    # 2026-10-05 ユーザー指示：トップの帯・スケジュール一覧・カレンダーを正しく連動させる。
    # 帯とカレンダーは events.json から描くので、schedule.html の一覧と events.json が
    # 食い違わないことをここで守る。見るのは「終わっていない予定」だけ
    # （日が過ぎれば対象が減るだけなので、日付の経過でこの検査が急に落ちることはない）。
    #   ・一覧の各項目（data-start〜data-event-date）の期間内に events.json の予定がある
    #   ・events.json の各予定の日付が、一覧のどれかの項目の期間に入っている
    # 桃花台を考える会・地域協議会の自動で足す催しは、どちらにも書かれていないので対象外。
    import datetime as _dt
    today = _dt.date.today().isoformat()
    sync_problems = []
    try:
        with open("schedule.html", encoding="utf-8") as f:
            sched = f.read()
        with open("data/events.json", encoding="utf-8") as f:
            ev_keys = sorted(json.load(f)["events"])
        ranges = []
        for attrs in re.findall(r'<div class="event-item\b[^"]*"([^>]*)>', sched):
            st = re.search(r'data-start="([\d-]+)"', attrs)
            en = re.search(r'data-event-date="([\d-]+)"', attrs)
            if not st:
                continue
            ranges.append((st.group(1), en.group(1) if en else st.group(1)))
        for st, en in ranges:
            if en < today:
                continue
            if not any(st <= k <= en for k in ev_keys):
                sync_problems.append(f"schedule.html の {st}〜{en} の予定が events.json に無い")
        for k in ev_keys:
            if k < today:
                continue
            if not any(st <= k <= en for st, en in ranges):
                sync_problems.append(f"events.json の {k} が schedule.html の一覧に無い")
    except (FileNotFoundError, KeyError, ValueError) as e:
        sync_problems.append(f"読めない: {e}")
    if sync_problems:
        for v in sync_problems:
            fail(f"予定の連動: {v}")
    else:
        ok("予定の連動（schedule.html ⇔ events.json）")

    # --- 10. 「いまの状況」の日付の書き方（サイト全体を検査） ---
    # 2026-10-05 ユーザー指示。「いまの状況」は随時更新する欄で、
    #   過ぎたこと（日付を確かめ、過去だと分かる書き方で）→ いまの状態 → 近い先の予定
    # の順に書く。now_text の中で日付に触れる部分は必ずどちらかの印で囲む：
    #   <span data-past="YYYY-MM-DD">…</span>  … すでに済んだこと（日付は今日以前でなければならない）
    #   <span data-until="YYYY-MM-DD">…</span> … これからのこと・続いていること。期限が過ぎると
    #                                              js/main.js（NOW BAR）が画面から外す
    # ① ja / ja-kids で、月・日が印の外に書かれていないこと ② data-past が未来でないこと
    # ③ どの言語も印の並び（種類と日付）が ja と同じであることを確かめる。
    # 期限切れの data-until は画面では消えるので失敗にはせず、書き直しを促す警告だけ出す
    # （日付の経過で自動更新パイプラインのゲートが落ちないように）。
    now_problems = []
    mark_re = re.compile(r'<span data-(past|until)="([\d-]+)">.*?</span>', re.S)
    try:
        with open("data/i18n/ja.json", encoding="utf-8") as f:
            ja_marks = mark_re.findall(json.load(f).get("now_text", ""))
    except (FileNotFoundError, ValueError):
        ja_marks = []
    for path in sorted(glob.glob("data/i18n/*.json")):
        name = os.path.basename(path)[:-5]
        try:
            with open(path, encoding="utf-8") as f:
                v = json.load(f).get("now_text")
        except ValueError:
            continue
        if v is None:
            continue
        marks = mark_re.findall(v)
        if name in ("ja", "ja-kids"):
            outside = mark_re.sub("", v)
            m = re.search(r"\d{1,2}\s*(月|日|がつ|にち)", outside)
            if m:
                now_problems.append(f"{name}: 日付「{m.group(0)}」が data-past / data-until の外にある")
        if name != "ja" and marks != ja_marks:
            now_problems.append(f"{name}: 日付の印 {marks} が ja {ja_marks} と違う")
        for kind, d in marks:
            if kind == "past" and d > today:
                now_problems.append(f"{name}: data-past={d} が未来の日付（済んだことだけに付ける）")
            if kind == "until" and d < today:
                print(f"WARN: now_text（{name}）の data-until={d} は期限切れ。画面では消えている。文面を書き直すこと")
    if now_problems:
        for v in now_problems:
            fail(f"いまの状況: {v}")
    else:
        ok("いまの状況（日付は data-past / data-until つき）")

    # --- 11. 全ページに共有欄がある（サイト全体を検査） ---
    # 2026-10-05 に clubs.html だけ共有欄（#share）が抜けていて、共有ボタンも画面下の固定バーも
    # 出ていなかった。共有ボタンは main.js がこの欄を見つけて組み立てるので、欄が無いと黙って消える。
    # 移動案内だけの voices.html は対象外。
    share_missing = []
    for page in sorted(glob.glob("*.html")):
        if page == "voices.html":
            continue
        with open(page, encoding="utf-8") as f:
            h = f.read()
        if 'id="share"' not in h or 'id="share-buttons"' not in h:
            share_missing.append(page)
    if share_missing:
        for p_ in share_missing:
            fail(f"共有欄（#share / #share-buttons）が無い: {p_}")
    else:
        ok("全ページに共有欄")

    # --- 7. 出典実在チェック ---
    if not os.path.exists(EVIDENCE):
        fail(f"{EVIDENCE} がない（変更には出典が必須）")
    else:
        try:
            with open(EVIDENCE, encoding="utf-8") as f:
                evidence = json.load(f)
        except Exception as e:
            fail(f"{EVIDENCE} が JSON として不正: {e}")
            evidence = []

        by_file = {}
        for e in evidence:
            by_file.setdefault(e.get("file", ""), []).append(e)

        for p in changed:
            if p.startswith(ALLOWED_PREFIXES):
                continue  # 生成物。出典は生成元の data/i18n/*.json 側で検証済み
            if p not in by_file:
                fail(f"{p} の変更に evidence.json のエントリがない")

        snap_cache = {}
        for e in evidence:
            quotes = e.get("quotes", [])
            if not quotes:
                fail(f"evidence: {e.get('file')} に引用（quotes）がない")
            for q in quotes:
                snap = q.get("snapshot", "")
                text = q.get("text", "")
                if not snap.startswith("data/official_pages/") or not os.path.exists(snap):
                    fail(f"evidence: スナップショットが存在しない: {snap}")
                    continue
                if len(text) < MIN_QUOTE_LEN:
                    fail(f"evidence: 引用が短すぎる（{MIN_QUOTE_LEN}文字以上必須）: {text!r}")
                    continue
                if snap not in snap_cache:
                    with open(snap, encoding="utf-8") as f:
                        snap_cache[snap] = normalize(f.read())
                if normalize(text) not in snap_cache[snap]:
                    fail(f"evidence: 引用が {snap} に実在しない（創作の疑い）: {text[:60]!r}")
        if not fails:
            ok(f"出典実在チェック（{sum(len(e.get('quotes', [])) for e in evidence)}引用）")

    # --- 結果 ---
    if fails:
        print(f"\n不合格: {len(fails)}件の問題")
        sys.exit(1)
    print("\n全ゲート合格")
    sys.exit(0)


if __name__ == "__main__":
    main()
