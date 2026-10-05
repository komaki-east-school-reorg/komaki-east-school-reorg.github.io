#!/usr/bin/env python3
"""
地域協議会イベント案内の一覧を data/community_events.json に組み立てる。

■ 市サーバへは一切アクセスしない
   fetch_news.py が「監視のみ」の対象として
   data/official_pages/sasaeai-3-3_2-chiikikyougikaievent-*.txt に
   本文スナップショットをすでに保存している。このスクリプトはそれを読むだけ。
   同じページを2度取りに行かないので、市サーバへの負荷は増えない。
   （このため、fetch_news.py の【あと】に実行すること。）

■ 篠岡地区以外のイベントも載せる理由
   市のイベント案内は市内16の小学校区すべてを対象にしている。
   篠岡地区の5協議会の記事だけに絞ると、現状ゼロ件で常に空になる。
   一方で「よその地区の協議会が実際に何をしているか」は、
   地域協議会とは何かを知りたい読者にとって具体例として役に立つ。
   そこで全件を載せ、篠岡地区のものだけ shinooka=true を立てて
   先頭に並べ、バッジを付ける（並べ替えと表示は js/main.js 側）。

■ 出力は生成物。手で編集しないこと（次回実行で上書きされる）。

■ 東部地域の催しは「地域の取組」・スケジュール・更新履歴へ（2026-10-05 ユーザー指示）
   shinooka=true（題名が篠岡地区5協議会の名前を含む、または会場が東部の地名を含む）で
   日付の読み取れた催しは、js/main.js が「地域の取組」とスケジュール・カレンダーへ足す。
   更新履歴（data/site-updates.json）にはこのスクリプトが1行足す。記事 URL を auto_key に
   残すので、同じ催しが二度足されることはない。

終了コード: 0 = 生成した（変化の有無は問わない）, 1 = 致命的エラー
"""
import datetime
import glob
import json
import os
import re
import sys

SNAPSHOT_DIR = "data/official_pages"
PREFIX = "sasaeai-3-3_2-chiikikyougikaievent-"
INDEX_FILE = PREFIX + "index.txt"
OUTPUT = "data/community_events.json"
# 掲載元として案内するのは、許可されている所管課インデックスのみ。
# 各イベントの個別URLは生成物である JSON 側にだけ入る（news.json と同じ扱い）。
SOURCE_URL = ("https://www.city.komaki.aichi.jp/admin/soshiki/"
              "kenkouikigai/sasaeai/3/3_2/index.html")

# 篠岡地区の5協議会。ここに載っている名前が記事タイトルに含まれていれば
# 「このサイトの読者に直接関係するイベント」として扱う。
SHINOOKA_COUNCILS = [
    "篠岡学区",
    "光ヶ丘小学校区",
    "大城小学校区",
    "桃ヶ丘小学校区",
    "陶小学校区",
]

# 会場がこの地名を含めば、どの協議会の催しでも東部地域で開かれるものとみなす。
# fetch_chunichi.py の AREA_KEYWORDS と同じ基準（「陶」単独は陶芸・陶器と紛れるので学校名の形のみ）。
EAST_PLACE_KEYWORDS = (
    "篠岡", "しのおか",
    "桃花台", "光ケ丘", "光ヶ丘", "桃ケ丘", "桃ヶ丘", "桃陵",
    "大城", "陶小",
    "城山", "大草", "上末", "下末", "高根", "大山", "池之内", "野口",
    "東部市民センター",
)

SITE_UPDATES = "data/site-updates.json"
UPDATE_MAX_CHARS = 45   # 更新履歴の ja は長くても45字（CLAUDE.md）

# 本文のうち、ここから先は市内の他イベントの羅列や問い合わせ先なので読まない。
STOP_LABELS = ("関連イベント", "関連ファイル", "この記事に関するお問い合わせ先")
FIELD_LABELS = {
    "開催場所・会場": "place",
    "開催日・期間": "when",
    "イベントの種類分野": "category",
}


def read_snapshot(path):
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    url, _, body = raw.partition("\n---\n")
    lines = [l.strip() for l in body.split("\n")]
    return url.strip(), [l for l in lines if l]


def parse_event(path):
    url, lines = read_snapshot(path)
    if not lines:
        return None
    # 本文の頭からストップ位置までだけを見る
    for i, l in enumerate(lines):
        if l.startswith(STOP_LABELS):
            lines = lines[:i]
            break

    ev = {"title": lines[0], "url": url}
    for i, l in enumerate(lines):
        m = re.match(r"^更新日：\s*(.+)$", l)
        if m:
            ev["updated_at"] = m.group(1).strip()
        key = FIELD_LABELS.get(l)
        if not key:
            continue
        # ラベルの次の行から、次のラベル／既知の見出しに当たるまでを値とする
        vals = []
        for nxt in lines[i + 1:]:
            if nxt in FIELD_LABELS or nxt in ("イベントの詳細", "内容", "ページID："):
                break
            vals.append(nxt)
        if vals:
            ev[key] = " ".join(vals).strip()

    if not ev.get("title"):
        return None
    ev["shinooka"] = (any(c in ev["title"] for c in SHINOOKA_COUNCILS)
                      or any(k in ev.get("place", "") for k in EAST_PLACE_KEYWORDS))
    d = event_date(ev.get("when", ""), ev.get("updated_at", ""))
    if d:
        ev["date"] = d
    return ev


