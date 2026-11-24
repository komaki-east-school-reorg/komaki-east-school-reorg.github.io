#!/usr/bin/env python3
"""サイトの点検（止めない検査）。週1回 check-site.yml が回し、気になる所を Issue（🧹）1件にまとめる。

2026-11-11、日次アイデアにたまっていた検査の案（約20件）を1本にまとめた。
auto_gates.py に検査を増やすと自動更新が小さなことで止まるので、ここは「知らせるだけ」。
壊れると読者に見える2つ（辞書に無い data-i18n キー・サイト内リンク切れ）だけは
auto_gates.py の check 28・29 がこのファイルの関数を呼んで止める。

外部にはアクセスしない。AI も使わない。リポジトリのファイルを読むだけ。

使い方:
  site_lint.py                 結果を表示
  site_lint.py --report <md>   Issue 用の Markdown も書く
終了コード: 0 = 気になる所なし / 3 = あり / 1 = 異常終了

点検を足すときは、関数を1つ書いて CHECKS に足す（見出し, 関数）。関数は文字列のリストを返す。
"""
import datetime
import glob
import gzip
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)
sys.path.insert(0, os.path.join(ROOT, ".github", "scripts"))

LANGS = ["ja", "en", "pt", "vi", "tl", "es", "zh", "id", "ko", "ne", "tr", "my"]
I18N_ATTR = re.compile(r'data-i18n(?:-html|-aria|-alt)?="([^"]+)"')
# 一覧に出しすぎない（Issue が読めなくなる）
CAP = 25


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def dicts():
    out = {}
    for lang in LANGS + ["ja-kids"]:
        out[lang] = json.loads(read(f"data/i18n/{lang}.json"))
    return out


def pages():
    """ルートの *.html（移動案内の voices.html を除く）。"""
    return [p for p in sorted(glob.glob("*.html")) if p != "voices.html"]


def cap(items, n=CAP):
    items = list(items)
    if len(items) > n:
        return items[:n] + [f"…ほか {len(items) - n} 件"]
    return items


# ---------------------------------------------------------------- 止める検査（auto_gates.py からも呼ぶ）

def missing_keys():
    """HTML の data-i18n* が指すキーで、ja.json に無いもの。"""
    ja = json.loads(read("data/i18n/ja.json"))
    bad = []
    for page in sorted(glob.glob("*.html")) + sorted(glob.glob("events/*.html")) + sorted(glob.glob("qa/*.html")):
        seen = set()
        for key in I18N_ATTR.findall(read(page)):
            if key not in ja and key not in seen:
                seen.add(key)
                bad.append(f"{page}: {key}")
    return bad


def _moved_anchors():
    """js/main.js の MOVED ANCHORS が受ける古いアンカー（ページ#id）。"""
    js = read("js/main.js")
    out = set()
    m = re.search(r"var MOVES = \{(.*?)\n  \};", js, re.S)
    if m:
        for page, ids in re.findall(r"(\w+): \['[\w.]+', \[(.*?)\]\]", m.group(1), re.S):
            for i in re.findall(r"'([\w-]+)'", ids):
                out.add(f"{page}.html#{i}")
    m = re.search(r"var RENAMED = \{(.*?)\n  \};", js, re.S)
    if m:
        for old in re.findall(r"'(\w+)#([\w-]+)':", m.group(1)):
            out.add(f"{old[0]}.html#{old[1]}")
    return out


_html_cache = {}


