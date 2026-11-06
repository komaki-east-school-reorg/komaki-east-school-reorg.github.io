#!/usr/bin/env python3
"""
小牧市の、篠岡地区以外の地区の学校再編の掲載を data/nearby_komaki.json に組み立てる。
2026-11-07 ユーザー指示（about.html#nearby「近隣他地区の状況」を随時更新する）。

fetch_news.py が学校再編の木（.../kyouikusoumu/303/ の下）から毎日保存している
data/official_pages/303-719-<地区のフォルダ>-<ページID>.txt のうち、篠岡地区と
全市の検討委員会以外のもの（いまは北里地区の「学校を考える会」）を、更新日の新しい順に並べる。
市サーバへのアクセスはしない（fetch_news.py の【あと】に実行する）。

市が新しい地区のフォルダ（例：.../303/719/<新しい地区>/）を作れば、何もしなくてもここに出る。
地区名は DISTRICTS で訳す。知らないフォルダは「その他の地区」として出す（落とさない）。

  python3 .github/scripts/build_nearby_komaki.py           # 生成
  python3 .github/scripts/build_nearby_komaki.py --check   # 古ければ exit 1
"""
import glob
import json
import os
import re
import sys

SNAP_DIR = os.path.join("data", "official_pages")
OUTPUT = os.path.join("data", "nearby_komaki.json")
# 篠岡地区（このサイトの本体）と、全市の推進計画の検討委員会は対象外
EXCLUDE = ("sinookachiku", "aratanagakkoudukurisuishinkeikakukentouiinnkai")
# 市のフォルダ名 → 地区（表示は js/main.js の NEARBY KOMAKI が訳す）
DISTRICTS = {"kitazatochiku": "kitazato", "habashitachiku": "habashita", "hahashitachiku": "habashita"}


def build():
    items = []
    for path in sorted(glob.glob(os.path.join(SNAP_DIR, "303-719-*.txt"))):
        name = os.path.basename(path)[:-4]
        m = re.match(r"303-719-([^-]+)-(\d+)$", name)
        if not m or m.group(1) in EXCLUDE:
            continue
        with open(path, encoding="utf-8") as f:
            lines = f.read().split("\n")
        body = lines[2:] if len(lines) > 2 and lines[1] == "---" else lines
        title = next((l.strip() for l in body if l.strip()), "")
        upd = next((re.search(r"更新日：(\d{4})年(\d{2})月(\d{2})日", l) for l in body
                    if l.startswith("更新日：")), None)
        items.append({
            "slug": name,
            "title": title,
            "updated": f"{upd.group(1)}-{upd.group(2)}-{upd.group(3)}" if upd else None,
            "district": DISTRICTS.get(m.group(1), "other"),
        })
    items.sort(key=lambda it: (it["updated"] or "", it["slug"]), reverse=True)
    out = {
        "description": "小牧市の、篠岡地区以外の地区の学校再編の掲載（自動生成・手編集不可）。"
                       ".github/scripts/build_nearby_komaki.py が data/official_pages/303-719-* から作る。",
        "items": items,
    }
    return json.dumps(out, ensure_ascii=False, indent=2) + "\n"


def main():
    new = build()
    old = open(OUTPUT, encoding="utf-8").read() if os.path.exists(OUTPUT) else ""
    if "--check" in sys.argv:
        if new != old:
            print(f"{OUTPUT} が古い。python3 .github/scripts/build_nearby_komaki.py を実行すること", file=sys.stderr)
            sys.exit(1)
        print(f"{OUTPUT} は最新")
        return
    if new != old:
        with open(OUTPUT, "w", encoding="utf-8") as f:
            f.write(new)
        print(f"wrote {OUTPUT}")
    else:
        print("no change")


if __name__ == "__main__":
    main()
