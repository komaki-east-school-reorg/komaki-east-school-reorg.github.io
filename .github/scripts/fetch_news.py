#!/usr/bin/env python3
"""
Fetches official Komaki City school reorganization pages,
recursively follows sub-category index pages within each source subtree,
visits each item page to get its individual update date, and saves only
items updated within the last WINDOW_DAYS days to data/news.json.

Additionally saves a normalized body-text snapshot of every item page to
data/official_pages/<slug>.txt so that content changes (not just new items)
can be detected via git diff by the workflow.

Exit codes: 0 = content changed (news items or snapshots), 2 = no change,
1 = fatal error.
"""
import atexit
import subprocess
import tempfile
import urllib.parse
import json
import random
import re
import os
import sys
import time
from html import unescape
from datetime import datetime, timezone, timedelta

PARENT_URL = "https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/index.html"
BASE_DOMAIN = "https://www.city.komaki.aichi.jp"
OUTPUT = "data/news.json"
SNAPSHOT_DIR = "data/official_pages"
WINDOW_DAYS = 30

# --- 監視のみ行うページ（地域協議会：支え合い協働推進課の所管） ---
# 学校再編とは所管課が異なり news.json の「お知らせ」には載せない。本文スナップショット
# だけを取り、変化したら community.html の更新候補として Issue に載せる。
# WATCH_INDEXES はインデックスなので、配下の <li class="page"> 記事も辿って取得する。
WATCH_BASE = BASE_DOMAIN + "/admin/soshiki/kenkouikigai/sasaeai/3/3_2/"
WATCH_PAGES = [
    WATCH_BASE + "index.html",     # 地域協議会（総論）
    WATCH_BASE + "25722.html",     # 地域協議会の設立・活動状況（篠岡地区5協議会の一覧）
]
WATCH_INDEXES = [
    WATCH_BASE + "chiikikyougikaievent/index.html",   # 地域協議会イベント案内
]

# --- 監視のみ行うページ（市議会だより：議会事務局 議事課の所管） ---
# 2026-09-13 追加（ユーザー指示）。council.html の出典。中身は添付 PDF なので、
# ここで取るスナップショットは号の一覧だけ。本文は fetch_pdf_docs.py が PDF から取り出す。
# 新しい号が出るとこのページが変わるので、それが「議会審議のページを更新する合図」になる。
WATCH_PAGES.append(BASE_DOMAIN + "/admin/soshiki/gikai/giji/2/2/51603.html")

# --- 監視のみ行うページ（東部まちづくり：東部まちづくり推進室の所管） ---
# 2026-09-13 追加（ユーザー指示）。学校再編とは所管課が違うので news.json の
# 「お知らせ」には載せない。本文スナップショットだけを取り、そこから
# build_tobu_actions.py が「地域の取組」欄に出す一覧を組み立てる。
# この配下はディレクトリが2階層入れ子（東部まちづくりニュース > その他、団体等に
# よるイベント情報 など）なので、下の BFS が <li class="dir"> も辿る。
TOBU_BASE = BASE_DOMAIN + "/admin/soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/"
WATCH_INDEXES.append(TOBU_BASE + "index.html")

# 配下の下位インデックスまで辿ってよい接頭辞。ここに挙げた木の外へは出ない
# （<li class="dir"> のリンクは市サイトのどこへでも張れるため、境界は機械で持つ）。
WATCH_SUBTREES = (WATCH_BASE, TOBU_BASE)

# 東部まちづくり配下は、過去年度の記録まで含めると 110ページ規模ある。毎日その全部を
# 取りに行くのは市サーバに対して過剰なので、ふだんは直下のインデックスまで（約20ページ）。
# 週1回だけ WATCH_DEEP=1 で全階層を回る（fetch-news.yml が日曜に立てる）。
# 「地域の取組」欄に出す一覧の元（年度別の東部まちづくりニュース・審議会）は
# どちらも直下にあるので、毎日の浅い巡回でも最新のまま保てる。
WATCH_DEEP = os.environ.get("WATCH_DEEP") == "1"
WATCH_DIR_MAX_DEPTH = 6 if WATCH_DEEP else 1

