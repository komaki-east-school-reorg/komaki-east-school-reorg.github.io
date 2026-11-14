#!/usr/bin/env python3
"""Q&A の1問ずつの固有ページを生成する（2026-11-14 ユーザー承認の計画。検索の入口を増やすため）。

faq.html の「よくある質問」と bus.html の Q&A（.faq-item。質問は faq_q<N> / bus_faq_q<N>、
答えは faq_a<N> / bus_faq_a<N> の辞書キー）1問ずつに、qa/<質問のキーの _ を - に>.html を作る
（faq_q3 → qa/faq-q3.html。もとのページの直リンク #faq-q3 と同じ名前）。

  ・検索結果と SNS のカードに質問そのものが出るよう、ページごとに日本語の title（質問）と
    description（答えの頭）・og を持つ（外国語では js/main.js の QA PAGE が表示言語に書き換える）。
  ・静的な日本語の文は data/i18n/ja.json から取る（もとのページの HTML からではない）。
    辞書を直したら作り直すこと。本文は辞書キーで流し込むので、訳は既存の13辞書がそのまま使われる。
  ・もとのページの各 .faq-item に、固有ページへのリンク（a.qa-permalink）を書き込む
    （冪等。静的に書くのは検索エンジンがたどれるように）。
  ・sitemap.xml の QA:BEGIN〜END の間を作り直す。
  ・質問がもとのページから消えたら、そのページも消す（消えた URL は 404.html が受ける）。
  ・構造化データ（QAPage）は付けない。答えは市の公表を当サイトが書き直したもので、
    当サイトが答えの出どころではないため。FAQPage は faq.html だけ（i18n.js）。

使い方:
  python3 .github/scripts/build_qa_pages.py          # 生成・更新
  python3 .github/scripts/build_qa_pages.py --check  # 古ければ exit 1（auto_gates.py check 13b）

生成物は手編集しないこと。質問のキー名を変えると、公開済みの URL が変わる。
"""
import glob
import html as htmlmod
import json
import os
import re
import sys

SITE = "https://komaki-east-school-reorg.github.io/"
OUT_DIR = "qa"
SITE_NAME = "小牧市東部（篠岡地区）学校再編ナビ"
HREFLANG = [("ja", ""), ("en", "en"), ("pt-BR", "pt"), ("vi", "vi"), ("tl", "tl"), ("es", "es"),
            ("zh-Hans", "zh"), ("id", "id"), ("ko", "ko"), ("ne", "ne"), ("tr", "tr"), ("my", "my"),
            ("x-default", "")]

# もとのページ、質問のキーの頭、パンくずに出すページ名のキー、ページ冒頭の挿絵
SOURCES = [
    {"page": "faq.html", "prefix": "faq_q", "name_key": "faq_h1", "ill": "question.svg"},
    {"page": "bus.html", "prefix": "bus_faq_q", "name_key": "nav_bus", "ill": "bus.svg"},
]

# 1問の閉じタグは、開きタグと同じ字下げの </div>（中の .faq-a の </div> と取り違えないため）
ITEM_RE = re.compile(
    r'^(?P<indent>[ \t]*)(?P<open><div class="faq-item"[^>]*>)(?P<body>.*?)\n(?P=indent)</div>',
    re.S | re.M)
LINK_RE = re.compile(r'\n[ \t]*<a class="qa-permalink"[^>]*></a>')


def plain(s):
    s = re.sub(r'<span class="faq-tag">.*?</span>', "", s, flags=re.S)
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", htmlmod.unescape(s)).strip()


def items_of(text, src):
    out = []
    for m in ITEM_RE.finditer(text):
        q = re.search(r'data-i18n-html="(' + src["prefix"] + r'\d+)"', m.group("body"))
        if not q:
            continue
        qk = q.group(1)
        ak = qk.replace("_q", "_a")
        if f'data-i18n-html="{ak}"' not in m.group("body"):
            continue
        out.append({"m": m, "q": qk, "a": ak, "slug": qk.replace("_", "-"), "src": src})
    return out


