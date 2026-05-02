#!/usr/bin/env python3
"""
Fetches official Komaki City school reorganization pages,
visits each item page to get its individual update date, and saves only
items updated within the last WINDOW_DAYS days to data/news.json.
"""
import urllib.request
import json
import re
import os
import sys
import time
from datetime import datetime, timezone, timedelta

SOURCE_URLS = [
    "https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/718/index.html",
    "https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/shinooka_gsaihen/index.html",
]
PARENT_URL = "https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/index.html"
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


def main():
    os.makedirs("data", exist_ok=True)

    # --- Fetch all index pages and merge items (deduplicate by URL) ---
    raw_items = []
    seen_urls = set()
    index_updated_at = None

    for index_url in SOURCE_URLS:
        try:
            index_html = fetch_html(index_url)
        except Exception as e:
            print(f"ERROR: Failed to fetch {index_url}: {e}", file=sys.stderr)
            continue

        page_date = extract_jp_date(index_html)
        if page_date and (index_updated_at is None or page_date > index_updated_at):
            index_updated_at = page_date

        for m in re.finditer(r'<li class="page">\s*<a href="([^"]+)">([^<]+)</a>', index_html):
            href = m.group(1).strip()
            title = m.group(2).strip()
            if href.startswith("http://"):
                href = "https://" + href[7:]
            if href not in seen_urls:
                seen_urls.add(href)
                raw_items.append({"title": title, "url": href})

    if not raw_items and not seen_urls:
        print("ERROR: Failed to fetch any index page", file=sys.stderr)
        sys.exit(1)

    # --- Visit each item page to get its update date ---
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=WINDOW_DAYS)
    items = []

    for item in raw_items:
        time.sleep(0.5)  # polite crawl delay
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
        # Only update fetched_at, leave the rest
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
