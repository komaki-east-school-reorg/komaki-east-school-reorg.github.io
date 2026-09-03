#!/usr/bin/env python3
"""
回覧板シート（index.html の共有欄「回」ボタンと「最新の動き」節内の専用ボタン）に
載せる QR コードを、言語ぶん SVG で書き出す。回覧板シートは index.html にしか無いので
PAGES は index 1件のみ。

なぜ静的生成なのか:
  このサイトが自動で読み込む外部スクリプトは、はてなスターの1本だけという方針
  （CLAUDE.md の SHARE BUTTONS の節）。QR 生成ライブラリを CDN から読むとその方針が
  崩れ、自前で JS のエンコーダを書くと検証手段がないまま「見た目だけ QR」を
  出す危険がある。ここで検証済みライブラリ（segno）を使って生成し、成果物を
  コミットしておけば、ページ側は <img> を1枚読むだけで済む。

出力: qr/<pageId>.<lang>.svg   （日本語は素の URL、他言語は ?lang= 付き）
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
LANGS = ["ja", "en", "pt", "vi", "tl", "es", "zh", "id", "tr", "my"]
# 回覧板シートは index.html の共有欄／「最新の動き」節にしか無いので、QRも index だけでよい。
# canonical と同じ並び。index は素のディレクトリ URL が正規形。
PAGES = {
    "index": "",
}

# 紙に印刷して読むので、誤り訂正は高め（H）にしておく。折り目や汚れに強い。
EC_LEVEL = "h"


def url_for(page_id, lang):
    u = BASE + PAGES[page_id]
    return u if lang == "ja" else u + "?lang=" + lang


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
