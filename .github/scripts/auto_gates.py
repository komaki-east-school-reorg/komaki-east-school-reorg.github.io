#!/usr/bin/env python3
"""
自動更新（Phase 3）のガードレール検証。

起案AIが作業ツリーに加えた変更を機械的に検査する：
  1. 編集範囲チェック  — 許可ファイル以外の変更・新規ファイル作成を拒否
  2. スキーマチェック  — events.json の日付キー・10言語ラベル、i18n の JSON 構文
  3. ja/en キー一致    — i18n.js が非日本語表示で ja.json を取らない前提を守る
  4. こどもモード      — ja-kids.json の1行がモーラ換算で長すぎないか
  5. ページ別辞書      — data/i18n/pages/ が data/i18n/ と HTML に対して最新か
  6. 外部リンク規則    — 市サイトへのリンクは許可URL（303/index.html）のみ、
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

# events.json のイベントラベルに必須の言語（この10言語が揃っていないと不合格）。
# tr / my は 2026-08-13 に全キー翻訳が揃ったので必須に含めた。
LANGS = ["ja", "en", "pt", "vi", "tl", "es", "zh", "id", "tr", "my"]
# 翻訳が部分的な言語（現在なし）。新たに部分翻訳の言語を足すときは、
# i18n.js の PARTIAL と揃えてここに入れ、events.json のラベル必須対象から外す。
PARTIAL_LANGS = []
ALLOWED = {"data/events.json", "index.html", "schedule.html", "community.html"} | {
    f"data/i18n/{l}.json" for l in LANGS + PARTIAL_LANGS + ["ja-kids"]
}
# ページ別辞書は build_page_dicts.py が決定的に生成する。起案AIは触らないが、
# ワークフローが辞書編集のあとに再生成するので、変更ファイルとして現れる。
ALLOWED_PREFIXES = ("data/i18n/pages/",)
# 自動化の作業ファイル置き場（検査対象外）
IGNORE_PREFIXES = ("auto_update/", "report/")
EVIDENCE = "auto_update/evidence.json"
# 市サイトへのリンクを張ってよいページ（この2つのインデックスのみ。PDF直リンク・
# 個別記事ページは不可）。1つ目＝学校再編（教育総務課）、2つ目＝地域協議会（支え合い
# 協働推進課、community.html 用に 2026-08-12 追加）。
PERMITTED_LINKS = ("303/index.html", "sasaeai/3/3_2/index.html")
# 文部科学省へのリンク。全国の動向を扱う nationwide.html でのみ、この4つに限って
# 張ってよい（2026-08-22 追加）。全国の数値・基準は市の公式情報では賄えないため
# 国の一次資料を出典にするが、市サイトと同じく「索引ページのみ・PDF直リンク不可」
# を機械で守らせる。増やすときは CLAUDE.md・CONTRIBUTING.txt 規則1・README.md も同時に更新すること。
PERMITTED_MEXT_LINKS = (
    "shotou/tekisei/index.htm",          # 適正規模・適正配置（索引）
    "shotou/tekisei/1413885_00007.htm",  # 手引の改訂等について（通知・令和8年8月5日）
    "shotou/zyosei/yoyuu_00002.htm",     # 廃校施設活用状況実態調査
    "kihon/1267995.htm",                 # 学校基本調査
)
MEXT_PAGES = ("nationwide.html",)
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
            for date, labels in events.items():
                if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
                    fail(f"events.json: 不正な日付キー: {date}")
                if sorted(labels) != sorted(LANGS):
                    fail(f"events.json: {date} の言語キーが{len(LANGS)}言語と一致しない: {sorted(labels)}")
                elif not all(isinstance(v, str) and v.strip() for v in labels.values()):
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
                for m in re.finditer(r"mext\.go\.jp[^\s\"'<)\\]*", line):
                    if not (is_dict or p in MEXT_PAGES):
                        link_violations.append(f"{p}:{i} 文科省リンクは {'/'.join(MEXT_PAGES)} のみ可 {m.group(0)[:60]}")
                    elif not any(allowed in m.group(0) for allowed in PERMITTED_MEXT_LINKS):
                        link_violations.append(f"{p}:{i} 許可外の文科省URL {m.group(0)[:80]}")
    if link_violations:
        for v in link_violations:
            fail(f"許可外の外部URL: {v}")
    else:
        ok("外部リンク規則")

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
