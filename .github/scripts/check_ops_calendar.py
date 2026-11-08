#!/usr/bin/env python3
"""運用カレンダーの期限を確かめる（2026-11-08）。

人の手でしか直せない期限つきの作業（PR カードの差し替え、BASE_FY、4月の組織改編…）が
CLAUDE.md のあちこちに散らばっていて、期限が来ると黙って古くなっていた。
.github/workflows/check-fetch.yml が毎日これを回し、期限の近いものを Issue（⏰ 運用作業の期限）で知らせる。
ネットワークには出ない（ファイルを読むだけ）。AI も使わない。

読むもの
  - data/ops_calendar.json の items（手で書く。一度きり／yearly／monthly）
  - ルート直下の *.html の data-expires（過ぎると画面から消える要素）
  - data/i18n/ja.json の値の中の data-until（過ぎると NOW BAR / DATED TEXT が外す文）
    → 後の2つは書き足さなくても自動で拾う。

  python3 .github/scripts/check_ops_calendar.py --list          # 先々までの一覧（人が見る用）
  python3 .github/scripts/check_ops_calendar.py --report out.md [--seen seen.txt] [--now 2026-12-01]
  exit 0 = 知らせるものなし / 3 = あり（--report に本文） / 1 = 読めない・書式の誤り

--seen には、これまでの ⏰ Issue の本文とコメントをつないだテキストを渡す。
各項目は <!-- ops:ID@期限 --> の印つきで書くので、同じ期限を二度知らせない（Issue を閉じたあとも）。
"""
import glob
import json
import re
import sys
from datetime import date, timedelta

CAL = "data/ops_calendar.json"
JA = "data/i18n/ja.json"
AUTO_NOTICE = 7          # 自動で拾った期限は7日前から
LIST_DAYS = 400          # --list で見る先の日数
REPEAT_GRACE = 7         # 繰り返しの項目は期限を過ぎてもこの日数は「今回の分」として扱う

EXPIRES_RE = re.compile(r'data-expires="(\d{4}-\d{2}-\d{2})"')
UNTIL_RE = re.compile(r'data-until="(\d{4}-\d{2}-\d{2})"')


def occurrence(item, today):
    """その項目の「今回の」期限日。"""
    due = item["due"]
    rep = item.get("repeat")
    if not rep:
        return date.fromisoformat(due)
    if rep == "yearly":
        m, d = (int(x) for x in due.split("-"))
        for y in (today.year - 1, today.year, today.year + 1):
            cand = date(y, m, d)
            if cand + timedelta(days=REPEAT_GRACE) >= today:
                return cand
    if rep == "monthly":
        d = int(due)
        y, m = today.year, today.month
        for _ in range(3):
            cand = date(y, m, d)
            prev = cand
            if cand + timedelta(days=REPEAT_GRACE) >= today:
                return cand
            m += 1
            if m == 13:
                y, m = y + 1, 1
        return prev
    raise ValueError(f"repeat が不明: {rep}")


def load_items():
    with open(CAL, encoding="utf-8") as f:
        items = json.load(f)["items"]
    ids = set()
    for it in items:
        for k in ("id", "due", "title", "how"):
            if not it.get(k):
                raise ValueError(f"{CAL}: {it.get('id', '?')} に {k} がない")
        if it["id"] in ids:
            raise ValueError(f"{CAL}: id が重複: {it['id']}")
        ids.add(it["id"])
        rep = it.get("repeat")
        pat = {None: r"\d{4}-\d{2}-\d{2}", "yearly": r"\d{2}-\d{2}", "monthly": r"\d{2}"}.get(rep)
        if pat is None or not re.fullmatch(pat, it["due"]):
            raise ValueError(f"{CAL}: {it['id']} の due「{it['due']}」が repeat={rep} の書式でない")
    return items


