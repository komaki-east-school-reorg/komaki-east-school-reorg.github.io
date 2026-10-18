#!/usr/bin/env python3
"""
都市計画課の掲載のうち、東部地域に関係するものを data/toshikeikaku_east.json に組み立てる。
2026-10-17 追加（ユーザー指示）。review.html の「都市計画の動き（東部地域）」の元。

■ 市サーバへは一切アクセスしない
   fetch_news.py が監視対象として data/official_pages/toshikeikaku-1-*.txt に
   本文スナップショットをすでに保存している。このスクリプトはそれを読むだけ。
   （このため、fetch_news.py の【あと】に実行すること。）

■ 何を拾うか
   題名または本文に東部の地名（build_community_events.py の EAST_PLACE_KEYWORDS ＝
   当サイトが東部の地名として使っているもの）があるページ。索引ページと、申請書の
   様式集（同じ様式が別の索引にも載っている）は拾わない。
   図やPDFの中は読めないので、**載っていない＝存在しない ではない**。

■ 新しい順に MAX_ITEMS（5件。ユーザー指示）
   日付はページの「更新日」。昔からあるページ（桃花台地区計画など）も、更新日が
   新しければ上に来る。「新着」の札は画面側（js/main.js）が日付から付ける。

■ リンク
   市サイトへのリンクは許可された索引ページのみ（CLAUDE.md／auto_gates.py check 6）。
   2026-10-17 に都市計画課の索引が許可に加わったので、コーナーの「出典」だけ
   そこへリンクする（URL は js/main.js が持つ＝機械検査の対象になる）。
   個々の記事ページは許可されていないので、項目は url を持たない。

■ 決まった日程はスケジュールへ（2026-10-18 ユーザー指示）
   東部に関係するページ（上と同じ判定。表示の5件に限らない）に「開催日時」「開催期日」
   「閲覧期間」「縦覧期間」「意見募集期間」の見出しがあり、その次の行に日付が読めたものを
   events に入れる。js/main.js の KomakiTokadaiEvents() がこれを予定の形に直し、カレンダー・
   schedule.html の一覧・トップの帯へ足す。
   ・SCHEDULE_SINCE より前に終わった日程は入れない（過去の会議録までさかのぼって足さない）。
   ・題名に「中止」「延期」があるページは日程を入れない。「は開催しません」とあるページは
     開催日（1日の予定）を入れない（閲覧期間は実際に行われたので残す）。
   ・日付が読めない書き方・図やPDFの中の日程は拾えない。推測で補わない。
   ・新しい日程が載ったら、更新履歴（data/site-updates.json）に1行足す（2026-10-18 ユーザー指示）。
     カットインは都市計画関連の行を出さないが、この行（auto_key が toshikeikaku: 始まり）だけは出す。
     auto_key は同じ日程を二度足さないための目印なので消さないこと。終わった日程はさかのぼって足さない。
     更新履歴を書くのは生成モードだけ（--check では書かない）。

■ 出力は入力だけで決まる（実行時刻を入れない）。生成物なので手で編集しないこと。

使い方:
  python3 .github/scripts/build_toshikeikaku.py           # 生成
  python3 .github/scripts/build_toshikeikaku.py --check   # 古ければ exit 1

終了コード: 0 = 生成した／最新, 1 = 致命的エラー・古い（--check）
"""
import datetime
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_community_events import EAST_PLACE_KEYWORDS, SITE_UPDATES, UPDATE_MAX_CHARS  # noqa: E402

SNAPSHOT_DIR = "data/official_pages"
PREFIX = "toshikeikaku-1-"
OUTPUT = "data/toshikeikaku_east.json"
MAX_ITEMS = 5
MAX_HITS = 3
SCHEDULE_SINCE = "2026-10-17"   # このコーナーを置いた日。これより前に終わった日程は足さない

# 見出し（【】を外したもの）→ 日程の種類。day = 1日の予定、viewing / pubcom = 期間
DATE_LABELS = {"開催日時": "day", "開催期日": "day",
               "閲覧期間": "viewing", "縦覧期間": "viewing", "意見募集期間": "pubcom"}
