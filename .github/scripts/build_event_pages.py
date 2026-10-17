#!/usr/bin/env python3
"""スケジュールの予定ごとの固有ページを生成する（2026-10-11 ユーザー指示）。

schedule.html の「主要イベント一覧」にある手書きの予定（.event-item。日付は sched_date<N>、
内容は sched_desc<N> の辞書キー）1件ずつに、events/<開始日>-<N>.html を作る。

  ・検索結果と SNS のカードに予定そのものが出るよう、ページごとに日本語の title と
    description・og を持つ（外国語では js/main.js の EVENT PAGE が表示言語に書き換える）。
  ・本文の文字は辞書キー（sched_date<N> / sched_desc<N>）で流し込むので、翻訳は既存の
    12言語＋こどもむけがそのまま使われる。ページ側に訳を書き写さない。
  ・schedule.html の各予定には、id="ev-<開始日>-<N>" と固有ページへのリンクを書き込む
    （冪等。2回走らせても変わらない）。リンクは静的に書く — 検索エンジンがたどれるように。
  ・sitemap.xml の EVENTS:BEGIN〜END の間を作り直す。
  ・予定が schedule.html から消えたら、そのページも消す（古い予定を残すと、変わった日付が
    検索結果に残り続けるため）。消えた URL は 404.html が受ける。
  ・自動で足される催し（桃花台を考える会・東部の地域協議会・東部の都市計画の日程。data-auto）は実行時に
    描かれるもので辞書キーを持たないため、対象外。

使い方:
  python3 .github/scripts/build_event_pages.py          # 生成・更新
  python3 .github/scripts/build_event_pages.py --check  # 古ければ exit 1（auto_gates.py check 13）

生成物は手編集しないこと。
"""
import glob
import html as htmlmod
import json
import os
import re
import sys

SITE = "https://komaki-east-school-reorg.github.io/"
OUT_DIR = "events"
SITE_NAME = "小牧市東部（篠岡地区）学校再編ナビ"
HREFLANG = [("ja", ""), ("en", "en"), ("pt-BR", "pt"), ("vi", "vi"), ("tl", "tl"), ("es", "es"),
            ("zh-Hans", "zh"), ("id", "id"), ("ko", "ko"), ("ne", "ne"), ("tr", "tr"), ("my", "my"),
            ("x-default", "")]

# 予定の閉じタグは、開きタグと同じ字下げの </div>（中の event-date / event-desc の
# </div> と取り違えないため）。
ITEM_RE = re.compile(
    r'^(?P<indent>[ \t]*)(?P<open><div class="event-item(?P<cls>[^"]*)"(?P<attrs>[^>]*)>)'
    r'(?P<body>.*?)\n(?P=indent)</div>',
    re.S | re.M)


def plain(s):
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", htmlmod.unescape(s)).strip()


def items_of(sched):
    out = []
    for m in ITEM_RE.finditer(sched):
        attrs, body = m.group("attrs"), m.group("body")
        if "data-auto" in attrs:
            continue
        st = re.search(r'data-start="([\d-]+)"', attrs)
        dk = re.search(r'data-i18n(?:-html)?="sched_date(\d+)"', body)
        if not st or not dk:
            continue
        n = dk.group(1)
        ed = re.search(r'data-event-date="([\d-]+)"', attrs)
        date_ja = re.search(r'data-i18n="sched_date' + n + r'"[^>]*>(.*?)</div>', body, re.S)
        desc_ja = re.search(r'data-i18n-html="sched_desc' + n + r'"[^>]*>(.*?)</div>', body, re.S)
        desc_html = desc_ja.group(1).strip() if desc_ja else ""
        strong = re.search(r"<strong>(.*?)</strong>", desc_html, re.S)
        title = plain(strong.group(1)) if strong else plain(desc_html).split("（")[0][:40]
        out.append({
            "m": m, "n": n, "start": st.group(1),
            "end": ed.group(1) if ed else "",
            "cls": m.group("cls").strip(),
            "id": f"{st.group(1)}-{n}",
            "date_ja": plain(date_ja.group(1)) if date_ja else "",
            "date_html": date_ja.group(1).strip() if date_ja else "",
            "desc_html": desc_html,
            "title": title,
            "desc_plain": plain(desc_html),
        })
    return out


