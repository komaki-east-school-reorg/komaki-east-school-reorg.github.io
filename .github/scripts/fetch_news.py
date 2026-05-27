#!/usr/bin/env python3
"""
Fetches official Komaki City school reorganization pages,
recursively follows sub-category index pages within each source subtree,
visits each item page to get its individual update date, and saves only
items updated within the last WINDOW_DAYS days to data/news.json.
"""
import urllib.request
import urllib.parse
import json
import re
import os
import sys
import time
from datetime import datetime, timezone, timedelta

PARENT_URL = "https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/index.html"
BASE_DOMAIN = "https://www.city.komaki.aichi.jp"
OUTPUT = "data/news.json"
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

    # --- Visit each item page to get its update date ---
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=WINDOW_DAYS)
    items = []

    for item in raw_items:
        time.sleep(0.5)
        try:
            page_html = fetch_html(item["url"])
            updated_at = extract_jp_date(page_html)
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
        print(f"No content changes. {len(items)} items in window.")
    else:
        print(f"Changes detected. {len(items)}/{len(raw_items)} items in {WINDOW_DAYS}-day window.")

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    sys.exit(0 if changed else 2)


if __name__ == "__main__":
    main()
