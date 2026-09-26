#!/usr/bin/env python3
"""
東部まちづくり（東部まちづくり推進室）の取組一覧を data/tobu_actions.json に組み立てる。

■ 市サーバへは一切アクセスしない
   fetch_news.py が監視対象として
   data/official_pages/toubumachidukuri-tobumachidukurisingikai-*.txt に
   本文スナップショットをすでに保存している。このスクリプトはそれを読むだけ。
   同じページを2度取りに行かないので、市サーバへの負荷は増えない。
   （このため、fetch_news.py の【あと】に実行すること。）

■ 何を拾うか（3通り）
   1. 催し   … 「開催場所・会場」「開催日・期間」を持つページ（協働提案事業・団体等の
                イベント情報）。開催日が読めれば、それが日付になる。
   2. 記録   … 年度別の『東部まちづくりニュース』と『東部まちづくり審議会』の本文に
                〈見出し（令和8年8月24日）〉の形で並ぶ行。この形の行だけを見出しとみなす。
                本文の文は「。」で終わるのでこの形にならない。
   3. その他 … 上のどちらでもないページ（トライアル活動の紹介など）は、そのページの
                更新日を日付として扱う。

   図やPDFの中は読めないので、**載っていない＝存在しない ではない**。

■ 直近2か月ぶんだけ（ユーザー指示 2026-09-13）
   古い記録が積もると「いま何が起きているか」が読めなくなるので、
   日付が WINDOW_DAYS（60日）より古いものは落とす。
   ただし**これから開催される催しは日付が未来なので必ず残す** — 参加できる催しを
   期限切れ扱いで落としてしまっては、この欄を置く意味がない。

■ リンク
   市サイトへのリンクは許可された索引ページのみ（CLAUDE.md／auto_gates.py check 6）。
   2026-09-13 に東部まちづくりの索引が許可に加わったので、コーナーの「出典」だけ
   そこへリンクする（リンクの文字列は js/main.js が持つ＝機械検査の対象になる）。
   個々の記事ページは許可されていないので、項目ごとのリンクは持たない。

■ 桃花台を考える会の催しには organizer を付ける（2026-09-26 ユーザー指示）
   市民活動団体「桃花台を考える会」が開く催しは、市の欄（東部まちづくりの動き）ではなく
   住民側の欄（地域の取組）に出す。振り分けは js/main.js が organizer を見て行う。
   判定は ①ページ本文に団体名がある ②協働提案事業のページで、題名が同会の続き物
   （TOKADAI_SERIES）に当たる、のどちらか。②が要るのは、第11回桃花台音楽まつりの
   ページのように団体名を書かず問い合わせ先も推進室になっている回があるため
   （第3回〜第10回はいずれも「協働提案事業 桃花台を考える会×東部まちづくり推進室」）。
   同会が新しい続き物を始めたら TOKADAI_SERIES に足すこと。

■ 出力は生成物。手で編集しないこと（次回実行で上書きされる）。

終了コード: 0 = 生成した（変化の有無は問わない）, 1 = 致命的エラー
"""
import glob
import json
import os
import re
import sys
from datetime import date, timedelta

SNAPSHOT_DIR = "data/official_pages"
PREFIX = "toubumachidukuri-tobumachidukurisingikai-"
OUTPUT = "data/tobu_actions.json"
WINDOW_DAYS = 60          # 直近2か月
MAX_ITEMS = 12            # 画面に出す数は js/main.js 側で更に絞る

# 行末が（令和○年○月○日）で終わる見出し行（＝記録）。日付のあとに「・26日」「月曜日」等が
# 付くことがあるので、閉じ括弧までは何が来てもよい。
ITEM_RE = re.compile(
    r"^(?P<title>.{4,80}?)\s*[（(]令和(?P<y>\d{1,2})年(?P<m>\d{1,2})月(?P<d>\d{1,2})日[^)）]*[)）]$"
)
REIWA_RE = re.compile(r"令和(\d{1,2})年(\d{1,2})月(\d{1,2})日")
UPDATED_RE = re.compile(r"^更新日：\s*(\d{4})年(\d{1,2})月(\d{1,2})日")
# 見出しではない行（ページの meta 行や本文の途中）を落とす
SKIP_WORDS = ("更新日", "ページID", "詳しくはこちら", "お問い合わせ", "電話番号")

TOKADAI_GROUP = "桃花台を考える会"
TOKADAI_SERIES = ("桃花台音楽まつり", "我が家の相続セミナー", "桃花台を考える講演会", "住まいの相談会")

# スラッグの一部 → 画面に出す「どこの話か」。市の書いた名称なので翻訳しない。
SECTIONS = [
    ("kyoudouteianjigyou", "協働提案事業"),
    ("purattofo-mu-trial", "東部地域トライアル活動"),
    ("purattofo-mu-machidukurisemina", "まちづくりセミナー"),
    ("purattofo-mu-openfactory", "オープンファクトリー"),
    ("purattofo-mu-project", "東部まちづくりプラットフォーム"),
    ("purattofo-mu", "東部まちづくりプラットフォーム"),
    ("ibentojyoho", "団体等によるイベント情報"),
    ("toubutiikimatidukuripa-tona-shippuseido", "まちづくり活動パートナーシップ制度"),
    ("toubusinnkoukousou", "東部振興構想"),
    ("actionplan", "アクションプラン"),
]