# 深いところにあるが【毎日】見たいインデックス（2026-09-13 ユーザー指示）。
# 協働提案事業＝これから開催される催しが載る。トライアル活動＝年度ごとの認定活動。
# どちらも「地域の取組」欄に出す元なので、週1回の深い巡回まで待てない。
WATCH_INDEXES += [
    TOBU_BASE + "toubumatidukurinyu-su/kyoudouteianjigyou/index.html",
    TOBU_BASE + "toubumatidukurinyu-su/purattofo-mu/trial/index.html",
]
# ただし、この2つは配下に過去の分が数十ページ積もっている。毎日その全部を取るのは
# 市サーバに対して過剰なので、**末尾（＝新しいほう）だけ**を毎日見る。
# 市のインデックスは古い順に並んでいるため、末尾が最新。過去分は日曜の WATCH_DEEP で拾う。
WATCH_TAIL_PAGES = 8   # 末尾から何件の記事ページを毎日取るか
WATCH_TAIL_DIRS = 1    # 末尾から何件の下位インデックス（＝最新年度）を毎日辿るか
# インデックス → (末尾から取る記事ページ数, 末尾から辿る下位インデックス数)
WATCH_TAIL_INDEXES = {u: (WATCH_TAIL_PAGES, WATCH_TAIL_DIRS) for u in WATCH_INDEXES[-2:]}

# --- 監視のみ行うページ（都市計画：都市計画課の所管） ---
# 2026-10-17 追加（ユーザー指示）。analysis.html（2026-10-31 に review.html から移した）の「都市計画の動き（東部地域）」の元。
# 本文スナップショットから build_toshikeikaku.py が東部に関係するページだけを拾う。
# 配下は索引37・記事約125ページ（審議会の会議録が平成29年度から積もっている）ので、
# ふだんは**動きのある索引の末尾（＝新しいほう）だけ**を見て、最上位の索引からは
# 下へ降りない（TOSHI_NO_DESCEND）。全階層は日曜の WATCH_DEEP で回る。
TOSHI_BASE = BASE_DOMAIN + "/admin/soshiki/toshiseisakubu/toshikeikaku/1/"
WATCH_INDEXES.append(TOSHI_BASE + "index.html")
TOSHI_NO_DESCEND = {TOSHI_BASE + "index.html"}
TOSHI_DAILY = [
    (TOSHI_BASE + "denshikokuji/index.html", 3, 0),        # 電子告示
    (TOSHI_BASE + "kouchoukai/index.html", 3, 0),          # 公聴会
    (TOSHI_BASE + "3/index.html", 3, 0),                   # パブリックコメント
    (TOSHI_BASE + "2_1/tochiriyou/1/index.html", 3, 0),    # 地区計画
    (TOSHI_BASE + "4/1/3/index.html", 3, 0),               # 都市計画審議会（会議録）
    (TOSHI_BASE + "4/2/index.html", 0, 1),                 # 会議の開催案内（最新年度だけ辿る）
]
for _u, _p, _d in TOSHI_DAILY:
    WATCH_INDEXES.append(_u)
    WATCH_TAIL_INDEXES[_u] = (_p, _d)
WATCH_SUBTREES += (TOSHI_BASE,)

# 市サーバへの負荷配慮: リクエスト間に必ずこの秒数（＋ゆらぎ）待つ
REQUEST_WAIT_MIN = 3.0
REQUEST_WAIT_MAX = 5.0

# --- 取得方法について（2026-08-15 変更） -------------------------------
# 市サイトは WAF（Imperva/Incapsula）配下にあり、初回アクセスに対して Cookie を
# 付けた 302 を同一URLへ返す。この Cookie を保持して踏み直さないと永久に
# リダイレクトし続けるため、Cookie の保存が必須。
#
# さらに、Python の urllib は Cookie を保持しても 403 で弾かれる（UA を実ブラウザ
# 相当にしても変わらない）。WAF が TLS/HTTP の指紋で判定しているため、ヘッダを
# 足すだけでは通らない。curl なら同じ URL・同じ UA で 200 が返るので、取得だけ
# curl に委ねる。curl は GitHub Actions の ubuntu-latest に標準搭載。
# --- 取得した HTML のランレベルキャッシュ ---------------------------------
# 本文スナップショットはタグを落としてあるため、添付 PDF の href が残らない。
# だより（PDF）の中身を読む fetch_newsletters.py が同じページをもう一度
# 取りに行かずに済むよう、取得した記事ページの生 HTML を実行中だけ置いておく。
# 実行後に消える一時領域なので、リポジトリには何も残らない。
HTML_CACHE_DIR = os.path.join(tempfile.gettempdir(), "komaki_html")

