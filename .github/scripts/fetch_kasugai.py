#!/usr/bin/env python3
"""
春日井市の学校再編（「小中学校の適正規模等について」）の監視。2026-11-07 ユーザー指示。

  https://www.city.kasugai.lg.jp/kosodate/kyouiku/school/1009208/index.html

の索引と、その配下（/kosodate/kyouiku/school/1009208/ の下）の HTML ページを毎日1回ずつ取り、
  ・本文スナップショット … data/official_pages/kasugai/<slug>.txt
  ・ページの一覧       … data/kasugai_reorg.json（about.html#kasugai の自動の一覧の元）
を書く。添付 PDF は辿らない（本文は fetch_pdf_docs.py の kasugai-* 群が取り出す）。

・取得は fetch_news.py の curl（Cookie jar つき）を使う。春日井市のサイトも小牧市と同じく、
  Cookie を持たないと 302 が無限に続く WAF の下にある。リクエストの間は 3〜5 秒あける。
・スナップショットはサブディレクトリに置くので、fetch_news.py の剪定（直下の .txt だけ）に
  消されない。市がページを下ろしても、ここでは消さない（根拠の裏取りのため）。
・取れなかったページは前回の一覧の行とスナップショットをそのまま残す。
・data/kasugai_reorg.json には取得日時を書かない（変化の無い日にコミットを作らないため）。
  最後に確かめた日時は record_fetch_status.py の kasugai が持つ。

Exit codes: 0 = 変化あり, 2 = 変化なし, 1 = 索引を取得できない
"""
import json
import os
import re
import sys
import urllib.parse
from html import unescape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_news  # noqa: E402

BASE = "https://www.city.kasugai.lg.jp"
ROOT = BASE + "/kosodate/kyouiku/school/1009208/"
INDEX = ROOT + "index.html"
SNAP_DIR = os.path.join("data", "official_pages", "kasugai")
OUTPUT = os.path.join("data", "kasugai_reorg.json")
MAX_DEPTH = 2      # 索引 → ページ／下位索引 → その中のページ まで
MAX_PAGES = 40     # 市サーバへの負荷の上限（いまは約15ページ）

# 索引の見出し（h2/h3）→ 地区の札
AREAS = [("坂下", "sakashita"), ("高蔵寺ニュータウン", "kozoji")]

DROP_LINES = {"ツイート", "シェア", "印刷", "大きな文字で印刷"}


def article(html):
    m = re.search(r'<article id="content"[^>]*>(.*?)</article>', html, re.DOTALL)
    return m.group(1) if m else None


def text_of(fragment):
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", fragment, flags=re.DOTALL)
    s = unescape(re.sub(r"<[^>]+>", "\n", s))
    lines = [" ".join(line.split()) for line in s.split("\n")]
    out = []
    for line in lines:
        if not line or line in DROP_LINES:
            continue
        # PDF 閲覧ソフトの案内は毎ページ同じで、変化の検知に要らない
        if "Adobe" in line or line.startswith("PDFファイルをご覧いただくには") or "からダウンロード（無料）" in line \
                or line == "アドビシステムズ社のサイト（新しいウィンドウ）":
            continue
        out.append(line)
    return "\n".join(out) + "\n"


def wareki_to_iso(s):
    m = re.search(r"(令和|平成)\s*(\d+|元)\s*年\s*(\d+)\s*月\s*(\d+)\s*日", s or "")
    if not m:
        return None
    n = 1 if m.group(2) == "元" else int(m.group(2))
    y = (2018 if m.group(1) == "令和" else 1988) + n
    return f"{y:04d}-{int(m.group(3)):02d}-{int(m.group(4)):02d}"


def slug_of(url):
    rest = url[len(ROOT):]
    rest = re.sub(r"\.html$", "", rest) or "index"
    return re.sub(r"[^A-Za-z0-9_-]", "-", rest.replace("/", "-"))


