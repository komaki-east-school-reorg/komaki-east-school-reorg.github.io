#!/usr/bin/env python3
"""東部たんけんクイズの候補（AI が書いた auto_quiz/candidates.md）を Issue の本文に整える。

AI はウェブの文章を読むので、本文は信用しない。ここで機械的に：
- 出どころの https URL が無い候補を落とす
- SNS・地図サービスだけを根拠にした候補を落とす（規約で機械の収集が禁じられているため）
- 学校再編・行政の問いを落とす
- HTML と、人やIssueへの通知になる @ / # を無効にする
使い方: quiz_candidates.py <入力.md> <出力.md>   終了コード 0=候補あり / 2=候補なし / 1=エラー
"""
import re
import sys
from urllib.parse import urlsplit

BLOCKED = ("instagram.com", "facebook.com", "x.com", "twitter.com", "threads.net", "tiktok.com",
           "google.com", "google.co.jp", "goo.gl", "maps.app.goo.gl")
OFF_TOPIC = re.compile("再編|パブリックコメント|教育委員会|市議会|議員|選挙")
MAX_ITEMS = 8
MAX_ITEM_CHARS = 1500


def blocked(url):
    host = (urlsplit(url).hostname or "").lower()
    return any(host == b or host.endswith("." + b) for b in BLOCKED)


def clean(text):
    text = re.sub(r"<[^>]*>", "", text)
    text = text.replace("@", "＠")
    text = re.sub(r"#(?=\d)", "＃", text)
    text = re.sub(r"!\[", "[", text)
    return text.strip()


def main(src, dst):
    try:
        raw = open(src, encoding="utf-8").read()
    except FileNotFoundError:
        return 2
    parts = re.split(r"(?m)^(?=## )", raw)
    kept, dropped = [], 0
    for part in parts:
        if not part.startswith("## "):
            continue
        part = clean(part)[:MAX_ITEM_CHARS]
        urls = re.findall(r"https://[^\s)>\]」]+", part)
        good = [u for u in urls if not blocked(u)]
        if not good or len(good) != len(urls) or OFF_TOPIC.search(part):
            dropped += 1
            continue
        kept.append(part)
    if not kept:
        return 2
    head = ("AI がウェブで探した候補です。**サイトはまだ変わっていません。** 出どころを開いて確かめ、"
            "採用するものだけ `data/quiz/` の13枚に足してください（テーマの問題数はそろえる）。\n")
    if dropped:
        head += f"\n（出どころの条件を満たさない候補を {dropped} 件外しました）\n"
    with open(dst, "w", encoding="utf-8") as f:
        f.write(head + "\n" + "\n\n".join(kept[:MAX_ITEMS]) + "\n")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(1)
    sys.exit(main(sys.argv[1], sys.argv[2]))
