#!/usr/bin/env python3
"""
自動更新（Phase 3）の PR 本文・事後報告コメントを
auto_update/evidence.json と auto_update/verdict.json から生成する。

usage: auto_report.py [pr|report]
  pr     … PR 本文用（出典と監査結果）
  report … マージ後の事後報告用（取り消し手順つき）
"""
import json
import os
import sys


def load(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "pr"
    evidence = load("auto_update/evidence.json") or []
    verdict = load("auto_update/verdict.json")

    print("## 自動更新の内容")
    print()
    if not evidence:
        print("（変更なし）")
    for e in evidence:
        print(f"### `{e.get('file', '?')}`")
        print()
        print(e.get("summary", ""))
        print()
        print("**出典（公式ページ原文の引用）:**")
        for q in e.get("quotes", []):
            text = " ".join(q.get("text", "").split())[:200]
            print(f"> {text}")
            print(f"> — `{q.get('snapshot', '?')}`")
            print()

    if verdict:
        icon = "✅" if verdict.get("verdict") == "approve" else "❌"
        print(f"## 監査AIの判定: {icon} {verdict.get('verdict', '?')}")
        print()
        for r in verdict.get("reasons", []):
            print(f"- {r}")
        for n in verdict.get("notes", []):
            print(f"- （備考）{n}")
        print()

    if mode == "report":
        print("## この更新を取り消すには")
        print()
        print("```bash")
        print("git revert <このPRのマージコミットSHA>")
        print("git push")
        print("```")
        print()
        print("以後の自動マージを止めるには、リポジトリの変数（Settings → Secrets and variables → Actions → Variables）で `AUTO_MERGE` を `false` に設定してください（PR作成までは行い、マージ前で停止します）。")

    print()
    print("🤖 Generated with [Claude Code](https://claude.com/claude-code)")


if __name__ == "__main__":
    main()
