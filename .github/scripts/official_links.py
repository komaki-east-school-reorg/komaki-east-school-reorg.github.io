#!/usr/bin/env python3
"""
自動取得の一覧の見出しから公式ページへ張る直リンクの許可範囲（2026-11-27 ユーザー指示）。

地域協議会のイベント・東部まちづくりの動き・都市計画の動き（東部地域）・小牧市のほかの地区・
春日井市の一覧は、見出しから元の公式ページ（HTML だけ）へ直接リンクする。URL は自動生成の
JSON の "url" にだけ置き、HTML・辞書・js/main.js には書かない。PDF へは今までどおり張らない。

生成スクリプトはここの article_url() を通した URL だけを書き、auto_gates.py check 6b は
同じ ARTICLE_SCOPES で「そのファイルの中では、その配下の .html だけ」を確かめる。
範囲を変えるときは CLAUDE.md・CONTRIBUTING.txt 規則1・README.md も一緒に直すこと。
"""
import re

CITY = "www.city.komaki.aichi.jp"
KASUGAI = "www.city.kasugai.lg.jp"

# ファイル → (ホスト, 許すパスの接頭辞)
ARTICLE_SCOPES = {
    "data/community_events.json": (CITY, "/admin/soshiki/kenkouikigai/sasaeai/3/3_2/"),
    "data/tobu_actions.json": (CITY, "/admin/soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/"),
    "data/toshikeikaku_east.json": (CITY, "/admin/soshiki/toshiseisakubu/toshikeikaku/1/"),
    "data/nearby_komaki.json": (CITY, "/admin/soshiki/kyoiku/kyouikusoumu/303/719/"),
    "data/kasugai_reorg.json": (KASUGAI, "/kosodate/kyouiku/school/1009208/"),
}

_URL_RE = re.compile(r"^https://([^/?#]+)(/[^?#\s\"'<>]*)$")


def in_scope(url, output):
    """url が output（data/…json）に書いてよい公式ページなら True。"""
    host, prefix = ARTICLE_SCOPES[output]
    m = _URL_RE.match(url or "")
    if not m or m.group(1).lower() != host:
        return False
    path = m.group(2)
    return path.startswith(prefix) and path.endswith(".html") and ".." not in path


def article_url(url, output):
    """許可範囲の URL ならそのまま、そうでなければ None（JSON に書かない）。"""
    url = (url or "").strip()
    return url if in_scope(url, output) else None
