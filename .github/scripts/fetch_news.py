#!/usr/bin/env python3
"""
Fetches official Komaki City school reorganization pages,
recursively follows sub-category index pages within each source subtree,
visits each item page to get its individual update date, and saves only
items updated within the last WINDOW_DAYS days to data/news.json.

Additionally saves a normalized body-text snapshot of every item page to
data/official_pages/<slug>.txt so that content changes (not just new items)
can be detected via git diff by the workflow.

Exit codes: 0 = content changed (news items or snapshots), 2 = no change,
1 = fatal error.
"""
import atexit
import subprocess
import tempfile
import urllib.parse
import json
import random
import re
import os
import sys
import time
from html import unescape
from datetime import datetime, timezone, timedelta

PARENT_URL = "https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/index.html"
BASE_DOMAIN = "https://www.city.komaki.aichi.jp"
OUTPUT = "data/news.json"
SNAPSHOT_DIR = "data/official_pages"
WINDOW_DAYS = 30

# --- 監視のみ行うページ（地域協議会：支え合い協働推進課の所管） ---
# 学校再編とは所管課が異なり news.json の「お知らせ」には載せない。本文スナップショット
# だけを取り、変化したら community.html の更新候補として Issue に載せる。
# WATCH_INDEXES はインデックスなので、配下の <li class="page"> 記事も辿って取得する。
WATCH_BASE = BASE_DOMAIN + "/admin/soshiki/kenkouikigai/sasaeai/3/3_2/"
WATCH_PAGES = [
    WATCH_BASE + "index.html",     # 地域協議会（総論）
    WATCH_BASE + "25722.html",     # 地域協議会の設立・活動状況（篠岡地区5協議会の一覧）
]
WATCH_INDEXES = [
    WATCH_BASE + "chiikikyougikaievent/index.html",   # 地域協議会イベント案内
]

# 市サーバへの負荷配慮: リクエスト間に必ずこの秒数（＋ゆらぎ）待つ
REQUEST_WAIT_MIN = 3.0
REQUEST_WAIT_MAX = 5.0

# --- 取得方法について（2026-08-15 変更） -------------------------------
# 市サイトは WAF（Imperva/Incapsula）配下にあり、初回アクセスに対して Cookie を
# 付けた 302 を同一URLへ返す。この Cookie を保持して踏み直さないと永久に
# リダイレクトし続けるため、Cookie の保存が必須。
#
# さらに、Python の urllib は Cookie を保持しても 403 で弾かれる（UA を実ブラウザ
# 相当にしても変わらない）。WAF が TLS/HTTP の指紋で判定しているため、ヘッダを
# 足すだけでは通らない。curl なら同じ URL・同じ UA で 200 が返るので、取得だけ
# curl に委ねる。curl は GitHub Actions の ubuntu-latest に標準搭載。
# --- 取得した HTML のランレベルキャッシュ ---------------------------------
# 本文スナップショットはタグを落としてあるため、添付 PDF の href が残らない。
# だより（PDF）の中身を読む fetch_newsletters.py が同じページをもう一度
# 取りに行かずに済むよう、取得した記事ページの生 HTML を実行中だけ置いておく。
# 実行後に消える一時領域なので、リポジトリには何も残らない。
HTML_CACHE_DIR = os.path.join(tempfile.gettempdir(), "komaki_html")

COOKIE_FILE = os.path.join(tempfile.gettempdir(), f"komaki_cookies_{os.getpid()}.txt")
atexit.register(lambda: os.path.exists(COOKIE_FILE) and os.remove(COOKIE_FILE))

# Cookie は最初の1回で取れるので、2ページ目以降に追加の往復は発生しない。
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}

# WAF の判定が初回だけ滑ることがあるので、少しだけ待って粘る。
# 市サーバへの負荷を増やさないよう回数は最小限、間隔は polite_wait と同等。
FETCH_ATTEMPTS = 3


def polite_wait():
    """連続アクセスを避けるため、リクエストごとに 3〜5 秒待つ。"""
    time.sleep(random.uniform(REQUEST_WAIT_MIN, REQUEST_WAIT_MAX))


def _curl_get(url):
    """curl で1回だけ取得する。200 以外・curl 失敗はすべて例外。"""
    fd, body_path = tempfile.mkstemp(prefix="komaki_body_", suffix=".html")
    os.close(fd)
    cmd = ["curl", "-sS", "-L", "--compressed", "--max-time", "30",
           "-c", COOKIE_FILE, "-b", COOKIE_FILE,
           "-o", body_path, "-w", "%{http_code}"]
    for name, value in BROWSER_HEADERS.items():
        cmd += ["-H", f"{name}: {value}"]
    cmd.append(url)
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        if proc.returncode != 0:
            raise RuntimeError(
                f"curl exited {proc.returncode}: {proc.stderr.strip()}")
        status = proc.stdout.strip()
        if status != "200":
            raise RuntimeError(f"HTTP {status}")
        with open(body_path, encoding="utf-8") as f:
            return f.read()
    finally:
        os.remove(body_path)


