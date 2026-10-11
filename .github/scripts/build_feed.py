#!/usr/bin/env python3
"""「最新の動き」を Atom フィード（feed.xml）に書き出す（2026-10-11 ユーザー指示）。

RSS リーダーで地域の情報を追う人（他地域の保護者・記者・教育関係者）に、桃花台の新着を
手作業なしで届けるため。中身は、サイトが既に持っているデータだけ:

  ・市公式サイトのお知らせ       data/news.json
  ・東部の地域協議会の催し       data/community_events.json（shinooka: true のもの）
  ・東部まちづくりの動き         data/tobu_actions.json
  ・このサイトの更新履歴         data/site-updates.json（type が fix のものは除く）

  ・リンクは**このサイトの該当コーナー**だけ。市の個別ページへは張らない（外部リンク規則と同じ。
    読者がサイトの説明を読まずに外へ抜けないようにするため — カットインと同じ考え方）。
  ・文面は日本語。見出しは「市が「…」のページを更新」のように、カットインと同じ一行にそろえる。
  ・出力は入力だけで決まる（実行時刻を入れない）。--check で古さを検査できるようにするため。

使い方:
  python3 .github/scripts/build_feed.py          # feed.xml を書き出す
  python3 .github/scripts/build_feed.py --check  # 古ければ exit 1（auto_gates.py check 14）

生成物（feed.xml）は手編集しないこと。
"""
import hashlib
import json
import os
import re
import sys
from xml.sax.saxutils import escape

SITE = "https://komaki-east-school-reorg.github.io/"
OUT = "feed.xml"
TITLE = "小牧市東部（篠岡地区）学校再編ナビ｜最新の動き"
SUBTITLE = "桃花台エリアの非公式でもわかりやすい地域情報メディア。市のお知らせ・地域の催し・東部まちづくり・サイトの更新を日本語でお届けします。"
MAX_ENTRIES = 40


def load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def iso_of(s):
    """「2026年10月08日」または「2026-10-08」を ISO 日付に。読めなければ空。"""
    m = re.match(r"(\d{4})年(\d{1,2})月(\d{1,2})日", s or "")
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = re.match(r"(\d{4}-\d{2}-\d{2})", s or "")
    return m.group(1) if m else ""


def entry_id(*parts):
    h = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]
    return f"tag:komaki-east-school-reorg.github.io,2026:{h}"


def collect():
    out = []
    for it in load("data/news.json").get("items", []):
        d = iso_of(it.get("updated_at", ""))
        t = it.get("title", "")
        if d and t:
            out.append((d, f"市が「{t}」のページを更新", "市公式サイトのお知らせ", "index.html#news",
                        entry_id("news", d, t)))
    for it in load("data/community_events.json").get("events", []):
        if not it.get("shinooka"):
            continue
        d = iso_of(it.get("updated_at", ""))
        t = it.get("title", "")
        if d and t:
            when = f"（{it['when']}）" if it.get("when") else ""
            out.append((d, f"地域協議会の催し：{t}{when}", "地域協議会のイベント案内",
                        "community.html#council-events", entry_id("council", t, it.get("when", ""))))
    for it in load("data/tobu_actions.json").get("items", []):
        # 催し（kind: event）の date は「開催日」で、公表日ではない。未来の日付を更新日にすると
        # フィードの並びが壊れるので入れない（記録・紹介の行だけ）。
        if it.get("kind") == "event":
            continue
        d = iso_of(it.get("date", ""))
        t = it.get("title", "")
        if d and t:
            out.append((d, f"東部まちづくり：{t}", "東部まちづくりの動き",
                        "community.html#community-actions", entry_id("tobu", d, t)))
    for it in load("data/site-updates.json").get("updates", []):
        if it.get("type") == "fix":
            continue
        d = iso_of(it.get("date", ""))
        t = it.get("ja", "")
        if d and t:
            out.append((d, t, "サイトの更新履歴", "index.html#site-updates", entry_id("site", d, t)))
    # 新しい順。同じ日付の中は種類と題名で決まった順にして、出力を毎回同じにする。
    out.sort(key=lambda e: (e[0], e[2], e[1]), reverse=True)
    seen, uniq = set(), []
    for e in out:
        if e[4] in seen:
            continue
        seen.add(e[4])
        uniq.append(e)
    return uniq[:MAX_ENTRIES]


def build():
    entries = collect()
    updated = (entries[0][0] if entries else "2026-01-01") + "T00:00:00+09:00"
    lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<!-- 自動生成（.github/scripts/build_feed.py）。手編集しないこと。 -->",
        '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ja">',
        f"  <title>{escape(TITLE)}</title>",
        f"  <subtitle>{escape(SUBTITLE)}</subtitle>",
        f'  <link rel="self" type="application/atom+xml" href="{SITE}{OUT}"/>',
        f'  <link rel="alternate" type="text/html" href="{SITE}"/>',
        f"  <id>{SITE}</id>",
        f"  <updated>{updated}</updated>",
        "  <author><name>小牧市東部（篠岡地区）学校再編ナビ（市民有志・非公式）</name></author>",
        f"  <icon>{SITE}favicon.svg</icon>",
        "  <rights>このサイトは市民有志が運営しており、小牧市・教育委員会とは無関係です。</rights>",
    ]
    for d, title, cat, href, eid in entries:
        lines += [
            "  <entry>",
            f"    <title>{escape(title)}</title>",
            f'    <link rel="alternate" type="text/html" href="{SITE}{href}"/>',
            f"    <id>{eid}</id>",
            f"    <updated>{d}T00:00:00+09:00</updated>",
            f'    <category term="{escape(cat)}"/>',
            f"    <summary>{escape(cat + '｜' + title)}</summary>",
            "  </entry>",
        ]
    lines.append("</feed>")
    return "\n".join(lines) + "\n", len(entries)


def main():
    text, n = build()
    old = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else None
    if "--check" in sys.argv:
        if old != text:
            print("NG: feed.xml が古い → python3 .github/scripts/build_feed.py を実行してコミットすること")
            sys.exit(1)
        print(f"OK: feed.xml は最新（{n}件）")
        return
    if old != text:
        with open(OUT, "w", encoding="utf-8") as f:
            f.write(text)
    print(f"feed.xml: {n}件" + ("（更新）" if old != text else "（変更なし）"))


if __name__ == "__main__":
    main()