def anchor_exists(page, frag):
    """page（ルートの html）に #frag があるか。実行時に付く id も認める。"""
    if page not in _html_cache:
        _html_cache[page] = read(page) if os.path.exists(page) else None
    html = _html_cache[page]
    if html is None:
        return False
    if re.search(r'\bid="%s"' % re.escape(frag), html):
        return True
    # main.js が実行時に付ける id
    if frag in ("main-content", "top"):
        return True
    key = None
    m = re.fullmatch(r"((?:bus-|comm-)?faq)-q(\d+)", frag)
    if m:                                   # SECTION LINKS：質問のキーから（faq_q3 → faq-q3）
        key = m.group(1).replace("-", "_") + "_q" + m.group(2)
    elif frag.startswith("toc-"):           # PAGE TOC：id の無い見出しに toc-<キー>
        key = frag[4:]
    if key and re.search(r'data-i18n(?:-html)?="%s"' % re.escape(key), html):
        return True
    return False


def broken_links():
    """*.html と辞書の値にあるサイト内リンク（page.html#id・#id）で、飛び先が無いもの。"""
    moved = _moved_anchors()
    root_pages = set(glob.glob("*.html"))
    bad = []

    def check(src, href, here):
        href = href.strip()
        if not href or re.match(r"(?i)^(https?:|//|mailto:|tel:|webcal:|javascript:|data:)", href):
            return
        path, _, frag = href.partition("#")
        path = path.split("?")[0]
        if path.startswith("/"):
            path = path[1:]
        page = path or here
        if not page.endswith(".html"):
            return                          # 画像・フィード・マニフェストなど
        if page not in root_pages and not os.path.exists(page):
            bad.append(f"{src}: {href} → ページ {page} が無い")
            return
        if frag and page in root_pages:
            try:
                from urllib.parse import unquote
                frag = unquote(frag)
            except Exception:
                pass
            if f"{page}#{frag}" in moved:
                return
            if not anchor_exists(page, frag):
                bad.append(f"{src}: {href} → {page} に #{frag} が無い")

    for page in sorted(root_pages):
        if page in ("voices.html",):
            continue
        html = re.sub(r"<!--.*?-->", "", read(page), flags=re.S)
        html = re.sub(r"<script\b.*?</script>", "", html, flags=re.S)
        for href in set(re.findall(r'<a\b[^>]*\bhref="([^"]*)"', html)):
            check(page, href, page)

    # 辞書の値の中のリンクは、そのキーを使っているページから見た相対になる
    used = {}
    for page in sorted(root_pages):
        for key in set(I18N_ATTR.findall(read(page))):
            used.setdefault(key, []).append(page)
    for lang in LANGS + ["ja-kids"]:
        d = json.loads(read(f"data/i18n/{lang}.json"))
        for key, val in d.items():
            if "href=" not in val:
                continue
            for href in set(re.findall(r'href="([^"]*)"', val)):
                if href.startswith("#"):
                    for page in used.get(key, []):
                        check(f"{lang}.json {key}（{page}）", href, page)
                else:
                    check(f"{lang}.json {key}", href, "index.html")
    return sorted(set(bad))


# ---------------------------------------------------------------- 知らせるだけの点検

def unused_keys():
    """どのページ・js・生成スクリプトからも使われていない辞書のキー。"""
    import build_page_dicts as bpd
    ja = json.loads(read("data/i18n/ja.json"))
    used = set(bpd.RUNTIME_KEYS)
    blob = ""
    for p in sorted(glob.glob("*.html")) + sorted(glob.glob("events/*.html")) + sorted(glob.glob("qa/*.html")):
        t = read(p)
        used |= set(I18N_ATTR.findall(t))
        blob += t
    for p in glob.glob("js/*.js") + glob.glob(".github/scripts/*.py"):
        if os.path.basename(p) == "site_lint.py":
            continue
        blob += read(p)
    out = []
    for k in ja:
        base = k[:-len("__after")] if k.endswith("__after") else k
        if base in used or re.match(r"meta_(title|desc)_", k):
            continue
        # js やスクリプトが名前で（または接頭辞＋番号で）参照しているキー
        if re.search(r"['\"]%s['\"]" % re.escape(base), blob):
            continue
        stem = re.sub(r"\d+(_[a-z]+)?$", "", base)
        if stem != base and len(stem) >= 4 and re.search(r"['\"]%s['\"]" % re.escape(stem), blob):
            continue
        out.append(k)
    return cap(sorted(out))