def chunk(sched, start_marker, end_marker):
    i = sched.index(start_marker)
    j = sched.index(end_marker, i)
    return sched[i:j]


def page(it, prev, nxt, header, share, footer):
    url = f"{SITE}{OUT_DIR}/{it['id']}.html"
    t = f"{it['title']}（{it['date_ja']}） – {SITE_NAME}"
    d = it["desc_plain"][:150]
    alt = "\n".join(
        f'  <link rel="alternate" hreflang="{hl}" href="{url}{"?lang=" + c if c else ""}">' for hl, c in HREFLANG)
    end_attr = f' data-event-date="{it["end"]}"' if it["end"] else ""
    cls = (" " + it["cls"]) if it["cls"] else ""

    def nav(x, key, label):
        if not x:
            return ""
        return (f'        <a class="event-nav-{key}" href="{OUT_DIR}/{x["id"]}.html">'
                f'<span class="event-nav-label" data-i18n="event_{key}">{label}</span>'
                f'<span class="event-nav-date" data-i18n="sched_date{x["n"]}">{htmlmod.escape(x["date_ja"])}</span></a>\n')

    return f'''<!DOCTYPE html>
<html lang="ja" data-page="event">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- 自動生成（.github/scripts/build_event_pages.py）。手編集しないこと。
       元は schedule.html の予定（sched_date{it['n']} / sched_desc{it['n']}）。
       events/ の下にあるので、css・js・data・リンクは <base href="/"> でサイトの根から解決する。 -->
  <base href="/">
  <title>{htmlmod.escape(t)}</title>
  <meta name="description" content="{htmlmod.escape(d)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="{SITE_NAME}｜桃花台エリアの非公式でもわかりやすい地域情報メディア">
  <meta property="og:title" content="{htmlmod.escape(t)}">
  <meta property="og:description" content="{htmlmod.escape(d)}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{SITE}img/og-image.png?v=20261011">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{htmlmod.escape(t)}">
  <meta name="twitter:description" content="{htmlmod.escape(d)}">
  <meta name="twitter:image" content="{SITE}img/og-image.png?v=20261011">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="manifest" href="manifest.ja.webmanifest">
  <link rel="apple-touch-icon" href="img/icon-180.png">
  <meta name="theme-color" content="#1b3826">
  <meta name="apple-mobile-web-app-title" content="学校再編ナビ">
  <link rel="stylesheet" href="css/style.css">
  <link rel="alternate" type="application/atom+xml" title="{SITE_NAME}｜最新の動き" href="{SITE}feed.xml">
  <link rel="canonical" href="{url}">
{alt}
</head>
<body>

{header}<main>

  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><a href="index.html" data-i18n="nav_home">ホーム</a> <span>›</span> <a href="schedule.html" data-i18n="nav_schedule">スケジュール</a> <span>›</span> <span data-i18n="sched_date{it['n']}">{htmlmod.escape(it['date_ja'])}</span></div>
      <h1 class="event-h1">{htmlmod.escape(it['title'])}</h1>
      <p class="event-h1-date" data-i18n="sched_date{it['n']}">{htmlmod.escape(it['date_ja'])}</p>
    </div>
  </section>

  <section class="section">
    <div class="container" style="max-width:760px;">
      <div class="event-list event-single">
        <div class="event-item{cls}" data-start="{it['start']}"{end_attr} id="ev-{it['id']}">
          <div class="event-date" data-i18n="sched_date{it['n']}">{it['date_html']}</div>
          <div class="event-desc" data-i18n-html="sched_desc{it['n']}">{it['desc_html']}</div>
        </div>
      </div>
      <p class="event-page-note" data-i18n="event_page_note">日時や内容は変わることがあります。最新の情報はスケジュールのページと小牧市の公式情報でご確認ください。</p>
      <p><a class="card-link" href="schedule.html#ev-{it['id']}" data-i18n="event_page_back">スケジュールの一覧で見る →</a></p>
      <div class="event-nav">
{nav(prev, "prev", "前の予定")}{nav(nxt, "next", "次の予定")}      </div>
    </div>
  </section>

{share}</main>
{footer}'''


