#!/usr/bin/env python3
"""週1回、このサイトがどう読まれ・どう話題にされているかを集めて、報告の本文（Markdown）を書く。

2026-10-24 ユーザー指示（サイトの利用状況の確認と、ハッシュタグでの広がり）。

集めるもの:
  1. GoatCounter（Cookie なしの閲覧数。js/main.js の COUNTER が送っている）
     先週のページ別・言語別の閲覧数、参照元、機能の使われ方（イベント）、紙の QR からの来訪。
     Secret GOATCOUNTER_TOKEN が無ければ黙って省く。
  2. はてなブックマーク数（公開 API。全ページの日本語 URL）
  3. Bluesky の公開検索で、5つのハッシュタグとサイトのドメインに触れた投稿の数。
     認証を求められたら黙って省く。

集めないもの:
  X・Instagram・Facebook・Threads・TikTok は robots.txt が機械での収集を禁じているので
  取りに行かない。報告にはタグ検索ページへのリンクだけを載せ、人が見る。
  Search Console も API は使わず、確認の手順を一行で書く。

数字はリポジトリにコミットしない（公開リポジトリのため）。報告はメール（send_mail.py）か、
SMTP が無ければ Issue で届き、本文は Actions のアーティファクトにも残る。

実行: python3 .github/scripts/check_reach.py OUT.md
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

SITE = "https://komaki-east-school-reorg.github.io/"
COUNTER = "https://komaki-saihen.goatcounter.com/api/v0"
TAGS = ["学校再編ナビ", "桃花台", "小牧", "小牧市東部", "篠岡地区"]
PAGES = ["", "about.html", "schedule.html", "faq.html", "bus.html", "clubs.html",
         "council.html", "community.html", "map.html", "nationwide.html", "review.html"]
UA = "komaki-saihen-navi-report/1.0 (+" + SITE + ")"


def get_json(url, token=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # 失敗の理由（API のエラーメッセージ）を報告に出す。トークンは含まれない
        body = e.read().decode("utf-8", "replace")[:200].replace("\n", " ")
        raise RuntimeError(f"HTTP {e.code} {url.split('?')[0]} {body}") from None


def week_range():
    jst = dt.timezone(dt.timedelta(hours=9))
    today = dt.datetime.now(jst).date()
    end = today - dt.timedelta(days=today.weekday())     # 今週の月曜（この日は含めない）
    start = end - dt.timedelta(days=7)
    return start, end


def goatcounter(start, end):
    token = os.environ.get("GOATCOUNTER_TOKEN", "").strip()
    if not token:
        return ["（GOATCOUNTER_TOKEN が未設定のため、閲覧数は省きました）"]
    q = urllib.parse.urlencode({"start": start.isoformat(), "end": (end - dt.timedelta(days=1)).isoformat(), "limit": 100})
    out = []
    try:
        hits = get_json(f"{COUNTER}/stats/hits?{q}", token).get("hits", [])
        time.sleep(1)
    except Exception as e:  # noqa: BLE001
        return [f"（GoatCounter の取得に失敗: {e}）"]
    pages = [h for h in hits if not h.get("event")]
    events = [h for h in hits if h.get("event")]
    total = sum(h.get("count", 0) for h in pages)
    out.append(f"- 閲覧数（ページ）: **{total}**")
    by_page, by_lang = {}, {}
    for h in pages:
        path = h.get("path", "")
        base, _, qs = path.partition("?")
        lang = "kids" if "kids=1" in qs else (urllib.parse.parse_qs(qs).get("lang", ["ja"])[0])
        by_page[base] = by_page.get(base, 0) + h.get("count", 0)
        by_lang[lang] = by_lang.get(lang, 0) + h.get("count", 0)
    out.append("- ページ別: " + "、".join(f"{k} {v}" for k, v in sorted(by_page.items(), key=lambda x: -x[1])[:12]))
    out.append("- 言語別: " + "、".join(f"{k} {v}" for k, v in sorted(by_lang.items(), key=lambda x: -x[1])))
    if events:
        out.append("- 機能の使われ方: " + "、".join(f"{h.get('path')} {h.get('count', 0)}" for h in sorted(events, key=lambda x: -x.get("count", 0))[:25]))
        qr = sum(h.get("count", 0) for h in events if h.get("path") == "entry/qr")
        out.append(f"- 紙の QR からの来訪（entry/qr）: **{qr}**")
    try:
        refs = get_json(f"{COUNTER}/stats/toprefs?{q}", token).get("stats", [])
        if refs:
            out.append("- 参照元: " + "、".join(f"{r.get('name') or '(直接)'} {r.get('count', 0)}" for r in refs[:12]))
    except Exception as e:  # noqa: BLE001
        out.append(f"- 参照元: 取得に失敗（{e}）")
    return out


def hatena():
    urls = [SITE + p for p in PAGES]
    q = "&".join("url=" + urllib.parse.quote(u, safe="") for u in urls)
    try:
        d = get_json("https://bookmark.hatenaapis.com/count/entries?" + q)
    except Exception as e:  # noqa: BLE001
        return [f"（はてなブックマーク数の取得に失敗: {e}）"]
    total = sum(d.values())
    rows = [f"{(u.replace(SITE, '') or 'index')} {n}" for u, n in d.items() if n]
    return [f"- はてなブックマーク: 合計 **{total}**" + ("（" + "、".join(rows) + "）" if rows else "")]


def bluesky(start):
    out = []
    since = dt.datetime.combine(start, dt.time(0), dt.timezone(dt.timedelta(hours=9))).astimezone(dt.timezone.utc)
    for term in ["#" + t for t in TAGS] + ["komaki-east-school-reorg.github.io"]:
        # since パラメータは公開 API が受け付けないので、新しい順の100件を取って投稿日時で絞る
        q = urllib.parse.urlencode({"q": term, "sort": "latest", "limit": 100})
        try:
            posts = get_json("https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?" + q).get("posts", [])
        except Exception:  # noqa: BLE001  認証を求められる・止まっているときは黙って省く
            return ["（Bluesky の公開検索は使えませんでした）"]
        cut = since.strftime("%Y-%m-%dT%H:%M:%S")
        posts = [x for x in posts if str(x.get("indexedAt", "")) >= cut]
        out.append(f"{term} {len(posts)}{'+' if len(posts) >= 100 else ''}")
        time.sleep(1)
    return ["- Bluesky（先週の投稿数）: " + "、".join(out)]


def manual_links():
    rows = []
    for t in TAGS:
        e = urllib.parse.quote(t)
        rows.append(f"  - #{t}: [X](https://x.com/hashtag/{e}) / [Instagram](https://www.instagram.com/explore/tags/{e}/) / "
                    f"[Threads](https://www.threads.net/search?q=%23{e}) / [TikTok](https://www.tiktok.com/tag/{e})")
    return ["- 人が見るところ（機械では取りに行かない）:"] + rows + [
        "  - サイトの URL を含む投稿: [X](https://x.com/search?q=komaki-east-school-reorg.github.io&f=live)",
        "- 月初には Search Console の「検索パフォーマンス」で、桃花台・篠岡・Tokadai を含む検索語を見る。",
        "- 読者の声: [feedback ラベルの Issue](https://github.com/komaki-east-school-reorg/komaki-east-school-reorg.github.io/issues?q=label%3Afeedback)",
    ]


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "reach.md"
    start, end = week_range()
    lines = [f"# 学校再編ナビ 利用状況 {start:%Y-%m-%d}〜{(end - dt.timedelta(days=1)):%Y-%m-%d}", "",
             "## 閲覧（GoatCounter・Cookie なし）"] + goatcounter(start, end) + ["",
             "## 話題（ハッシュタグ・ブックマーク）"] + hatena() + bluesky(start) + manual_links()
    text = "\n".join(lines) + "\n"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
