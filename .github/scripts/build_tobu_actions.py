#!/usr/bin/env python3
"""
東部まちづくり（東部まちづくり推進室）の取組一覧を data/tobu_actions.json に組み立てる。

■ 市サーバへは一切アクセスしない
   fetch_news.py が「監視のみ」の対象として
   data/official_pages/toubumachidukuri-tobumachidukurisingikai-*.txt に
   本文スナップショットをすでに保存している。このスクリプトはそれを読むだけ。
   同じページを2度取りに行かないので、市サーバへの負荷は増えない。
   （このため、fetch_news.py の【あと】に実行すること。）

■ 何を拾うか
   「東部まちづくりニュース（年度別）」と「小牧市東部まちづくり審議会」のページは、
   本文が〈見出し（令和8年8月24日）〉という形で1件ずつ並んでいる。この
   「行末が（令和○年○月○日）で終わる短い行」だけを取組の見出しとみなす。
   本文の文は「。」で終わるのでこの形にはならず、日付の無い見出しは拾わない。
   拾えなかったからといって「載っていない」わけではない（図や PDF の中は読めない）。

■ リンクは張らない
   市サイトへのリンクは許可された2つのインデックスだけ（CLAUDE.md／
   auto_gates.py check 6）。東部まちづくりのページはその2つに含まれないので、
   JSON にも URL を持たせず、出典は「小牧市 東部まちづくり推進室」という
   文字だけで示す。読者が原文に当たる導線が要るなら、許可URLを増やす判断が先。

■ 出力は生成物。手で編集しないこと（次回実行で上書きされる）。

終了コード: 0 = 生成した（変化の有無は問わない）, 1 = 致命的エラー
"""
import glob
import json
import os
import re
import sys

SNAPSHOT_DIR = "data/official_pages"
PREFIX = "toubumachidukuri-tobumachidukurisingikai-"
OUTPUT = "data/tobu_actions.json"
# 画面に出すのは js/main.js 側で絞る。ここは少し多めに持つ。
MAX_ITEMS = 12

# 行末が（令和○年○月○日）で終わる見出し行。日付のあとに「・26日」「月曜日」等が
# 付くことがあるので、閉じ括弧までは何が来てもよい。
ITEM_RE = re.compile(
    r"^(?P<title>.{4,80}?)\s*[（(]令和(?P<y>\d{1,2})年(?P<m>\d{1,2})月(?P<d>\d{1,2})日[^)）]*[)）]$"
)
# 見出しではない行（ページの meta 行や本文の途中）を落とす
SKIP_WORDS = ("更新日", "ページID", "詳しくはこちら", "お問い合わせ", "電話番号")


def read_snapshot(path):
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    url, _, body = raw.partition("\n---\n")
    lines = [l.strip() for l in body.split("\n")]
    return url.strip(), [l for l in lines if l]


def page_title(lines):
    """本文1行目がページ見出し（更新日・ページIDより前）。"""
    return lines[0] if lines else ""


def parse_page(path):
    _url, lines = read_snapshot(path)
    if not lines:
        return []
    src = page_title(lines)
    out = []
    for line in lines:
        if any(w in line for w in SKIP_WORDS):
            continue
        m = ITEM_RE.match(line)
        if not m:
            continue
        title = m.group("title").strip("　 ・-—")
        if not title:
            continue
        y = 2018 + int(m.group("y"))       # 令和1年 = 2019年
        date = f"{y:04d}-{int(m.group('m')):02d}-{int(m.group('d')):02d}"
        out.append({
            "title": title,
            "date": date,
            "date_ja": f"令和{m.group('y')}年{m.group('m')}月{m.group('d')}日",
            "from": src,
        })
    return out


def main():
    if not os.path.isdir(SNAPSHOT_DIR):
        print(f"ERROR: {SNAPSHOT_DIR} がない", file=sys.stderr)
        return 1

    paths = sorted(glob.glob(os.path.join(SNAPSHOT_DIR, PREFIX + "*.txt")))
    items = []
    seen = set()
    for path in paths:
        try:
            found = parse_page(path)
        except Exception as e:
            print(f"  WARN 解析できない: {path}: {e}", file=sys.stderr)
            continue
        for it in found:
            key = (it["title"], it["date"])
            if key in seen:
                continue
            seen.add(key)
            items.append(it)

    # 新しい順。同日は取り込み順を保つ（市のページ内の並び）。
    items.sort(key=lambda it: it["date"], reverse=True)
    items = items[:MAX_ITEMS]

    data = {
        "description": ("東部まちづくりの取組（自動生成・手編集不可）。"
                        ".github/scripts/build_tobu_actions.py が "
                        "data/official_pages/" + PREFIX + "*.txt から組み立てる。"
                        "市サイトへのリンクは許可URL以外を張れないため url は持たない。"),
        "source_label": "小牧市 都市政策部 東部まちづくり推進室",
        "items": items,
    }
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    old = open(OUTPUT, encoding="utf-8").read() if os.path.exists(OUTPUT) else None
    if old != text:
        with open(OUTPUT, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"更新: {OUTPUT}（{len(items)}件 / スナップショット {len(paths)}枚）")
    else:
        print(f"変化なし: {OUTPUT}（{len(items)}件）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