def chunk(text, start_marker, end_marker):
    i = text.index(start_marker)
    j = text.index(end_marker, i)
    return text[i:j]


def permalink(it):
    return (f'<a class="qa-permalink" href="{OUT_DIR}/{it["slug"]}.html" '
            f'data-i18n-aria="qa_permalink" aria-label="この質問だけのページ"></a>')


def page(it, prev, nxt, ja, header, share, footer):
    src = it["src"]
    url = f"{SITE}{OUT_DIR}/{it['slug']}.html"
    q_html, a_html = ja[it["q"]], ja[it["a"]]
    t = f"{plain(q_html)} – {SITE_NAME}"
    d = plain(a_html)[:150]
    alt = "\n".join(
        f'  <link rel="alternate" hreflang="{hl}" href="{url}{"?lang=" + c if c else ""}">' for hl, c in HREFLANG)

    def nav(x, key, label):
        if not x:
            return ""
        return (f'        <a class="event-nav-{key}" href="{OUT_DIR}/{x["slug"]}.html">'
                f'<span class="event-nav-label" data-i18n="qa_{key}">{label}</span>'
                f'<span class="event-nav-date" data-i18n-html="{x["q"]}">{ja[x["q"]]}</span></a>\n')

    return f'''<!DOCTYPE html>
<html lang="ja" data-page="qa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- 自動生成（.github/scripts/build_qa_pages.py）。手編集しないこと。
       元は {src["page"]} の Q&A（{it["q"]} / {it["a"]}）。
       qa/ の下にあるので、css・js・data・リンクは <base href="/"> でサイトの根から解決する。 -->
  <base href="/">
  <title>{htmlmod.escape(t)}</title>
  <meta name="description" content="{htmlmod.escape(d)}">
  <meta name="robots" content="max-snippet:-1, max-image-preview:large">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="{SITE_NAME}｜桃花台エリアの非公式でもわかりやすい地域情報メディア">
  <meta property="og:title" content="{htmlmod.escape(t)}">
  <meta property="og:description" content="{htmlmod.escape(d)}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{SITE}img/og-image.png?v=20261011">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="黒板のデザインに「小牧市東部（篠岡地区）学校再編ナビ」と書かれたタイトル画像">
  <meta property="og:locale" content="ja_JP">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{htmlmod.escape(t)}">
  <meta name="twitter:description" content="{htmlmod.escape(d)}">
  <meta name="twitter:image" content="{SITE}img/og-image.png?v=20261011">
  <meta name="twitter:image:alt" content="黒板のデザインに「小牧市東部（篠岡地区）学校再編ナビ」と書かれたタイトル画像">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="manifest" href="manifest.ja.webmanifest">
  <link rel="apple-touch-icon" href="img/icon-180.png">
  <meta name="theme-color" content="#1b3826">
  <meta name="apple-mobile-web-app-title" content="学校再編ナビ">
  <link rel="stylesheet" href="css/style.css">
  <noscript><style>html:not(.i18n-ready) body {{ opacity: 1; }}</style></noscript>
  <link rel="alternate" type="application/atom+xml" title="{SITE_NAME}｜最新の動き" href="{SITE}feed.xml">
  <link rel="canonical" href="{url}">
{alt}
</head>
<body>

{header}<main>

  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><a href="index.html" data-i18n="nav_home">ホーム</a> <span>›</span> <a href="{src["page"]}#{it["slug"]}" data-i18n="{src["name_key"]}">{htmlmod.escape(plain(ja[src["name_key"]]))}</a></div>
      <img class="page-hero-ill" src="img/illust/{src["ill"]}" alt="" width="160" height="120" decoding="async">
      <h1 class="qa-h1" data-i18n-html="{it["q"]}">{q_html}</h1>
    </div>
  </section>

  <section class="section">
    <div class="container" style="max-width:760px;">
      <div class="qa-single" id="{it["slug"]}">
        <div class="qa-single-a" data-i18n-html="{it["a"]}">{a_html}</div>
      </div>
      <p class="event-page-note" data-i18n="recomposed_note">{htmlmod.escape(plain(ja["recomposed_note"]))}</p>
      <p><a class="card-link" href="{src["page"]}#{it["slug"]}" data-i18n="qa_page_back">ほかの質問といっしょに見る →</a></p>
      <div class="event-nav">
{nav(prev, "prev", "前の質問")}{nav(nxt, "next", "次の質問")}      </div>
    </div>
  </section>

{share}</main>
{footer}'''


