#!/usr/bin/env python3
"""関連リンク（あわせて読みたい）を計算する（2026-11-10 ユーザー指示「サイトの回遊性を高めるため、
サイト内で必要と考えられる箇所すべて計算してたくさんリンクを作成」）。

手で1本ずつ書くと漏れと古びが出るので、検索の索引 data/search/<言語>.json の日本語の本文から
文面の近さを計算して選ぶ。出力は data/crosslinks/<ページ>.json（手編集不可）で、画面側は
js/main.js の CROSS LINKS が、そのページの1枚だけを読んで描く。

  リンク元：各ページの h2 の節（問い合わせ先などは除く）と、Q&A の1問ずつ（faq-q* / bus-faq-q*）
  リンク先：索引のすべての項目（節・Q&A・根拠のカード rev-…・legacy-…・予定 ev-… など）。同じページは除く
  計算    ：文字2-gram の TF-IDF（tf は 1+log）のコサイン類似度。見出しは3回数えて重くする。
            似ている順に、1ページにつき1件まで、節は最大 SEC_MAX 件・Q&A は最大 FAQ_MAX 件。
            MIN_SIM を下回るものは出さない（関係の薄いリンクを作らない）。
見出しとページ名は 13 表示（12言語＋こどもむけ）ぶん、各言語の索引から同じ（ページ, id）の見出しを引く。
出力は入力だけで決まる（--check のため）。

使い方:  python3 .github/scripts/build_crosslinks.py          # 書き出す
         python3 .github/scripts/build_crosslinks.py --check  # 古ければ exit 1（auto_gates.py check 27）
         python3 .github/scripts/build_crosslinks.py --show   # 選ばれた組み合わせを日本語で一覧（調整用）
build_search_index.py のあとに実行すること（索引が材料のため）。
"""
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_search_index as bsi  # noqa: E402

SEARCH = "data/search"
OUT = "data/crosslinks"
LANGS = bsi.LANGS
SEC_MAX = 4
FAQ_MAX = 2      # Q&A の1問・カード・予定の1件ごとの上限
# 節の中のカード（根拠のカード・核心・地域のレガシー・議会の答弁・予定）もリンク元にする
CARD_RE = re.compile(r"^(rev-(?:[a-z]+\d+|[a-z]-[a-z]+\d+|cv\d+|cp\d+)|legacy-[a-z]+|council-[a-z0-9]+|ev-[0-9-]+)$")
MIN_SIM = 0.17
TITLE_WEIGHT = 3

# リンク元にしない節（連絡先・自動で描く一覧・サイトの運営の話）
SKIP_SOURCE = {"contact", "rev-contact", "changelog", "site-updates", "latest", "news",
               "site-card", "toc-section_news", "privacy", "translation", "feedback"}
# リンク先にしない項目（ページの先頭・連絡先・部品の id・自動で描く一覧の器）
SKIP_TARGET_RE = re.compile(r"^(|contact|rev-contact|.*-container|site-updates.*|site-card|latest|news|"
                            r"changelog|privacy|translation|feedback|cal-grid|cal-sub.*|grade-ics|"
                            r"bus-map-layers|toc-section_news|toc-section_links|rev-deep|app|feed|spread|"
                            r"site-intro|operator)$")
# 運営の話のページはリンク先にしない（読者が次に知りたいことではないため）
SKIP_TARGET_PAGES = {"site"}


def load_index(lang):
    with open(os.path.join(SEARCH, lang + ".json"), encoding="utf-8") as f:
        return json.load(f)


def norm(s):
    s = re.sub(r"[\s　、。・「」『』（）()【】〔〕［］\[\]:：;；!！?？,，.．/／\-–—…→←↑↓〜~#＃%％0-9０-９]+", "", s)
    return s


def grams(s):
    s = norm(s)
    return [s[i:i + 2] for i in range(len(s) - 1)]


HEAD_MAX = 42
HEAD_MAX_LATIN = 80
HEAD_MAX_LIMIT = {"ja": HEAD_MAX, "zh": HEAD_MAX, "ko": 50, "ja-kids": 60}
BOILER_PAGES = 3
TARGET_MAX_LEN = 3000


def segs(t):
    """本文を文・語句のまとまりに分ける（定型文を見つけるため）。"""
    return [x for x in (y.strip() for y in re.split(r"[。\s]+", t)) if len(x) >= 4]


