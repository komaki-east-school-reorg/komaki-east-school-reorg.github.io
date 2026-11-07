#!/usr/bin/env python3
"""自動取得が止まっていないかを data/fetch_status.json から確かめる（2026-11-07、日次アイデア 11/2）。

画面では FETCH STATUS（js/main.js）が赤字で「取得できませんでした」「◯日から確かめられていません」と出すが、
運営者は画面を見ないと気づけない。.github/workflows/check-fetch.yml が毎日これを回し、
問題があれば Issue（⚠️ 自動取得の停止）で知らせる。ネットワークには出ない（ファイルを読むだけ）。

  python3 .github/scripts/check_fetch_health.py --report /tmp/fetch.md
  exit 0 = 正常 / 3 = 問題あり（--report に本文） / 1 = 記録が読めない
  STALE_HOURS（36）を過ぎても確かめていない取得元は「止まっている」とみなす（画面の赤字と同じ基準）。
"""
import json
import sys
from datetime import datetime, timezone, timedelta

STATUS = "data/fetch_status.json"
STALE_HOURS = 36
JST = timezone(timedelta(hours=9))


def parse(ts):
    return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def jst(dt):
    return dt.astimezone(JST).strftime("%Y-%m-%d %H:%M")


def main(argv):
    report = None
    if "--report" in argv:
        report = argv[argv.index("--report") + 1]
    now = datetime.now(timezone.utc)
    if "--now" in argv:   # 検証用：基準の時刻を変える（例 --now 2026-11-10T00:00:00Z）
        now = parse(argv[argv.index("--now") + 1])
    try:
        with open(STATUS, encoding="utf-8") as f:
            sources = json.load(f)["sources"]
    except (OSError, ValueError, KeyError) as e:
        print(f"{STATUS} が読めない: {e}", file=sys.stderr)
        return 1
    problems = []
    for key, s in sorted(sources.items()):
        label = s.get("label", key)
        checked = s.get("checked_at")
        last_ok = s.get("last_ok_at")
        if not checked:
            problems.append(f"- **{label}**（`{key}`）：確かめた記録がありません")
            continue
        age = (now - parse(checked)).total_seconds() / 3600
        if age > STALE_HOURS:
            problems.append(f"- **{label}**（`{key}`）：{jst(parse(checked))}（日本時間）から確かめられていません（約{int(age)}時間）。毎日の巡回（Fetch Official News）が止まっている可能性があります")
        elif not s.get("ok"):
            since = f"最後に取れたのは {jst(parse(last_ok))}（日本時間）" if last_ok else "取れた記録がありません"
            problems.append(f"- **{label}**（`{key}`）：{jst(parse(checked))} の巡回で取得できませんでした。{since}")
    if not problems:
        print("自動取得は正常")
        return 0
    body = "\n".join([
        f"自動取得の確認記録（`{STATUS}`）に問題があります（{jst(now)} 日本時間に確認）。",
        "",
        *problems,
        "",
        "サイトの各コーナーの下には赤字で「取得できませんでした」などと出ています。",
        "Actions の「Fetch Official News」の実行結果を確かめてください（相手のサーバの不調なら、翌日に自然に直ることもあります）。",
        "直ったらこの Issue は手で閉じてください（自動では閉じません）。",
    ]) + "\n"
    print(body)
    if report:
        with open(report, "w", encoding="utf-8") as f:
            f.write(body)
    return 3


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
