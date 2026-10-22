#!/usr/bin/env python3
"""
市の人口統計（住民基本台帳）から東部地域（篠岡地区）の行を取り出し、
data/official_pages/population/ に保存する。トップの「東部地域の0〜17歳（推定）」
（build_child_estimate.py → data/child_estimate.json）の材料。2026-10-22 追加。

取り込む資料（どちらも市民窓口課 住民登録係の公表）:
  ・指定区別年齢別男女別人口統計表 … 年1回・10月1日時点、町字×1歳刻み（xlsx）
  ・人口世帯表                     … 毎月1日時点、町字別の男女・計・世帯数（csv）

東部地域の範囲:
  市の表は地区ごとに町字を並べていて、篠岡地区は「小針二丁目」の次の「大山」から
  「城山五丁目」までの連続した塊になっている。この塊をまるごと東部として数える。
  表の先頭近くにある「大山（小牧）」は小牧地区の別の町字なので含めない。
  塊の中に新しい町字が増えるのはよい（令和8年の人口世帯表には東部の工業地に
  新設された長治町・郷西町が入っている）が、既知の町字（EAST_TOWNS）が1つでも
  欠けたら失敗させる。黙って一部を落とすと、推定値が気づかれないまま小さくなるため。

市サーバへの負荷:
  ふだんの日に取るのは索引ページ3枚だけ（3〜5秒あけて）。記事ページと添付ファイルは
  【まだ保存していないものだけ】取りに行く。月に1回（人口世帯表）と年に1回
  （指定区別）しかダウンロードは起きない。

保存したファイルは消さない（推定の根拠をあとから確かめられるように）。手編集不可。
サイトからこれらの市のページへはリンクしない（許可外の URL のため）。

Exit codes: 0 = 新しい資料を保存, 2 = 変化なし, 1 = 致命的エラー
"""
import csv
import io
import os
import re
import subprocess
import sys
import tempfile
import zipfile
from datetime import date
from html import unescape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_news  # noqa: E402  （curl/WAF 対応の取得処理をそのまま使う）

OUT_DIR = os.path.join(fetch_news.SNAPSHOT_DIR, "population")

STAT_BASE = fetch_news.BASE_DOMAIN + "/admin/soshiki/fukushi/shimin/3/2/1/"
PARENT_INDEX = STAT_BASE + "index.html"
SHITEIKU_INDEX = STAT_BASE + "shiteikujinko/index.html"

# 東部地域（篠岡地区）の既知の町字。市の表の並び順のまま。塊の先頭と末尾は
# EAST_TOWNS[0] と EAST_TOWNS[-1]。
EAST_TOWNS = (
    "大山", "野口", "林", "池之内", "上末", "上末字稲葉台", "下末", "大草",
    "高根一丁目", "高根二丁目", "高根三丁目",
    "桃ケ丘一丁目", "桃ケ丘二丁目", "桃ケ丘三丁目",
    "古雅一丁目", "古雅二丁目", "古雅三丁目", "古雅四丁目",
    "篠岡一丁目", "篠岡二丁目", "篠岡三丁目",
    "光ケ丘一丁目", "光ケ丘二丁目", "光ケ丘三丁目", "光ケ丘四丁目",
    "光ケ丘五丁目", "光ケ丘六丁目",
    "城山一丁目", "城山二丁目", "城山三丁目", "城山四丁目", "城山五丁目",
)
CHILD_MAX_AGE = 17


def reiwa_date(text):
    """「令和7年10月1日」→ date。読めなければ None。"""
    m = re.search(r"令和\s*(\d+|元)\s*年\s*(\d+)\s*月\s*(\d+)\s*日", text)
    if not m:
        return None
    y = 1 if m.group(1) == "元" else int(m.group(1))
    return date(2018 + y, int(m.group(2)), int(m.group(3)))


def links(html, page_url):
    """(絶対 URL, リンク文字列) を順に返す。"""
    m = re.search(r'<article id="contents"[^>]*>(.*?)</article>', html, re.DOTALL)
    body = m.group(1) if m else html
    for a in re.finditer(r'<a\s[^>]*href="([^"]+)"[^>]*>(.*?)</a>', body, re.DOTALL):
        label = " ".join(unescape(re.sub(r"<[^>]+>", "", a.group(2))).split())
        yield fetch_news.normalize_url(a.group(1).strip(), page_url), label


def get_page(url):
    print(f"  fetch: {url}")
    html = fetch_news.fetch_html(url)
    fetch_news.polite_wait()
    return html