def auto_items():
    """HTML の data-expires と ja.json の data-until を拾う。"""
    found = {}
    for path in sorted(glob.glob("*.html")):
        with open(path, encoding="utf-8") as f:
            text = f.read()
        for d in sorted(set(EXPIRES_RE.findall(text))):
            found.setdefault(("expires", d), []).append(path)
    with open(JA, encoding="utf-8") as f:
        ja = json.load(f)
    for key, val in sorted(ja.items()):
        if isinstance(val, str):
            for d in sorted(set(UNTIL_RE.findall(val))):
                found.setdefault(("until", d), []).append(key)
    out = []
    for (kind, d), where in sorted(found.items(), key=lambda x: x[0][1]):
        if kind == "expires":
            out.append({
                "id": f"auto-expires-{d}", "due": d, "notice_days": AUTO_NOTICE,
                "title": f"data-expires=\"{d}\" の要素が画面から消える",
                "how": f"{'・'.join(where)}。差し替えるか、終わったものは HTML から削除する（auto_gates.py 10b も警告する）。",
            })
        else:
            out.append({
                "id": f"auto-until-{d}", "due": d, "notice_days": AUTO_NOTICE,
                "title": f"辞書の data-until=\"{d}\" の文が画面から外れる",
                "how": f"キー {'・'.join('`%s`' % k for k in where)}。外れたあとも文が通じるか確かめ、必要なら13辞書（12言語＋こどもむけ）の文面を書き直す（now_text なら now_asof も）。",
            })
    return out


def main(argv):
    def opt(name):
        return argv[argv.index(name) + 1] if name in argv else None

    today = date.fromisoformat(opt("--now")) if opt("--now") else date.today()
    try:
        manual = load_items()
        covered = {it["covers"] for it in manual if it.get("covers")}
        items = manual + [a for a in auto_items() if a["id"] not in covered]
    except (OSError, ValueError, KeyError) as e:
        print(f"運用カレンダーが読めない: {e}", file=sys.stderr)
        return 1

    rows = []
    for it in items:
        due = occurrence(it, today)
        rows.append((due, it))
    rows.sort(key=lambda r: (r[0], r[1]["id"]))

    if "--list" in argv:
        print(f"運用カレンダー（{today} から {LIST_DAYS} 日先まで。繰り返しは次の1回だけ）\n")
        print("| 期限 | 何日前から | 作業 | どうする |")
        print("|---|---|---|---|")
        for due, it in rows:
            if due <= today + timedelta(days=LIST_DAYS):
                rep = {"yearly": "（毎年）", "monthly": "（毎月）"}.get(it.get("repeat"), "")
                print(f"| {due}{rep} | {it.get('notice_days', 0)} | {it['title']} | {it['how']} |")
        return 0

    seen = ""
    if opt("--seen"):
        try:
            with open(opt("--seen"), encoding="utf-8") as f:
                seen = f.read()
        except OSError:
            seen = ""

    due_now = []
    for due, it in rows:
        mark = f"<!-- ops:{it['id']}@{due} -->"
        if today >= due - timedelta(days=it.get("notice_days", 0)) and mark not in seen:
            due_now.append((due, it, mark))
    if not due_now:
        print("知らせる運用作業はありません")
        return 0

    lines = [f"期限が近い（または過ぎた）運用作業があります（{today} に確認）。", ""]
    for due, it, mark in due_now:
        left = (due - today).days
        when = f"あと{left}日" if left > 0 else ("今日" if left == 0 else f"{-left}日過ぎています")
        lines += [f"- {mark}**{due}（{when}）{it['title']}**", f"  - {it['how']}"]
    lines += [
        "",
        "一度きりの項目は、済んだら `data/ops_calendar.json` から消してください（繰り返しの項目は消さない）。",
        "data-expires / data-until から自動で拾った項目は、HTML や辞書を直せば次から出ません。",
        "同じ期限は二度知らせません。済んだらこの Issue は手で閉じてください。",
    ]
    body = "\n".join(lines) + "\n"
    print(body)
    if opt("--report"):
        with open(opt("--report"), "w", encoding="utf-8") as f:
            f.write(body)
    return 3


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
