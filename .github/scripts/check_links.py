#!/usr/bin/env python3
"""
サイトが張っている外部リンクが生きているかを確かめる（週1回、check-links.yml）。

■ なぜ機械で見張るか
   市・文科省・学校・クラブのページは予告なく移る。リンクが切れても
   このサイトの見た目は何も壊れないので、読者が押すまで誰も気づけない。
   出典のリンクが切れていれば、「公式情報にもとづく」という約束そのものが崩れる。

■ 何を見るか
   *.html・js/*.js・data/i18n/*.json と data/community_actions.json（まだ終わっていない項目）に書かれた
   https?:// の URL のうち、SKIP_HOSTS 以外のすべて（市の許可URL・文科省・対象8校・
   クラブや団体のサイト・会場の案内・市の登録フォームなど）。
   取得は fetch_news.py の curl 実装をそのまま使い（市サイトの WAF を越えるため）、
   1本ごとに3〜5秒あける。各サーバへのアクセスは週に数回で済む。

■ 見ないもの（SKIP_HOSTS）
   - Instagram・Facebook：robots.txt が機械による収集を禁じている（CLAUDE.md の方針）。
   - 共有ボタンの送り先（X・LINE・はてな・note・Threads・Bluesky・Reddit）：
     読者が押したときに開く入口で、出典ではない。
   - Google マップ：検索語を渡すリンクで、決まったページではない。

■ 切れたと判断するまで
   一時的な不調で騒がないよう、2週続けて失敗した URL だけを「切れている」とする。
   失敗の記録は data/link_check.json に残す（週ごとにコミットされる）。

終了コード: 0 = すべて生きている（初回の失敗は様子見）, 3 = 切れているものがある, 1 = 致命的エラー
"""
import argparse
import glob
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_news as F   # noqa: E402  （curl 取得・polite_wait を共有する）

STATE = "data/link_check.json"
SOURCES = ("*.html", "js/*.js", "data/i18n/*.json")
ACTIONS = "data/community_actions.json"   # 終わった催しは画面に出ないので、まだ終わっていない項目だけ見る
URL_RE = re.compile(r"https?://[^\s\"'<>\\`]+")
SITE_HOST = "komaki-east-school-reorg.github.io"
SKIP_HOSTS = (
    "instagram.com", "facebook.com",
    "x.com", "twitter.com", "line.me", "hatena.ne.jp", "note.com",
    "threads.net", "bsky.app", "reddit.com", "tiktok.com",
    "maps.google.co.jp", "google.com",
    "schema.org", "w3.org", "ogp.me",
)
JST = timezone(timedelta(hours=9))
CONFIRM_AFTER = 2   # この回数続けて失敗したら「切れている」


def skip(url):
    host = urlsplit(url).hostname or ""
    if not host or "." not in host or host == SITE_HOST:
        return True
    return any(host == h or host.endswith("." + h) for h in SKIP_HOSTS)


def collect():
    """{URL: [見つかったファイル, ...]}"""
    found = {}
    for pattern in SOURCES:
        for path in sorted(glob.glob(pattern)):
            with open(path, encoding="utf-8") as f:
                text = f.read()
            for m in URL_RE.finditer(text):
                url = m.group(0).rstrip(".,;:)]}」』）")
                if "{" in url or skip(url):   # 雛形（'https://' + host）は skip() がホスト無しで外す
                    continue
                found.setdefault(url, [])
                if path not in found[url]:
                    found[url].append(path)
    today = datetime.now(JST).date().isoformat()
    with open(ACTIONS, encoding="utf-8") as f:
        for item in json.load(f).get("actions", []):
            if item.get("date") and item["date"] < today:
                continue
            for k, v in item.items():
                if k.endswith("url") and isinstance(v, str) and not skip(v):
                    found.setdefault(v, [])
                    if ACTIONS not in found[v]:
                        found[v].append(ACTIONS)
    return found


def load_state():
    if os.path.exists(STATE):
        with open(STATE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", help="切れているリンクの報告（Markdown）の書き出し先")
    ap.add_argument("--list", action="store_true", help="取りに行かず、対象の URL を並べるだけ")
    args = ap.parse_args()

    links = collect()
    if args.list:
        for url, where in sorted(links.items()):
            print(url, " ".join(where))
        print(f"{len(links)}本")
        return 0

    old = load_state().get("failing", {})
    failing = {}
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    for i, url in enumerate(sorted(links)):
        if i:
            F.polite_wait()
        try:
            F.fetch_html(url)
            print(f"OK  {url}")
        except Exception as e:
            prev = old.get(url, {})
            failing[url] = {
                "since": prev.get("since", now),
                "count": prev.get("count", 0) + 1,
                "error": str(e)[:200],
                "found_in": links[url],
            }
            print(f"NG  {url}  {e}（{failing[url]['count']}回目）")

    with open(STATE, "w", encoding="utf-8") as f:
        json.dump({
            "description": "外部リンクの死活確認の記録（自動生成・手編集不可）。.github/scripts/check_links.py が週1回書く。"
                           "failing は直近の確認で取れなかった URL。2回続けて取れないと Issue になる。",
            "checked_at": now,
            "checked": len(links),
            "failing": failing,
        }, f, ensure_ascii=False, indent=2)
        f.write("\n")

    broken = {u: v for u, v in failing.items() if v["count"] >= CONFIRM_AFTER}
    print(f"{len(links)}本を確認：取れなかったもの {len(failing)}本、うち切れていると判断 {len(broken)}本")
    if broken and args.report:
        lines = [
            f"外部リンク {len(links)}本を確かめたところ、{CONFIRM_AFTER}週続けて開けないものが {len(broken)}本ありました。",
            "",
            "| URL | 状態 | いつから | 書かれている場所 |",
            "|---|---|---|---|",
        ]
        for url, v in sorted(broken.items()):
            lines.append(f"| {url} | {v['error']} | {v['since'][:10]} | {'、'.join(v['found_in'])} |")
        lines += [
            "",
            "直し方：移転先が同じ発信元の公表ページで確かめられたら差し替える。"
            "市・文科省の URL を変えるときは、CLAUDE.md の許可URLの表と auto_gates.py の PERMITTED_LINKS もあわせて直すこと。"
            "確かめられなければリンクを外す（推測の URL を張らない）。",
            "",
            "Instagram・Facebook は規約により機械で確かめていません。",
        ]
        with open(args.report, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    return 3 if broken else 0


if __name__ == "__main__":
    sys.exit(main())