def missing_translations():
    """ja にあるのに、ほかの言語・こどもむけに無いキー。"""
    d = dicts()
    out = []
    for lang in LANGS[1:] + ["ja-kids"]:
        miss = sorted(k for k in d["ja"] if k not in d[lang])
        if miss:
            out.append(f"{lang}: {len(miss)} 件（{', '.join(miss[:8])}{' …' if len(miss) > 8 else ''}）")
    return out


def lang_lists():
    """言語の一覧が、各スクリプト・i18n.js・sitemap でそろっているか。"""
    out = []
    want = LANGS
    for path, pat, strip in [
        ("js/i18n.js", r"var LANGS = \[(.*?)\]", []),
        (".github/scripts/auto_gates.py", r"^LANGS = \[(.*?)\]", []),
        (".github/scripts/build_calendar.py", r"^LANGS = \[(.*?)\]", []),
        (".github/scripts/build_manifest.py", r"^LANGS = \[(.*?)\]", []),
        (".github/scripts/build_qr.py", r"^LANGS = \[(.*?)\]", []),
        (".github/scripts/build_search_index.py", r"^LANGS = \[(.*?)\]", ["ja-kids"]),
        (".github/scripts/headline_i18n.py", r"^LANGS = \[(.*?)\]", []),
    ]:
        m = re.search(pat, read(path), re.M | re.S)
        got = re.findall(r"['\"]([a-z-]+)['\"]", m.group(1)) if m else []
        got = [g for g in got if g not in strip]
        exp = want[1:] if path.endswith("headline_i18n.py") else want
        if got != exp:
            out.append(f"{path}: {got}（期待 {exp}）")
    files = sorted(os.path.basename(p)[:-5] for p in glob.glob("data/i18n/*.json"))
    if files != sorted(LANGS + ["ja-kids"]):
        out.append(f"data/i18n/ のファイル: {files}")
    sm = read("sitemap.xml")
    for lang in LANGS[1:]:
        if f"?lang={lang}" not in sm:
            out.append(f"sitemap.xml に ?lang={lang} が無い")
    return out


def meta_desc_length():
    """meta description の長さ（日本語・中国語・韓国語は字数、ほかは文字数の目安）。"""
    d = dicts()
    out = []
    for lang in LANGS:
        cjk = lang in ("ja", "zh", "ko")
        lo, hi = (25, 180) if cjk else (70, 420)
        for k, v in d[lang].items():
            if not k.startswith("meta_desc_") or k in ("meta_desc_voices", "meta_desc_404"):
                continue
            n = len(v)
            if n < lo or n > hi:
                out.append(f"{lang} {k}: {n}字（目安 {lo}〜{hi}）")
    return cap(out)


def blank_without_noopener():
    out = []
    for page in sorted(glob.glob("*.html")) + sorted(glob.glob("events/*.html")) + sorted(glob.glob("qa/*.html")):
        for tag in re.findall(r"<a\b[^>]*target=\"_blank\"[^>]*>", read(page)):
            if "noopener" not in tag:
                out.append(f"{page}: {tag[:90]}")
    for lang in LANGS + ["ja-kids"]:
        for k, v in json.loads(read(f"data/i18n/{lang}.json")).items():
            for tag in re.findall(r"<a\b[^>]*target=\\?\"_blank\\?\"[^>]*>", v):
                if "noopener" not in tag:
                    out.append(f"{lang}.json {k}")
    return cap(out)