def permalink(it):
    return (f'<a class="event-permalink" href="{OUT_DIR}/{it["id"]}.html" '
            f'data-i18n-aria="event_permalink" aria-label="この予定のページ"></a>')


def build():
    with open("schedule.html", encoding="utf-8") as f:
        sched = f.read()
    items = items_of(sched)
    header = chunk(sched, '<div class="notice-banner"', "<main>")
    share = chunk(sched, '  <section class="section share"', "</main>")
    footer = sched[sched.index("<footer>"):]

    # 1) schedule.html に id と固有ページへのリンクを書き込む（冪等）
    new_sched = []
    pos = 0
    for it in items:
        m = it["m"]
        new_sched.append(sched[pos:m.start("open")])
        op = m.group("open")
        op = re.sub(r'\s+id="ev-[^"]*"', "", op)
        op = op[:-1] + f' id="ev-{it["id"]}">'
        body = re.sub(r'\n[ \t]*<a class="event-permalink"[^>]*></a>', "", m.group("body"))
        indent = m.group("indent")
        body = body + f"\n{indent}  {permalink(it)}"
        new_sched.append(op + body + "\n" + indent + "</div>")
        pos = m.end()
    new_sched.append(sched[pos:])
    new_sched = "".join(new_sched)

    # 2) 予定ごとのページ（並びは開始日の順。前後の予定へのリンクに使う）
    order = sorted(items, key=lambda x: (x["start"], int(x["n"])))
    pages = {}
    for i, it in enumerate(order):
        prev = order[i - 1] if i > 0 else None
        nxt = order[i + 1] if i + 1 < len(order) else None
        pages[f"{OUT_DIR}/{it['id']}.html"] = page(it, prev, nxt, header, share, footer)

    # 3) sitemap.xml の EVENTS ブロック
    with open("sitemap.xml", encoding="utf-8") as f:
        sm = f.read()
    urls = []
    for it in order:
        u = f"{SITE}{OUT_DIR}/{it['id']}.html"
        links = "\n".join(
            f'    <xhtml:link rel="alternate" hreflang="{hl}" href="{u}{"?lang=" + c if c else ""}"/>'
            for hl, c in HREFLANG)
        urls.append(f"  <url>\n    <loc>{u}</loc>\n{links}\n  </url>")
    block = ("  <!-- EVENTS:BEGIN 予定ごとの固有ページ。build_event_pages.py が生成する。手編集しないこと -->\n"
             + "\n".join(urls) + "\n  <!-- EVENTS:END -->\n")
    if "<!-- EVENTS:BEGIN" in sm:
        sm = re.sub(r"  <!-- EVENTS:BEGIN.*?<!-- EVENTS:END -->\n", lambda _: block, sm, flags=re.S)
    else:
        sm = sm.replace("</urlset>", block + "</urlset>")
    return new_sched, pages, sm


def main():
    check = "--check" in sys.argv
    new_sched, pages, sm = build()
    changed = []

    def put(path, text):
        old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
        if old != text:
            changed.append(path)
            if not check:
                os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
                with open(path, "w", encoding="utf-8") as f:
                    f.write(text)

    put("schedule.html", new_sched)
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
                print(f"NG: 予定ページが古い/未生成: {c}")
            print("→ python3 .github/scripts/build_event_pages.py を実行してコミットすること")
            sys.exit(1)
        print(f"OK: 予定ページは最新（{len(pages)}件）")
        return
    print(f"予定ページ {len(pages)} 件。更新: {len(changed)} ファイル")


if __name__ == "__main__":
    main()