def head_of(t, lang="ja"):
    """本文の頭（【事実】・💡・🔎 の札より前、最初の文まで）を短くして見出しの代わりにする。"""
    t = re.split(r"\s*(?:【|💡|🔎|<)", t, maxsplit=1)[0]
    t = re.sub(r"^\s*(?:[0-9]{1,2}[.)]?|[①-⑳])\s+", "", t)
    t = re.split(r"(?<=[。．！？!?])\s*|(?<=[a-z)]\.)\s+", t, maxsplit=1)[0].strip()
    mx = HEAD_MAX_LIMIT.get(lang, HEAD_MAX_LATIN)
    return t if len(t) <= mx else t[:mx - 1].rstrip() + "…"


def clean_head(t, lang):
    t = re.sub(r"^\s*(?:[0-9]{1,2}[.)]?|[①-⑳])\s*", "", t).strip()
    mx = HEAD_MAX_LIMIT.get(lang, HEAD_MAX_LATIN)
    return t if len(t) <= mx else t[:mx - 1].rstrip() + "…"


CARD_HEAD_RE = re.compile(r'<(?:h[3-5]\b[^>]*|[a-z]+\b[^>]*class="[^"]*(?:-h|qa-q)(?:\s[^"]*)?"[^>]*)'
                          r'\sdata-i18n(?:-html)?="([^"]+)"')


def find_card_heads(keys):
    """カード（id を持つ要素）の中で最初の見出し（h3〜h5、または class が …-h / qa-q のもの）のキー。"""
    out = {}
    cache = {}
    for pid, a in keys:
        if not a:
            continue
        if pid not in cache:
            with open(pid + ".html", encoding="utf-8") as f:
                cache[pid] = f.read()
        html_ = cache[pid]
        m = re.search(r'<[a-z]+\b[^>]*\sid="%s"[^>]*>' % re.escape(a), html_)
        if not m:
            continue
        hm = CARD_HEAD_RE.search(html_, m.end(), m.end() + 700)
        if hm:
            out[(pid, a)] = hm.group(1)
    return out


def sources():
    """（ページ, id）の集合：h2 の節と Q&A の1問。"""
    out = set()
    for pid in sorted(bsi_pages()):
        _, keep = bsi.page_records(pid + ".html")
        for r in keep:
            a = r["a"]
            if r.get("sec_id") is not None and r.get("h2key") and a not in SKIP_SOURCE:
                out.add((pid, a))
            elif re.match(r"^(bus-)?faq-q\d+$", a or "") or CARD_RE.match(a or ""):
                out.add((pid, a))
    return out


def bsi_pages():
    import glob
    return [p[:-5] for p in sorted(glob.glob("*.html")) if p not in bsi.SKIP_PAGES]