def images():
    """<img> の alt・width・height、挿絵 SVG に文字が入っていないか。"""
    out = []
    for page in sorted(glob.glob("*.html")):
        for tag in re.findall(r"<img\b[^>]*>", read(page)):
            miss = [a for a in ("alt", "width", "height") if not re.search(r"\b%s=" % a, tag)]
            if "data-i18n-alt" in tag and "alt" in miss:
                miss.remove("alt")
            if miss:
                src = re.search(r'src="([^"]*)"', tag)
                out.append(f"{page}: {src.group(1) if src else tag[:60]} に {'・'.join(miss)} が無い")
    for svg in sorted(glob.glob("img/illust/*.svg")):
        if re.search(r"<text\b|<tspan\b", read(svg)):
            out.append(f"{svg}: 文字（<text>）が入っている")
    return cap(out)


def versions():
    """版の表記（13辞書）と OGP 画像の ?v= がそろっているか。"""
    out = []
    d = dicts()
    vers = {}
    for lang, dd in d.items():
        m = re.search(r"Ver\.\s?(\d+\.\d+)", dd.get("site_version", ""))
        vers.setdefault(m.group(1) if m else "（読めない）", []).append(lang)
    if len(vers) > 1:
        out.append("site_version の版がそろっていない: " + "; ".join(f"{v}={','.join(l)}" for v, l in vers.items()))
    seen = {}
    for p in sorted(glob.glob("*.html")) + ["js/main.js", ".github/scripts/build_event_pages.py"]:
        for v in set(re.findall(r"og-image\.png\?v=(\d+)", read(p))):
            seen.setdefault(v, []).append(p)
    if len(seen) > 1:
        out.append("og-image.png?v= がそろっていない: " + "; ".join(f"{v}={len(l)}か所（{l[0]} など）" for v, l in seen.items()))
    return out


def counts_in_text():
    """文中の数と実数（Q&A の数・質問集の数）。"""
    out = []
    ja = json.loads(read("data/i18n/ja.json"))
    faq = read("faq.html")
    n_faq = len(re.findall(r'class="faq-item"', faq))
    m = re.search(r"(\d+)問", ja.get("faq_qa_intro", ""))
    if m and int(m.group(1)) != n_faq:
        out.append(f"faq_qa_intro は「{m.group(1)}問」、faq.html の Q&A は {n_faq} 問")
    # FAQPage の構造化データは faq_q1 から連番で読む（欠番で止まる）
    nums = sorted(int(k[5:]) for k in ja if re.fullmatch(r"faq_q\d+", k))
    if nums and nums != list(range(1, len(nums) + 1)):
        out.append(f"faq_q の番号が連番でない（{nums[0]}〜{nums[-1]}、{len(nums)}件）")
    rv = read("review.html")
    n_ask = len(set(re.findall(r'data-i18n(?:-html)?="(rev_o\d+)"', rv)))
    m = re.search(r"(\d+)問", ja.get("rev_open_short", ""))
    if m and int(m.group(1)) != n_ask:
        out.append(f"rev_open_short は「{m.group(1)}問」、review.html の質問は {n_ask} 問")
    return out


def day_flag():
    """schedule.html で1日の予定なのに、events.json に "day": true が無いもの。"""
    out = []
    ev = json.loads(read("data/events.json")).get("events", {})
    html = read("schedule.html")
    for tag in re.findall(r'<[^>]*class="[^"]*\bevent-item\b[^"]*"[^>]*>', html):
        s = re.search(r'data-start="([\d-]+)"', tag)
        e = re.search(r'data-event-date="([\d-]+)"', tag)
        if not s or not e or s.group(1) != e.group(1):
            continue
        day = s.group(1)
        if day not in ev:
            continue
        items = ev[day] if isinstance(ev[day], list) else [ev[day]]
        if not any(it.get("day") for it in items):
            out.append(f"{day}: schedule.html は1日の予定、events.json に \"day\": true が無い（あと◯日・カレンダーに数えられない）")
    return out


def page_dict_size(limit=50000):
    """ページ別辞書の重さ（gzip）。"""
    out = []
    for p in sorted(glob.glob("data/i18n/pages/*.json")):
        with open(p, "rb") as f:
            n = len(gzip.compress(f.read(), 6))
        if n > limit:
            out.append(f"{p}: gzip {n:,} バイト（目安 {limit:,}）")
    return cap(out)