COOKIE_FILE = os.path.join(tempfile.gettempdir(), f"komaki_cookies_{os.getpid()}.txt")
atexit.register(lambda: os.path.exists(COOKIE_FILE) and os.remove(COOKIE_FILE))

# Cookie は最初の1回で取れるので、2ページ目以降に追加の往復は発生しない。
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}

# WAF の判定が初回だけ滑ることがあるので、少しだけ待って粘る。
# 市サーバへの負荷を増やさないよう回数は最小限、間隔は polite_wait と同等。
FETCH_ATTEMPTS = 3


def polite_wait():
    """連続アクセスを避けるため、リクエストごとに 3〜5 秒待つ。"""
    time.sleep(random.uniform(REQUEST_WAIT_MIN, REQUEST_WAIT_MAX))


# 古い TLS 再ネゴシエーションしか話せないサーバ（国土地理院 gsi.go.jp など）向けの
# OpenSSL 設定。OpenSSL 3 は既定でこれを拒み、curl が exit 35「unsafe legacy
# renegotiation disabled」で落ちる。そのエラーのときだけ、この設定で1回取り直す
# （2026-10-11、check_contacts.py の照合のため。市のサイトの取得には影響しない）。
_LEGACY_OSSL_CONF = None


def _legacy_ossl_env():
    global _LEGACY_OSSL_CONF
    if _LEGACY_OSSL_CONF is None:
        fd, path = tempfile.mkstemp(prefix="komaki_ossl_", suffix=".cnf")
        with os.fdopen(fd, "w") as f:
            f.write("openssl_conf = openssl_init\n[openssl_init]\nssl_conf = ssl_sect\n"
                    "[ssl_sect]\nsystem_default = sys_default\n"
                    "[sys_default]\nOptions = UnsafeLegacyRenegotiation\n")
        atexit.register(lambda p=path: os.path.exists(p) and os.remove(p))
        _LEGACY_OSSL_CONF = path
    env = dict(os.environ)
    env["OPENSSL_CONF"] = _LEGACY_OSSL_CONF
    return env


def _curl_get(url):
    """curl で1回だけ取得する。200 以外・curl 失敗はすべて例外。"""
    fd, body_path = tempfile.mkstemp(prefix="komaki_body_", suffix=".html")
    os.close(fd)
    cmd = ["curl", "-sS", "-L", "--compressed", "--max-time", "30",
           "-c", COOKIE_FILE, "-b", COOKIE_FILE,
           "-o", body_path, "-w", "%{http_code}"]
    for name, value in BROWSER_HEADERS.items():
        cmd += ["-H", f"{name}: {value}"]
    cmd.append(url)
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        if proc.returncode == 35 and "legacy renegotiation" in proc.stderr:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=90,
                                  env=_legacy_ossl_env())
        if proc.returncode != 0:
            raise RuntimeError(
                f"curl exited {proc.returncode}: {proc.stderr.strip()}")
        status = proc.stdout.strip()
        if status != "200":
            raise RuntimeError(f"HTTP {status}")
        with open(body_path, "rb") as f:
            raw = f.read()
        # 市のページは UTF-8。連絡先の照合（check_contacts.py）で読む総務省統計局の
        # ページは Shift_JIS なので、UTF-8 で読めなければ cp932 で読み直す。
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return raw.decode("cp932", errors="replace")
    finally:
        os.remove(body_path)


def fetch_html(url):
    last_error = None
    for attempt in range(1, FETCH_ATTEMPTS + 1):
        try:
            return _curl_get(url)
        except Exception as e:
            last_error = e
            if attempt < FETCH_ATTEMPTS:
                print(f"  retry {attempt}/{FETCH_ATTEMPTS - 1} after error: {e}",
                      file=sys.stderr)
                polite_wait()
    raise last_error


