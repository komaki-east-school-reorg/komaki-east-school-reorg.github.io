/* =====================================================================
   ウェブアプリ化（ホーム画面に追加）の service worker（2026-10-17 追加）

   方針（ユーザー決定：オフラインでは「前に見たページだけ読める」）
   - いつもネットの最新を先に取る（network-first）。取れたらキャッシュを上書きする。
     キャッシュを返すのは、つながらないときだけ。古い内容を最新のように見せないため
     （ページ別辞書の「古いものは404より悪い」と同じ考え方）。
     stale-while-revalidate にしないこと — 古い JS と新しい辞書が噛み合わなくなる。
   - 扱うのは、このサイトと同じオリジンの GET だけ。はてなスターや共有先などの
     外部ドメインには一切触れない（外部への通信を増やさない・ほかのサイトを保存しない）。
   - オフラインのとき、ページが前に開いたものであることは、ページ側（js/main.js の
     INSTALL APP）が「オフライン表示中」のバーで断る。
   - 中身の鮮度は network-first が守るので、ふだんは CACHE の版を上げなくてよい。
     このファイルの仕組みを変えたときだけ上げる（activate で古い版を消す）。
   - ページ（navigate）は ?lang= や ?fbclid= などを外した URL で1枚だけ保存する（v2、2026-10-26）。
     URL ごとに保存していたので、共有リンクの付け足し（?fbclid= など）のたびにキャッシュが増え続けた。
     言語は localStorage でも決まり、i18n.js が辞書を当てるので、ページの HTML は1枚で足りる。
     「/」は「/index.html」と同じものとして保存する。
   ===================================================================== */
var CACHE = 'komaki-v2';

// 最初に入れておく最小限（トップを一度も開かずにアプリを入れた人のため）
var PRECACHE = [
  '/index.html',
  '/css/style.css',
  '/js/i18n.js',
  '/js/main.js',
  '/favicon.svg',
  '/data/i18n/pages/index.ja.json'
];

// キャッシュに無いページをオフラインで開いたときの案内（新しいページは増やさない）
var OFFLINE_HTML =
  '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<meta name="robots" content="noindex"><title>オフライン – 学校再編ナビ</title>' +
  '<style>body{margin:0;font-family:sans-serif;background:#2e5c3a;color:#fff;display:flex;' +
  'min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:1.5rem;box-sizing:border-box}' +
  'a{color:#d4aa30;font-weight:700}p{line-height:1.7;max-width:28rem}</style></head><body><div>' +
  '<p>インターネットにつながっていないため、このページを開けません。<br>' +
  '前に開いたことのあるページは、オフラインでも読めます。</p>' +
  '<p lang="en">You are offline. Pages you have opened before can still be read.</p>' +
  '<p><a href="/">トップページ / Top page</a></p></div></body></html>';

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(PRECACHE); })
      .catch(function () {})   // 先に入れられなくても、アプリ化そのものは止めない
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf('komaki-') === 0 && k !== CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // 同じオリジンだけ。外部ドメインはブラウザに任せる（保存もしない）。
  if (url.origin !== self.location.origin) return;
  // sw.js 自身はブラウザの更新確認に任せる
  if (url.pathname === '/sw.js') return;

  var isPage = req.mode === 'navigate';
  // ページの保存キー：検索語を外し、「/」は「/index.html」にそろえる
  var key = req;
  if (isPage) {
    var path = url.pathname.replace(/\/$/, '/index.html');
    key = new Request(url.origin + path);
  }
  e.respondWith(
    fetch(req).then(function (res) {
      // 正常な応答だけ保存する（404 や途中で切れた応答、リダイレクト後の応答は保存しない）
      if (res && res.ok && res.type === 'basic' && !res.redirected) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { return c.put(key, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(key).then(function (hit) {
        if (hit) return hit;
        if (isPage) {
          return new Response(OFFLINE_HTML, {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }
        return Response.error();
      });
    })
  );
});