def old_asof(months=3):
    """「◯年◯月時点」が古くなっていないか（now_asof / about_nearby_asof など）。"""
    out = []
    ja = json.loads(read("data/i18n/ja.json"))
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date()
    for k, v in ja.items():
        if not k.endswith("_asof"):
            continue
        m = re.search(r"(\d{4})年(\d{1,2})月", v)
        if not m:
            continue
        age = (today.year - int(m.group(1))) * 12 + today.month - int(m.group(2))
        if age >= months:
            out.append(f"{k}: 「{v}」（{age}か月前）")
    return out


# 「市民」を使ってよい固有名詞（CLAUDE.md の運営者の節）
SHIMIN_OK = ["市民センター", "市民四季の森", "市民球場", "市民窓口課", "市民文化財団", "市民まつり",
             "市民大会", "市民活動団体", "市民情報サイト", "市民活動", "市民会館", "市民病院", "市民交流",
             "市民安全", "市民生活", "市民協働", "市民憲章", "市民講座", "市民税", "小牧市民",
             "市民意見募集"]   # 市民意見募集＝春日井市の制度の名前


def shimin():
    """「市民」が固有名詞以外に出てくる所（サイトは「住民」と書く）。"""
    out = []
    for lang in ("ja", "ja-kids"):
        for k, v in json.loads(read(f"data/i18n/{lang}.json")).items():
            t = v
            for ok_word in SHIMIN_OK:
                t = t.replace(ok_word, "")
            if "市民" in t:
                i = t.index("市民")
                out.append(f"{lang}.json {k}: …{t[max(0, i - 12):i + 14]}…")
    return cap(out)


def handover():
    """HANDOVER.md と実際のワークフロー・Secrets の食い違い。"""
    out = []
    ho = read("HANDOVER.md")
    secrets, issue_titles = set(), set()
    for wf in sorted(glob.glob(".github/workflows/*.yml")):
        t = read(wf)
        secrets |= set(re.findall(r"secrets\.([A-Z0-9_]+)", t))
        for title in re.findall(r'--title "([^"$]+)', t):
            issue_titles.add(title.strip())
    secrets.discard("GITHUB_TOKEN")
    for s in sorted(secrets):
        if s not in ho:
            out.append(f"Secret {s} がワークフローで使われているが、HANDOVER.md に無い")
    for s in sorted(set(re.findall(r"`([A-Z][A-Z0-9_]{5,})`", ho))):
        if s in ("AUTO_MERGE", "BASE_FY", "LANGS") or s in secrets:
            continue
        if not any(s in read(p) for p in glob.glob(".github/workflows/*.yml") + glob.glob(".github/scripts/*.py") + ["js/main.js"]):
            out.append(f"HANDOVER.md の `{s}` が、どのワークフロー・スクリプトにも無い")
    for title in sorted(issue_titles):
        mark = title.split()[0]
        if mark and mark not in ho:
            out.append(f"Issue「{title}」の印 {mark} が HANDOVER.md の一覧に無い")
    for name in re.findall(r"`([\w./-]+\.(?:py|yml|json|md))`", ho):
        cand = [name, os.path.join(".github/scripts", name), os.path.join(".github/workflows", name),
                os.path.join("data", name)]
        if not any(os.path.exists(c) for c in cand):
            out.append(f"HANDOVER.md の `{name}` というファイルが無い")
    return cap(sorted(set(out)))


