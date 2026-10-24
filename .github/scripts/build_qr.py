#!/usr/bin/env python3
"""
回覧板シート（index.html）と、全ページの共有欄の「QR」ボタン（2026-10-11 追加）で使う
QR コードを、ページ×言語ぶん SVG で書き出す。

なぜ静的生成なのか:
  このサイトが自動で読み込む外部スクリプトは、はてなスターの1本だけという方針
  （CLAUDE.md の SHARE BUTTONS の節）。QR 生成ライブラリを CDN から読むとその方針が
  崩れ、自前で JS のエンコーダを書くと検証手段がないまま「見た目だけ QR」を
  出す危険がある。ここで検証済みライブラリ（segno）を使って生成し、成果物を
  コミットしておけば、ページ側は <img> を1枚読むだけで済む。

出力: qr/<pageId>.<lang>.svg   （日本語は素の URL、他言語は ?lang= 付き。どちらにも src=qr を足す）

src=qr（2026-10-24）: 紙の QR から何人来たかを数えるための印。js/i18n.js が読み込み直後に
読み取ってアドレスバーから消し、js/main.js の COUNTER が「entry/qr」として数える。
共有 URL・canonical には残らない。
実行: python3 .github/scripts/build_qr.py [--check]
      --check は再生成せずに、コミット済みの内容と一致するかだけを見る（終了コード1で不一致）。
"""
import os
import sys

try:
    import segno
except ImportError:
    sys.exit("segno が必要です: pip install segno")

BASE = "https://komaki-east-school-reorg.github.io/"
OUT_DIR = "qr"
LANGS = ["ja", "en", "pt", "vi", "tl", "es", "zh", "id", "ko", "ne", "tr", "my"]
# 回覧板シート（index）に加え、2026-10-11 から全11ページの共有欄の「QR」ボタンでも使う
# （チラシ・掲示・発表スライドに貼れるように）。canonical と同じ並び。index は素のディレクトリ URL が正規形。
# ページを足したら、ここと js/main.js SHARE BUTTONS の QR_PAGES の両方に足すこと。
PAGES = {
    "index": "",
    "about": "about.html",
    "schedule": "schedule.html",
    "faq": "faq.html",
    "bus": "bus.html",
    "clubs": "clubs.html",
    "council": "council.html",
    "community": "community.html",
    "map": "map.html",
    "nationwide": "nationwide.html",
    "review": "review.html",
}

# 紙に印刷して読むので、誤り訂正は高め（H）にしておく。折り目や汚れに強い。
EC_LEVEL = "h"


def url_for(page_id, lang):
    u = BASE + PAGES[page_id]
    return u + "?src=qr" if lang == "ja" else u + "?lang=" + lang + "&src=qr"


def svg_for(page_id, lang):
    qr = segno.make(url_for(page_id, lang), error=EC_LEVEL)
    import io
    buf = io.BytesIO()
    # unit を付けず viewBox だけにして、印刷側の CSS で大きさを決められるようにする。
    qr.save(buf, kind="svg", scale=1, border=2, xmldecl=False, svgns=True,
            omitsize=True, dark="#000000", light="#ffffff")
    return buf.getvalue().decode("utf-8")


def main():
    check = "--check" in sys.argv
    os.makedirs(OUT_DIR, exist_ok=True)
    stale, written = [], 0
    for page_id in PAGES:
        for lang in LANGS:
            path = os.path.join(OUT_DIR, f"{page_id}.{lang}.svg")
            new = svg_for(page_id, lang)
            old = None
            if os.path.exists(path):
                with open(path, encoding="utf-8") as f:
                    old = f.read()
            if old == new:
                continue
            if check:
                stale.append(path)
            else:
                with open(path, "w", encoding="utf-8", newline="") as f:
                    f.write(new)
                written += 1
    if check:
        if stale:
            print("古い QR: " + ", ".join(stale[:10]) +
                  (f" ほか{len(stale) - 10}件" if len(stale) > 10 else ""))
            return 1
        print(f"QR は最新（{len(PAGES) * len(LANGS)}ファイル）")
        return 0
    print(f"QR を生成: {len(PAGES) * len(LANGS)}ファイル中 {written}ファイル更新")
    return 0


if __name__ == "__main__":
    sys.exit(main())
