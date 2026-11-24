#!/usr/bin/env python3
"""各ページの <head> に、構造化データ（JSON-LD）を静的にも書く（2026-11-24 ユーザー指示
「サイト内全部の各ページで SEO および生成AIからのアクセスに対応を強化」）。

WebPage・BreadcrumbList・FAQPage は js/i18n.js が実行時に表示言語で組み立てているが、
生成AIのクローラ（GPTBot・ClaudeBot・PerplexityBot など）の多くは JavaScript を実行しないため、
それだけでは見えない。そこで日本語（canonical）の同じ内容を HTML にも書いておく。
i18n.js は同じ id（webpage-jsonld / breadcrumb-jsonld / faq-jsonld）の要素を getElementById で
見つけて中身を上書きする（こどもむけ・noindex では消す）ので、二重にはならない。

  WebPage        ：全ページ（404・voices を除く）。<title>・meta description・canonical から。
                   publisher は書かない（公式に見せないため。index.html の WebSite と同じ方針）。
  BreadcrumbList ：.breadcrumb のあるページ。静的な日本語の文字から。
  FAQPage        ：faq.html だけ。data/i18n/ja.json の faq_q<N> / faq_a<N> の連番から（最初の欠番で止まる）。

書く場所は各ページの <!-- SEO:BEGIN … --> 〜 <!-- SEO:END --> の間だけ（無ければ </head> の直前に作る）。
手で直さないこと。出力は入力だけで決まる（--check のため。日付も入れない —
dateModified は main.js の PAGE RECENT が実行時に入れる）。

使い方:  python3 .github/scripts/build_static_seo.py          # 書き出す
         python3 .github/scripts/build_static_seo.py --check  # 古ければ exit 1（auto_gates.py check 31）
タイトル・説明文・パンくず・Q&A（faq_q* / faq_a*）を変えたら実行すること。
"""
import glob
import html
import json
import re
import sys
from html.parser import HTMLParser

SKIP = {"404.html", "voices.html"}
BEGIN = "<!-- SEO:BEGIN（build_static_seo.py が生成。手で直さない） -->"
END = "<!-- SEO:END -->"
BLOCK_RE = re.compile(r"[ \t]*<!-- SEO:BEGIN.*?<!-- SEO:END -->\n?", re.S)


def strip_tags(s):
    s = re.sub(r"<[^>]+>", " ", str(s))
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def meta(src, attr, name):
    m = re.search(r'<meta\s+%s="%s"\s+content="([^"]*)"' % (attr, re.escape(name)), src)
    return html.unescape(m.group(1)) if m else None


class Crumbs(HTMLParser):
    """最初の div.breadcrumb の中の a（href と文字）と、最後の子 span の文字を拾う。"""

    def __init__(self):
        super().__init__()
        self.depth = 0          # breadcrumb の中の div の深さ（0 = 外）
        self.done = False
        self.items = []         # [href or None, text]
        self.cur = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.done:
            return
        if self.depth == 0:
            if tag == "div" and "breadcrumb" in (a.get("class") or "").split():
                self.depth = 1
            return
        if tag == "div":
            self.depth += 1
        elif tag == "a":
            self.cur = [a.get("href") or "", ""]
        elif tag == "span" and self.cur is None:
            self.cur = [None, ""]

    def handle_endtag(self, tag):
        if self.depth == 0 or self.done:
            return
        if tag in ("a", "span") and self.cur is not None:
            self.items.append(self.cur)
            self.cur = None
        elif tag == "div":
            self.depth -= 1
            if self.depth == 0:
                self.done = True

    def handle_data(self, data):
        if self.cur is not None:
            self.cur[1] += data


def breadcrumb(src, origin, canonical):
    p = Crumbs()
    p.feed(src)
    links = [(h, re.sub(r"\s+", " ", t).strip()) for h, t in p.items if h]
    spans = [re.sub(r"\s+", " ", t).strip() for h, t in p.items if h is None]
    spans = [s for s in spans if s and s != "›"]
    if not links or not spans:
        return None
    items = []
    for href, text in links:
        url = origin + ("" if href == "index.html" else re.sub(r"^\.?/", "", href))
        items.append((text, url))
    items.append((spans[-1], canonical))
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, "item": u}
            for i, (n, u) in enumerate(items)
        ],
    }


def faq_items(ja):
    out = []
    i = 1
    while ja.get(f"faq_q{i}") is not None and ja.get(f"faq_a{i}") is not None:
        q, a = strip_tags(ja[f"faq_q{i}"]), strip_tags(ja[f"faq_a{i}"])
        if q and a:
            out.append({"@type": "Question", "name": q,
                        "acceptedAnswer": {"@type": "Answer", "text": a}})
        i += 1
    return out


def script(id_, payload):
    body = json.dumps(payload, ensure_ascii=False, indent=2).replace("</", "<\\/")
    body = "\n".join("  " + line for line in body.splitlines())
    return f'  <script type="application/ld+json" id="{id_}">\n{body}\n  </script>'


def build(page, src, ja):
    title_m = re.search(r"<title>(.*?)</title>", src, re.S)
    canonical_m = re.search(r'<link rel="canonical" href="([^"]+)"', src)
    if not title_m or not canonical_m:
        return None
    canonical = canonical_m.group(1)
    origin = re.match(r"https://[^/]+/", canonical).group(0)
    site_name = meta(src, "property", "og:site_name")
    webpage = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": html.unescape(title_m.group(1).strip()),
        "description": meta(src, "name", "description"),
        "url": canonical,
        "inLanguage": "ja",
        "isPartOf": {"@type": "WebSite", "name": site_name, "url": origin},
    }
    image = meta(src, "property", "og:image")
    if image:
        webpage["primaryImageOfPage"] = {"@type": "ImageObject", "url": image}
    parts = [script("webpage-jsonld", {k: v for k, v in webpage.items() if v})]
    bc = breadcrumb(src, origin, canonical)
    if bc:
        parts.append(script("breadcrumb-jsonld", bc))
    if page == "faq.html":
        items = faq_items(ja)
        if items:
            parts.append(script("faq-jsonld", {
                "@context": "https://schema.org", "@type": "FAQPage",
                "inLanguage": "ja", "mainEntity": items}))
    return "  " + BEGIN + "\n" + "\n".join(parts) + "\n  " + END + "\n"


def render(page, src, ja):
    block = build(page, src, ja)
    base = BLOCK_RE.sub("", src)
    if block is None:
        return base
    return base.replace("</head>", block + "</head>", 1)


def main():
    check = "--check" in sys.argv
    with open("data/i18n/ja.json", encoding="utf-8") as f:
        ja = json.load(f)
    stale = []
    for page in sorted(glob.glob("*.html")):
        if page in SKIP:
            continue
        with open(page, encoding="utf-8") as f:
            src = f.read()
        new = render(page, src, ja)
        if new != src:
            stale.append(page)
            if not check:
                with open(page, "w", encoding="utf-8") as f:
                    f.write(new)
    if check:
        if stale:
            print("静的な構造化データが古い: " + ", ".join(stale))
            sys.exit(1)
        print("静的な構造化データは最新")
    else:
        print(f"書き出し: {len(stale)} ページ")


if __name__ == "__main__":
    main()