def download(url):
    """添付ファイルを取り、バイト列を返す。"""
    fd, path = tempfile.mkstemp(prefix="komaki_pop_")
    os.close(fd)
    cmd = ["curl", "-sS", "-L", "--compressed", "--max-time", "120",
           "-c", fetch_news.COOKIE_FILE, "-b", fetch_news.COOKIE_FILE,
           "-o", path, "-w", "%{http_code}"]
    for name, value in fetch_news.BROWSER_HEADERS.items():
        cmd += ["-H", f"{name}: {value}"]
    cmd.append(url)
    try:
        print(f"  download: {url}")
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if proc.returncode != 0:
            raise RuntimeError(f"curl exited {proc.returncode}: {proc.stderr.strip()}")
        if proc.stdout.strip() != "200":
            raise RuntimeError(f"HTTP {proc.stdout.strip()}")
        with open(path, "rb") as f:
            return f.read()
    finally:
        os.remove(path)
        fetch_news.polite_wait()


def saved_pages():
    """保存済みファイルの「掲載ページ:」の URL の集合。"""
    seen = set()
    if not os.path.isdir(OUT_DIR):
        return seen
    for name in os.listdir(OUT_DIR):
        with open(os.path.join(OUT_DIR, name), encoding="utf-8") as f:
            for line in f:
                if line.startswith("---"):
                    break
                if line.startswith("掲載ページ:"):
                    seen.add(line.split(":", 1)[1].strip())
    return seen


def east_block(names, what):
    """表の町字名から東部の塊の (開始, 終了の次) を返す。既知の町字が欠ければ例外。"""
    try:
        i = names.index(EAST_TOWNS[0], names.index("小針二丁目"))
        j = names.index(EAST_TOWNS[-1], i) + 1
    except ValueError:
        raise RuntimeError(f"{what}: 東部の塊（{EAST_TOWNS[0]}〜{EAST_TOWNS[-1]}）が見つからない")
    block = names[i:j]
    missing = [t for t in EAST_TOWNS if t not in block]
    if missing:
        raise RuntimeError(f"{what}: 東部の町字が欠けている: {missing}")
    extra = [t for t in block if t not in EAST_TOWNS]
    if extra:
        print(f"  note: {what}: 東部の塊に新しい町字 {extra}（含めて数える）")
    return i, j


# ── 指定区別年齢別男女別人口統計表（xlsx） ─────────────────────────

def read_xlsx_rows(data):
    """標準ライブラリだけで1枚目のシートを読む（openpyxl を入れないため）。"""
    z = zipfile.ZipFile(io.BytesIO(data))
    strings = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode("utf-8"), re.S):
            si = re.sub(r"<rPh.*?</rPh>", "", si, flags=re.S)   # ふりがなを落とす
            strings.append(unescape("".join(re.findall(r"<t[^>]*>([^<]*)</t>", si))))
    sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8")
    rows = []
    for r in re.findall(r"<row [^>]*>(.*?)</row>", sheet, re.S):
        out = []
        for c in re.finditer(r'<c r="[A-Z]+\d+"([^>]*?)(?:/>|>(.*?)</c>)', r, re.S):
            inner = c.group(2) or ""
            v = re.search(r"<v>([^<]*)</v>", inner)
            if 't="s"' in c.group(1) and v:
                out.append(strings[int(v.group(1))])
            elif 't="inlineStr"' in c.group(1):
                out.append(unescape("".join(re.findall(r"<t[^>]*>([^<]*)</t>", inner))))
            else:
                out.append(v.group(1) if v else "")
        rows.append(out)
    return rows


def shiteiku_text(data, title, page_url, file_url, size, base):
    rows = read_xlsx_rows(data)
    head = rows[0]
    col = {k: i for i, k in enumerate(head)}
    ages = [f"計{a}" for a in range(CHILD_MAX_AGE + 1)]
    for k in ages + ["地区"]:
        if k not in col:
            raise RuntimeError(f"{title}: 列「{k}」が無い")
    total_cols = [i for k, i in col.items() if k.startswith("計")]
    names = [r[col["地区"]] if len(r) > col["地区"] else "" for r in rows[1:]]
    start, end = east_block(names, title)

    def num(r, i):
        return int(float(r[i])) if i < len(r) and r[i] not in ("", None) else 0

    lines = [f"資料: {title}", f"掲載ページ: {page_url}", f"ファイル: {file_url}",
             f"ファイルサイズ表示: {size}", f"基準日: {base.isoformat()}", "---",
             "町字," + ",".join(f"{a}歳" for a in range(CHILD_MAX_AGE + 1)) + ",0〜17歳計,総人口"]
    sums = [0] * (CHILD_MAX_AGE + 3)
    for r in rows[1 + start:1 + end]:
        vals = [num(r, col[k]) for k in ages]
        vals += [sum(vals), sum(num(r, i) for i in total_cols)]
        sums = [a + b for a, b in zip(sums, vals)]
        lines.append(r[col["地区"]] + "," + ",".join(map(str, vals)))
    lines.append("東部計," + ",".join(map(str, sums)))
    return "\n".join(lines) + "\n"