def links_in(body, page_url):
    """本文中の、監視の木の中の HTML ページへのリンク（出てくる順・重複なし）と、
    そのリンクの直前の見出し（h2/h3）を返す。"""
    out, seen, heading = [], set(), ""
    for m in re.finditer(r'<h[23][^>]*>(.*?)</h[23]>|<a\s[^>]*href="([^"]+)"', body, re.DOTALL):
        if m.group(1) is not None:
            heading = " ".join(unescape(re.sub(r"<[^>]+>", "", m.group(1))).split())
            continue
        url = urllib.parse.urljoin(page_url, unescape(m.group(2).strip()))
        url = url.split("#", 1)[0]
        if url.startswith("http://"):
            url = "https://" + url[7:]
        if not url.startswith(ROOT) or not url.endswith(".html"):
            continue
        out.append((url, heading))
        if url not in seen:
            seen.add(url)
    return out


def save_snapshot(url, text):
    os.makedirs(SNAP_DIR, exist_ok=True)
    path = os.path.join(SNAP_DIR, slug_of(url) + ".txt")
    content = url + "\n---\n" + text
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            if f.read() == content:
                return False
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return True


def main():
    try:
        with open(OUTPUT, encoding="utf-8") as f:
            prev = {it["slug"]: it for it in json.load(f).get("items", [])}
    except (OSError, ValueError, KeyError):
        prev = {}

    changed = False
    items = {}
    areas = {}          # slug → 地区の札の集合（索引の見出しから）
    queue = [(INDEX, 0)]
    visited = set()
    index_ok = False

    while queue and len(visited) < MAX_PAGES:
        url, depth = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)
        if url != INDEX:
            fetch_news.polite_wait()
        slug = slug_of(url)
        try:
            html = fetch_news.fetch_html(url)
        except Exception as e:
            print(f"  ERROR {url}: {e}", file=sys.stderr)
            if slug in prev:
                items[slug] = prev[slug]
            continue
        fetch_news.cache_html(url, html)   # fetch_pdf_docs.py が同じページを取り直さないように
        body = article(html)
        if body is None:
            print(f"  WARN: 本文が見つからない {url}", file=sys.stderr)
            if slug in prev:
                items[slug] = prev[slug]
            continue
        if url == INDEX:
            index_ok = True
        text = text_of(body)
        if save_snapshot(url, text):
            changed = True
            print(f"  changed  {slug}")
        h1 = re.search(r"<h1[^>]*>(.*?)</h1>", body, re.DOTALL)
        title = " ".join(unescape(re.sub(r"<[^>]+>", "", h1.group(1))).split()) if h1 else slug
        upd = re.search(r"更新日[\s　]*((?:令和|平成)[^<\n]*?日)", body)
        items[slug] = {"slug": slug, "title": title,
                       "updated": wareki_to_iso(upd.group(1)) if upd else None}
        if depth < MAX_DEPTH:
            for link, heading in links_in(body, url):
                if url == INDEX:
                    tag = next((v for k, v in AREAS if k in heading), "general")
                    areas.setdefault(slug_of(link), set()).add(tag)
                elif slug_of(link) not in areas:
                    # 下位索引の中のページは、親の地区の札を受け継ぐ
                    areas[slug_of(link)] = set(areas.get(slug, {"general"}))
                if link not in visited:
                    queue.append((link, depth + 1))

    if not index_ok:
        print("ERROR: 索引を取得できない", file=sys.stderr)
        sys.exit(1)

    # 地区の札：索引の両地区に出てくるもの（推計・アンケートなど）は both
    for slug, it in items.items():
        tags = areas.get(slug) or ({prev[slug].get("area")} if slug in prev else {"general"})
        tags.discard(None)
        named = tags - {"general", "both"}
        it["area"] = "both" if len(named) > 1 or "both" in tags else (named.pop() if named else "general")
    items.pop("index", None)   # 索引そのものは一覧に出さない（出典の1本としてリンクする）

    rows = sorted(items.values(), key=lambda it: (it.get("updated") or "", it["title"]), reverse=True)
    out = {
        "description": "春日井市「小中学校の適正規模等について」の配下ページの一覧。"
                       ".github/scripts/fetch_kasugai.py が毎日作る。手で編集しないこと。",
        "source_url": INDEX,
        "items": rows,
    }
    new = json.dumps(out, ensure_ascii=False, indent=2) + "\n"
    old = open(OUTPUT, encoding="utf-8").read() if os.path.exists(OUTPUT) else ""
    if new != old:
        with open(OUTPUT, "w", encoding="utf-8") as f:
            f.write(new)
        changed = True
    print(f"{len(rows)} pages, {'changed' if changed else 'no change'}")
    sys.exit(0 if changed else 2)


if __name__ == "__main__":
    main()
