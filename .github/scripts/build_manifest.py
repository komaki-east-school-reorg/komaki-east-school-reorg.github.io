#!/usr/bin/env python3
"""
ウェブアプリ化（ホーム画面に追加。2026-10-17 追加）のマニフェストを、言語ごとに書き出す。

全ページの <head> は manifest.ja.webmanifest を指し、i18n.js が表示言語のものに差し替える。
アプリ名を読者の言語で出すため、言語ごとに1枚ずつ持つ（qr/ と同じ考え方）。

  name        … meta_title_index（サイトの各言語名。外国語名は据え置き）
  short_name  … logo_main からタグを外したもの（ホーム画面のアイコンの下に出る名前）
  description … meta_desc_index

出力: manifest.<lang>.webmanifest（リポジトリの根）
実行: python3 .github/scripts/build_manifest.py [--check]
      --check は書き出さずに、コミット済みの内容と一致するかだけを見る（終了コード1で不一致）。
辞書の上の3キーを変えたら実行すること（auto_gates.py check 16 が古さを止める）。
"""
import json
import re
import sys

LANGS = ["ja", "en", "pt", "vi", "tl", "es", "zh", "id", "ko", "ne", "tr", "my"]
# i18n.js と同じ lang 属性（es は中南米スペイン語）
LANG_ATTR = {"es": "es-419", "pt": "pt-BR", "zh": "zh-Hans"}
THEME = "#1b3826"        # --primary-dark（ヘッダの帯）
BACKGROUND = "#2e5c3a"   # --primary（黒板の緑。起動画面の背景）


def strip_tags(s):
    return re.sub(r"<[^>]+>", "", s).strip()


def build(lang):
    d = json.load(open(f"data/i18n/{lang}.json", encoding="utf-8"))
    m = {
        "name": d["meta_title_index"],
        "short_name": strip_tags(d["logo_main"]),
        "description": d["meta_desc_index"],
        "lang": LANG_ATTR.get(lang, lang),
        "dir": "ltr",
        # 起動したら表示言語のトップを開く（日本語は素の URL が正規形）
        "start_url": "/" if lang == "ja" else f"/?lang={lang}",
        "scope": "/",
        "id": "/",
        "display": "standalone",
        "theme_color": THEME,
        "background_color": BACKGROUND,
        "icons": [
            {"src": "/img/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "/img/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "/img/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    return json.dumps(m, ensure_ascii=False, indent=2) + "\n"


def main():
    check = "--check" in sys.argv
    stale = []
    for lang in LANGS:
        path = f"manifest.{lang}.webmanifest"
        text = build(lang)
        try:
            cur = open(path, encoding="utf-8").read()
        except FileNotFoundError:
            cur = None
        if cur == text:
            continue
        if check:
            stale.append(path)
        else:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(text)
            print("wrote", path)
    if check and stale:
        print("古いマニフェスト:", ", ".join(stale))
        sys.exit(1)


if __name__ == "__main__":
    main()
