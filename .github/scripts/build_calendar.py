#!/usr/bin/env python3
"""
購読できるカレンダー（calendar.<言語>.ics）を12言語ぶん作る。2026-11-07 ユーザー指示
（日次の新機能アイデア 2026-10-22「購読できるカレンダー（calendar.ics）を自動生成」）。

スマートフォンやパソコンのカレンダーに一度 URL を登録すれば、予定の追加・変更が自動で届く。
schedule.html の「🔔 カレンダーを購読する」から登録する。

中身は画面のカレンダーと同じ：data/events.json に、js/main.js の KomakiTokadaiEvents / KomakiEvents と
同じ選び方・同じ並びで「自動で足す催し」（桃花台を考える会・東部の地域協議会・都市計画の日程）を足したもの。
・UID は画面の「📅 カレンダーに追加」（KomakiIcs.schedule / councilUid）と同じ形にしてある。
  1件ずつ取り込んだ人が購読しても二重にならない。**この形を変えないこと**（js/main.js と同時に直す）。
・1件の書き方も KomakiIcs.entry() と同じ：day:true は終日（until まで）、span:true は期間、
  それ以外（月単位）は公表された時期を期間にして名前に「（日程未定・…）」を付ける。
・出力は入力だけで決まる（DTSTAMP は予定の日付から作る固定値）。終わった予定も消さない。
  そのため auto_gates.py check 25 が --check で古さを止められる。

  python3 .github/scripts/build_calendar.py           # 生成
  python3 .github/scripts/build_calendar.py --check   # 古ければ exit 1
"""
import calendar as _cal
import json
import os
import re
import sys
from datetime import date, datetime, timedelta

HOST = "komaki-east-school-reorg.github.io"
LANGS = ["ja", "en", "pt", "vi", "tl", "es", "zh", "id", "ko", "ne", "tr", "my"]
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# js/main.js KomakiTokadaiEvents と同じ文字列（変えるときは両方）
TAG = {"ja": "（住民有志）", "en": " (resident-run)", "pt": " (iniciativa de moradores)", "vi": " (do người dân tổ chức)", "tl": " (mga residente ang nagpapatakbo)", "es": " (iniciativa vecinal)", "zh": "（居民自发）", "id": " (inisiatif warga)", "ko": "(주민 주도)", "ne": " (बासिन्दा पहल)", "tr": " (bölge sakinleri girişimi)", "my": " (ဒေသခံဦးဆောင်)"}
TAG_COUNCIL = {"ja": "（地域協議会）", "en": " (community council)", "pt": " (conselho comunitário)", "vi": " (hội đồng cộng đồng)", "tl": " (konseho ng komunidad)", "es": " (consejo comunitario)", "zh": "（地区协议会）", "id": " (dewan komunitas)", "ko": "(지역 협의회)", "ne": " (सामुदायिक परिषद्)", "tr": " (bölge konseyi)", "my": " (ဒေသဆိုင်ရာ ကောင်စီ)"}
TAG_TOSHI = {
    "day": {"ja": "（都市計画）", "en": " (city planning)", "pt": " (planejamento urbano)", "vi": " (quy hoạch đô thị)", "tl": " (pagpaplano ng lungsod)", "es": " (planificación urbana)", "zh": "（城市规划）", "id": " (tata kota)", "ko": "(도시계획)", "ne": " (सहरी योजना)", "tr": " (şehir planlaması)", "my": " (မြို့ပြစီမံကိန်း)"},
    "viewing": {"ja": "（都市計画・案の閲覧）", "en": " (city planning: draft open for viewing)", "pt": " (planejamento urbano: consulta à proposta)", "vi": " (quy hoạch đô thị: công khai dự thảo)", "tl": " (pagpaplano ng lungsod: pagtingin sa draft)", "es": " (planificación urbana: consulta del borrador)", "zh": "（城市规划・草案公开查阅）", "id": " (tata kota: draf dapat dilihat)", "ko": "(도시계획・안 열람)", "ne": " (सहरी योजना: मस्यौदा अवलोकन)", "tr": " (şehir planlaması: taslak incelemeye açık)", "my": " (မြို့ပြစီမံကိန်း: မူကြမ်း ကြည့်ရှုခြင်း)"},
    "pubcom": {"ja": "（都市計画・意見募集）", "en": " (city planning: public comments)", "pt": " (planejamento urbano: consulta pública)", "vi": " (quy hoạch đô thị: lấy ý kiến)", "tl": " (pagpaplano ng lungsod: pagtanggap ng opinyon)", "es": " (planificación urbana: consulta pública)", "zh": "（城市规划・征求意见）", "id": " (tata kota: konsultasi publik)", "ko": "(도시계획・의견 모집)", "ne": " (सहरी योजना: राय सङ्कलन)", "tr": " (şehir planlaması: görüş toplama)", "my": " (မြို့ပြစီမံကိန်း: အကြံပြုချက် ကောက်ခံခြင်း)"},
}


