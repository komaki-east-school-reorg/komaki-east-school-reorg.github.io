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

トップの「各ページへのリンク」に出す各ページの内容（2026-09-20 ユーザー指示）：
  index.<言語>.json にだけ、ql_<ページID>_outline という合成キーを入れる。
  中身は、そのページの main h2.section-title の見出しを並べたもの（<small> の副題は落とす）。
  各ページの見出しキーをそのまま流用するので、翻訳を新しく書く必要がない。
  見出しを足したり直したりしたら、このスクリプトを回すだけでトップの表示も追従する。
  index.html に書いてある既定値（辞書が 404 のときに出る日本語）も、ここで書き換える。

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
    "share_print",
    "tts_play",
    "tts_stop",
    "share_star_label",
    "share_star_note",
    "share_sticky_label",
    # 回覧板シートのボタン。main.js が実行時に作るので HTML に現れない。
    "board_btn",
    # 長いページの目次の見出し。main.js の PAGE TOC が実行時に作る。
    "page_toc_h",
]

KEY_RE = re.compile(r'data-i18n(?:-html|-aria)?="([^"]+)"')

# トップの「各ページへのリンク」に出す、各ページの節見出し
OUTLINE_MAX = 5          # 多いページは先頭から5つまで（カードが縦に伸びすぎないように）
OUTLINE_SEP = {"ja": "・", "ja-kids": "・", "zh": "・"}   # 既定は " / "
OUTLINE_MORE = "…"       # 5つを超えたページに付ける（言語に依存しない記号にする）
H2_RE = re.compile(r'<h2[^>]*class="section-title"[^>]*>')
MAIN_RE = re.compile(r"<main[^>]*>(.*?)</main>", re.S)
OUTLINE_SPAN_RE = re.compile(
    r'(<span data-i18n="ql_([a-z]+)_outline">)(.*?)(</span>)', re.S)


def outline_keys(path):
    """そのページの節見出し（main h2.section-title）の i18n キーを、出てくる順に返す。"""
    with open(path, encoding="utf-8") as f:
        m = MAIN_RE.search(f.read())
    if not m:
        return []
    keys = []
    for tag in H2_RE.findall(m.group(1)):
        k = re.search(r'data-i18n(?:-html)?="([^"]+)"', tag)
        if k:
            keys.append(k.group(1))
    return keys


def outline_text(keys, d, lang):
    """見出しキーの並びを、その言語の1行の文字列にする。副題（<small>）は落とす。"""
    parts = []
    for k in keys[:OUTLINE_MAX]:
        v = d.get(k)
        if not v:
            return ""          # その言語に訳が無ければ出さない（英語→日本語の順で i18n.js が拾う）
        v = re.sub(r"<small>.*?</small>", "", v, flags=re.S)
        v = re.sub(r"<[^>]+>", "", v)
        parts.append(re.sub(r"\s+", " ", v).strip())
    if not parts:
        return ""
    text = OUTLINE_SEP.get(lang, " / ").join(parts)
    if len(keys) > OUTLINE_MAX:
        text += OUTLINE_MORE
    return text


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

    # トップのカードに出す「このページの内容」。各ページの節見出しから組み立てる。
    outlines = {}
    for path in sorted(glob.glob("*.html")):
        pid = page_id(path)
        if pid == "index":
            continue
        ks = outline_keys(path)
        if ks:
            outlines[pid] = ks

    out = {}
    for path in sorted(glob.glob("*.html")):
        pid = page_id(path)
        keys = keys_for_page(path, all_keys)
        for lang, d in dicts.items():
            sub = {k: d[k] for k in sorted(keys) if k in d}
            if pid == "index":
                for opid, ks in sorted(outlines.items()):
                    txt = outline_text(ks, d, lang)
                    if txt:
                        sub[f"ql_{opid}_outline"] = txt
            out[f"{pid}.{lang}.json"] = sub
    return out, outlines


def index_html_with_outlines(outlines, ja):
    """index.html の既定値（辞書が 404 のときに出る日本語）を、いまの見出しに合わせる。"""
    with open("index.html", encoding="utf-8") as f:
        html = f.read()

    def repl(m):
        pid = m.group(2)
        ks = outlines.get(pid, [])
        return m.group(1) + outline_text(ks, ja, "ja") + m.group(4)

    return OUTLINE_SPAN_RE.sub(repl, html)


def main():
    check = "--check" in sys.argv
    out, outlines = build()
    os.makedirs(OUT_DIR, exist_ok=True)

    # index.html のカードに書いてある既定の日本語も、見出しに合わせて書き換える
    ja = json.load(open(os.path.join(I18N_DIR, "ja.json"), encoding="utf-8"))
    new_index = index_html_with_outlines(outlines, ja)
    cur_index = open("index.html", encoding="utf-8").read()
    index_stale = new_index != cur_index
    if index_stale and not check:
        with open("index.html", "w", encoding="utf-8") as f:
            f.write(new_index)
        print("更新: index.html の「このページの内容」")

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
        if index_stale:
            print("NG: index.html の「このページの内容」が古い")
        if changed or stale or index_stale:
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
