#!/usr/bin/env python3
"""
サイトに載せている担当部署の連絡先（data/contacts.json）を、出所の公表ページと突き合わせる。

■ なぜ機械で見張るか
   連絡先は組織改編でだまって変わる（小牧市・愛知県とも4月1日付が多い）。
   古い番号を載せたままにすると、読者が「市に聞いてみよう」と思った一度きりの
   機会をつぶしてしまう。ページの見た目は何も壊れないので、人の目では気づけない。

■ 取り方
   市サイトは WAF 配下なので fetch_news.py の curl 実装をそのまま使う。
   県・文科省も同じ関数で取る（3〜5秒あけて1ページずつ）。

■ 照合のしかた（probe.kind）
   article_contact : 「この記事に関するお問い合わせ先」の下の 部署名／所在地／
                     電話番号：…　ファクス番号：… を読む（市の記事ページの定型）。
   kakari          : 係の一覧表。係名の行を見つけ、その下の「電話番号」「所在地」を読む。
   pref_group      : 愛知県の「連絡先」欄。グループ名の行の下の Tel：／Fax：を読む。
   text            : 部署名（空白を除いた形）がページ本文にあるかだけを見る。
                     文科省は部署名しか載せていないページがあるため。

■ --fix でできること／できないこと
   できる   : 電話番号・FAX番号の差し替え（*.html と data/i18n/*.json の中の
              「0568-39-5261」形と tel: 用の数字だけの形を両方置き換え、
              data/contacts.json 自身も更新する）。番号は翻訳されないので機械で直せる。
   できない : 部署名・所在地の変更。部署名は10言語＋こどもむけに訳してあるので、
              人（またはAI）が文面を書き直す必要がある。報告だけして直さない。

終了コード: 0 = 全件一致（または取得できず様子見）, 3 = 食い違いあり, 1 = 致命的エラー
"""
import argparse
import glob
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_news as F   # noqa: E402  （curl 取得・polite_wait を共有する）

MANIFEST = "data/contacts.json"
# 番号を書き換えてよいファイル。部署名は翻訳されるので辞書も対象に含める。
FIX_GLOBS = ("*.html", "data/i18n/*.json")
TEL_RE = re.compile(r"0\d{1,4}-\d{1,4}-\d{3,4}")


def to_lines(page_html):
    """タグを落として、読者が目にする行の並びにする（fetch_news と同じ考え方）。"""
    s = re.sub(r"(?s)<(script|style).*?</\1>", "", page_html)
    s = re.sub(r"(?s)<[^>]+>", "\n", s)
    s = html.unescape(s)
    return [l.strip() for l in s.split("\n") if l.strip()]


def norm(s):
    """部署名の比較用。全角・半角の空白と記号ゆれを吸収する。"""
    return re.sub(r"[\s　]+", "", str(s or "")).replace("／", "/")


def probe_article_contact(lines):
    """「この記事に関するお問い合わせ先」ブロックを読む。"""
    for i, l in enumerate(lines):
        if "この記事に関するお問い合わせ先" in l:
            block = lines[i + 1:i + 8]
            found = {"name": block[0] if block else ""}
            for b in block:
                if "階" in b or "庁舎" in b:
                    found.setdefault("location", b)
                m = re.search(r"電話番号：\s*([0-9-]+)", b)
                if m:
                    found["tel"] = m.group(1)
                m = re.search(r"ファクス番号：\s*([0-9-]+)", b)
                if m:
                    found["fax"] = m.group(1)
            return found
    return None


def probe_kakari(lines, label):
    """係の一覧表（係名 → 電話番号 → 所在地）を読む。

    係名はページ上部の目次リンクにも出るので、「次の行が『電話番号』である」ものだけを
    本文の表とみなす。目次のほうを拾うと、隣の係の番号を読んでしまう。
    """
    for i, l in enumerate(lines):
        if l != label or lines[i + 1:i + 2] != ["電話番号"]:
            continue
        found = {"name": label}
        window = lines[i + 1:i + 8]
        for j, b in enumerate(window):
            if b == "電話番号" and j + 1 < len(window):
                found.setdefault("tel", window[j + 1])
            if b == "所在地" and j + 1 < len(window):
                found.setdefault("location", window[j + 1])
        if "tel" in found:
            return found
    return None


def probe_pref_group(lines, label):
    """愛知県の「連絡先」欄（グループ名 → Tel：／Fax：）を読む。"""
    for i, l in enumerate(lines):
        if l == label:
            found = {"name": label}
            for b in lines[i + 1:i + 9]:
                m = re.match(r"Tel[：:]\s*([0-9-]+)", b)
                if m and "tel" not in found:
                    found["tel"] = m.group(1)
                m = re.match(r"Fax[：:]\s*([0-9-]+)", b)
                if m and "fax" not in found:
                    found["fax"] = m.group(1)
            if "tel" in found:
                return found
    return None