DATE_RE = re.compile(r"(?:(\d{4})|(令和|平成)(元|\d{1,2}))年(\d{1,2})月(\d{1,2})日")
MD_RE = re.compile(r"(\d{1,2})月(\d{1,2})日")
ERA = {"令和": 2018, "平成": 1988}

UPDATED_RE = re.compile(r"^更新日：\s*(\d{4})年(\d{1,2})月(\d{1,2})日")
# 様式集（申請書ダウンロード）は同じ様式が各分野の索引にも載っているので拾わない
SKIP_PREFIXES = (PREFIX + "1-1-",)

# スラッグの一部 → 種類（js/main.js が表示言語に訳す）。上から順に当てる。
KINDS = [
    (PREFIX + "denshikokuji-", "notice"),       # 電子告示
    (PREFIX + "kouchoukai-", "hearing"),        # 公聴会
    (PREFIX + "3-", "pubcom"),                  # パブリックコメント
    (PREFIX + "4-", "meeting"),                 # 審議会・会議録・開催案内
    (PREFIX + "2_1-tochiriyou-", "landuse"),    # 土地利用・地区計画
    (PREFIX + "2_1-toshikeikaku-", "plan"),     # マスタープラン・立地適正化計画
    (PREFIX + "1_1-", "landscape"),             # 都市景観・屋外広告物
]


def read_snapshot(path):
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    _, _, body = raw.partition("\n---\n")
    return [l.strip() for l in body.split("\n") if l.strip()]


def kind_of(name):
    for key, kind in KINDS:
        if name.startswith(key):
            return kind
    return "other"


def _year(m):
    if m.group(1):
        return int(m.group(1))
    n = 1 if m.group(3) == "元" else int(m.group(3))
    return ERA[m.group(2)] + n


def _iso(y, mo, d):
    return f"{y:04d}-{int(mo):02d}-{int(d):02d}"


def dates_of(title, lines):
    """ページから決まった日程を拾う。[{role, date, start?, date_note?}]"""
    if "中止" in title or "延期" in title:
        return []
    not_held = any("は開催しません" in l for l in lines)
    out = []
    for i, l in enumerate(lines[:-1]):
        role = DATE_LABELS.get(l.strip("【】 "))
        if not role:
            continue
        nxt = lines[i + 1]
        m = DATE_RE.search(nxt)
        if not m:
            continue
        first = _iso(_year(m), m.group(4), m.group(5))
        if role == "day":
            if not_held:
                continue
            out.append({"role": role, "date": first, "date_note": nxt})
            continue
        m2 = DATE_RE.search(nxt, m.end())
        if m2:
            end = _iso(_year(m2), m2.group(4), m2.group(5))
        else:
            md = MD_RE.search(nxt, m.end())
            if not md:
                continue
            y = _year(m)
            end = _iso(y, md.group(1), md.group(2))
            if end < first:
                end = _iso(y + 1, md.group(1), md.group(2))
        if end < first:
            continue
        out.append({"role": role, "date": end, "start": first})
    return out


