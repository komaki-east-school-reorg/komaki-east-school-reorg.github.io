#!/usr/bin/env python3
"""サイト内検索の索引を作る（2026-11-05 ユーザー指示「サイト内検索機能」）。

各ページの <main> を読み、辞書（data/i18n/*.json）の文で、言語ごとの索引
data/search/<言語>.json（12言語＋ja-kids）を書き出す。画面側は js/main.js の SITE SEARCH が、
検索の窓を初めて開いたときに表示言語の索引だけを読み込む。

1件の単位：
  ・<section> ごと（飛び先は PAGE TOC と同じ規則：節の id → 見出しの id → toc-<見出しのキー>）
  ・その中で id を持つ要素（予定 ev-…、根拠のカード rev-…、地域のレガシー legacy-… など）
  ・Q&A の1問ずつ（.faq-item。飛び先は SECTION LINKS と同じ「質問のキーの _ を - にしたもの」）
文は data-i18n / data-i18n-html のキーの訳（外国語は en を下敷きに重ねる。i18n.js と同じ）。
data-i18n の外にある文字（部署名・電話番号・年など、どの言語でも同じ）もそのまま入れる。
共有欄・関連するページ・目次・隠し要素（hidden）は入れない。<small> の副題は落とす。
自動で取り込む一覧（市のお知らせなど）は実行時に描かれるので入らない。

使い方:  python3 .github/scripts/build_search_index.py          # 書き出す
         python3 .github/scripts/build_search_index.py --check  # 古ければ exit 1（auto_gates.py check 23）
辞書や HTML の文を変えたら実行すること（ページ別辞書の build_page_dicts.py と同じ扱い）。
"""
import glob
import html
import json
import os
import re
import sys
from html.parser import HTMLParser

I18N = "data/i18n"
OUT = "data/search"
LANGS = ["ja", "ja-kids", "en", "pt", "vi", "tl", "es", "zh", "id", "ko", "ne", "tr", "my"]
SKIP_PAGES = {"voices.html", "404.html"}
PAGE_LABEL = {"index": "nav_home", "about": "nav_about", "schedule": "nav_schedule", "faq": "nav_faq",
              "council": "nav_council", "community": "nav_community", "map": "nav_map",
              "nationwide": "nav_nationwide", "bus": "nav_bus", "review": "nav_review",
              "clubs": "nav_clubs", "analysis": "rev_tab2", "site": "footer_site"}
SKIP_CLASSES = {"xlinks", "share", "related", "page-toc", "tts-row", "breadcrumb", "share-buttons", "mc-card", "faq-tools", "cal-month-list"}  # mc-card＝窓口で見せる日本語（日本語表示では出さない）
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


def load_dict(lang):
    def rd(l):
        with open(os.path.join(I18N, l + ".json"), encoding="utf-8") as f:
            return json.load(f)
    if lang == "ja":
        return rd("ja")
    if lang == "ja-kids":
        d = dict(rd("ja")); d.update(rd("ja-kids")); return d
    d = dict(rd("en"))
    if lang != "en":
        d.update(rd(lang))
    return d


def plain(s):
    s = re.sub(r"<small\b[^>]*>.*?</small>", "", s, flags=re.S)
    s = re.sub(r'<span class="faq-tag">.*?</span>', "", s, flags=re.S)
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


