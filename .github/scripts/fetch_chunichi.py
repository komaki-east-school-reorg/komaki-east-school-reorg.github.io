#!/usr/bin/env python3
"""
中日新聞Web の小牧市エリア記事一覧を1日1回巡回し、小牧市東部（篠岡地区）に
関する記事を data/chunichi_news.json に保存する。話題は学校再編に限らない。

保存するのは「見出し・掲載日・記事URL・リード文の1文（引用）」のみ。
本文は有料会員限定であり、転載はしない。表示側でも出典を明示する。

robots.txt について:
  中日新聞Web の robots.txt は `User-Agent: *` に対して Allow: /（/search
  等のみ禁止）であり、記事ページ・エリア一覧の取得は許可されている。
  一方 ClaudeBot / GPTBot などのAIクローラは全面禁止されている。
  そのためこのスクリプトは、サイト名とURLを名乗る固有のUAでアクセスする。

負荷配慮:
  - 巡回するのは小牧市エリア一覧の1ページ目のみ（20件・約2週間分）。
  - 一度でも中身を確認した記事IDは checked_ids に記録し、二度と取りに行かない。
  - 1回の実行で新規に開く記事は MAX_NEW_FETCH 件まで。
  - リクエスト間に 3〜5 秒待つ。

Exit codes: 0 = 変更あり, 2 = 変更なし, 1 = 致命的エラー（一覧が引けない）
"""
import json
import os
import random
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from html import unescape

BASE = "https://www.chunichi.co.jp"
INDEX_URL = BASE + "/aichi_news/owari_area/komaki/"
OUTPUT = "data/chunichi_news.json"

# 小牧市東部（篠岡地区）に関する記事を拾う。話題は学校再編に限らない。
# 見出し・リード文・無料公開部分の本文のいずれかで判定する。
# （2026-06-23「人文字で作る校章…光ケ丘中」のように、見出しには地区名が
#   なく本文で初めて地区に触れる記事があるため、本文まで見る必要がある）
#
# 巡回対象がもともと中日新聞Webの「小牧市」エリア一覧なので、ここに並ぶ地名は
# ほぼ小牧市内のものとみなせる。よって地名だけで判定してよい。
# 地名は当サイトが使っているもの（about.html の学区表・bus.html の路線・
# community.html の地域協議会）に合わせてある。新聞は「光ケ丘」、学校名は
# 「光ヶ丘」と表記ゆれがあるため両方を入れている。
AREA_KEYWORDS = (
    "篠岡", "しのおか",
    "桃花台", "光ケ丘", "光ヶ丘", "桃ケ丘", "桃ヶ丘", "桃陵",
    "大城", "陶小",          # 陶は「陶芸・陶器」と紛れるので学校名の形でのみ拾う
    "城山", "大草", "上末", "下末", "高根", "大山", "池之内", "野口",
    "市東部", "東部地区",
)
# 地区名が出てこない再編記事を取りこぼさないための保険。
TOPIC_KEYWORDS = ("学校再編", "しのおか学園")

# 地名を含むが東部地域の話ではない語。判定前に本文から取り除く。
# 「大山廃寺跡」は東部の大山にある史跡だが、出土品は市中心部の歴史館に展示
# されており、市史関連の記事で地区と関係なく言及される。
EXCLUDE_PHRASES = ("大山廃寺",)

# 一覧に載らなくなった過去記事の種。初回実行時だけ取得され、以後は
# checked_ids に入るので二度と取りに行かない。
SEED_URLS = [
    BASE + "/article/1083664",   # 2025-06-17 市が計画案
    BASE + "/article/1135341",   # 2025-09-19 保護者から不安の声
    BASE + "/article/1208730",   # 2026-02-13 「寝耳に水」
    BASE + "/article/1270804",   # 2026-06-23 光ケ丘中 閉校前の航空写真
]

MAX_NEW_FETCH = 25      # 1回の実行で新たに開く記事の上限
MAX_CHECKED = 400       # checked_ids の保持件数（古いものから捨てる）
QUOTE_MAX = 100         # 引用する文字数の上限

