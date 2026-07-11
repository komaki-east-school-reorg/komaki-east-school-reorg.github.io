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
import urllib.request
import urllib.parse
import json
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


def fetch_html(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


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
    prefix = "admin/soshiki/kyoiku/kyouikusoumu/"
    if path.startswith(prefix):
        path = path[len(prefix):]
    return path.replace("/", "-")


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
            time.sleep(0.3)
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
        time.sleep(0.5)
        try:
            page_html = fetch_html(item["url"])
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

    # --- Remove snapshots of pages that no longer exist on the site ---
    # (only files whose URL is no longer listed; a transient fetch failure
    #  keeps the item in seen_item_urls, so its snapshot survives)
    expected = {url_to_slug(u) + ".txt" for u in seen_item_urls}
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