class Walker(HTMLParser):
    """<main> の中を歩き、(飛び先, 見出しのキー or 文, [文の断片…]) の並びを作る。
    断片は ('k', キー) か ('t', 生の文字)。言語ごとの文はあとで当てる。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # (tag, info)
        self.in_main = False
        self.skip = 0            # 入れない要素の深さ
        self.keyed = 0           # data-i18n の要素の中（中の生文字は訳で置き換わるので拾わない）
        self.records = []        # {'a': anchor, 'h': [frags], 't': [frags]}
        self.cur = []            # 開いている record の添字のスタック
        self.heads = []          # main 内の h2.section-title の順（toc-N 用）

    def _new(self, anchor):
        parent = self.cur[-1] if self.cur else None
        self.records.append({"a": anchor, "h": [], "t": [], "parent": parent})
        return len(self.records) - 1

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "main":
            self.in_main = True
        info = {"rec": None, "skip": False, "keyed": False, "head": False, "sec": False, "faq": False}
        cls = set((a.get("class") or "").split())
        if self.in_main:
            if self.skip or "hidden" in a or (cls & SKIP_CLASSES) or tag in ("nav", "script", "style", "template", "dialog", "select"):
                info["skip"] = True
                self.skip += 1
            else:
                if tag == "section":
                    info["sec"] = True
                    info["rec"] = self._new(a.get("id") or "")
                    self.records[info["rec"]]["sec_id"] = a.get("id") or ""
                elif "faq-item" in cls:
                    info["faq"] = True
                    info["rec"] = self._new("")
                elif a.get("id") and self.cur:
                    info["rec"] = self._new(a["id"])
                if info["rec"] is not None:
                    self.cur.append(info["rec"])
                key = a.get("data-i18n-html") or a.get("data-i18n")
                is_h2 = tag == "h2" and "section-title" in cls
                if self.cur and key and not self.keyed:
                    r = self.records[self.cur[-1]]
                    head = False
                    if info["faq"] or (r["a"] == "" and r.get("sec_id") is None and not r["h"]):
                        # Q&A の1問：最初のキー（質問）で飛び先と見出しが決まる
                        if not r["a"]:
                            r["a"] = key.replace("_", "-")
                        head = not r["h"]
                    elif is_h2:
                        head = not r["h"]
                    elif tag in ("h3", "h4") and not r["h"] and r.get("sec_id") is None:
                        head = True
                    if is_h2:
                        self.heads.append(key)
                        if r.get("sec_id") is not None and "h2key" not in r:
                            r["h2key"] = key
                            r["h2id"] = a.get("id") or ""
                    (r["h"] if head else r["t"]).append(("k", key))
                    info["keyed"] = True
                    self.keyed += 1
                elif is_h2:
                    self.heads.append(key or "")
        self.stack.append((tag, info))
        if tag in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == "main":
            self.in_main = False
        # 対応する開始タグまで巻き戻す（閉じ忘れに強くする）
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                for t, info in reversed(self.stack[i:]):
                    if info["skip"]:
                        self.skip -= 1
                    if info["keyed"]:
                        self.keyed -= 1
                    if info["rec"] is not None and self.cur and self.cur[-1] == info["rec"]:
                        self.cur.pop()
                del self.stack[i:]
                return

    def handle_data(self, data):
        if self.in_main and not self.skip and not self.keyed and self.cur:
            t = re.sub(r"\s+", " ", data).strip()
            if t and re.search(r"\w", t):
                self.records[self.cur[-1]]["t"].append(("t", t))


def page_records(path):
    w = Walker()
    with open(path, encoding="utf-8") as f:
        w.feed(f.read())
    out = []
    for r in w.records:
        if r.get("sec_id") is not None:
            # PAGE TOC と同じ飛び先：節の id → 見出しの id → toc-<キー>
            k = r.get("h2key")
            if r["sec_id"] and k:
                r["a"] = r["sec_id"]
            elif r.get("h2id"):
                r["a"] = r["h2id"]
            elif k:
                r["a"] = "toc-" + k
            else:
                r["a"] = r["sec_id"]
        has_key = any(k == "k" for k, _ in r["h"] + r["t"])
        if r.get("sec_id") is None and not has_key:
            continue   # カレンダーの送りボタンのような、文を持たない部品の id は項目にしない
        if r["t"] or r["h"]:
            out.append(r)
    return w.records, out


def text_of(frags, d):
    parts = []
    for kind, v in frags:
        parts.append(plain(d.get(v, "")) if kind == "k" else v)
    return re.sub(r"\s+", " ", " ".join(p for p in parts if p)).strip()


def build():
    pages = [p for p in sorted(glob.glob("*.html")) if p not in SKIP_PAGES]
    rs_all = {}
    recs = {}
    for p in pages:
        allr, keep = page_records(p)
        rs_all[p[:-5]] = allr
        recs[p[:-5]] = keep
    result = {}
    for lang in LANGS:
        d = load_dict(lang)
        labels = {pid: plain(d.get(PAGE_LABEL.get(pid, ""), "")) or pid for pid in recs}
        items = []
        seen = {}
        for pid, rs in recs.items():
            for r in rs:
                h = text_of(r["h"], d)
                t = text_of(r["t"], d)
                if not (h or t):
                    continue
                q = r
                while not h and q.get("parent") is not None:
                    q = rs_all[pid][q["parent"]]
                    h = text_of(q["h"], d)
                if not h:
                    h = labels[pid]
                key = (pid, r["a"])
                if key in seen:
                    # 同じ飛び先（ページの先頭など）は1件にまとめる。見出しは先に出たほう
                    it = seen[key]
                    it[3] = (it[3] + " " + t).strip()
                    continue
                it = [pid, r["a"], h, t]
                seen[key] = it
                items.append(it)
        result[lang] = {"v": 1, "pages": labels, "items": items}
    return result


def dump(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"


def main():
    check = "--check" in sys.argv
    res = build()
    stale = []
    if not check:
        os.makedirs(OUT, exist_ok=True)
    for lang, obj in res.items():
        path = os.path.join(OUT, lang + ".json")
        s = dump(obj)
        old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
        if old != s:
            stale.append(path)
            if not check:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(s)
    n = len(res["ja"]["items"])
    if check:
        if stale:
            print("NG: 検索の索引が古い。python3 .github/scripts/build_search_index.py を実行すること:", ", ".join(stale))
            sys.exit(1)
        print(f"OK: 検索の索引は最新（{len(res)}言語・{n}件）")
    else:
        print(f"検索の索引: {len(res)}言語・{n}件（更新 {len(stale)} ファイル）")


if __name__ == "__main__":
    main()
