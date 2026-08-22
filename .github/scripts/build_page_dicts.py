#!/usr/bin/env python3
"""
ページ別の翻訳辞書を生成する。

なぜ必要か：
  各ページが使う i18n キーは全体の 9〜20% しかないのに、これまでは全ページで
  661キーの辞書を丸ごと配っていた。しかも body は .i18n-ready が付くまで
  非表示なので、この転送は描画の律速そのものだった。ページごとに必要な
  キーだけを切り出すと、1ページ表示あたり gzip 44KB → 2〜5KB になる。

出力：
  data/i18n/pages/<ページID>.<言語>.json   （生成物。手で編集しないこと）

含めるキー：
  - そのページの HTML に data-i18n / -html / -aria で書かれているキー
  - meta_title_<ページID> / meta_desc_<ページID>（i18n.js が動的に組み立てる）
  - RUNTIME_KEYS（main.js が実行時に data-i18n を付けるので HTML には現れない）
  - 上記すべての「<キー>__after」（第1期再編後への文面切替。applyTemporal 用）

ビルドステップは増やさない：生成物をコミットし、閲覧者は静的ファイルを読むだけ。
data/school_news.json などと同じ方式。

使い方:
  python3 .github/scripts/build_page_dicts.py          # 生成
  python3 .github/scripts/build_page_dicts.py --check  # 差分があれば exit 1

終了コード: 0 = 成功（--check では最新）, 1 = --check で古い
"""
import glob
import json
import os
import re
import sys

I18N_DIR = "data/i18n"
OUT_DIR = os.path.join(I18N_DIR, "pages")
AFTER_SUFFIX = "__after"

# main.js が実行時に data-i18n を付けるキー。HTML を静的に読んでも出てこないので、
# ここに列挙して全ページの辞書に必ず入れる（いずれも数文字で、コストは無視できる）。
#   status_done        … index.html の「現在の状況」完了ラベル
#   event_status_*     … schedule.html の 完了/進行中/予定 バッジ
#   share_*            … 全ページ共通の共有ボタン（main.js が組み立てる）
RUNTIME_KEYS = [
    "status_done",
    "event_status_done",
    "event_status_current",
    "event_status_upcoming",
    "share_line",
    "share_x",
    "share_facebook",
    "share_hatena",
    "share_threads",
    "share_bluesky",
    "share_reddit",
    "share_mastodon",
    "share_mastodon_prompt",
    "share_mastodon_invalid",
    "share_instagram",
    "share_tiktok",
    "share_copied_paste",
    "share_copy",
    "share_copied",
    "share_copy_failed",
    "share_native",
    "share_star_label",
    "share_star_note",
    "share_fb_like",
]

KEY_RE = re.compile(r'data-i18n(?:-html|-aria)?="([^"]+)"')


def page_id(path):
    return os.path.basename(path)[:-len(".html")]


def keys_for_page(path, all_keys):
    pid = page_id(path)
    with open(path, encoding="utf-8") as f:
        used = set(KEY_RE.findall(f.read()))
    used |= {f"meta_title_{pid}", f"meta_desc_{pid}"}
    used |= set(RUNTIME_KEYS)
    used |= {k + AFTER_SUFFIX for k in list(used)}
    return {k for k in used if k in all_keys}


def build():
    dicts = {}
    for path in sorted(glob.glob(os.path.join(I18N_DIR, "*.json"))):
        dicts[os.path.basename(path)[:-len(".json")]] = json.load(open(path, encoding="utf-8"))
    if "ja" not in dicts:
        print("NG: data/i18n/ja.json がない", file=sys.stderr)
        sys.exit(1)
    all_keys = set(dicts["ja"]) | set(dicts.get("en", {}))

    out = {}
    for path in sorted(glob.glob("*.html")):
        pid = page_id(path)
        keys = keys_for_page(path, all_keys)
        for lang, d in dicts.items():
            sub = {k: d[k] for k in sorted(keys) if k in d}
            out[f"{pid}.{lang}.json"] = sub
    return out


def main():
    check = "--check" in sys.argv
    out = build()
    os.makedirs(OUT_DIR, exist_ok=True)

    existing = {os.path.basename(p) for p in glob.glob(os.path.join(OUT_DIR, "*.json"))}
    stale = existing - set(out)
    changed = []

    for name, data in sorted(out.items()):
        path = os.path.join(OUT_DIR, name)
        text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
        old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
        if old != text:
            changed.append(name)
            if not check:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(text)

    if check:
        if changed or stale:
            for n in changed[:10]:
                print(f"NG: 古い/未生成: {n}")
            for n in sorted(stale)[:10]:
                print(f"NG: 不要なファイルが残っている: {n}")
            print("`python3 .github/scripts/build_page_dicts.py` を実行してコミットしてください")
            return 1
        print(f"OK: ページ別辞書は最新（{len(out)}ファイル）")
        return 0

    for n in sorted(stale):
        os.remove(os.path.join(OUT_DIR, n))
        print(f"削除: {n}")

    total = sum(len(json.dumps(d, ensure_ascii=False).encode()) for d in out.values())
    print(f"生成: {len(out)}ファイル / 合計 {total/1024:.1f}KB（非圧縮）")
    print(f"更新のあったファイル: {len(changed)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