def build():
    items, events = [], []
    for path in sorted(glob.glob(os.path.join(SNAPSHOT_DIR, PREFIX + "*.txt"))):
        name = os.path.basename(path)
        if name.endswith("-index.txt") or name.startswith(SKIP_PREFIXES):
            continue
        lines = read_snapshot(path)
        if not lines:
            continue
        title = lines[0]
        updated = None
        for l in lines[:6]:
            m = UPDATED_RE.match(l)
            if m:
                updated = f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
                break
        if not updated:
            continue
        text = "\n".join(lines)
        hits = []
        for k in EAST_PLACE_KEYWORDS:
            # 「光ケ丘」と「光ヶ丘」のような表記ゆれは先に当たったほうだけ残す
            if k in text and k.replace("ヶ", "ケ") not in {h.replace("ヶ", "ケ") for h in hits}:
                hits.append(k)
        if not hits:
            continue
        items.append({
            "title": title,
            "updated_at": updated,
            "kind": kind_of(name),
            "in_title": any(k in title for k in EAST_PLACE_KEYWORDS),
            "hits": hits[:MAX_HITS],
            "slug": name[:-4],
        })
        seen = set()
        for ev in dates_of(title, lines):
            k = (ev["role"], ev["date"], ev.get("start"))
            if ev["date"] < SCHEDULE_SINCE or k in seen:
                continue
            seen.add(k)
            events.append(dict({"title": title}, **ev, slug=name[:-4]))
    # 更新日の新しい順。同じ日なら題名に地名があるものを先に、あとはスラッグ順（出力を安定させる）
    items.sort(key=lambda i: (i["updated_at"], i["in_title"], i["slug"]), reverse=True)
    events.sort(key=lambda e: (e.get("start", e["date"]), e["date"], e["slug"], e["role"]))
    total = len(items)
    data = {
        "description": ("都市計画課の掲載のうち東部地域に関係するもの（自動生成・手編集不可）。"
                        ".github/scripts/build_toshikeikaku.py が "
                        "data/official_pages/" + PREFIX + "*.txt から組み立てる。"
                        f"更新日の新しい順に{MAX_ITEMS}件。"
                        "個々の記事ページへのリンクは許可されていないので url は持たない。"
                        "events は東部に関係するページの決まった日程（スケジュールに自動で載る）。"),
        "source_label": "小牧市 都市政策部 都市計画課",
        "matched": total,
        "items": items[:MAX_ITEMS],
        "events": events,
    }
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n", total


ROLE_JA = {"day": "開催日", "viewing": "閲覧期間", "pubcom": "意見募集期間"}


def add_site_updates(events):
    """スケジュールに載る都市計画の日程で、まだ更新履歴に載せていないものを先頭に1件ずつ足す。"""
    if not os.path.exists(SITE_UPDATES):
        return 0
    with open(SITE_UPDATES, encoding="utf-8") as f:
        data = json.load(f)
    ups = data.get("updates", [])
    seen = {u.get("auto_key") for u in ups if u.get("auto_key")}
    today = datetime.date.today().isoformat()
    added = []
    for ev in events:
        key = "toshikeikaku:" + "|".join((ev["slug"], ev["role"], ev.get("start", ""), ev["date"]))
        if key in seen or ev["date"] < today:   # 終わった日程はさかのぼって載せない
            continue
        head = "都市計画「"
        tail = "」の" + ROLE_JA.get(ev["role"], "日程") + "を予定に掲載"
        title = ev["title"]
        room = UPDATE_MAX_CHARS - len(head) - len(tail)
        if len(title) > room:
            title = title[:room - 1] + "…"
        added.append({
            "date": today,
            "type": "content",
            "ja": head + title + tail,
            "en": "City planning date for the eastern district added to the schedule",
            "auto_key": key,
        })
        seen.add(key)
    if not added:
        return 0
    data["updates"] = added + ups
    with open(SITE_UPDATES, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    return len(added)


def main():
    if not os.path.isdir(SNAPSHOT_DIR):
        print(f"ERROR: {SNAPSHOT_DIR} がない", file=sys.stderr)
        return 1
    text, total = build()
    old = open(OUTPUT, encoding="utf-8").read() if os.path.exists(OUTPUT) else None
    if "--check" in sys.argv:
        if old != text:
            print(f"NG: {OUTPUT} が古い。python3 .github/scripts/build_toshikeikaku.py を実行すること",
                  file=sys.stderr)
            return 1
        print(f"OK: {OUTPUT} は最新")
        return 0
    if old != text:
        with open(OUTPUT, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"更新: {OUTPUT}（東部に関係する掲載 {total}件のうち {min(total, MAX_ITEMS)}件）")
    else:
        print(f"変化なし: {OUTPUT}")
    n = add_site_updates(json.loads(text)["events"])
    if n:
        print(f"更新履歴に {n}件 追加: {SITE_UPDATES}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