def search_words():
    """検索の窓の入口の語（search_hints）と言い換え先（data/search_aliases.json）が、その言語の索引に実際に当たるか。"""
    import unicodedata
    def norm(s, cjk):
        s = unicodedata.normalize("NFKC", s).lower()
        s = "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)
        return re.sub(r"\s+", "", s) if cjk else re.sub(r"\s+", " ", s)
    out = []
    aliases = json.load(open("data/search_aliases.json", encoding="utf-8"))
    hays = {}
    def hit(lang, word):
        cjk = lang in ("ja", "ja-kids", "zh")
        if lang not in hays:
            d = json.load(open(f"data/search/{lang}.json", encoding="utf-8"))
            hays[lang] = "\n".join(norm(it[2], cjk) + " " + norm(it[3], cjk) for it in d["items"])
        return norm(word, cjk) in hays[lang]
    for lang in ["ja", "ja-kids", "en", "pt", "vi", "tl", "es", "zh", "id", "ko", "ne", "tr", "my"]:
        v = json.load(open(f"data/i18n/{lang}.json", encoding="utf-8")).get("search_hints", "")
        for w in v.split("|"):
            if not hit(lang, w):
                out.append(f"{lang}: 入口の語「{w}」が索引に当たらない")
    for lang in ("ja", "en"):
        for k, vals in aliases[lang].items():
            for w in vals:
                if not hit(lang, w) and not (lang == "ja" and hit("ja-kids", w)):
                    out.append(f"{lang}: 言い換え「{k}→{w}」が索引に当たらない")
    return out


def weekday_mismatch():
    """「M月D日（曜）」の曜日が実際と合っているか（ja・こどもむけ・events.json の ja・HTML）。
    年が日付の直前に書いてあればその年で確かめる。無ければ 2025〜2027 年のどれとも合わないものだけを報告する。"""
    import unicodedata
    W = "月火水木金土日"
    pat = re.compile(r"(?:(20\d\d)年|令和(\d{1,2})年)?\s*(?:(\d{1,2})月)?(\d{1,2})日\s*[（(]([月火水木金土日])(?:曜日?)?[）)]")
    def check(where, text):
        out = []
        text = unicodedata.normalize("NFKC", str(text))
        month = None
        for m in pat.finditer(text):
            y = int(m.group(1)) if m.group(1) else (2018 + int(m.group(2)) if m.group(2) else None)
            if m.group(3):
                month = int(m.group(3))
            if month is None:
                continue
            ok = False
            real = []
            for yy in ([y] if y else [2025, 2026, 2027]):
                try:
                    wd = W[datetime.date(yy, month, int(m.group(4))).weekday()]
                except ValueError:
                    continue
                real.append(f"{yy}年は{wd}")
                ok = ok or wd == m.group(5)
            if not ok:
                out.append(f"{where}: {month}月{m.group(4)}日（{m.group(5)}）→ " + "・".join(real))
        return out
    out = []
    for lang in ("ja", "ja-kids"):
        for k, v in json.load(open(f"data/i18n/{lang}.json", encoding="utf-8")).items():
            out += check(f"{lang}:{k}", v)
    for day, v in json.load(open("data/events.json", encoding="utf-8"))["events"].items():
        for e in (v if isinstance(v, list) else [v]):
            out += check(f"events:{day}", e.get("ja", ""))
    for f in sorted(glob.glob("*.html")):
        out += check(f, re.sub(r"<!--.*?-->", "", open(f, encoding="utf-8").read(), flags=re.S))
    return sorted(set(out))


def permitted_sync():
    """auto_gates.py の許可する市の URL が、CLAUDE.md・CONTRIBUTING.txt・README.md にも書いてあるか。"""
    import ast
    src = open(".github/scripts/auto_gates.py", encoding="utf-8").read()
    links = None
    for node in ast.parse(src).body:
        if isinstance(node, ast.Assign) and getattr(node.targets[0], "id", "") == "PERMITTED_LINKS":
            links = ast.literal_eval(node.value)
    if not links:
        return ["auto_gates.py の PERMITTED_LINKS を読めない"]
    out = []
    for doc in ("CLAUDE.md", "CONTRIBUTING.txt", "README.md"):
        text = open(doc, encoding="utf-8").read()
        for u in links:
            tail = u[3:] if u.startswith("jp/") else u
            if tail not in text:
                out.append(f"{doc}: {tail} が無い")
    return out