def check_one(entry, lines):
    """(差分のリスト, 見つかった値) を返す。見つけられなければ (None, None)。"""
    kind = entry.get("probe", {}).get("kind", "text")
    if kind == "article_contact":
        found = probe_article_contact(lines)
    elif kind == "kakari":
        found = probe_kakari(lines, entry["probe"]["label"])
    elif kind == "pref_group":
        found = probe_pref_group(lines, entry["probe"]["label"])
    else:
        # ページ本文に「その名前」と「その番号」があるかだけを見る。
        # probe.match があればそちらを探す（サイトの表示名と、ページ上の書き方が
        # 違うことがある。例: 表示は「あおい交通株式会社 野口営業所」、ページは「野口営業所」）。
        text = norm("".join(lines))
        needle = entry["probe"].get("match", entry["name"])
        found = {"name": entry["name"] if norm(needle) in text else "(見つからない)"}
        # 電話番号は「(0568) 79-6464」のような書き方もあるので、括弧・空白・
        # ハイフンを落とした数字の並びで照合する。
        flat = re.sub(r"[()（）\s\-‐-―ー]", "", "".join(lines))
        if entry["probe"].get("check_tel") and entry.get("tel"):
            digits = entry["tel"].replace("-", "")
            found["tel"] = entry["tel"] if digits in flat else "(見つからない)"
    if not found:
        return None, None

    diffs = []
    if kind != "kakari" and kind != "pref_group":
        # 係・グループの照合は係名そのものを鍵にしているので、名前の比較は行わない
        if norm(found.get("name")) != norm(entry["name"]):
            diffs.append(("name", entry["name"], found.get("name")))
    for field in ("tel", "fax", "location"):
        want = entry.get(field)
        got = found.get(field)
        if want and got and norm(want) != norm(got):
            diffs.append((field, want, got))
        elif want and got is None and kind != "text":
            diffs.append((field, want, "(ページに見当たらない)"))
    return diffs, found


def apply_number_fix(old, new):
    """番号の置き換え。表示用（ハイフンあり）と tel: 用（数字だけ）の両方。"""
    changed = []
    pairs = [(old, new), (old.replace("-", ""), new.replace("-", ""))]
    for pattern in FIX_GLOBS:
        for path in sorted(glob.glob(pattern)):
            with open(path, encoding="utf-8") as f:
                text = f.read()
            out = text
            for a, b in pairs:
                out = out.replace(a, b)
            if out != text:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(out)
                changed.append(path)
    return changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fix", action="store_true",
                    help="電話・FAX番号の変更をサイト側にも反映する（部署名は直さない）")
    ap.add_argument("--report", help="報告文（Markdown）の書き出し先")
    args = ap.parse_args()

    try:
        with open(MANIFEST, encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"ERROR: {MANIFEST} が読めない: {e}", file=sys.stderr)
        return 1

    entries = data.get("contacts", [])
    if not entries:
        print(f"ERROR: {MANIFEST} に contacts がない", file=sys.stderr)
        return 1

    # 同じページを2度取りに行かない
    cache = {}
    report = []
    problems = 0
    fixed_files = set()

    for entry in entries:
        url = entry["source"]
        if url not in cache:
            F.polite_wait()
            try:
                cache[url] = to_lines(F.fetch_html(url))
            except Exception as e:
                cache[url] = None
                print(f"  WARN 取得できない {url}: {e}", file=sys.stderr)
        lines = cache[url]
        if lines is None:
            report.append(f"- ⚠️ {entry['id']}：出所ページを取得できませんでした（{url}）")
            continue

        diffs, found = check_one(entry, lines)
        if diffs is None:
            problems += 1
            report.append(
                f"- ❓ **{entry['id']}**：出所ページで連絡先の欄を見つけられませんでした"
                f"（ページの構成が変わった可能性）\n  - 出所: {url}")
            continue
        if not diffs:
            print(f"  OK   {entry['id']}")
            continue

        problems += 1
        lines_out = [f"- ⚠️ **{entry['id']}**（{entry['name']}）"]
        for field, want, got in diffs:
            lines_out.append(f"  - {field}: 掲載中「{want}」 → 公表ページ「{got}」")
            if args.fix and field in ("tel", "fax") and TEL_RE.fullmatch(str(got or "")):
                touched = apply_number_fix(want, got)
                entry[field] = got
                fixed_files.update(touched)
                lines_out.append(f"    - 自動修正しました（{len(touched)}ファイル）")
            elif field in ("name", "location"):
                lines_out.append("    - 部署名・所在地は翻訳があるため自動修正しません（手で直してください）")
        lines_out.append(f"  - 出所: {url}")
        lines_out.append(f"  - 掲載ページ: {', '.join(entry.get('shown_in', []))}")
        report.append("\n".join(lines_out))
        print(f"  DIFF {entry['id']}")

    if args.fix and fixed_files:
        with open(MANIFEST, "w", encoding="utf-8") as f:
            f.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
        print("修正したファイル: " + ", ".join(sorted(fixed_files) + [MANIFEST]))

    body = ""
    if report:
        body = ("担当部署の連絡先と公表ページの照合で、確認が必要な箇所が見つかりました。\n\n"
                + "\n".join(report)
                + "\n\n出所ページの表示が変わっただけのこともあります。"
                  "実際に変わっていた場合は、番号は自動修正されていることがありますが、"
                  "部署名・所在地は data/contacts.json と掲載ページ・data/i18n/*.json を"
                  "手で直してください（部署名は10言語＋こどもむけに訳してあります）。\n")
        if args.report:
            with open(args.report, "w", encoding="utf-8") as f:
                f.write(body)
        print(body)

    if problems:
        print(f"食い違い {problems} 件")
        return 3
    print(f"すべて一致（{len(entries)}件）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
