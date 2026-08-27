#!/usr/bin/env python3
"""
『篠岡地区学校再編だより』の PDF から本文テキストを取り出し、
data/official_pages/newsletters/<slug>.txt に保存する。

なぜ必要か:
  fetch_news.py が本文スナップショットを取るのは HTML ページだけで、だよりの
  中身は添付 PDF の中にある。そのため新しい号が出ても、パイプラインが受け取るのは
  「篠岡地区学校再編だより（第7号）(PDFファイル:…)」という見出しの一行だけで、
  中身は誰も確認できないままだった。本スクリプトがその一行を実際の本文に変える。
  出力先を data/official_pages/ の下にしてあるのは、auto_gates.py の出典実在
  チェックがこのディレクトリを見るため。だよりの記述をそのまま引用の根拠にできる。

市サーバへの負荷について:
  ・掲載ページの HTML は fetch_news.py が取得済みのものを再利用する
    （HTML_CACHE_DIR。同じページを2度取りに行かない）。単体実行時のみ自分で取る。
  ・PDF は【まだ取っていない号だけ】ダウンロードする。既に取得済みの号は
    リンク文字列のファイルサイズ表示（例「(PDFファイル:1005.3KB)」）が
    変わらないかぎり再取得しない。通常の日は1本もダウンロードが発生しない。
  ・ダウンロードするときは fetch_news.py と同じく 3〜5 秒あける。

取り出せる範囲について:
  だよりは図版の多い広報物で、地図・表の一部は画像として貼られている。
  画像の中の文字は取り出せない（例: vol.6 の対象エリア図）。本文テキストが
  ほとんど取れなかった PDF は、その旨を本文欄に明記して保存する。
  「PDF から取れた文字がすべて」ではないことを、読む側が分かるようにするため。

過去号のスナップショットは消さない:
  市がページから古い号を下ろしても、その号を根拠に書いたサイトの記述は残る。
  出典が消えると検証できなくなるので、一度保存した号は削除しない。

Exit codes: 0 = 変化あり, 2 = 変化なし, 1 = 致命的エラー
"""
import os
import re
import subprocess
import sys
import tempfile
import urllib.parse
from html import unescape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_news  # noqa: E402  （curl/WAF 対応の取得処理をそのまま使う）

# 添付 PDF を取り込む市の掲載ページ。
# いまは「篠岡地区学校再編だより」のページのみ。別の資料ページを足すときは
# ここに URL を、拾う PDF の見分け方を TITLE_RE に足す。
SOURCE_PAGES = [
    "https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/"
    "shinooka_gsaihen/49521.html",
]

# 取り込む添付の見分け方。リンク文字列がこれに一致する PDF だけを取る。
# 同じページには各号の外国語版（リンク文字列は「スペイン語」等）と
# 「意見提出フォームから頂いたご意見」の PDF も並んでいるが、
# 前者は日本語版と同内容、後者は市民の意見そのものなので取り込まない。
TITLE_RE = re.compile(r"学校再編だより")

OUT_DIR = os.path.join("data", "official_pages", "newsletters")
SLUG_PREFIX = "saihen-dayori-"

# これ未満の文字数しか取れなかった PDF は「本文が取れなかった」として扱う
MIN_TEXT_CHARS = 40


def fetch_page_html(url):
    """掲載ページの HTML。fetch_news.py が取得済みならそれを使う。"""
    cached = os.path.join(fetch_news.HTML_CACHE_DIR,
                          fetch_news.url_to_slug(url) + ".html")
    if os.path.exists(cached):
        print(f"  cache: {os.path.basename(cached)}")
        with open(cached, encoding="utf-8") as f:
            return f.read()
    print(f"  fetch: {url}")
    html = fetch_news.fetch_html(url)
    fetch_news.polite_wait()
    return html


def iter_pdf_links(html, page_url):
    """掲載ページから (PDF の URL, リンク文字列) を順に返す。"""
    m = re.search(r'<article id="contents"[^>]*>(.*?)</article>', html, re.DOTALL)
    body = m.group(1) if m else html
    seen = set()
    for a in re.finditer(r'<a\s[^>]*href="([^"]+\.pdf)"[^>]*>(.*?)</a>',
                         body, re.DOTALL | re.IGNORECASE):
        url = fetch_news.normalize_url(a.group(1).strip(), page_url)
        label = " ".join(unescape(re.sub(r"<[^>]+>", "", a.group(2))).split())
        if url in seen:
            continue
        seen.add(url)
        yield url, label


def split_label(label):
    """リンク文字列を（表題, ファイルサイズ表示）に分ける。"""
    m = re.search(r"\(PDF\s*ファイル\s*[:：]\s*([^)]+)\)", label)
    size = m.group(1).strip() if m else ""
    title = label[:m.start()].strip() if m else label
    return title, size


