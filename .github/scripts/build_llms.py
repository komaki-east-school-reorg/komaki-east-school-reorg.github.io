#!/usr/bin/env python3
"""生成AI向けの案内 llms.txt と、本文をまとめた llms-full.txt を作る（2026-11-24 ユーザー指示
「サイト内全部の各ページで SEO および生成AIからのアクセスに対応を強化」）。

  llms.txt      ：サイトの説明（非公式・運営者・公式情報の確かめ先・事実と見解の書き分け）と、
                  ページごとの題名・URL・説明・主な節へのリンク。llmstxt.org の形（# 題名 → > 要約 → ## 一覧）。
  llms-full.txt ：各ページの節・カード・Q&A の本文（日本語）を Markdown で並べたもの。
                  当サイトの見解を含むページには、そのことを冒頭に書く。

材料は検索の索引 data/search/ja.json（build_search_index.py の生成物）と data/i18n/ja.json の
meta_title_* / meta_desc_*、ページの並びは sitemap.xml。自動取得の一覧（市のお知らせなど）は
索引に入っていないので、ここにも入らない（最新は feed.xml）。
手で直さないこと。出力は入力だけで決まる（--check のため）。

使い方:  python3 .github/scripts/build_llms.py          # 書き出す
         python3 .github/scripts/build_llms.py --check  # 古ければ exit 1（auto_gates.py check 30）
build_search_index.py のあとに実行すること。
"""
import json
import re
import sys

ORIGIN = "https://komaki-east-school-reorg.github.io/"
OFFICIAL = "https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/index.html"
OUT_INDEX = "llms.txt"
OUT_FULL = "llms-full.txt"
# 当サイトの見解（🔎 検証・💡 提案）を載せているページ
VIEW_PAGES = {"review", "analysis", "shinooka"}
# llms.txt の「主な節」に出さない id（カード・Q&A・予定・部品）。llms-full.txt には全部入る。
NOT_SECTION = re.compile(
    r"^(rev-(?:[a-z]-)?[a-z]+\d+|rev-l-name|rev-m-fact|legacy-|ev-|faq-q|bus-faq-q|council-|kz-|cal-|grade-|"
    r"bus-map-|bus-checklist|official-|school-news|sn-top|site-updates$|toc-|news$|site-card$|.*-container$)")


def load():
    with open("data/search/ja.json", encoding="utf-8") as f:
        idx = json.load(f)
    with open("data/i18n/ja.json", encoding="utf-8") as f:
        ja = json.load(f)
    with open("sitemap.xml", encoding="utf-8") as f:
        sm = f.read()
    order = []
    for loc in re.findall(r"<loc>([^<]+)</loc>", sm):
        rest = loc[len(ORIGIN):]
        if "/" in rest:
            continue          # events/ と qa/ の個別ページ
        page = rest[:-5] if rest.endswith(".html") else "index"
        if page not in order:
            order.append(page)
    return idx, ja, order


def url(page, frag=""):
    base = ORIGIN if page == "index" else f"{ORIGIN}{page}.html"
    return base + (f"#{frag}" if frag else "")


def clean(s):
    return re.sub(r"\s+", " ", s or "").strip()


def title(ja, page):
    t = ja.get(f"meta_title_{page}") or page
    return re.sub(r"\s*[–-]\s*小牧市東部（篠岡地区）学校再編ナビ.*$", "", t).strip() or t


def head(ja):
    return [
        "# 小牧市東部（篠岡地区）学校再編ナビ",
        "",
        "> " + clean(ja.get("meta_desc_index")),
        "",
        "- 運営：「これがまちつくサイトの解。」THE UNIT（住民有志）。小牧市・教育委員会の公式サイトではありません。",
        f"- 公式情報の確かめ先：小牧市教育委員会 教育総務課 学校再編推進係のページ {OFFICIAL}",
        "- 事実は市・県・国の公表資料にもとづき、市の資料の文面はそのまま載せず当サイトの言葉で書き直しています。",
        "- 当サイトの見解（🔎 検証・💡 提案）を載せているのは review.html・analysis.html と、shinooka.html の見解の節だけです。"
        "【事実】と 🔎・💡 の印で書き分けています。引用するときは、事実と当サイトの見解を区別してください。",
        "- 個人名・政党名は載せていません。計画の決定や最新の日程は、市の公表で確かめてください。",
        "- 12言語で読めます（URL に ?lang=en / pt / vi / tl / es / zh / id / ko / ne / tr / my）。この案内と本文は日本語です。",
        f"- 最新の動き：Atom フィード {ORIGIN}feed.xml 、予定：{ORIGIN}calendar.ja.ics 、全文：{ORIGIN}{OUT_FULL}",
        "",
    ]


def build(idx, ja, order):
    by_page = {}
    for page, frag, heading, text in idx["items"]:
        by_page.setdefault(page, []).append((frag, clean(heading), clean(text)))
    lines = head(ja) + ["## ページ", ""]
    for page in order:
        lines.append(f"- [{title(ja, page)}]({url(page)}): {clean(ja.get(f'meta_desc_{page}'))}")
        for frag, heading, _ in by_page.get(page, []):
            if frag and not NOT_SECTION.match(frag) and frag != "contact":
                lines.append(f"  - [{heading}]({url(page, frag)})")
    lines += ["", "## Optional", "",
              f"- [本文の全文（日本語）]({ORIGIN}{OUT_FULL}): 各ページの節・カード・Q&A の本文",
              f"- [サイトマップ]({ORIGIN}sitemap.xml): 予定ごとのページ（events/）と Q&A の1問ずつのページ（qa/）を含む",
              ""]
    index = "\n".join(lines)

    full = head(ja)
    for page in order:
        full += [f"## {title(ja, page)}", "", f"URL: {url(page)}", ""]
        if page in VIEW_PAGES:
            full += ["（このページには当サイトの見解（🔎・💡）が含まれます。【事実】の部分と区別して扱ってください。）", ""]
        for frag, heading, text in by_page.get(page, []):
            if frag:
                full += [f"### {heading}", "", f"URL: {url(page, frag)}", ""]
            if text:
                full += [text, ""]
    return index, "\n".join(full)


def main():
    check = "--check" in sys.argv
    index, full = build(*load())
    stale = []
    for path, body in ((OUT_INDEX, index), (OUT_FULL, full)):
        try:
            with open(path, encoding="utf-8") as f:
                cur = f.read()
        except FileNotFoundError:
            cur = None
        if cur != body:
            stale.append(path)
            if not check:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(body)
    if check:
        if stale:
            print("古い: " + ", ".join(stale) + "（build_llms.py を実行すること）")
            sys.exit(1)
        print("llms.txt / llms-full.txt は最新")
    else:
        print("書き出し: " + (", ".join(stale) or "変更なし"))


if __name__ == "__main__":
    main()
