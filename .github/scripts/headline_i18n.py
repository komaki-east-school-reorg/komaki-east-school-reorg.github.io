#!/usr/bin/env python3
"""自動取得した見出しの多言語化（2026-09-14 ユーザー指示：見出しを原文のまま残さない）。

市のお知らせ・対象校ホームページ・報道・地域協議会のイベント・東部まちづくり・
地域の取組の見出し（と東部まちづくりの会場名）は日本語で届く。日本語以外の表示では
これを訳した見出しに置き換えるため、訳を data/headline_i18n.json に持つ。

  pending  いま表示されうる見出しのうち、訳がそろっていないものを
           auto_i18n/pending.json に書き出す。
           exit 0 = 訳すものがある / 2 = 無い
  apply    起案AIが書いた auto_i18n/translations.json を機械検証し、合格した訳だけを
           data/headline_i18n.json に取り込む。いま表示されない見出しの訳は落とす
           （見出しが入れ替われば古い訳は自動で消える）。
           exit 0 = 変更あり / 2 = 変更なし / 1 = 下書きが読めない
  prune    取り込みはせず、いま表示されない見出しの訳を落とすだけ。exit は apply と同じ。

AI に data/headline_i18n.json を直接書かせないのは、壊れた JSON や規則違反の訳が
そのまま公開されるのを防ぐため（ideas_digest.py と同じ考え方）。
キーは見出しの原文そのもの。見出しが1文字でも変われば別のキーになり、訳し直される。
"""
import json
import os
import re
import sys

LANGS = ["en", "pt", "vi", "tl", "es", "zh", "id", "ko", "ne", "tr", "my"]
STORE = "data/headline_i18n.json"
PENDING = "auto_i18n/pending.json"
DRAFT = "auto_i18n/translations.json"

JA = re.compile(r"[぀-ヿ㐀-鿿]")
KANA = re.compile(r"[぀-ゟ゠-ヺ]")   # ひらがな・カタカナ（長音「ー」と中黒「・」は除く）
DESCRIPTION = (
    "自動取得した見出しの訳（日本語以外の表示で見出しを置き換える）。"
    ".github/scripts/headline_i18n.py と .github/workflows/translate-headlines.yml が毎日更新する。"
    "キーは見出しの原文。いま表示されない見出しの訳は自動で落ちる。"
    "訳の誤りは手で直してよい（見出しが変わらないかぎり上書きされない）。"
)


def load(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def current_headlines():
    """表示されうる日本語の見出しを、出どころの順に重複なく集める。"""
    out, seen = [], set()

    def add(s):
        s = (s or "").strip()
        if s and JA.search(s) and s not in seen:
            seen.add(s)
            out.append(s)

    for it in load("data/news.json", {}).get("items", []):
        add(it.get("title"))
    for s in load("data/school_news.json", {}).get("schools", []):
        for it in s.get("items", []):
            add(it.get("title"))
    for it in load("data/chunichi_news.json", {}).get("items", []):
        add(it.get("title"))
    for ev in load("data/community_events.json", {}).get("events", []):
        add(ev.get("title"))
    for it in load("data/tobu_actions.json", {}).get("items", []):
        add(it.get("title"))
        add(it.get("place"))
    for it in load("data/community_actions.json", {}).get("actions", []):
        add(it.get("title_ja"))
    return out


def complete(entry):
    return isinstance(entry, dict) and all(isinstance(entry.get(l), str) and entry[l].strip() for l in LANGS)


def problems(src, entry):
    """訳1件を検証し、問題点の一覧を返す（空なら合格）。"""
    if not isinstance(entry, dict):
        return ["値がオブジェクトではない"]
    errs = []
    for l in LANGS:
        v = entry.get(l)
        if not isinstance(v, str) or not v.strip():
            errs.append(f"{l}: 訳が無い")
            continue
        if "<" in v or ">" in v:
            errs.append(f"{l}: タグ記号を含む")
        if re.search(r"https?://|www\.", v):
            errs.append(f"{l}: URL を含む")
        if "\n" in v:
            errs.append(f"{l}: 改行を含む")
        if len(v) > max(160, len(src) * 6):
            errs.append(f"{l}: 長すぎる（{len(v)}字）")
        if KANA.search(v):
            errs.append(f"{l}: かなが残っている（訳されていない）")
        if l != "zh" and JA.search(v):
            errs.append(f"{l}: 漢字が残っている（訳されていない）")
    return errs


def write_store(items):
    ordered = {k: {l: items[k][l].strip() for l in LANGS} for k in current_headlines() if k in items}
    data = {"description": DESCRIPTION, "items": ordered}
    old = load(STORE, None)
    if old == data:
        return False
    os.makedirs(os.path.dirname(STORE), exist_ok=True)
    with open(STORE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return True


def cmd_pending():
    items = load(STORE, {}).get("items", {})
    todo = [t for t in current_headlines() if not complete(items.get(t))]
    os.makedirs(os.path.dirname(PENDING), exist_ok=True)
    with open(PENDING, "w", encoding="utf-8") as f:
        json.dump(todo, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"訳の無い見出し: {len(todo)}件")
    for t in todo:
        print("  -", t)
    return 0 if todo else 2


def cmd_apply():
    try:
        with open(DRAFT, encoding="utf-8") as f:
            draft = json.load(f)
    except (OSError, ValueError) as e:
        print(f"::warning::{DRAFT} が読めません: {e}")
        return 1
    if not isinstance(draft, dict):
        print(f"::warning::{DRAFT} の最上位がオブジェクトではありません")
        return 1
    items = load(STORE, {}).get("items", {})
    wanted = set(current_headlines())
    ok = bad = 0
    for src, entry in draft.items():
        if src not in wanted:
            print(f"  skip（いま表示されない見出し）: {src}")
            continue
        errs = problems(src, entry)
        if errs:
            bad += 1
            print(f"  NG: {src}")
            for e in errs:
                print(f"      {e}")
            continue
        items[src] = entry
        ok += 1
    print(f"取り込み: {ok}件 / 不合格: {bad}件")
    if bad:
        print(f"::warning::不合格の訳が {bad} 件あります（その見出しは原文のまま表示され、翌日また訳し直します）")
    return 0 if write_store(items) else 2


def cmd_prune():
    return 0 if write_store(load(STORE, {}).get("items", {})) else 2


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    fn = {"pending": cmd_pending, "apply": cmd_apply, "prune": cmd_prune}.get(cmd)
    if not fn:
        print(__doc__)
        sys.exit(1)
    sys.exit(fn())
