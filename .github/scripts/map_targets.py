#!/usr/bin/env python3
"""
標準入力で変更されたスナップショットのパス一覧
（例: data/official_pages/303-718-51565.txt）を受け取り、
data/site-facts.json の対応表からサイト内の更新候補箇所を
Markdown で出力する。fetch-news.yml の Issue 本文生成用。
"""
import json
import os
import sys

FACTS = "data/site-facts.json"


def main():
    with open(FACTS, encoding="utf-8") as f:
        facts = json.load(f)
    site_targets = facts["site_targets"]
    mappings = facts["mappings"]
    default_targets = facts.get("default_targets", [])

    slugs = []
    for line in sys.stdin:
        name = os.path.basename(line.strip())
        if name.endswith(".txt"):
            slugs.append(name[:-4])
    if not slugs:
        return

    print("## サイト内の更新候補箇所（site-facts.json より）")
    print()
    for slug in slugs:
        matched = next((m for m in mappings if slug.startswith(m["slug_prefix"])), None)
        if matched:
            topic = matched["topic"]
            targets = matched["targets"]
        else:
            topic = "（対応表に未登録 → data/site-facts.json に追記してください）"
            targets = default_targets
        print(f"### `{slug}` — {topic}")
        if targets:
            for t in targets:
                info = site_targets.get(t, {})
                print(f"- **{t}**: {info.get('file', '?')} — {info.get('notes', '')}")
        else:
            print("- （サイト内の直接の反映箇所なし・参考情報）")
        print()


if __name__ == "__main__":
    main()
