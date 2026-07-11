#!/usr/bin/env python3
"""
自動更新（Phase 3）のガードレール検証。

起案AIが作業ツリーに加えた変更を機械的に検査する：
  1. 編集範囲チェック  — 許可ファイル以外の変更・新規ファイル作成を拒否
  2. スキーマチェック  — events.json の日付キー・8言語ラベル、i18n の JSON 構文
  3. 外部リンク規則    — 市サイトへのリンクは許可URL（303/index.html）のみ
  4. 出典実在チェック  — evidence.json の各引用が data/official_pages/ の
                          スナップショットに実在する文字列か照合（創作の検出）

終了コード: 0 = 合格, 1 = 不合格, 3 = 変更なし（更新不要と判断）
"""
import glob
import json
import os
import re
import subprocess
import sys

LANGS = ["ja", "en", "pt", "vi", "tl", "es", "zh", "id"]
ALLOWED = {"data/events.json", "index.html", "schedule.html"} | {
    f"data/i18n/{l}.json" for l in LANGS + ["ja-kids"]
}
# 自動化の作業ファイル置き場（検査対象外）
IGNORE_PREFIXES = ("auto_update/", "report/")
EVIDENCE = "auto_update/evidence.json"
PERMITTED_LINK = "303/index.html"
MIN_QUOTE_LEN = 10

fails = []


def fail(msg):
    fails.append(msg)
    print(f"NG: {msg}")


def ok(msg):
    print(f"OK: {msg}")


def normalize(text):
    """空白・改行を除去して比較する（スナップショットは行区切りのため）"""
    return re.sub(r"\s+", "", text)


def changed_paths():
    """作業ツリーの変更ファイル（未追跡含む）。IGNORE_PREFIXES は除外。"""
    out = subprocess.check_output(["git", "status", "--porcelain"], text=True)
    paths = []
    for line in out.splitlines():
        path = line[3:].strip().strip('"')
        if " -> " in path:  # リネーム
            path = path.split(" -> ")[1].strip().strip('"')
        if path.startswith(IGNORE_PREFIXES):
            continue
        paths.append(path)
    return paths


def main():
    changed = changed_paths()

    if not changed:
        print("変更なし（更新不要と判断）")
        sys.exit(3)

    print(f"変更ファイル: {changed}")

    # --- 1. 編集範囲チェック ---
    for p in changed:
        if p not in ALLOWED:
            fail(f"許可されていないファイルの変更: {p}")
    if not fails:
        ok("編集範囲は許可ファイル内")

    # --- 2. スキーマチェック ---
    if "data/events.json" in changed:
        try:
            with open("data/events.json", encoding="utf-8") as f:
                events = json.load(f)["events"]
            n_before = len(fails)
            for date, labels in events.items():
                if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
                    fail(f"events.json: 不正な日付キー: {date}")
                if sorted(labels) != sorted(LANGS):
                    fail(f"events.json: {date} の言語キーが8言語と一致しない: {sorted(labels)}")
                elif not all(isinstance(v, str) and v.strip() for v in labels.values()):
                    fail(f"events.json: {date} に空のラベルがある")
            if len(fails) == n_before:
                ok(f"events.json スキーマ（{len(events)}件）")
        except Exception as e:
            fail(f"events.json が読めない: {e}")

    for p in changed:
        if p.startswith("data/i18n/") and p.endswith(".json"):
            try:
                with open(p, encoding="utf-8") as f:
                    d = json.load(f)
                bad = [k for k, v in d.items() if not isinstance(v, str)]
                if bad:
                    fail(f"{p}: 文字列でない値: {bad[:5]}")
                else:
                    ok(f"{p} JSON 構文・型")
            except Exception as e:
                fail(f"{p} が JSON として不正: {e}")

    # --- 3. 外部リンク規則（サイト全体を検査） ---
    link_violations = []
    for p in glob.glob("*.html") + glob.glob("js/*.js"):
        with open(p, encoding="utf-8") as f:
            for i, line in enumerate(f, 1):
                for m in re.finditer(r"city\.komaki\.aichi\.jp[^\s\"'<)]*", line):
                    if PERMITTED_LINK not in m.group(0):
                        link_violations.append(f"{p}:{i} {m.group(0)[:80]}")
    if link_violations:
        for v in link_violations:
            fail(f"許可外の市サイトURL: {v}")
    else:
        ok("外部リンク規則")

    # --- 4. 出典実在チェック ---
    if not os.path.exists(EVIDENCE):
        fail(f"{EVIDENCE} がない（変更には出典が必須）")
    else:
        try:
            with open(EVIDENCE, encoding="utf-8") as f:
                evidence = json.load(f)
        except Exception as e:
            fail(f"{EVIDENCE} が JSON として不正: {e}")
            evidence = []

        by_file = {}
        for e in evidence:
            by_file.setdefault(e.get("file", ""), []).append(e)

        for p in changed:
            if p not in by_file:
                fail(f"{p} の変更に evidence.json のエントリがない")

        snap_cache = {}
        for e in evidence:
            quotes = e.get("quotes", [])
            if not quotes:
                fail(f"evidence: {e.get('file')} に引用（quotes）がない")
            for q in quotes:
                snap = q.get("snapshot", "")
                text = q.get("text", "")
                if not snap.startswith("data/official_pages/") or not os.path.exists(snap):
                    fail(f"evidence: スナップショットが存在しない: {snap}")
                    continue
                if len(text) < MIN_QUOTE_LEN:
                    fail(f"evidence: 引用が短すぎる（{MIN_QUOTE_LEN}文字以上必須）: {text!r}")
                    continue
                if snap not in snap_cache:
                    with open(snap, encoding="utf-8") as f:
                        snap_cache[snap] = normalize(f.read())
                if normalize(text) not in snap_cache[snap]:
                    fail(f"evidence: 引用が {snap} に実在しない（創作の疑い）: {text[:60]!r}")
        if not fails:
            ok(f"出典実在チェック（{sum(len(e.get('quotes', [])) for e in evidence)}引用）")

    # --- 結果 ---
    if fails:
        print(f"\n不合格: {len(fails)}件の問題")
        sys.exit(1)
    print("\n全ゲート合格")
    sys.exit(0)


if __name__ == "__main__":
    main()