def fetch_html(url):
    last_error = None
    for attempt in range(1, FETCH_ATTEMPTS + 1):
        try:
            return _curl_get(url)
        except Exception as e:
            last_error = e
            if attempt < FETCH_ATTEMPTS:
                print(f"  retry {attempt}/{FETCH_ATTEMPTS - 1} after error: {e}",
                      file=sys.stderr)
                polite_wait()
    raise last_error


def extract_jp_date(html):
    """Return '2026年04月30日' string from page HTML, or None."""
    m = re.search(r"更新日：(\d{4}年\d{2}月\d{2}日)", html)
    return m.group(1) if m else None


def jp_date_to_dt(text):
    """'2026年04月30日' → datetime (UTC midnight), or None."""
    m = re.match(r"(\d{4})年(\d{2})月(\d{2})日", text)
    if not m:
        return None
    return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)


def extract_body_text(html):
    """Extract readable text from the page's main content area, or None."""
    m = re.search(r'<article id="contents"[^>]*>(.*?)</article>', html, re.DOTALL)
    if not m:
        return None
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", m.group(1), flags=re.DOTALL)
    body = re.sub(r"<[^>]+>", "\n", body)
    body = unescape(body)
    lines = [line.strip() for line in body.split("\n")]
    return "\n".join(line for line in lines if line) + "\n"


def url_to_slug(url):
    """Item page URL → snapshot filename stem, e.g. '303-718-50750'."""
    path = urllib.parse.urlparse(url).path.lstrip("/")
    path = re.sub(r"\.html$", "", path)
    for prefix in ("admin/soshiki/kyoiku/kyouikusoumu/",
                   "admin/soshiki/kenkouikigai/"):
        if path.startswith(prefix):
            path = path[len(prefix):]
            break
    return path.replace("/", "-")