def crosslink_balance():
    """「あわせて読みたい」でどこからも指されないページと、3割を超えて集まるページ。"""
    incoming = {}
    total = 0
    pages = [os.path.basename(f)[:-5] for f in glob.glob("data/crosslinks/*.json")]
    for f in glob.glob("data/crosslinks/*.json"):
        for rows in json.load(open(f, encoding="utf-8"))["links"].values():
            for page, _ in rows:
                incoming[page] = incoming.get(page, 0) + 1
                total += 1
    out = [f"{p}: どこからも指されていない" for p in sorted(pages) if p != "site" and not incoming.get(p)]
    out += [f"{p}: 全体の{n * 100 // total}%（{n}本）が集まっている" for p, n in sorted(incoming.items()) if total and n / total > 0.3]
    return out


def quiz_data():
    """東部たんけんクイズ：全言語で同じ問い、3択、飛び先が実在、テーマが均等、学校再編・行政の語が無い。"""
    out = []
    page = open("community.html", encoding="utf-8").read()
    base = None
    for f in sorted(glob.glob("data/quiz/*.json")):
        name = os.path.basename(f)
        items = json.load(open(f, encoding="utf-8"))["items"]
        sig = [(x["id"], x["theme"], x["more"]) for x in items]
        base = base or sig
        if sig != base:
            out.append(f"{name}: 問いの並び・テーマ・飛び先がほかの言語と違う")
        for x in items:
            if len(x["o"]) != 3 or len(set(x["o"])) != 3:
                out.append(f"{name} {x['id']}: 選択肢が3つでない")
            if x.get("lv") not in ("easy", "hard") or (x.get("lv") == "easy" and not x.get("more")):
                out.append(f"{name} {x['id']}: 難易度の指定がおかしい")
            if not x.get("more") and not x.get("src"):
                out.append(f"{name} {x['id']}: 飛び先も出どころも無い")
            if x.get("more") and f'id="{x["more"]}"' not in page:
                out.append(f"{name} {x['id']}: 飛び先 {x['more']} が無い")
            if re.search("再編|パブリックコメント|教育委員会|議会", x["q"] + "".join(x["o"])):
                out.append(f"{name} {x['id']}: 学校再編・行政の語がある")
    themes = {}
    for _, th, _m in base or []:
        themes[th] = themes.get(th, 0) + 1
    # お店1〜4（f・g・k・l）は中身で分けるので数が違ってよく、合わせて40問。ほかのテーマは同じ数にそろえる
    shop = sum(themes.get(t, 0) for t in "fgkl")
    rest = {t: n for t, n in themes.items() if t not in "fgkl"}
    if len(set(rest.values())) > 1 or (rest and shop != 4 * next(iter(rest.values()))):
        out.append(f"テーマの問題数がそろっていない {themes}")
    # つながり（data/quiz_meta.json）：全問に難しさと道があり、道は かんたん→むずかしい の順
    meta = json.load(open("data/quiz_meta.json", encoding="utf-8"))
    ja = {x["id"]: x for x in json.load(open("data/quiz/ja.json", encoding="utf-8"))["items"]}
    if set(meta["d"]) != set(ja):
        out.append("quiz_meta.json: 難しさ d の問いが問題ファイルと食い違う")
    joined = set()
    for r, ids in meta["routes"].items():
        joined |= set(ids)
        if not set(ids) <= set(ja):
            out.append(f"quiz_meta.json: 道 {r} に無い問いがある")
        elif [meta["d"][i] for i in ids] != sorted(meta["d"][i] for i in ids):
            out.append(f"quiz_meta.json: 道 {r} が かんたん→むずかしい の順でない")
    if set(ja) - joined:
        out.append(f"quiz_meta.json: どの道にも入っていない問い {sorted(set(ja) - joined)}")
    for i, x in ja.items():
        d = meta["d"].get(i, 0)
        if (x["lv"] == "easy" and not 1 <= d <= 3) or (x["lv"] == "hard" and not 3 <= d <= 5):
            out.append(f"quiz_meta.json: {i} の難しさ {d} が lv と合わない")
    # 画面の文言（ui）は13言語で同じキー
    uis = {os.path.basename(f): set(json.load(open(f, encoding="utf-8")).get("ui", {})) for f in glob.glob("data/quiz/*.json")}
    if len({frozenset(v) for v in uis.values()}) > 1:
        out.append("data/quiz: ui のキーが言語でそろっていない")
    named = {r for r in meta["routes"] if not r.startswith("_")}
    for name, keys in uis.items():
        if {"pl_" + r for r in named} - keys:
            out.append(f"{name}: 道の名前 pl_* が足りない")
    return out