USER_AGENT = ("KomakiEastSchoolReorgSite/1.0 "
              "(+https://komaki-east-school-reorg.github.io/)")

REQUEST_WAIT_MIN = 3.0
REQUEST_WAIT_MAX = 5.0

# 開発用。設定するとHTMLをこのディレクトリに保存し、次回からはそこから読む。
# 抽出条件を調整するたびに市外のサーバへ取りに行かないためのもの。
# CI では設定しない（＝毎回ネットワークから取得する）。
CACHE_DIR = os.environ.get("CHUNICHI_CACHE_DIR")

_last_request = 0.0


def throttle():
    """直前のリクエストから 3〜5 秒あける（初回は待たない）。"""
    global _last_request
    if _last_request:
        wait = random.uniform(REQUEST_WAIT_MIN, REQUEST_WAIT_MAX) - (time.time() - _last_request)
        if wait > 0:
            time.sleep(wait)
    _last_request = time.time()


def cache_path_for(url):
    if not CACHE_DIR:
        return None
    name = re.sub(r"[^0-9A-Za-z]+", "_", url).strip("_") + ".html"
    return os.path.join(CACHE_DIR, name)


def fetch_html(url):
    """curl で1回だけ取得する。200 以外・curl 失敗はすべて例外。"""
    cached = cache_path_for(url)
    if cached and os.path.exists(cached):
        with open(cached, encoding="utf-8") as f:
            return f.read()

    throttle()
    html = _curl_get(url)
    if cached:
        os.makedirs(CACHE_DIR, exist_ok=True)
        with open(cached, "w", encoding="utf-8") as f:
            f.write(html)
    return html


def _curl_get(url):
    fd, body_path = tempfile.mkstemp(prefix="chunichi_", suffix=".html")
    os.close(fd)
    cmd = ["curl", "-sS", "-L", "--compressed", "--max-time", "30",
           "-H", f"User-Agent: {USER_AGENT}",
           "-H", "Accept: text/html,application/xhtml+xml",
           "-H", "Accept-Language: ja",
           "-o", body_path, "-w", "%{http_code}", url]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        if proc.returncode != 0:
            raise RuntimeError(f"curl exited {proc.returncode}: {proc.stderr.strip()}")
        if proc.stdout.strip() != "200":
            raise RuntimeError(f"HTTP {proc.stdout.strip()}")
        with open(body_path, encoding="utf-8") as f:
            return f.read()
    finally:
        os.remove(body_path)


def article_ids_from_index(html):
    """一覧ページから記事IDを出現順に返す（重複除去）。"""
    ids = []
    for m in re.finditer(r'href="/article/(\d+)', html):
        if m.group(1) not in ids:
            ids.append(m.group(1))
    return ids


def strip_tags(fragment):
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", fragment, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", "", text)
    return unescape(text).strip()


def parse_article(html):
    """記事ページ → dict(title, date, lead, body) 。取れなければ None。"""
    m = re.search(r'"headline"\s*:\s*"([^"]+)"', html)
    if not m:
        return None
    title = unescape(m.group(1)).replace("\\/", "/").strip()

    m = re.search(r'"datePublished"\s*:\s*"(\d{4})-(\d{2})-(\d{2})', html)
    date = "-".join(m.groups()) if m else None

    # リード（description）。一覧・SNS 用に用意されている要約で、末尾は「…」。
    m = re.search(r'<meta name="description" content="([^"]*)"', html)
    lead = unescape(m.group(1)).strip() if m else ""

    # 無料公開されている本文段落（有料部分の手前まで）。
    blocks = re.findall(r'<div class="block">(.*?)</div>\s*(?=<div class="block">|$)',
                        html, re.DOTALL)[:6]

    # body はキーワード判定用。写真キャプション（「＝小牧市大草の愛知文教大で」の
    # ような撮影地の記載）にしか地名が出ない記事があるので、こちらには含める。
    body = " ".join(strip_tags(b) for b in blocks)

    # first_para は引用用。キャプションは記事の書き出しではないので取り除く。
    first_para = ""
    for block in blocks:
        text = strip_tags(re.sub(r'<p class="caption">.*?</p>', "", block, flags=re.DOTALL))
        if text:
            first_para = text
            break

    return {"title": title, "date": date, "lead": lead,
            "body": body, "first_para": first_para}