def cache_html(url, page_html):
    """取得した生 HTML を実行中だけ残す（失敗しても本処理は止めない）。"""
    try:
        os.makedirs(HTML_CACHE_DIR, exist_ok=True)
        path = os.path.join(HTML_CACHE_DIR, url_to_slug(url) + ".html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(page_html)
    except OSError as e:
        print(f"  WARN: HTML キャッシュに失敗 {url}: {e}", file=sys.stderr)


def save_snapshot(url, page_html):
    """Write body-text snapshot if changed. Returns True if file changed."""
    text = extract_body_text(page_html)
    if text is None:
        return False
    path = os.path.join(SNAPSHOT_DIR, url_to_slug(url) + ".txt")
    content = url + "\n---\n" + text
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            if f.read() == content:
                return False
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return True


def normalize_url(href, base_url):
    """Convert any href to an absolute https URL."""
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("http://"):
        return "https://" + href[7:]
    if href.startswith("https://"):
        return href
    if href.startswith("/"):
        return BASE_DOMAIN + href
    return urllib.parse.urljoin(base_url, href)


def crawl_index(index_url, source_dir, visited_index, seen_item_urls, raw_items, all_dates):
    """
    BFS within source_dir: collect <li class="page"> items and follow any
    sub-index pages whose URL starts with source_dir.
    Appends found dates to all_dates (for index_updated_at tracking).
    """
    queue = [index_url]

    while queue:
        url = queue.pop(0)
        print(f"  index: {url}")
        try:
            html = fetch_html(url)
            polite_wait()
        except Exception as e:
            print(f"  ERROR fetching {url}: {e}", file=sys.stderr)
            continue

        page_date = extract_jp_date(html)
        if page_date:
            all_dates.append(page_date)

        # Collect article links from <li class="page">
        for m in re.finditer(r'<li class="page">\s*<a href="([^"]+)">([^<]+)</a>', html):
            href = normalize_url(m.group(1).strip(), url)
            title = m.group(2).strip()
            if href not in seen_item_urls:
                seen_item_urls.add(href)
                raw_items.append({"title": title, "url": href})

        # Enqueue sub-index pages that are within the same source subtree
        for m in re.finditer(r'href="([^"#?]+/index\.html)"', html):
            sub = normalize_url(m.group(1).strip(), url)
            if sub.startswith(source_dir) and sub != url and sub not in visited_index:
                visited_index.add(sub)
                queue.append(sub)


def main():
    os.makedirs("data", exist_ok=True)

    raw_items = []
    seen_item_urls = set()
    all_dates = []

    source_dir = PARENT_URL.rsplit("/", 1)[0] + "/"
    visited_index = {PARENT_URL}
    print(f"Crawling subtree: {source_dir}")
    crawl_index(PARENT_URL, source_dir, visited_index, seen_item_urls, raw_items, all_dates)

    if not raw_items and not seen_item_urls:
        print("ERROR: Failed to fetch any index page", file=sys.stderr)
        sys.exit(1)

    index_updated_at = max(all_dates) if all_dates else None

    # --- Visit each item page to get its update date + body snapshot ---
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=WINDOW_DAYS)
    items = []
    snapshots_changed = False

    for item in raw_items:
        polite_wait()
        try:
            page_html = fetch_html(item["url"])
            cache_html(item["url"], page_html)
            updated_at = extract_jp_date(page_html)
            if save_snapshot(item["url"], page_html):
                snapshots_changed = True
        except Exception:
            updated_at = None

        item["updated_at"] = updated_at

        if updated_at:
            dt = jp_date_to_dt(updated_at)
            if dt is None or dt < cutoff:
                print(f"  skip  {updated_at}  {item['title'][:40]}")
                continue
            print(f"  keep  {updated_at}  {item['title'][:40]}")
        else:
            # Can't determine date → include to avoid silent omission
            print(f"  keep? (no date)  {item['title'][:40]}")

        items.append(item)

    # --- 監視のみのページ（地域協議会）のスナップショットを取る ---
    # news.json の items には入れない。変化の検知だけが目的。
    watch_urls = set(WATCH_PAGES)
    keep_slugs = set()
    for index_url in WATCH_INDEXES:
        watch_urls.add(index_url)
        polite_wait()
        try:
            index_html = fetch_html(index_url)
        except Exception as e:
            print(f"  ERROR fetching watch index {index_url}: {e}", file=sys.stderr)
            # インデックスが引けないと配下記事のURLが分からない。この回だけの障害で
            # 既存スナップショットを消さないよう、同じ接頭辞のファイルは保護する。
            stem = url_to_slug(index_url).rsplit("-", 1)[0] + "-"
            keep_slugs |= {f for f in os.listdir(SNAPSHOT_DIR) if f.startswith(stem)}
            continue
        if save_snapshot(index_url, index_html):
            snapshots_changed = True
        for m in re.finditer(r'<li class="page">\s*<a href="([^"]+)">', index_html):
            watch_urls.add(normalize_url(m.group(1).strip(), index_url))

    for url in sorted(watch_urls - set(WATCH_INDEXES)):
        polite_wait()
        try:
            if save_snapshot(url, fetch_html(url)):
                snapshots_changed = True
                print(f"  watch: changed  {url}")
        except Exception as e:
            print(f"  ERROR fetching watch page {url}: {e}", file=sys.stderr)
            # 取得失敗時は既存スナップショットを消さないよう URL は残す
    seen_item_urls |= watch_urls

    # --- Remove snapshots of pages that no longer exist on the site ---
    # (only files whose URL is no longer listed; a transient fetch failure
    #  keeps the item in seen_item_urls, so its snapshot survives)
    expected = {url_to_slug(u) + ".txt" for u in seen_item_urls} | keep_slugs
    for fname in os.listdir(SNAPSHOT_DIR):
        if fname.endswith(".txt") and fname not in expected:
            os.remove(os.path.join(SNAPSHOT_DIR, fname))
            print(f"  removed stale snapshot: {fname}")
            snapshots_changed = True

    # --- Build output ---
    new_data = {
        "fetched_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "index_updated_at": index_updated_at,
        "source_url": PARENT_URL,
        "window_days": WINDOW_DAYS,
        "items": items,
    }

    # --- Detect changes ---
    old_items = []
    if os.path.exists(OUTPUT):
        with open(OUTPUT, encoding="utf-8") as f:
            old = json.load(f)
        old_items = old.get("items", [])

    changed = items != old_items
    if not changed:
        new_data = {**old, "fetched_at": new_data["fetched_at"]}
        print(f"No news-item changes. {len(items)} items in window.")
    else:
        print(f"News-item changes detected. {len(items)}/{len(raw_items)} items in {WINDOW_DAYS}-day window.")

    if snapshots_changed:
        print("Page-body snapshot changes detected.")

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    sys.exit(0 if (changed or snapshots_changed) else 2)


if __name__ == "__main__":
    main()
