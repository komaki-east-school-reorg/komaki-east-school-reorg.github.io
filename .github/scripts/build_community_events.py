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

終了コード: 0 = 生成した（変化の有無は問わない）, 1 = 致命的エラー
"""
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
    ev["shinooka"] = any(c in ev["title"] for c in SHINOOKA_COUNCILS)
    return ev


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
                        "shinooka=true は篠岡地区5協議会のイベント。"),
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
    return 0


if __name__ == "__main__":
    sys.exit(main())