def event_date(when, updated_at):
    """「10月10日 11時…」に年を補って YYYY-MM-DD にする。年は掲載ページの更新日の年で、
    それより2か月以上前になるなら翌年とみなす（年末に翌年1月の催しを載せる場合）。"""
    m = re.search(r"(\d{1,2})月(\d{1,2})日", when)
    u = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", updated_at)
    if not m or not u:
        return ""
    y = int(u.group(1))
    try:
        upd = datetime.date(y, int(u.group(2)), int(u.group(3)))
        d = datetime.date(y, int(m.group(1)), int(m.group(2)))
        if d < upd - datetime.timedelta(days=60):
            d = datetime.date(y + 1, d.month, d.day)
    except ValueError:
        return ""
    return d.isoformat()


def add_site_updates(events):
    """東部の催しで、まだ更新履歴に載せていないものを先頭に1件ずつ足す。"""
    if not os.path.exists(SITE_UPDATES):
        return 0
    with open(SITE_UPDATES, encoding="utf-8") as f:
        old = f.read()
    data = json.loads(old)
    ups = data.get("updates", [])
    seen = {u.get("auto_key") for u in ups if u.get("auto_key")}
    # 「地域の取組」に手で書いてある催し（data/community_actions.json）は、すでに載っているので足さない。
    # 手書き側は協議会名の前置きを外した題名のことがあるので、両方で照らす。
    try:
        with open("data/community_actions.json", encoding="utf-8") as f:
            hand = {a.get("title_ja", "") for a in json.load(f).get("actions", [])}
    except (OSError, ValueError):
        hand = set()
    today = datetime.date.today().isoformat()
    added = []
    for ev in events:
        if not ev.get("shinooka") or not ev.get("date") or ev["url"] in seen:
            continue
        if ev["date"] < today:   # 終わった催しはさかのぼって載せない
            continue
        short = re.sub(r"^\S*地域協議会\s+", "", ev["title"])
        if ev["title"] in hand or short in hand:
            continue
        title = ev["title"]
        # 題名がたいてい「◯◯小学校区地域協議会 …」なので、そのときは前置きを省く
        head = "「" if "協議会" in title else "地域協議会の催し「"
        tail = "」を地域の取組と予定に掲載"
        room = UPDATE_MAX_CHARS - len(head) - len(tail)
        if len(title) > room:
            title = title[:room - 1] + "…"
        added.append({
            "date": today,
            "type": "content",
            "ja": head + title + tail,
            "en": "Community council event added to community efforts and the schedule",
            "auto_key": ev["url"],
        })
        seen.add(ev["url"])
    if not added:
        return 0
    data["updates"] = added + ups
    with open(SITE_UPDATES, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    return len(added)


def index_order():
    """イベント案内インデックスに並んでいる順（＝市の掲載順）を返す。"""
    path = os.path.join(SNAPSHOT_DIR, INDEX_FILE)
    if not os.path.exists(path):
        return []
    _, lines = read_snapshot(path)
    # 見出し・更新日・ページID を飛ばした残りが記事タイトルの並び
    out = []
    for l in lines:
        if l in ("地域協議会イベント案内", "ページID：") or l.startswith("更新日："):
            continue
        if l.isdigit():
            continue
        out.append(l)
    return out


def main():
    if not os.path.isdir(SNAPSHOT_DIR):
        print(f"NG: {SNAPSHOT_DIR} がない", file=sys.stderr)
        return 1

    events = []
    for path in sorted(glob.glob(os.path.join(SNAPSHOT_DIR, PREFIX + "*.txt"))):
        if os.path.basename(path) == INDEX_FILE:
            continue
        try:
            ev = parse_event(path)
        except Exception as e:
            print(f"  WARN 解析できない: {path}: {e}", file=sys.stderr)
            continue
        if ev:
            events.append(ev)

    # 市の掲載順を保ち、そのうえで篠岡地区のものを前に出す
    order = index_order()
    def key(ev):
        try:
            pos = order.index(ev["title"])
        except ValueError:
            pos = len(order)
        return (0 if ev["shinooka"] else 1, pos)
    events.sort(key=key)

    data = {
        "description": ("地域協議会イベント案内（自動生成・手編集不可）。"
                        ".github/scripts/build_community_events.py が "
                        "data/official_pages/ のスナップショットから組み立てる。"
                        "shinooka=true は東部地域（篠岡地区5協議会、または会場が東部）のイベント。"
                        "date は when の月日に updated_at から年を補ったもの。"),
        "source_url": SOURCE_URL,
        "events": events,
    }
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    old = open(OUTPUT, encoding="utf-8").read() if os.path.exists(OUTPUT) else None
    if old != text:
        with open(OUTPUT, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"更新: {OUTPUT}（{len(events)}件 / うち篠岡地区 "
              f"{sum(1 for e in events if e['shinooka'])}件）")
    else:
        print(f"変化なし: {OUTPUT}（{len(events)}件）")
    n = add_site_updates(events)
    if n:
        print(f"更新履歴に {n} 件追加: {SITE_UPDATES}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