def static_seo():
    """各ページの静的な構造化データ（build_static_seo.py の SEO:BEGIN〜END）が古くないか（2026-11-24）。
    自動更新で faq_a* などが変わると古くなる。auto_gates.py check 31 は警告だけなので、ここで週1回知らせる。"""
    import subprocess
    r = subprocess.run([sys.executable, ".github/scripts/build_static_seo.py", "--check"],
                       capture_output=True, text=True)
    return [] if r.returncode == 0 else [r.stdout.strip() + "（build_static_seo.py を実行してコミット）"]


CHECKS = [
    ("東部たんけんクイズのデータ", quiz_data),
    ("辞書に無いキー（HTML の data-i18n）", missing_keys),
    ("サイト内リンクの切れ", broken_links),
    ("使われていない辞書のキー", unused_keys),
    ("訳の抜け（言語・こどもむけ）", missing_translations),
    ("言語の一覧の食い違い", lang_lists),
    ("meta description の長さ", meta_desc_length),
    ("target=_blank に rel=noopener が無い", blank_without_noopener),
    ("画像の属性・挿絵の文字", images),
    ("版の表記・OGP 画像の版番号", versions),
    ("文中の数と実数", counts_in_text),
    ("「day: true」の付け忘れ", day_flag),
    ("ページ別辞書の重さ", page_dict_size),
    ("古い「時点」表記", old_asof),
    ("「市民」の表記（サイトは「住民」）", shimin),
    ("HANDOVER.md との食い違い", handover),
    ("検索の入口の語・言い換え語が索引に当たらない", search_words),
    ("日付と曜日の食い違い", weekday_mismatch),
    ("許可する市の URL の記載もれ", permitted_sync),
    ("関連リンクの偏り", crosslink_balance),
    ("静的な構造化データの古さ", static_seo),
]


def main():
    report = None
    if "--report" in sys.argv:
        report = sys.argv[sys.argv.index("--report") + 1]
    found = []
    for title, fn in CHECKS:
        try:
            items = fn()
        except Exception as e:      # 1つの点検が壊れても、ほかは続ける
            items = [f"この点検を実行できませんでした: {e!r}"]
        if items:
            found.append((title, items))
            print(f"■ {title}（{len(items)}）")
            for it in items:
                print("   - " + it)
        else:
            print(f"OK {title}")
    if report:
        today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime("%Y-%m-%d")
        lines = [f"## サイトの点検 {today}", "",
                 "週1回の点検（`.github/scripts/site_lint.py`）で気になった所です。**サイトは止まっていません。**",
                 "急がないものばかりなので、手の空いたときに直してください。直したら、この Issue を閉じます。", ""]
        for title, items in found:
            lines.append(f"### {title}")
            lines += [f"- {it}" for it in items]
            lines.append("")
        lines.append("手元で確かめる：`python3 .github/scripts/site_lint.py`")
        with open(report, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    sys.exit(3 if found else 0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        print(f"異常終了: {e!r}", file=sys.stderr)
        sys.exit(1)