def load(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def times(text):
    """KomakiJaWhen.times と同じ読み方（読めなければ None）。"""
    if not text:
        return None
    t = re.sub(r"[０-９]", lambda m: chr(ord(m.group(0)) - 0xFEE0), str(text))
    t = re.sub(r"開場\s*(\d{1,2})時(?:(\d{1,2})分)?", "", t, count=1)
    rm = re.search(r"(\d{1,2})時(?:(\d{1,2})分)?\s*(?:から|[～〜~\-－ー])\s*(\d{1,2})時(?:(\d{1,2})分)?", t)
    if rm:
        return {"sh": int(rm[1]), "sm": int(rm[2] or 0), "eh": int(rm[3]), "em": int(rm[4] or 0)}
    sm = re.search(r"(\d{1,2})時(?:(\d{1,2})分)?", t)
    if sm:
        return {"sh": int(sm[1]), "sm": int(sm[2] or 0), "eh": None, "em": None}
    return None


def council_uid(key, d):
    """KomakiIcs.councilUid と同じハッシュ（JS の charCodeAt＝UTF-16 単位で回す）。"""
    h = 0
    units = key.encode("utf-16-le")
    for i in range(0, len(units), 2):
        h = (h * 31 + int.from_bytes(units[i:i + 2], "little")) & 0xFFFFFFFF
    s, n = "", h
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    while True:
        s = digits[n % 36] + s
        n //= 36
        if n == 0:
            break
    return f"council-{s}-{d}@{HOST}"


def auto_events(hl):
    """KomakiTokadaiEvents().get() と同じ並びの [{key, ev, src}]。"""
    tobu = load("data/tobu_actions.json", {}).get("items", [])
    ce = load("data/community_events.json", {}).get("events", [])
    toshi_ev = load("data/toshikeikaku_east.json", {}).get("events", [])
    srcs = []
    for t in tobu:
        if t.get("organizer") and t.get("kind") == "event" and ISO.match(t.get("date") or ""):
            srcs.append({"title": t["title"], "place": t.get("place") or "", "date_note": t.get("date_note") or "",
                         "date": t["date"], "kind": "tokadai"})
    for e in ce:
        if e.get("shinooka") and ISO.match(e.get("date") or ""):
            srcs.append({"title": e["title"], "place": e.get("place") or "", "date_note": e.get("when") or "",
                         "date": e["date"], "url": e.get("url") or "", "kind": "council"})
    for e in toshi_ev:
        if e.get("role") in TAG_TOSHI and ISO.match(e.get("date") or "") and (e["role"] == "day" or ISO.match(e.get("start") or "")):
            srcs.append({"title": e["title"], "place": "", "date_note": e.get("date_note") or "", "date": e["date"],
                         "start": e.get("start") or "", "role": e["role"], "kind": "toshi"})
    out = []
    for t in srcs:
        tags = TAG_COUNCIL if t["kind"] == "council" else TAG_TOSHI[t["role"]] if t["kind"] == "toshi" else TAG
        ev = {"start": t["start"], "span": True} if (t["kind"] == "toshi" and t["role"] != "day") else {"day": True}
        if t["kind"] != "toshi":
            ev["ics"] = {"times": times(t["date_note"]), "when": t["date_note"], "place": t["place"]}
            if t["kind"] == "council":
                ev["ics"]["uid"] = council_uid(t.get("url") or t["title"], t["date"])
                ev["ics"]["url"] = t.get("url") or ""
        h = hl.get(t["title"]) or {}
        for l in tags:
            ev[l] = (t["title"] if l == "ja" else (h.get(l) or t["title"])) + tags[l]
        out.append({"key": t["date"], "ev": ev, "src": t})
    return out


def names(title):
    t = str(title or "")
    short = re.sub(r"^\S*地域協議会\s+", "", t)
    return [t, short] if short and short != t else [t]


def merged_events():
    """KomakiEvents() と同じ統合。{日付: [予定, …]}（events.json の並びのまま、自動分は後ろ）"""
    base = load("data/events.json", {}).get("events", {})
    hl = load("data/headline_i18n.json", {}).get("items", {})
    events = {k: (list(v) if isinstance(v, list) else [v]) for k, v in base.items()}
    for x in auto_events(hl):
        lst = events.get(x["key"], [])
        ns = names(x["src"]["title"])
        if any(e and e.get("ja") and any(e["ja"].startswith(n) for n in ns) for e in lst):
            continue
        events[x["key"]] = lst + [x["ev"]]
    return events, hl


def period(a, b, lang):
    pa, pb = a.split("-"), b.split("-")
    same_y, same_m = pa[0] == pb[0], pa[0] == pb[0] and pa[1] == pb[1]
    if lang in ("ja", "zh"):
        return pa[0] + "年" + str(int(pa[1])) + "月" + ("" if same_m else "〜" + ("" if same_y else pb[0] + "年") + str(int(pb[1])) + "月")
    if lang == "ko":
        return f"{pa[0]}년 {int(pa[1])}월" + ("" if same_m else f"~{'' if same_y else pb[0] + '년 '}{int(pb[1])}월")
    f = lambda p: f"{int(p[1])}/{p[0]}"
    return f(pa) if same_m else f(pa) + " – " + f(pb)


def month_end(k):
    y, m = int(k[:4]), int(k[5:7])
    return f"{y:04d}-{m:02d}-{_cal.monthrange(y, m)[1]:02d}"


def esc(v):
    return str(v).replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n").replace("\r", "\\n")


def fold(line):
    out, n = "", 0
    for ch in line:
        b = len(ch.encode("utf-8"))
        if n + b > 73:
            out += "\r\n "
            n = 1
        out += ch
        n += b
    return out


def ymd(d):
    return d.replace("-", "")


def next_day(d):
    return (date.fromisoformat(d) + timedelta(days=1)).strftime("%Y%m%d")


def jst_utc(d, h, m):
    t = datetime.fromisoformat(d) + timedelta(minutes=h * 60 + m - 9 * 60)
    return t.strftime("%Y%m%dT%H%M%SZ")


def dict_strings(lang):
    ja = load("data/i18n/ja.json", {})
    en = load("data/i18n/en.json", {})
    d = load(f"data/i18n/{lang}.json", {}) if lang != "ja" else ja
    merged = ja if lang == "ja" else {**en, **d}
    g = lambda k, fb: merged.get(k) or fb
    return {
        "calname": g("grade_ics_calname", "小牧市東部 学校再編の予定"),
        "desc": g("grade_ics_desc", ""),
        "tbd": g("ics_tbd", "（日程未定・{p}）"),
        "tbd_desc": g("ics_tbd_desc", ""),
    }


def build(lang, events, hl):
    S = dict_strings(lang)
    url = f"https://{HOST}/schedule.html" + ("" if lang == "ja" else f"?lang={lang}")
    L = ["BEGIN:VCALENDAR", "VERSION:2.0",
         f"PRODID:-//komaki-east-school-reorg//subscribe//{lang.upper()}",
         "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
         fold("X-WR-CALNAME:" + esc(S["calname"])), "X-WR-TIMEZONE:Asia/Tokyo",
         "REFRESH-INTERVAL;VALUE=DURATION:P1D", "X-PUBLISHED-TTL:P1D"]
    for key in sorted(events):
        for idx, ev in enumerate(events[key]):
            label = ev.get(lang) or ev.get("en") or ev.get("ja") or ""
            e = {"uid": f"{key}{'-' + str(idx + 1) if idx else ''}-komaki-saihen@{HOST}",
                 "date": key, "end": None, "summary": label, "desc": S["desc"], "url": url,
                 "times": None, "location": ""}
            if ev.get("day") is True:
                if ev.get("until"):
                    e["end"] = ev["until"]
            else:
                start = ev.get("start") or key[:8] + "01"
                end = key if ev.get("start") else month_end(key)
                e["date"], e["end"] = start, end
                if ev.get("span") is not True:
                    p = period(start, end, lang)
                    e["summary"] += S["tbd"].replace("{p}", p)
                    e["desc"] = S["tbd_desc"].replace("{p}", p) + "\n" + e["desc"]
            x = ev.get("ics")
            if x:
                if x.get("uid"):
                    e["uid"] = x["uid"]
                if x.get("times"):
                    e["times"] = x["times"]
                if x.get("when"):
                    e["desc"] += "\n" + x["when"]
                if x.get("place"):
                    pl = x["place"]
                    e["location"] = pl if lang == "ja" else ((hl.get(pl) or {}).get(lang) or pl)
                if x.get("url"):
                    e["url"] = x["url"]
            L.append("BEGIN:VEVENT")
            L.append("UID:" + e["uid"])
            L.append("DTSTAMP:" + ymd(key) + "T000000Z")
            tm = e["times"]
            if tm:
                L.append("DTSTART:" + jst_utc(e["date"], tm["sh"], tm["sm"]))
                if tm["eh"] is not None:
                    over = tm["eh"] * 60 + tm["em"] <= tm["sh"] * 60 + tm["sm"]
                    dd = (date.fromisoformat(e["date"]) + timedelta(days=1)).isoformat() if over else e["date"]
                    L.append("DTEND:" + jst_utc(dd, tm["eh"], tm["em"]))
            else:
                L.append("DTSTART;VALUE=DATE:" + ymd(e["date"]))
                L.append("DTEND;VALUE=DATE:" + next_day(e["end"] or e["date"]))
            L.append(fold("SUMMARY:" + esc(e["summary"])))
            if e["desc"]:
                L.append(fold("DESCRIPTION:" + esc(e["desc"])))
            if e["location"]:
                L.append(fold("LOCATION:" + esc(e["location"])))
            if e["url"]:
                L.append(fold("URL:" + re.sub(r"[\r\n]", "", e["url"])))
            L.append("END:VEVENT")
    L.append("END:VCALENDAR")
    return "\r\n".join(L) + "\r\n"


def main():
    check = "--check" in sys.argv
    events, hl = merged_events()
    stale = []
    for lang in LANGS:
        path = f"calendar.{lang}.ics"
        new = build(lang, events, hl)
        old = open(path, encoding="utf-8", newline="").read() if os.path.exists(path) else ""
        if new != old:
            if check:
                stale.append(path)
            else:
                with open(path, "w", encoding="utf-8", newline="") as f:
                    f.write(new)
                print(f"wrote {path}")
    if check:
        if stale:
            print("購読カレンダーが古い: " + ", ".join(stale) + "（python3 .github/scripts/build_calendar.py を実行）", file=sys.stderr)
            sys.exit(1)
        print("購読カレンダーは最新")


if __name__ == "__main__":
    main()