def extract_jp_date(html):
    """Return '2026年04月30日' string from page HTML, or None."""
    m = re.search(r"更新日：(\d{4}年\d{2}月\d{2}日)", html)
    return m.group(1) if m else None


JST = timezone(timedelta(hours=9))


def jp_date_to_dt(text):
    """'2026年04月30日' → datetime（日本時間の0時）, or None.
    市のページの日付は日本時間。UTC の0時として読むと、30日の窓の境目が9時間ずれる。"""
    m = re.match(r"(\d{4})年(\d{2})月(\d{2})日", text)
    if not m:
        return None
    return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=JST)


def is_city_url(url):
    """市のサイト（BASE_DOMAIN）のページか。索引に外部サイトへのリンクが混ざっても、
    それを「市の公式ページ」のスナップショットやお知らせとして取り込まないため。"""
    return url.startswith(BASE_DOMAIN + "/")


_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2066-\u2069]")


def clean_title(t):
    """索引の見出し：HTML の実体参照を戻し（&amp; の二重表示を防ぐ）、制御文字を除く
    （feed.xml が不正な XML になるのを防ぐ）。"""
    return re.sub(r"\s+", " ", _CTRL.sub("", unescape(t))).strip()


def extract_body_text(html):
    """Extract readable text from the page's main content area, or None."""
    m = re.search(r'<article id="contents"[^>]*>(.*?)</article>', html, re.DOTALL)
    if not m:
        return None
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", m.group(1), flags=re.DOTALL)
    body = re.sub(r"<[^>]+>", "\n", body)
    body = unescape(body)
    lines = [line.strip() for line in body.split("\n")]
    return "\n".join(line for line in lines if line) + "\n"


def url_to_slug(url):
    """Item page URL → snapshot filename stem, e.g. '303-718-50750'."""
    path = urllib.parse.urlparse(url).path.lstrip("/")
    path = re.sub(r"\.html$", "", path)
    for prefix in ("admin/soshiki/kyoiku/kyouikusoumu/",
                   "admin/soshiki/kenkouikigai/",
                   "admin/soshiki/toshiseisakubu/",
                   # 上のどれにも当たらない所管（市議会など）は soshiki まで落とす
                   "admin/soshiki/"):
        if path.startswith(prefix):
            path = path[len(prefix):]
            break
    return path.replace("/", "-")