def build():
    idx = {l: load_index(l) for l in LANGS}
    ja = idx["ja"]["items"]
    # 定型文（書き直しの注記・窓口の部署名・出典の書き方など）は、3ページ以上に出てくる文として外す。
    # 残すと、連絡先や注記を含む節どうしが中身と関係なく似てしまう。
    seg_pages = defaultdict(set)
    for pid, a, h, t in ja:
        for sg in set(segs(t)):
            seg_pages[sg].add(pid)
    boiler = {sg for sg, ps in seg_pages.items() if len(ps) >= BOILER_PAGES}
    vecs = {}
    df = Counter()
    for pid, a, h, t in ja:
        t = " ".join(sg for sg in segs(t) if sg not in boiler)
        c = Counter(grams(h) * TITLE_WEIGHT + grams(t))
        vecs[(pid, a)] = c
        df.update(c.keys())
    n = len(ja)
    idf = {g: math.log((n + 1) / (d + 1)) + 1 for g, d in df.items()}
    W = {}
    for k, c in vecs.items():
        w = {g: (1 + math.log(v)) * idf[g] for g, v in c.items()}
        nm = math.sqrt(sum(x * x for x in w.values())) or 1.0
        W[k] = {g: x / nm for g, x in w.items()}

    def sim(a, b):
        wa, wb = W[a], W[b]
        if len(wa) > len(wb):
            wa, wb = wb, wa
        return sum(x * wb.get(g, 0.0) for g, x in wa.items())

    # 本文がとても長い項目（ページの大半を1つにまとめた節・質問集など）は、何にでも似てしまうのでリンク先にしない
    targets = [(pid, a) for pid, a, h, t in ja
               if pid not in SKIP_TARGET_PAGES and not SKIP_TARGET_RE.match(a) and len(t) <= TARGET_MAX_LEN]
    src = sorted(sources())
    links = defaultdict(dict)
    for s in src:
        if s not in W:
            continue
        cands = sorted(((sim(s, t), t) for t in targets if t[0] != s[0]),
                       key=lambda x: (-round(x[0], 6), x[1]))
        mx = FAQ_MAX if ("faq-q" in s[1] or CARD_RE.match(s[1])) else SEC_MAX
        chosen, pages = [], set()
        for v, t in cands:
            if v < MIN_SIM or len(chosen) >= mx:
                break
            if t[0] in pages:
                continue
            pages.add(t[0])
            chosen.append((t, round(v, 3)))
        if chosen:
            links[s[0]][s[1]] = chosen

    # 言語ごとの見出しとページ名
    # 節の中のカード・予定など（見出しが親の節と同じもの）は、本文の頭を見出しにする
    titles = {}
    labels = {}
    dicts = {l: bsi.load_dict(l) for l in LANGS}
    card_heads = find_card_heads({(pid, a) for pid, a, h, t in ja})
    sec_keys = {k for k in sources() if not re.match(r"^(bus-)?faq-q\d+$", k[1]) and not CARD_RE.match(k[1])}
    sec_keys |= {(pid, a) for pid, a, h, t in ja if a.startswith("toc-") or a == ""}
    for l in LANGS:
        labels[l] = {k: re.sub(r"^[①-⑳]\s*", "", v) for k, v in idx[l]["pages"].items()}
        sec_titles = {(pid, h) for pid, a, h, t in idx[l]["items"] if (pid, a) in sec_keys}
        d = dicts[l]
        for pid, a, h, t in idx[l]["items"]:
            if (pid, a) not in sec_keys and (pid, h) in sec_titles and t:
                k = card_heads.get((pid, a))
                h = clean_head(bsi.plain(d.get(k, "")), l) if k and d.get(k) else head_of(t, l)
            titles.setdefault((pid, a), {})[l] = h
    out = {}
    for pid in sorted(links):
        need_t, need_p = set(), set()
        L = {}
        for a in sorted(links[pid]):
            L[a] = [[t[0], t[1]] for t, _ in links[pid][a]]
            for t, _ in links[pid][a]:
                need_t.add(t); need_p.add(t[0])
        out[pid] = {
            "v": 1,
            "links": L,
            "t": {f"{p}#{a}": {l: titles.get((p, a), {}).get(l, titles.get((p, a), {}).get("ja", ""))
                                for l in LANGS} for p, a in sorted(need_t)},
            "p": {p: {l: labels[l].get(p, p) for l in LANGS} for p in sorted(need_p)},
        }
    return out, links, titles


def dump(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"


def main():
    check = "--check" in sys.argv
    out, links, titles = build()
    if "--show" in sys.argv:
        for pid in sorted(links):
            for a in sorted(links[pid]):
                print(f"{pid}#{a} 「{titles[(pid, a)]['ja'][:30]}」")
                for t, v in links[pid][a]:
                    print(f"    {v:.3f} → {t[0]}#{t[1]} 「{titles[t]['ja'][:40]}」")
        return
    stale = []
    want = {os.path.join(OUT, pid + ".json"): dump(o) for pid, o in out.items()}
    have = {}
    if os.path.isdir(OUT):
        for f in sorted(os.listdir(OUT)):
            if f.endswith(".json"):
                p = os.path.join(OUT, f)
                have[p] = open(p, encoding="utf-8").read()
    for p, s in want.items():
        if have.get(p) != s:
            stale.append(p)
    gone = [p for p in have if p not in want]
    nlinks = sum(len(v) for d in links.values() for v in d.values())
    nsrc = sum(len(d) for d in links.values())
    if check:
        if stale or gone:
            print("NG: 関連リンクが古い。python3 .github/scripts/build_crosslinks.py を実行すること:",
                  ", ".join(stale + gone))
            sys.exit(1)
        print(f"OK: 関連リンクは最新（{nsrc}か所・{nlinks}本）")
        return
    os.makedirs(OUT, exist_ok=True)
    for p in stale:
        with open(p, "w", encoding="utf-8") as f:
            f.write(want[p])
    for p in gone:
        os.remove(p)
    print(f"関連リンク: {nsrc}か所・{nlinks}本（更新 {len(stale)}・削除 {len(gone)} ファイル）")


if __name__ == "__main__":
    main()