def build():
    with open("data/i18n/ja.json", encoding="utf-8") as f:
        ja = json.load(f)
    sources, pages, order_all = {}, {}, []
    for src in SOURCES:
        with open(src["page"], encoding="utf-8") as f:
            text = f.read()
        items = [it for it in items_of(text, src) if it["q"] in ja and it["a"] in ja]

        # 1) もとのページの各問いに固有ページへのリンクを書き込む（冪等）
        new, pos = [], 0
        for it in items:
            m = it["m"]
            new.append(text[pos:m.start()])
            indent = m.group("indent")
            body = LINK_RE.sub("", m.group("body"))
            new.append(f'{indent}{m.group("open")}{body}\n{indent}  {permalink(it)}\n{indent}</div>')
            pos = m.end()
        new.append(text[pos:])
        sources[src["page"]] = "".join(new)

        # 2) 1問ずつのページ（並びはもとのページの順。前後の質問は同じページの中だけ）
        header = chunk(text, '<div class="notice-banner"', "<main>")
        share = chunk(text, '  <section class="section share"', "</main>")
        footer = text[text.index("<footer>"):]
        for i, it in enumerate(items):
            prev = items[i - 1] if i > 0 else None
            nxt = items[i + 1] if i + 1 < len(items) else None
            pages[f"{OUT_DIR}/{it['slug']}.html"] = page(it, prev, nxt, ja, header, share, footer)
        order_all += items

    # 3) sitemap.xml の QA ブロック
    with open("sitemap.xml", encoding="utf-8") as f:
        sm = f.read()
    urls = []
    for it in order_all:
        u = f"{SITE}{OUT_DIR}/{it['slug']}.html"
        links = "\n".join(
            f'    <xhtml:link rel="alternate" hreflang="{hl}" href="{u}{"?lang=" + c if c else ""}"/>'
            for hl, c in HREFLANG)
        urls.append(f"  <url>\n    <loc>{u}</loc>\n{links}\n  </url>")
    block = ("  <!-- QA:BEGIN Q&A の1問ずつのページ。build_qa_pages.py が生成する。手編集しないこと -->\n"
             + "\n".join(urls) + "\n  <!-- QA:END -->\n")
    if "<!-- QA:BEGIN" in sm:
        sm = re.sub(r"  <!-- QA:BEGIN.*?<!-- QA:END -->\n", lambda _: block, sm, flags=re.S)
    else:
        sm = sm.replace("</urlset>", block + "</urlset>")
    return sources, pages, sm


def main():
    check = "--check" in sys.argv
    sources, pages, sm = build()
    changed = []

    def put(path, text):
        old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
        if old != text:
            changed.append(path)
            if not check:
                os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
                with open(path, "w", encoding="utf-8") as f:
                    f.write(text)

    for p, t in sources.items():
        put(p, t)
    for p, t in pages.items():
        put(p, t)
    put("sitemap.xml", sm)
    stale = sorted(set(glob.glob(f"{OUT_DIR}/*.html")) - set(pages))
    for p in stale:
        changed.append(p + "（削除）")
        if not check:
            os.remove(p)

    if check:
        if changed:
            for c in changed[:10]:
                print(f"NG: Q&A のページが古い/未生成: {c}")
            print("→ python3 .github/scripts/build_qa_pages.py を実行してコミットすること")
            sys.exit(1)
        print(f"OK: Q&A のページは最新（{len(pages)}件）")
        return
    print(f"Q&A のページ {len(pages)} 件。更新: {len(changed)} ファイル")


if __name__ == "__main__":
    main()