def slug_for(title, url):
    """
    保存名。号数で並び、PDF のファイル名まで含めて一意にする。
    市が付ける PDF のファイル名は saihendayori01 / kawaraban2 / dayori3_nishi の
    ように揺れていて号数を読み取れないので、表題側から号数を取る。
    第3号のように同じ号が複数（西向け・東向け）あっても衝突しない。
    """
    m = re.search(r"第\s*(\d+)\s*号", title) or re.search(r"vol\.?\s*(\d+)", title, re.I)
    number = f"{int(m.group(1)):02d}" if m else "xx"
    base = os.path.splitext(os.path.basename(urllib.parse.urlparse(url).path))[0]
    base = re.sub(r"[^A-Za-z0-9_-]", "_", base)
    return f"{SLUG_PREFIX}{number}-{base}"


def read_size_label(path):
    """保存済みスナップショットのヘッダからファイルサイズ表示を読む。"""
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("---"):
                break
            if line.startswith("ファイルサイズ表示:"):
                return line.split(":", 1)[1].strip()
    return ""


def download_pdf(url):
    """PDF を一時ファイルに落として、そのパスを返す。"""
    fd, path = tempfile.mkstemp(prefix="komaki_pdf_", suffix=".pdf")
    os.close(fd)
    cmd = ["curl", "-sS", "-L", "--compressed", "--max-time", "120",
           "-c", fetch_news.COOKIE_FILE, "-b", fetch_news.COOKIE_FILE,
           "-o", path, "-w", "%{http_code}"]
    for name, value in fetch_news.BROWSER_HEADERS.items():
        cmd += ["-H", f"{name}: {value}"]
    cmd.append(url)
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if proc.returncode != 0:
        os.remove(path)
        raise RuntimeError(f"curl exited {proc.returncode}: {proc.stderr.strip()}")
    if proc.stdout.strip() != "200":
        os.remove(path)
        raise RuntimeError(f"HTTP {proc.stdout.strip()}")
    return path


def extract_pdf_text(path):
    """PDF の本文テキスト。行頭行末を落とし、空行を詰める（他のスナップショットと同じ形）。"""
    from pdfminer.high_level import extract_text
    raw = extract_text(path)
    lines = [line.strip() for line in raw.replace("\x0c", "\n").split("\n")]
    return "\n".join(line for line in lines if line)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    changed = False
    failures = 0
    found = 0

    for page_url in SOURCE_PAGES:
        try:
            html = fetch_page_html(page_url)
        except Exception as e:
            print(f"ERROR: 掲載ページを取得できない {page_url}: {e}", file=sys.stderr)
            failures += 1
            continue

        for pdf_url, label in iter_pdf_links(html, page_url):
            title, size = split_label(label)
            if not TITLE_RE.search(title):
                continue
            found += 1
            slug = slug_for(title, pdf_url)
            path = os.path.join(OUT_DIR, slug + ".txt")
            previous = read_size_label(path)
            if previous is not None and previous == size:
                print(f"  skip  {slug}（取得済み・サイズ表示が同じ）")
                continue

            print(f"  get   {slug}  {title}")
            fetch_news.polite_wait()
            try:
                pdf_path = download_pdf(pdf_url)
            except Exception as e:
                print(f"  ERROR: PDF を取得できない {pdf_url}: {e}", file=sys.stderr)
                failures += 1
                continue
            try:
                text = extract_pdf_text(pdf_path)
            except Exception as e:
                print(f"  ERROR: PDF を読めない {pdf_url}: {e}", file=sys.stderr)
                failures += 1
                continue
            finally:
                os.remove(pdf_path)

            if len(text) < MIN_TEXT_CHARS:
                text = ("（この PDF からは本文テキストを取り出せませんでした。"
                        "紙面が画像として貼られている可能性があります。"
                        "内容は元の PDF で確認してください。）")
                print(f"  WARN: 本文テキストがほとんど取れない: {pdf_url}",
                      file=sys.stderr)

            content = (
                f"{pdf_url}\n"
                f"表題: {title}\n"
                f"掲載ページ: {page_url}\n"
                f"ファイルサイズ表示: {size}\n"
                "※ 図版・地図の中の文字は取り出せていない。原文は上の PDF を参照。\n"
                "---\n"
                f"{text}\n"
            )
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            changed = True
            print(f"  saved {path}（{len(text)}文字）")

    if found == 0 and failures:
        print("ERROR: だよりを1件も確認できなかった", file=sys.stderr)
        sys.exit(1)
    if failures:
        print(f"WARN: {failures}件の取得に失敗（取得できた分だけ保存した）", file=sys.stderr)

    print("だよりの本文に変化あり" if changed else "だよりの本文に変化なし")
    sys.exit(0 if changed else 2)


if __name__ == "__main__":
    main()
