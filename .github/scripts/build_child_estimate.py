#!/usr/bin/env python3
"""
東部地域（篠岡地区）の0〜17歳の人数を推定するための係数を data/child_estimate.json に書く。
2026-10-22 追加（ユーザー指示）。トップの「東部地域の0〜17歳（当サイトの推定）」の元。

■ 市サーバへは一切アクセスしない
   fetch_population.py が data/official_pages/population/ に保存した東部の行だけを読む。
   （このため、fetch_population.py の【あと】に実行すること。）

■ 推定のしかた（当サイトの推定であって、市が公表した数ではない）
   1. 年1回の指定区別年齢別男女別人口統計表（10月1日時点）の新しい2時点から、東部の
      0〜17歳 C と総人口 P を出し、子どもの割合 s = C / P とその変化の速さ gs を求める。
   2. 毎月の人口世帯表のいちばん新しい月の東部総人口 Pm に、その月まで延ばした割合を掛ける
      ＝ その月1日の推定値 A。市の毎月の数字に毎月合わせ直すことになる。
   3. その1年前の月の総人口 Py から総人口の変化の速さ gP を求め、A から今日まで
      g = gs + gP の速さで日割りに延ばす（指数）。今日の値はブラウザが計算する：
        推定値 = A × exp(g × (今日 − 基準月の1日)) 〔日数〕
      ワークフローが止まった日も、日付が変われば数字は変わる。

■ 小数第1位まで表示する（2026-10-22 ユーザー指示：毎日必ず数字が切り替わること）
   一の位だと1日の動き（いまは1人未満）で変わらない日が出る。小数第1位で毎日変わるには
   1日の動きが 0.1 人以上要るので、それを下回る係数になったら失敗させる（MIN_DAILY）。
   増減そのものは画面に出さない（同日ユーザー指示）。

  python3 .github/scripts/build_child_estimate.py           # 生成
  python3 .github/scripts/build_child_estimate.py --check   # 古ければ exit 1

終了コード: 0 = 生成した／最新, 1 = 致命的エラー・古い（--check）
"""
import json
import math
import os
import re
import sys
from datetime import date

SRC_DIR = "data/official_pages/population"
OUTPUT = "data/child_estimate.json"
MIN_DAILY = 0.1
# 1日の動きが MIN_DAILY を保つことを、基準月からこの日数先まで確かめる
# （年次表は約5か月遅れで出るので、次の係数に替わるまでの最長に余裕を見た日数）。
HORIZON_DAYS = 550


def read(path):
    """保存ファイルの (ヘッダの dict, 「東部計」の数値の list)。"""
    head, total = {}, None
    with open(path, encoding="utf-8") as f:
        body = False
        for line in f:
            line = line.rstrip("\n")
            if line.startswith("---"):
                body = True
            elif not body and ":" in line:
                k, v = line.split(":", 1)
                head[k.strip()] = v.strip()
            elif body and line.startswith("東部計,"):
                total = [int(x) for x in line.split(",")[1:]]
    if total is None:
        raise RuntimeError(f"{path}: 東部計の行が無い")
    return head, total


def files(prefix):
    out = {}
    for name in sorted(os.listdir(SRC_DIR)):
        m = re.fullmatch(prefix + r"-(\d{4}-\d{2}-\d{2})\.txt", name)
        if m:
            out[date.fromisoformat(m.group(1))] = os.path.join(SRC_DIR, name)
    return out


def build():
    annual = files("shiteiku")
    monthly = files("jinko")
    if len(annual) < 2:
        raise RuntimeError("指定区別年齢別男女別人口統計表が2時点そろっていない")
    if not monthly:
        raise RuntimeError("人口世帯表が無い")

    t0, t1 = sorted(annual)[-2:]
    h0, a0 = read(annual[t0])
    h1, a1 = read(annual[t1])
    c0, p0 = a0[-2], a0[-1]          # 0〜17歳計, 総人口
    c1, p1 = a1[-2], a1[-1]
    gs = math.log((c1 / p1) / (c0 / p0)) / (t1 - t0).days

    tm = max(monthly)
    hm, mm = read(monthly[tm])
    pm = mm[2]                       # 計
    ty = date(tm.year - 1, tm.month, tm.day)
    if ty in monthly:
        hy, my = read(monthly[ty])
        gp = math.log(pm / my[2]) / (tm - ty).days
        gp_from = hy["資料"]
    else:                            # 1年前の月が無いときは年次表2時点の総人口から
        gp = math.log(p1 / p0) / (t1 - t0).days
        gp_from = f"{h0['資料']}・{h1['資料']}"

    g = gs + gp
    a = pm * (c1 / p1) * math.exp(gs * (tm - t1).days)
    worst = a * abs(g) * min(1.0, math.exp(g * HORIZON_DAYS))
    if worst < MIN_DAILY:
        raise RuntimeError(f"1日の動きが {worst:.3f} 人で、小数第1位が変わらない日が出る")

    data = {
        "_comment": "build_child_estimate.py が生成。手編集不可。"
                    "推定値 = base_value × exp(daily_rate × (今日 − base_date の日数))。",
        "area": "東部地域（篠岡地区）",
        "ages": "0〜17歳",
        "base_date": tm.isoformat(),
        "base_value": round(a, 4),
        "daily_rate": round(g, 9),
        "official": {
            "date": t1.isoformat(),
            "children": c1,
            "source": h1["資料"],
        },
        "inputs": {
            "annual": [
                {"date": t0.isoformat(), "children": c0, "population": p0, "source": h0["資料"]},
                {"date": t1.isoformat(), "children": c1, "population": p1, "source": h1["資料"]},
            ],
            "monthly": {"date": tm.isoformat(), "population": pm, "source": hm["資料"]},
            "population_trend_from": gp_from,
        },
    }
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def main():
    try:
        text = build()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    old = open(OUTPUT, encoding="utf-8").read() if os.path.exists(OUTPUT) else None
    if "--check" in sys.argv:
        if old != text:
            print(f"NG: {OUTPUT} が古い。python3 .github/scripts/build_child_estimate.py を実行すること",
                  file=sys.stderr)
            return 1
        print(f"OK: {OUTPUT} は最新")
        return 0
    if old != text:
        with open(OUTPUT, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"更新: {OUTPUT}")
    else:
        print(f"変化なし: {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
