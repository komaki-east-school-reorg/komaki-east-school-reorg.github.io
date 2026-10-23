#!/usr/bin/env python3
"""毎日の巡回で、取得元ごとに「いつ確かめたか・取れたか」を data/fetch_status.json に書く。

news.json などの fetched_at は、内容に変化が無い日はコミットされないので
「最後に確かめた日時」には使えない（学校HPの fetched_at が何日も前のまま、ということが起きる）。
この記録は成否にかかわらず毎回書き、fetch-news.yml の最後のステップ（if: always()）がコミットする。
画面では js/main.js の FETCH STATUS が、自動取得の各コーナーの下に確認日時を出す。

  python3 .github/scripts/record_fetch_status.py city=success schools=failure
  値は GitHub Actions の steps.<id>.outcome（success / failure / skipped / cancelled）。
  skipped・cancelled はその取得元を今回は見ていないとみなし、記録を変えない。
"""
import json
import os
import sys
from datetime import datetime, timezone

OUTPUT = "data/fetch_status.json"
LABELS = {
    "city": "小牧市の公式ページ（市のお知らせ・地域協議会のイベント・東部まちづくり・都市計画）",
    "schools": "対象8校のホームページ",
}


def main(argv):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    data = {}
    if os.path.exists(OUTPUT):
        with open(OUTPUT, encoding="utf-8") as f:
            data = json.load(f)
    sources = data.get("sources", {})
    for arg in argv:
        key, _, outcome = arg.partition("=")
        if key not in LABELS:
            print(f"unknown source: {key}", file=sys.stderr)
            return 1
        if outcome not in ("success", "failure"):
            continue
        s = sources.get(key, {})
        s["label"] = LABELS[key]
        s["checked_at"] = now
        s["ok"] = outcome == "success"
        if s["ok"]:
            s["last_ok_at"] = now
        sources[key] = s
        print(f"{key}: {outcome}")
    out = {
        "description": "自動取得の確認記録（自動生成・手編集不可）。.github/scripts/record_fetch_status.py が毎日の巡回の最後に書く。"
                       "checked_at = 最後に取りに行った日時、ok = そのとき取れたか、last_ok_at = 最後に取れた日時（いずれも UTC）。",
        "sources": sources,
    }
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
