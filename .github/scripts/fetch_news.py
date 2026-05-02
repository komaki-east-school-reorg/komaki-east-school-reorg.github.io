#!/usr/bin/env python3
"""
Fetches the official Komaki City school reorganization announcements page
and saves the results to data/news.json.
"""
import urllib.request
import json
import re
import os
import sys
from datetime import datetime, timezone

URL = "https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/718/index.html"
OUTPUT = "data/news.json"


def fetch_page(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def parse(html):
    date_m = re.search(r"更新日：(\d{4}年\d{2}月\d{2}日)", html)
    updated_at = date_m.group(1) if date_m else None

    items = []
    for m in re.finditer(r'<li class="page">\s*<a href="([^"]+)">([^<]+)</a>', html):
        href = m.group(1).strip()
        title = m.group(2).strip()
        # Normalize to https
        if href.startswith("http://"):
            href = "https://" + href[7:]
        items.append({"title": title, "url": href})

    return updated_at, items


def main():
    os.makedirs("data", exist_ok=True)

    try:
        html = fetch_page(URL)
    except Exception as e:
        print(f"ERROR: Failed to fetch {URL}: {e}", file=sys.stderr)
        sys.exit(1)

    updated_at, items = parse(html)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    new_data = {
        "fetched_at": now,
        "updated_at": updated_at,
        "source_url": URL,
        "items": items,
    }

    # Load existing to detect item/date changes
    existing_items = []
    existing_updated = None
    if os.path.exists(OUTPUT):
        with open(OUTPUT, encoding="utf-8") as f:
            old = json.load(f)
        existing_items = old.get("items", [])
        existing_updated = old.get("updated_at")

    changed = (items != existing_items) or (updated_at != existing_updated)
    if changed:
        print(f"Changes detected. Writing {len(items)} items (updated: {updated_at})")
    else:
        print(f"No changes. {len(items)} items (updated: {updated_at})")
        # Update only fetched_at
        new_data = {**old, "fetched_at": now}

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # Exit code 2 = no content change (used by workflow to skip commit)
    sys.exit(0 if changed else 2)


if __name__ == "__main__":
    main()