def read_snapshot(path):
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    url, _, body = raw.partition("\n---\n")
    lines = [l.strip() for l in body.split("\n")]
    return url.strip(), [l for l in lines if l]


def reiwa_to_iso(y, m, d):
    return f"{2018 + int(y):04d}-{int(m):02d}-{int(d):02d}"


def section_of(path, fallback):
    name = os.path.basename(path)
    for key, label in SECTIONS:
        if key in name:
            return label
    return fallback


def field_value(lines, label):
    """「開催日・期間」などの見出し行の次の行を値として読む。"""
    for i, l in enumerate(lines):
        if l == label and i + 1 < len(lines):
            return lines[i + 1]
    return None


def parse_page(path):
    url, lines = read_snapshot(path)
    if not lines:
        return []
    page_title = lines[0]
    updated = None
    for l in lines[:6]:
        m = UPDATED_RE.match(l)
        if m:
            updated = f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
            break

    out = []

    # 1. 催し（開催日・期間を持つページ）
    when = field_value(lines, "開催日・期間")
    if when is not None:
        m = REIWA_RE.search(when)
        by_group = TOKADAI_GROUP in "\n".join(lines) or (
            "kyoudouteianjigyou" in os.path.basename(path)
            and any(s in page_title for s in TOKADAI_SERIES))
        out.append({
            "kind": "event",
            "title": page_title,
            "date": reiwa_to_iso(*m.groups()) if m else updated,
            "date_note": when,
            "place": field_value(lines, "開催場所・会場") or "",
            "from": section_of(path, "東部まちづくり"),
        })
        if by_group:
            out[-1]["organizer"] = TOKADAI_GROUP
        return out

    # 2. 記録（本文に並ぶ〈見出し（令和○年○月○日）〉）
    for line in lines:
        if any(w in line for w in SKIP_WORDS):
            continue
        m = ITEM_RE.match(line)
        if not m:
            continue
        title = m.group("title").strip("　 ・-—")
        if not title:
            continue
        out.append({
            "kind": "report",
            "title": title,
            "date": reiwa_to_iso(m.group("y"), m.group("m"), m.group("d")),
            "from": page_title,
        })
    if out:
        return out

    # 3. その他（トライアル活動の紹介など）。ページの更新日を日付として扱う。
    if updated:
        out.append({
            "kind": "info",
            "title": page_title,
            "date": updated,
            "from": section_of(path, "東部まちづくり"),
        })
    return out


def main():
    if not os.path.isdir(SNAPSHOT_DIR):
        print(f"ERROR: {SNAPSHOT_DIR} がない", file=sys.stderr)
        return 1

    paths = sorted(glob.glob(os.path.join(SNAPSHOT_DIR, PREFIX + "*.txt")))
    today = date.today()
    cutoff = (today - timedelta(days=WINDOW_DAYS)).isoformat()
    today_s = today.isoformat()

    items = []
    seen = set()
    for path in paths:
        # 索引ページ自体は「取組」ではないので拾わない（見出しの羅列でしかない）
        if path.endswith("-index.txt"):
            continue
        try:
            found = parse_page(path)
        except Exception as e:
            print(f"  WARN 解析できない: {path}: {e}", file=sys.stderr)
            continue
        for it in found:
            if not it.get("date"):
                continue
            # 直近2か月ぶんだけ。ただしこれからの催しは未来の日付なので必ず残る。
            if it["date"] < cutoff:
                continue
            key = (it["title"], it["date"])
            if key in seen:
                continue
            seen.add(key)
            items.append(it)

    upcoming = sorted([i for i in items if i["kind"] == "event" and i["date"] >= today_s],
                      key=lambda i: i["date"])
    recent = sorted([i for i in items if i not in upcoming],
                    key=lambda i: i["date"], reverse=True)
    items = (upcoming + recent)[:MAX_ITEMS]

    data = {
        "description": ("東部まちづくりの取組（自動生成・手編集不可）。"
                        ".github/scripts/build_tobu_actions.py が "
                        "data/official_pages/" + PREFIX + "*.txt から組み立てる。"
                        f"日付が直近{WINDOW_DAYS}日より古いものは載せない（これからの催しは残す）。"
                        "個々の記事ページへのリンクは許可されていないので url は持たない。"),
        "source_label": "小牧市 都市政策部 東部まちづくり推進室",
        "window_days": WINDOW_DAYS,
        "items": items,
    }
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    old = open(OUTPUT, encoding="utf-8").read() if os.path.exists(OUTPUT) else None
    if old != text:
        with open(OUTPUT, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"更新: {OUTPUT}（{len(items)}件 / うちこれからの催し {len(upcoming)}件 "
              f"/ スナップショット {len(paths)}枚）")
    else:
        print(f"変化なし: {OUTPUT}（{len(items)}件）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
