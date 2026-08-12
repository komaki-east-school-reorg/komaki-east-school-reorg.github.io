#!/usr/bin/env python3
"""
再編対象8校（篠岡地区の小学校5校・中学校3校）の公式ホームページを巡回し、
各校の最新記事（タイトル・公開日）を data/school_news.json に保存する。

学校ホームページは市公式サイト（city.komaki.aichi.jp）とは別ドメイン
（komaki-aic.ed.jp）で、教育総務課ではなく各学校が更新している。
学校再編そのものの一次情報ではないため news.json とは分けて管理する。

各校トップページの記事カード（class="blogtitle" ＋「公開日」）を読む。
サイトの作りが変わって記事が1件も取れなくなった場合は、その学校の
既存データを維持したまま continue する（空で上書きしない）。

Exit codes: 0 = 内容に変化あり, 2 = 変化なし, 1 = 致命的エラー
"""
import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html import unescape

BASE = "https://www.komaki-aic.ed.jp/"
OUTPUT = "data/school_news.json"
MAX_ITEMS = 3          # 1校あたり画面に出す最新記事数
REQUEST_WAIT_MIN = 3.0  # 学校サーバへの負荷配慮（市サイトと同じ間隔）
REQUEST_WAIT_MAX = 5.0

# 再編対象8校。names は表示用（ja / ja-kids / en / zh。他言語は en にフォールバック）
SCHOOLS = [
    {"slug": "shinooka-e",    "level": "elem",
     "names": {"ja": "篠岡小学校",   "ja_kids": "しのおか小学校",     "en": "Shinooka Elem. School",      "zh": "篠冈小学"}},
    {"slug": "hikarigaoka-e", "level": "elem",
     "names": {"ja": "光ヶ丘小学校", "ja_kids": "ひかりがおか小学校", "en": "Hikari-ga-oka Elem. School", "zh": "光之丘小学"}},
    {"slug": "momogaoka-e",   "level": "elem",
     "names": {"ja": "桃ヶ丘小学校", "ja_kids": "ももがおか小学校",   "en": "Momo-ga-oka Elem. School",   "zh": "桃之丘小学"}},
    {"slug": "sue-e",         "level": "elem",
     "names": {"ja": "陶小学校",     "ja_kids": "すえ小学校",         "en": "Sue Elem. School",           "zh": "陶小学"}},
    {"slug": "ohshiro-e",     "level": "elem",
     "names": {"ja": "大城小学校",   "ja_kids": "おおしろ小学校",     "en": "Oshiro Elem. School",        "zh": "大城小学"}},
    {"slug": "shinooka-j",    "level": "jhs",
     "names": {"ja": "篠岡中学校",   "ja_kids": "しのおか中学校",     "en": "Shinooka Junior High",       "zh": "篠冈中学"}},
    {"slug": "hikarigaoka-j", "level": "jhs",
     "names": {"ja": "光ヶ丘中学校", "ja_kids": "ひかりがおか中学校", "en": "Hikari-ga-oka Junior High",  "zh": "光之丘中学"}},
    {"slug": "toryo-j",       "level": "jhs",
     "names": {"ja": "桃陵中学校",   "ja_kids": "とうりょう中学校",   "en": "Toryo Junior High",          "zh": "桃陵中学"}},
]

# 記事カード: <a href="..." class="blogtitle"> … <p class="card_parts_title"> … <dt>公開日</dt><dd>YYYY/MM/DD</dd>
CARD = re.compile(
    r'<a[^>]+href="([^"]+)"[^>]*class="blogtitle"[^>]*>.*?'
    r'<p class="card_parts_title\s*">\s*(.*?)\s*</p>.*?'
    r'<dt>公開日</dt>\s*<dd>\s*([\d/]+)\s*</dd>',
    re.DOTALL,
)


def polite_wait():
    time.sleep(random.uniform(REQUEST_WAIT_MIN, REQUEST_WAIT_MAX))


def fetch_html(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def clean(text):
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", "", text))).strip()


def to_iso(slashed):
    """'2026/07/18' → '2026-07-18'（読めなければ None）"""
    m = re.match(r"(\d{4})/(\d{1,2})/(\d{1,2})$", slashed)
    return "%s-%02d-%02d" % (m.group(1), int(m.group(2)), int(m.group(3))) if m else None


def parse_school(html, school_url):
    """記事カードを新しい順に MAX_ITEMS 件返す。取れなければ空リスト。"""
    items = []
    for href, title, pub in CARD.findall(html):
        iso = to_iso(pub.strip())
        title = clean(title)
        if not iso or not title:
            continue
        items.append({"title": title, "date": iso, "url": urllib.parse.urljoin(school_url, href)})
    items.sort(key=lambda x: x["date"], reverse=True)
    return items[:MAX_ITEMS]


def main():
    os.makedirs("data", exist_ok=True)

    old = {}
    if os.path.exists(OUTPUT):
        try:
            with open(OUTPUT, encoding="utf-8") as f:
                old = json.load(f)
        except Exception:
            old = {}
    old_by_slug = {s["slug"]: s for s in old.get("schools", [])}

    schools = []
    ok_count = 0
    for spec in SCHOOLS:
        url = BASE + spec["slug"] + "/"
        polite_wait()
        try:
            items = parse_school(fetch_html(url), url)
        except Exception as e:
            print("  ERROR %s: %s" % (spec["slug"], e), file=sys.stderr)
            items = []

        if items:
            ok_count += 1
            print("  %-14s %s  %s" % (spec["slug"], items[0]["date"], items[0]["title"][:34]))
        else:
            # 取得失敗・構造変化。前回の内容をそのまま維持する（空で上書きしない）
            prev = old_by_slug.get(spec["slug"])
            items = prev.get("items", []) if prev else []
            print("  %-14s (取得できず。前回の内容を維持)" % spec["slug"], file=sys.stderr)

        schools.append({
            "slug": spec["slug"],
            "level": spec["level"],
            "names": spec["names"],
            "url": url,
            "latest_date": items[0]["date"] if items else None,
            "items": items,
        })

    if ok_count == 0:
        print("ERROR: どの学校のページも取得できませんでした", file=sys.stderr)
        sys.exit(1)

    schools.sort(key=lambda s: (s["latest_date"] or "", s["slug"]), reverse=True)

    now = datetime.now(timezone.utc)
    new_data = {
        "fetched_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "各校公式ホームページ（小牧市立学校）",
        "max_items": MAX_ITEMS,
        "schools": schools,
    }

    changed = old.get("schools") != schools
    if not changed:
        new_data = {**old, "fetched_at": new_data["fetched_at"]}
        print("学校ホームページに更新はありません。")
    else:
        print("学校ホームページの更新を検知しました。")

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    sys.exit(0 if changed else 2)


if __name__ == "__main__":
    main()
