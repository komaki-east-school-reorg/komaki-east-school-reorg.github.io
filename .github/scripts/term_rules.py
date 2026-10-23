#!/usr/bin/env python3
"""訳語のゆれの検査（data/term_rules.json）。

auto_gates.py check 18 と headline_i18n.py apply の両方が使う。規則は JSON の1か所だけに置き、
ここは読み込みと照合だけを行う。

  python3 .github/scripts/term_rules.py   サイト全体を検査（exit 0 = 合格 / 1 = ゆれあり）
"""
import glob
import json
import os
import re
import sys

RULES_PATH = "data/term_rules.json"


def load_rules(path=RULES_PATH):
    with open(path, encoding="utf-8") as f:
        rules = json.load(f)["rules"]
    for r in rules:
        r["re"] = re.compile(r["avoid"])
    return rules


def violations(lang, text, rules):
    """lang の文 text に当たった規則を (規則, 当たった文字列) で返す。"""
    out = []
    for r in rules:
        if lang in r["langs"]:
            for m in r["re"].finditer(text):
                out.append((r, m.group(0)))
    return out


def site_texts():
    """(言語, 出どころ, 文) を、検査するすべての訳について返す。"""
    for path in sorted(glob.glob("data/i18n/*.json")):
        lang = os.path.basename(path)[:-5]
        if lang in ("ja", "ja-kids"):
            continue
        with open(path, encoding="utf-8") as f:
            for k, v in json.load(f).items():
                if isinstance(v, str):
                    yield lang, f"{path} {k}", v
    with open("data/headline_i18n.json", encoding="utf-8") as f:
        for src, entry in json.load(f).get("items", {}).items():
            for lang, v in entry.items():
                if isinstance(v, str):
                    yield lang, f"data/headline_i18n.json 「{src[:20]}」", v
    with open("data/events.json", encoding="utf-8") as f:
        for date, ev in json.load(f).get("events", {}).items():
            for i, e in enumerate(ev if isinstance(ev, list) else [ev]):
                for lang, v in e.items():
                    if isinstance(v, str):
                        yield lang, f"data/events.json {date}[{i}]", v
    with open("data/community_actions.json", encoding="utf-8") as f:
        data = json.load(f)
    for i, item in enumerate(data.get("items", data.get("actions", []))):
        for k, v in item.items():
            m = re.search(r"_([a-z]{2})$", k)
            if m and isinstance(v, str):
                yield m.group(1), f"data/community_actions.json [{i}] {k}", v


def check_site():
    rules = load_rules()
    found = []
    for lang, where, text in site_texts():
        for r, hit in violations(lang, text, rules):
            found.append(f"{where}: 「{hit}」→ {r['use']}（{r['id']}）")
    return found


if __name__ == "__main__":
    found = check_site()
    for v in found:
        print(f"NG: {v}")
    print(f"訳語のゆれ: {len(found)}件")
    sys.exit(1 if found else 0)