# ── 人口世帯表（csv） ───────────────────────────────────────────────

def monthly_text(data, title, page_url, file_url, size, base):
    for enc in ("utf-8-sig", "cp932"):
        try:
            text = data.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    rows = [r for r in csv.reader(io.StringIO(text)) if r]
    head = rows[0]
    if head[:4] != ["集計区分名", "男", "女", "計"]:
        raise RuntimeError(f"{title}: 見出しが想定と違う: {head}")
    names = [r[0] for r in rows[1:]]
    start, end = east_block(names, title)
    lines = [f"資料: {title}", f"掲載ページ: {page_url}", f"ファイル: {file_url}",
             f"ファイルサイズ表示: {size}", f"基準日: {base.isoformat()}", "---",
             "町字,男,女,計,世帯数"]
    sums = [0, 0, 0, 0]
    for r in rows[1 + start:1 + end]:
        vals = [int(v.replace(",", "")) for v in r[1:5]]
        sums = [a + b for a, b in zip(sums, vals)]
        lines.append(r[0] + "," + ",".join(map(str, vals)))
    lines.append("東部計," + ",".join(map(str, sums)))
    return "\n".join(lines) + "\n"


def save(name, text):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"  saved: {path}")


def attachment(html, page_url, ext):
    """記事ページの添付（拡張子 ext）の (URL, 表題, サイズ表示, 基準日)。"""
    for url, label in links(html, page_url):
        if url.lower().endswith("." + ext):
            m = re.search(r"\(([^()]*ファイル\s*[:：][^()]*)\)\s*$", label)
            size = m.group(1).strip() if m else ""
            title = label[:m.start()].strip() if m else label
            return url, title, size, reiwa_date(title)
    return None


def main():
    seen = saved_pages()
    changed = 0

    # 年次：指定区別年齢別男女別人口統計表（索引に並ぶ全時点。保存していないものだけ）
    html = get_page(SHITEIKU_INDEX)
    for page_url, label in links(html, SHITEIKU_INDEX):
        if "指定区別" not in label or not reiwa_date(label) or page_url in seen:
            continue
        att = attachment(get_page(page_url), page_url, "xlsx")
        if not att or not att[3]:
            print(f"  skip (添付が読めない): {page_url}", file=sys.stderr)
            continue
        url, title, size, base = att
        save(f"shiteiku-{base.isoformat()}.txt",
             shiteiku_text(download(url), title, page_url, url, size, base))
        changed += 1

    # 月次：人口世帯表。最新の年の索引の最新月と、その1年前の月（変化率の計算用）
    html = get_page(PARENT_INDEX)
    years = {}
    for url, label in links(html, PARENT_INDEX):
        m = re.fullmatch(r"人口世帯表\s*[（(]令和(\d+)年[)）]", label)
        if m:
            years[int(m.group(1))] = url
    if not years:
        raise RuntimeError("人口世帯表の年の索引が見つからない")
    latest_year = max(years)
    months = {}
    for url, label in links(get_page(years[latest_year]), years[latest_year]):
        d = reiwa_date(label)
        if "人口世帯表" in label and d:
            months[d] = url
    if not months:
        raise RuntimeError("人口世帯表の各月のページが見つからない")
    latest = max(months)
    wanted = [(latest, months[latest])]
    prev = date(latest.year - 1, latest.month, 1)
    have_prev = os.path.exists(os.path.join(OUT_DIR, f"jinko-{prev.isoformat()}.txt"))
    if not have_prev and latest_year - 1 in years:
        for url, label in links(get_page(years[latest_year - 1]), years[latest_year - 1]):
            if "人口世帯表" in label and reiwa_date(label) == prev:
                wanted.append((prev, url))
    for d, page_url in wanted:
        if page_url in seen or os.path.exists(os.path.join(OUT_DIR, f"jinko-{d.isoformat()}.txt")):
            continue
        att = attachment(get_page(page_url), page_url, "csv")
        if not att or att[3] != d:
            print(f"  skip (添付が読めない): {page_url}", file=sys.stderr)
            continue
        url, title, size, base = att
        save(f"jinko-{base.isoformat()}.txt",
             monthly_text(download(url), title, page_url, url, size, base))
        changed += 1

    print(f"new documents: {changed}")
    return 0 if changed else 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
