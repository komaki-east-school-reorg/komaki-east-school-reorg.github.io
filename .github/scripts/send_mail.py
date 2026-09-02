#!/usr/bin/env python3
"""件名と本文ファイルを受け取ってメールを1通送る。

環境変数（GitHub Actions の Secrets から渡す）:
  SMTP_HOST  必須  例 smtp.gmail.com
  SMTP_PORT  任意  既定 587。465 なら SMTP_SSL、それ以外は STARTTLS
  SMTP_USER  必須  SMTP の認証ユーザ（多くの場合そのまま差出人）
  SMTP_PASS  必須  アプリパスワード等
  MAIL_TO    任意  宛先。**1件だけ**。未指定なら SMTP_USER（＝自分宛て）
  MAIL_FROM  任意  差出人。未指定なら SMTP_USER

宛先は1件に限る。このリポジトリは公開なので、宛先のアドレスはコードにも
ワークフローにも書かない（Secrets に置くか、SMTP_USER と同じにする）。
カンマ区切りで複数渡されたら送らずに失敗する — 「自分宛ての通知」が
いつのまにか同報配信になっている、という事故を機械で止めるため。

終了コード:
  0 = 送信した
  2 = 設定が無い（未設定は異常ではない。呼び出し側は別の通知手段に切り替える）
  1 = 設定はあるが送信に失敗した
"""
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import formatdate


def main():
    args = sys.argv[1:]
    subject = body_path = None
    while args:
        a = args.pop(0)
        if a == "--subject":
            subject = args.pop(0)
        elif a == "--body-file":
            body_path = args.pop(0)
        else:
            print("不明な引数: %s" % a, file=sys.stderr)
            return 1
    if not subject or not body_path:
        print("使い方: send_mail.py --subject <件名> --body-file <本文ファイル>", file=sys.stderr)
        return 1

    host = os.environ.get("SMTP_HOST", "").strip()
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASS", "")
    # 宛先が空なら自分宛て（SMTP_USER）。公開リポジトリにアドレスを書かずに済む。
    to = [x.strip() for x in os.environ.get("MAIL_TO", "").split(",") if x.strip()]
    if not to and user:
        to = [user]
    if not (host and user and password and to):
        print("SMTP の設定が無いためメールは送りません（SMTP_HOST/SMTP_USER/SMTP_PASS）")
        return 2
    if len(to) > 1:
        print("宛先は1件だけにしてください（MAIL_TO に %d 件）" % len(to), file=sys.stderr)
        return 1

    port = int(os.environ.get("SMTP_PORT", "587") or "587")
    sender = os.environ.get("MAIL_FROM", "").strip() or user

    with open(body_path, encoding="utf-8") as f:
        body = f.read()

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to[0]
    msg["Date"] = formatdate(localtime=True)
    msg.set_content(body)

    ctx = ssl.create_default_context()
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=ctx, timeout=30) as s:
                s.login(user, password)
                s.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as s:
                s.ehlo()
                s.starttls(context=ctx)
                s.ehlo()
                s.login(user, password)
                s.send_message(msg)
    except Exception as e:
        # 認証情報そのものは絶対に出さない（ログは公開されうる）
        print("メール送信に失敗: %s: %s" % (type(e).__name__, e), file=sys.stderr)
        return 1

    print("メールを送信しました → %s" % to[0])
    return 0


if __name__ == "__main__":
    sys.exit(main())