def first_sentence(text):
    """引用として載せる1文を作る。長すぎる場合は QUOTE_MAX で切る。"""
    text = re.sub(r"\s+", " ", (text or "")).strip().lstrip("　")
    if not text:
        return ""
    m = re.match(r"(.+?。)", text)
    head = (m.group(1) if m else text).strip()
    if len(head) > QUOTE_MAX:
        return head[:QUOTE_MAX].rstrip("　 ") + "…"
    return head


def matches(article):
    haystack = article["title"] + article["lead"] + article["body"]
    for phrase in EXCLUDE_PHRASES:
        haystack = haystack.replace(phrase, "")
    return any(k in haystack for k in AREA_KEYWORDS + TOPIC_KEYWORDS)


def load_existing():
    if not os.path.exists(OUTPUT):
        return {"items": [], "checked_ids": []}
    try:
        with open(OUTPUT, encoding="utf-8") as f:
            data = json.load(f)
        data.setdefault("items", [])
        data.setdefault("checked_ids", [])
        return data
    except Exception as e:
        print(f"WARN: {OUTPUT} を読めませんでした（作り直します）: {e}", file=sys.stderr)
        return {"items": [], "checked_ids": []}


def main():
    os.makedirs("data", exist_ok=True)
    old = load_existing()
    checked = list(old["checked_ids"])
    items = {it["url"]: it for it in old["items"]}

    try:
        index_html = fetch_html(INDEX_URL)
    except Exception as e:
        print(f"ERROR: 一覧ページを取得できません: {e}", file=sys.stderr)
        sys.exit(1)

    candidates = [BASE + "/article/" + i for i in article_ids_from_index(index_html)]
    # 種記事は一覧より先に処理する（初回だけ効く）
    candidates = [u for u in SEED_URLS if u not in candidates] + candidates

    fetched = 0
    for url in candidates:
        article_id = url.rsplit("/", 1)[-1]
        if article_id in checked:
            continue
        if fetched >= MAX_NEW_FETCH:
            print(f"  (上限 {MAX_NEW_FETCH} 件に達したため残りは次回)")
            break

        fetched += 1   # 実際の待ちは fetch_html 側（キャッシュ命中時は待たない）
        try:
            article = parse_article(fetch_html(url))
        except Exception as e:
            print(f"  ERROR {url}: {e}", file=sys.stderr)
            continue          # 一時的な失敗。checked に入れず次回再挑戦する
        if article is None:
            print(f"  parse failed: {url}", file=sys.stderr)
            continue

        checked.append(article_id)
        if not matches(article):
            print(f"  skip  {article['date']}  {article['title'][:34]}")
            continue

        # 引用は本文の第1段落を優先する。description は末尾が「…」で切れており
        # 文として完結していないことがあるため、取れなかったときの控えに回す。
        quote = first_sentence(article["first_para"]) or first_sentence(article["lead"])
        items[url] = {
            "title": article["title"],
            "url": url,
            "date": article["date"],
            "quote": quote,
        }
        print(f"  HIT   {article['date']}  {article['title'][:34]}")

    new_items = sorted(items.values(),
                       key=lambda x: (x.get("date") or ""), reverse=True)
    new_data = {
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_name": "中日新聞Web",
        "source_url": INDEX_URL,
        "items": new_items,
        "checked_ids": checked[-MAX_CHECKED:],
    }

    # 掲載内容が変わらなくても、確認済みIDが増えたならコミットする。
    # ここを記録しないと、該当しない記事を毎日開き直すことになる。
    changed = (new_items != old["items"]) or (checked != old["checked_ids"])
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"{len(new_items)} 件掲載 / 今回 {fetched} 記事を確認"
          f"{'（更新あり）' if changed else '（更新なし）'}")
    sys.exit(0 if changed else 2)


if __name__ == "__main__":
    main()
