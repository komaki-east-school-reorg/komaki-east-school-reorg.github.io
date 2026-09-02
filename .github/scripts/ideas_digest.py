#!/usr/bin/env python3
"""毎日のアイデア案（auto_ideas/ideas.md）を読んで、見出しを履歴に足す。

AI に履歴 JSON を直接書かせないのは、生成物が壊れていても気づけないため。
AI が書くのは Markdown 1枚だけにして、機械で読める形はここで作る。

使い方:
  ideas_digest.py record <ideas.md>   見出しを auto_ideas/history.json に追記
  ideas_digest.py subject <ideas.md>  メールの件名を1行で出力

終了コード: 0 = 見出しが1つ以上あった / 2 = 1つも無かった（見送りの日）
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

HISTORY = "auto_ideas/history.json"
MAX_ENTRIES = 300           # 履歴はこの件数で頭打ち（プロンプトに全部載せるため）
HEAD_RE = re.compile(r"^##\s+(?:\d+[.．、]?\s*)?(.+?)\s*$")


def today_jst():
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d")


def titles(path):
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("## "):
                m = HEAD_RE.match(line.rstrip("\n"))
                if m:
                    # 件名は GITHUB_OUTPUT を経てシェルの "..." に入るので、
                    # 引用符・バッククォート・改行の類はここで落としておく
                    t = re.sub(r'["`$\\\n\r]', "", m.group(1)).strip()
                    if t and t not in out:
                        out.append(t)
    return out


def record(path):
    ts = titles(path)
    if not ts:
        return 2
    hist = {"ideas": []}
    if os.path.exists(HISTORY):
        try:
            with open(HISTORY, encoding="utf-8") as f:
                hist = json.load(f)
        except Exception as e:
            print("履歴が読めないので作り直します: %s" % e, file=sys.stderr)
            hist = {"ideas": []}
    day = today_jst()
    hist.setdefault("ideas", [])
    hist["ideas"] = [{"date": day, "title": t} for t in ts] + hist["ideas"]
    hist["ideas"] = hist["ideas"][:MAX_ENTRIES]
    hist["description"] = (
        "毎日の新機能アイデア（.github/workflows/feature-ideas.yml）が過去に出した見出しの記録。"
        "同じ案を繰り返さないために起案AIが読む。手編集可（消せばまた提案されうる）。"
    )
    os.makedirs(os.path.dirname(HISTORY), exist_ok=True)
    with open(HISTORY, "w", encoding="utf-8") as f:
        json.dump(hist, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("履歴に %d 件追記しました（合計 %d 件）" % (len(ts), len(hist["ideas"])))
    return 0


def subject(path):
    ts = titles(path)
    if not ts:
        print("💡 新機能アイデア %s（今日は見送り）" % today_jst())
        return 2
    head = ts[0]
    if len(head) > 40:
        head = head[:39] + "…"
    more = "ほか%d件" % (len(ts) - 1) if len(ts) > 1 else ""
    print("💡 新機能アイデア %s: %s%s" % (today_jst(), head, ("／" + more) if more else ""))
    return 0


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("record", "subject"):
        print(__doc__, file=sys.stderr)
        return 1
    return record(sys.argv[2]) if sys.argv[1] == "record" else subject(sys.argv[2])


if __name__ == "__main__":
    sys.exit(main())