def cache_html(url, page_html):
    """取得した生 HTML を実行中だけ残す（失敗しても本処理は止めない）。"""
    try:
        os.makedirs(HTML_CACHE_DIR, exist_ok=True)
        path = os.path.join(HTML_CACHE_DIR, url_to_slug(url) + ".html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(page_html)
    except OSError as e:
        print(f"  WARN: HTML キャッシュに失敗 {url}: {e}", file=sys.stderr)


def save_snapshot(url, page_html):
    """Write body-text snapshot if changed. Returns True if file changed."""
    text = extract_body_text(page_html)
    if text is None:
        return False
    path = os.path.join(SNAPSHOT_DIR, url_to_slug(url) + ".txt")
    content = url + "\n---\n" + text
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            if f.read() == content:
                return False
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return True


def normalize_url(href, base_url):
    """Convert any href to an absolute https URL."""
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("http://"):
        return "https://" + href[7:]
    if href.startswith("https://"):
        return href
    if href.startswith("/"):
        return BASE_DOMAIN + href
    return urllib.parse.urljoin(base_url, href)


def crawl_index(index_url, source_dir, visited_index, seen_item_urls, raw_items, all_dates):
    """
    BFS within source_dir: collect <li class="page"> items and follow any
    sub-index pages whose URL starts with source_dir.
    Appends found dates to all_dates (for index_updated_at tracking).
    Returns the list of index URLs that could not be fetched.
    """
    queue = [index_url]
    failed = []

    while queue:
        url = queue.pop(0)
        print(f"  index: {url}")
        try:
            html = fetch_html(url)
            polite_wait()
        except Exception as e:
            print(f"  ERROR fetching {url}: {e}", file=sys.stderr)
            failed.append(url)
            continue

        page_date = extract_jp_date(html)
        if page_date:
            all_dates.append(page_date)

        # Collect article links from <li class="page">
        for m in re.finditer(r'<li class="page">\s*<a href="([^"]+)">([^<]+)</a>', html):
            href = normalize_url(m.group(1).strip(), url)
            title = clean_title(m.group(2))
            if not is_city_url(href) or not title:
                continue
            if href not in seen_item_urls:
                seen_item_urls.add(href)
                raw_items.append({"title": title, "url": href})

        # Enqueue sub-index pages that are within the same source subtree
        for m in re.finditer(r'href="([^"#?]+/index\.html)"', html):
            sub = normalize_url(m.group(1).strip(), url)
            if sub.startswith(source_dir) and sub != url and sub not in visited_index:
                visited_index.add(sub)
                queue.append(sub)
    return failed


def main():
    os.makedirs("data", exist_ok=True)

    raw_items = []
    seen_item_urls = set()
    all_dates = []

    source_dir = PARENT_URL.rsplit("/", 1)[0] + "/"
    visited_index = {PARENT_URL}
    print(f"Crawling subtree: {source_dir}")
    failed_indexes = crawl_index(PARENT_URL, source_dir, visited_index, seen_item_urls, raw_items, all_dates)

    if not raw_items and not seen_item_urls:
        print("ERROR: Failed to fetch any index page", file=sys.stderr)
        sys.exit(1)

    index_updated_at = max(all_dates) if all_dates else None

    # --- Visit each item page to get its update date + body snapshot ---
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=WINDOW_DAYS)
    items = []
    snapshots_changed = False

    # 個別ページが取れなかった項目は、前回の news.json の更新日を引き継ぐ（無ければ載せない）。
    # 以前は「日付なし」として載せていたので、WAF の不調の日に古い記事が一覧に溜まった。
    prev_dates = {}
    try:
        with open(OUTPUT, encoding="utf-8") as f:
            prev_dates = {it.get("url"): it.get("updated_at") for it in json.load(f).get("items", [])}
    except (OSError, ValueError):
        pass

    for item in raw_items:
        polite_wait()
        try:
            page_html = fetch_html(item["url"])
            cache_html(item["url"], page_html)
            updated_at = extract_jp_date(page_html)
            if save_snapshot(item["url"], page_html):
                snapshots_changed = True
        except Exception as e:
            print(f"  ERROR fetching item {item['url']}: {e}", file=sys.stderr)
            updated_at = prev_dates.get(item["url"])
            if not updated_at:
                print(f"  skip  (fetch failed, not listed before)  {item['title'][:40]}")
                continue

        item["updated_at"] = updated_at

        if updated_at:
            dt = jp_date_to_dt(updated_at)
            if dt is None or dt < cutoff:
                print(f"  skip  {updated_at}  {item['title'][:40]}")
                continue
            print(f"  keep  {updated_at}  {item['title'][:40]}")
        else:
            # Can't determine date → include to avoid silent omission
            print(f"  keep? (no date)  {item['title'][:40]}")

        items.append(item)

    # --- 監視のみのページ（地域協議会）のスナップショットを取る ---
    # news.json の items には入れない。変化の検知だけが目的。
    watch_urls = set(WATCH_PAGES)
    keep_slugs = set()
    # 学校再編の木で取れなかった索引があれば、その配下のスナップショットを今回は消さない
    # （一時的な 403 で配下が丸ごと消え、「削除」の Issue と自動更新が無駄に動くのを防ぐ）。
    for u in failed_indexes:
        stem = url_to_slug(u).rsplit("-", 1)[0] + "-"
        keep_slugs |= {f for f in os.listdir(SNAPSHOT_DIR) if f.startswith(stem)}
    watch_indexes = [(u, 0) for u in WATCH_INDEXES]   # BFS の待ち行列（URL, 深さ）
    seen_watch_indexes = set(WATCH_INDEXES)
    # 浅い巡回の日は、今回見に行かない下位ページのスナップショットを消さないよう守る
    # （消して翌週また作る、を繰り返すと差分が毎週まるごと出てしまう）。
    if not WATCH_DEEP:
        keep_slugs |= {f for f in os.listdir(SNAPSHOT_DIR)
                       if f.startswith(tuple(url_to_slug(b + "x").rsplit("-", 1)[0] + "-"
                                             for b in (TOBU_BASE, TOSHI_BASE)))}
    while watch_indexes:
        index_url, depth = watch_indexes.pop(0)
        watch_urls.add(index_url)
        polite_wait()
        try:
            index_html = fetch_html(index_url)
        except Exception as e:
            print(f"  ERROR fetching watch index {index_url}: {e}", file=sys.stderr)
            # インデックスが引けないと配下記事のURLが分からない。この回だけの障害で
            # 既存スナップショットを消さないよう、同じ接頭辞のファイルは保護する。
            stem = url_to_slug(index_url).rsplit("-", 1)[0] + "-"
            keep_slugs |= {f for f in os.listdir(SNAPSHOT_DIR) if f.startswith(stem)}
            continue
        if save_snapshot(index_url, index_html):
            snapshots_changed = True
        pages = [u for u in (normalize_url(m.group(1).strip(), index_url) for m in
                 re.finditer(r'<li class="page">\s*<a href="([^"]+)">', index_html)) if is_city_url(u)]
        subs = [normalize_url(m.group(1).strip(), index_url) for m in
                re.finditer(r'<li class="dir">\s*<a href="([^"]+)">', index_html)]
        # 過去分が積もっているインデックスは、浅い巡回の日は末尾（新しいほう）だけ見る
        if not WATCH_DEEP and index_url in WATCH_TAIL_INDEXES:
            n_pages, n_dirs = WATCH_TAIL_INDEXES[index_url]
            pages = pages[-n_pages:] if n_pages else []
            subs = subs[-n_dirs:] if n_dirs else []
        if not WATCH_DEEP and index_url in TOSHI_NO_DESCEND:
            subs = []
        watch_urls.update(pages)
        # 下位インデックス（<li class="dir">）も同じ木の中なら辿る。
        # 市がフォルダを増やしても取りこぼさないため、URL は決め打ちしない。
        if depth < WATCH_DIR_MAX_DEPTH:
            for sub in subs:
                if sub.startswith(WATCH_SUBTREES) and sub not in seen_watch_indexes:
                    seen_watch_indexes.add(sub)
                    watch_indexes.append((sub, depth + 1))

    for url in sorted(watch_urls - seen_watch_indexes):
        polite_wait()
        try:
            page_html = fetch_html(url)
            cache_html(url, page_html)
            if save_snapshot(url, page_html):
                snapshots_changed = True
                print(f"  watch: changed  {url}")
        except Exception as e:
            print(f"  ERROR fetching watch page {url}: {e}", file=sys.stderr)
            # 取得失敗時は既存スナップショットを消さないよう URL は残す
    seen_item_urls |= watch_urls

    # --- Remove snapshots of pages that no longer exist on the site ---
    # (only files whose URL is no longer listed; a transient fetch failure
    #  keeps the item in seen_item_urls, so its snapshot survives)
    expected = {url_to_slug(u) + ".txt" for u in seen_item_urls} | keep_slugs
    for fname in os.listdir(SNAPSHOT_DIR):
        if fname.endswith(".txt") and fname not in expected:
            os.remove(os.path.join(SNAPSHOT_DIR, fname))
            print(f"  removed stale snapshot: {fname}")
            snapshots_changed = True

    # --- Build output ---
    new_data = {
        "fetched_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "index_updated_at": index_updated_at,
        "source_url": PARENT_URL,
        "window_days": WINDOW_DAYS,
        "items": items,
    }

    # --- Detect changes ---
    old_items = []
    if os.path.exists(OUTPUT):
        with open(OUTPUT, encoding="utf-8") as f:
            old = json.load(f)
        old_items = old.get("items", [])

    changed = items != old_items
    if not changed:
        new_data = {**old, "fetched_at": new_data["fetched_at"]}
        print(f"No news-item changes. {len(items)} items in window.")
    else:
        print(f"News-item changes detected. {len(items)}/{len(raw_items)} items in {WINDOW_DAYS}-day window.")

    if snapshots_changed:
        print("Page-body snapshot changes detected.")

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    sys.exit(0 if (changed or snapshots_changed) else 2)


if __name__ == "__main__":
    main()
