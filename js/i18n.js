/* ===== i18n: Multi-language support ===== */
(function () {
  'use strict';

  var LANGS = ['ja', 'en', 'pt', 'vi', 'tl', 'es', 'zh', 'id', 'ko', 'ne', 'tr', 'my'];
  var DEFAULT = 'ja';
  var BRIDGE = 'en';   // 未翻訳キーの中継言語。ja へ直接落とさず英語を挟む
  // 全キーが揃っていない言語。ページ上部に「一部は英語表示」の断りを出す。
  // 2026-08-13 に tr / my、2026-09-18 に ko / ne が全キー揃ったため空にした。
  // 新しく部分翻訳の言語を足したときだけ、ここにコードを入れる。
  var PARTIAL = [];
  var BASE = './data/i18n/';
  var PAGE_BASE = BASE + 'pages/';
  var SAFETY_MS = 1000;

  // ページID（ファイル名から .html を除いたもの）。meta_title_<ページID> の組み立てと、
  // ページ別辞書の取得の両方で使う。
  var PAGE_ID = (window.location.pathname.match(/([^/]+)\.html$/) || ['', 'index'])[1] || 'index';

  // ===== 第1期再編の実施後への文面切替 =====
  // 「<キー>__after」を用意しておくと、このフラグが true のときだけ
  // そのキーの値が採用される。実施後に「これから開校します」と言い続ける
  // 状態を防ぐための仕組み。__after が無いキーは何も起きない。
  //
  // ★ 日付では切り替えない。第1期再編の実施日は未確定であり、勝手に
  //   日付で切り替えると「実施予定日が過ぎただけで未実施」の期間に
  //   誤った既成事実を掲載してしまうため。
  //   市の公式発表で実施が確認でき、サイト管理者の指示があったときに
  //   だけ、この定数を true にする（切替はこの1行だけ）。
  //   自動更新パイプラインは js/ を編集できないので誤って倒すことはない。
  var PHASE1_DONE = false;
  var AFTER_SUFFIX = '__after';

  function applyTemporal(dict) {
    if (!PHASE1_DONE) return dict;
    Object.keys(dict).forEach(function (k) {
      if (k.slice(-AFTER_SUFFIX.length) !== AFTER_SUFFIX) return;
      var base = k.slice(0, -AFTER_SUFFIX.length);
      if (dict[base] != null) dict[base] = dict[k];
    });
    return dict;
  }

  var _safetyTimer = null;
  var _currentLang = DEFAULT;
  var _kidsMode = false;

  // ===== 言語つき URL（?lang=xx） =====
  // 言語の選択を localStorage だけに持たせていたため、どの言語で読んでも URL が
  // 同じという状態だった。そのため
  //   (1) 「ポルトガル語で読めるページ」を保護者同士で共有できない
  //   (2) hreflang が 11 言語すべて同一 URL を指す（検索エンジンにとっては誤り）
  // の 2 つが起きていた。既定言語 ja は素の URL、それ以外は ?lang=xx を正規 URL とする。
  var LANG_PARAM = 'lang';

  // 静的 HTML に書かれた canonical を言語別 URL の土台にする。
  // window.location から作ると「/」と「/index.html」で正規 URL が割れるため。
  var _canonicalBase = (function () {
    var el = document.querySelector('link[rel="canonical"]');
    var href = el && el.getAttribute('href');
    return href || window.location.href.split('?')[0].split('#')[0];
  })();

  // ===== 初めて開いた人の言語をブラウザ設定から選ぶ（2026-09-14） =====
  // 検索などから直接来た日本語以外の読者は、これまで必ず日本語表示から始まり、
  // 言語の切り替えに気づかないと訳を一度も見ないまま帰っていた。
  // URL に ?lang= が無く、この端末で一度も言語を選んでいない（localStorage が空の）
  // ときだけ、navigator.languages を上から見て、対応10言語に当たった最初のものを使う。
  //   ・日本語が先に当たれば何もしない（既定の日本語のまま）。
  //   ・判定した言語は、ここで同期的に URL の ?lang= に書き込む（履歴は増やさない）。
  //     js/main.js は window.KomakiLang() で「?lang= → localStorage」の順に言語を読んで
  //     すぐ描画を始めるので、URL に載せておかないと本文とコーナーの言語が食い違う。
  //   ・検索ロボットや自動ツールでは判定しない。ロボットのブラウザ言語はたいてい英語で、
  //     判定に通すと日本語ページが英語として登録されてしまうため。
  //   ・自動で切り替えたときだけ、ヘッダ直下に「日本語で見る」を添えた1行の案内を出す
  //     （英語設定のスマホを使う日本語話者が、ワンタップで戻れるように）。
  var _autoLang = null;
  (function detectFirstVisitLang() {
    try {
      var q = new URLSearchParams(window.location.search).get(LANG_PARAM);
      if (q) return;
      if (localStorage.getItem('komaki_lang')) return;
      if (navigator.webdriver) return;
      if (/bot|crawl|spider|slurp|lighthouse|headless|inspectiontool|facebookexternalhit|bingpreview|embedly|preview/i.test(navigator.userAgent || '')) return;
      var prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
      var hit = null;
      for (var i = 0; i < prefs.length && !hit; i++) {
        var base = String(prefs[i] || '').toLowerCase().split('-')[0];
        if (base === 'fil') base = 'tl';
        if (LANGS.indexOf(base) !== -1) hit = base;
      }
      if (!hit || hit === DEFAULT) return;
      var u = new URL(window.location.href);
      u.searchParams.set(LANG_PARAM, hit);
      window.history.replaceState(null, '', u.href);
      _autoLang = hit;
    } catch (e) {}
  })();

  var AUTO_MSG = {
    en: 'Showing this page in English, based on your browser settings.',
    pt: 'Esta página está em português, conforme as configurações do seu navegador.',
    vi: 'Trang này đang hiển thị bằng tiếng Việt theo cài đặt trình duyệt của bạn.',
    tl: 'Ipinapakita ang pahinang ito sa Filipino, ayon sa setting ng iyong browser.',
    es: 'Esta página se muestra en español según la configuración de su navegador.',
    zh: '已根据您的浏览器设置，以中文显示本页。',
    id: 'Halaman ini ditampilkan dalam bahasa Indonesia sesuai pengaturan browser Anda.',
    ko: '브라우저 설정에 따라 이 페이지를 한국어로 표시하고 있습니다.',
    ne: 'तपाईंको ब्राउजर सेटिङअनुसार यो पृष्ठ नेपालीमा देखाइएको छ।',
    tr: 'Bu sayfa, tarayıcı ayarlarınıza göre Türkçe gösteriliyor.',
    my: 'သင့်ဘရောက်ဇာ ဆက်တင်အရ ဤစာမျက်နှာကို မြန်မာဘာသာဖြင့် ပြသထားသည်။'
  };
  var AUTO_CLOSE = {en: 'Close', pt: 'Fechar', vi: 'Đóng', tl: 'Isara', es: 'Cerrar', zh: '关闭', id: 'Tutup', ko: '닫기', ne: 'बन्द गर्नुहोस्', tr: 'Kapat', my: 'ပိတ်ရန်'};

  function showAutoLangNotice(lang) {
    if (!_autoLang || lang !== _autoLang || document.getElementById('i18n-auto-notice')) return;
    var el = document.createElement('div');
    el.id = 'i18n-auto-notice';
    el.className = 'partial-notice auto-lang-notice';
    el.setAttribute('role', 'status');
    var msg = document.createElement('span');
    msg.textContent = '🌐 ' + (AUTO_MSG[lang] || AUTO_MSG.en) + ' ';
    msg.setAttribute('lang', lang);
    var ja = document.createElement('a');
    ja.href = seoUrlForLang(DEFAULT).split('#')[0];
    ja.lang = 'ja';
    ja.textContent = '日本語で見る';
    ja.addEventListener('click', function (ev) {
      ev.preventDefault();
      try { localStorage.setItem('komaki_lang', DEFAULT); } catch (e) {}
      try {
        var u = new URL(window.location.href);
        u.searchParams.delete(LANG_PARAM);
        window.location.replace(u.href);
      } catch (e) { loadAndApply(DEFAULT); }
    });
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'auto-lang-close';
    close.setAttribute('aria-label', AUTO_CLOSE[lang] || AUTO_CLOSE.en);
    close.textContent = '×';
    close.addEventListener('click', function () { el.remove(); });
    el.appendChild(msg);
    el.appendChild(ja);
    el.appendChild(close);
    var header = document.querySelector('header');
    if (header && header.parentNode) header.parentNode.insertBefore(el, header.nextSibling);
    else document.body.insertBefore(el, document.body.firstChild);
  }

  function langFromUrl() {
    try {
      var v = new URLSearchParams(window.location.search).get(LANG_PARAM);
      return LANGS.indexOf(v) !== -1 ? v : null;
    } catch (e) { return null; }
  }

  function seoUrlForLang(lang) {
    if (lang === DEFAULT) return _canonicalBase;
    return _canonicalBase + (_canonicalBase.indexOf('?') === -1 ? '?' : '&') + LANG_PARAM + '=' + lang;
  }

  // アドレスバーの URL を選択中の言語に合わせる。履歴は増やさない
  // （戻るボタンで言語だけが巻き戻るのは分かりにくいため replaceState）。
  function syncUrl(lang) {
    try {
      var u = new URL(window.location.href);
      if (lang === DEFAULT) u.searchParams.delete(LANG_PARAM);
      else u.searchParams.set(LANG_PARAM, lang);
      if (u.href !== window.location.href) window.history.replaceState(null, '', u.href);
    } catch (e) {}
  }

  function updateSeoUrls(lang) {
    var href = seoUrlForLang(lang);
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', href);
    var ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', href);
  }

  function showPage() {
    clearTimeout(_safetyTimer);
    document.documentElement.classList.add('i18n-ready');
  }

  function applyDict(dict, lang) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.dataset.i18n;
      if (dict[key] != null) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.dataset.i18nHtml;
      if (dict[key] != null) el.innerHTML = dict[key];
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var key = el.dataset.i18nAria;
      if (dict[key] != null) el.setAttribute('aria-label', dict[key]);
    });
    document.querySelectorAll('.lang-select').forEach(function (sel) {
      sel.value = lang;
    });

    var langAttr = { ja: 'ja', en: 'en', pt: 'pt-BR', vi: 'vi', tl: 'tl', es: 'es-419', zh: 'zh-Hans', id: 'id', ko: 'ko', ne: 'ne', tr: 'tr', my: 'my' };
    document.documentElement.lang = langAttr[lang] || lang;

    var pageId = PAGE_ID;
    var titleKey = 'meta_title_' + pageId;
    var descKey  = 'meta_desc_'  + pageId;
    if (dict[titleKey]) {
      document.title = dict[titleKey];
      ['meta[property="og:title"]', 'meta[name="twitter:title"]'].forEach(function (sel) {
        var el = document.querySelector(sel);
        if (el) el.setAttribute('content', dict[titleKey]);
      });
    }
    if (dict[descKey]) {
      ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]'].forEach(function (sel) {
        var el = document.querySelector(sel);
        if (el) el.setAttribute('content', dict[descKey]);
      });
    }

    updatePartialNotice(lang);
    showAutoLangNotice(lang);
    applyFaqJsonLd(dict, pageId, lang);
    syncUrl(lang);
    updateSeoUrls(lang);

    try { localStorage.setItem('komaki_lang', lang); } catch (e) {}
    showPage();

    // 辞書を流し込み終えた合図。data-i18n-html の要素は中身ごと作り直されるので、
    // 本文の DOM を掴んでいる処理（js/main.js の READ ALOUD など）はこれを見て手を離す。
    // 言語の切り替えはページの読み直しになるが、こどもむけの切り替えはここを通る。
    try { document.dispatchEvent(new CustomEvent('komaki:i18n-applied', { detail: { lang: lang } })); } catch (e) {}
  }

  // ===== FAQ ページの構造化データ（schema.org FAQPage） =====
  // faq.html に静的に書き写すと data/i18n/*.json との二重管理になり、
  // 片方だけ直したときに黙って食い違う。表示中の辞書からその場で組み立てて、
  // 情報源を data/i18n/ 一本に保つ。表示している言語のまま出力する。
  function stripTags(html) {
    var d = document.createElement('div');
    d.innerHTML = String(html);
    return d.textContent.replace(/\s+/g, ' ').trim();
  }

  function applyFaqJsonLd(dict, pageId, lang) {
    var existing = document.getElementById('faq-jsonld');
    if (pageId !== 'faq') { if (existing) existing.remove(); return; }

    var items = [];
    for (var i = 1; dict['faq_q' + i] != null && dict['faq_a' + i] != null; i++) {
      var q = stripTags(dict['faq_q' + i]);
      var a = stripTags(dict['faq_a' + i]);
      if (!q || !a) continue;
      items.push({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a }
      });
    }
    if (!items.length) { if (existing) existing.remove(); return; }

    var langAttrMap = { ja: 'ja', en: 'en', pt: 'pt-BR', vi: 'vi', tl: 'tl', es: 'es-419', zh: 'zh-Hans', id: 'id', ko: 'ko', ne: 'ne', tr: 'tr', my: 'my' };
    var payload = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: langAttrMap[lang] || lang,
      mainEntity: items
    };

    var el = existing;
    if (!el) {
      el = document.createElement('script');
      el.id = 'faq-jsonld';
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(payload);
  }

  function applyKidsSeoMeta(isKids) {
    var existing = document.getElementById('kids-robots-meta');
    if (isKids) {
      if (!existing) {
        var meta = document.createElement('meta');
        meta.id = 'kids-robots-meta';
        meta.name = 'robots';
        meta.content = 'noindex, follow';
        document.head.appendChild(meta);
      }
      document.documentElement.classList.add('kids-mode');
    } else {
      if (existing) existing.remove();
      document.documentElement.classList.remove('kids-mode');
    }
  }

  // 翻訳が部分的な言語のとき、「一部は英語表示」であることを断る帯を出す。
  // 黙って英語が混ざるより、理由が分かるほうが親切なため。
  var PARTIAL_MSG = {
    ko: '이 페이지의 번역은 아직 진행 중입니다. 번역되지 않은 부분은 영어로 표시됩니다.',
    ne: 'यस पृष्ठको अनुवाद अझै चलिरहेको छ। अनुवाद नभएका भाग अङ्ग्रेजीमा देखिन्छन्।',
    tr: 'Bu sayfanın çevirisi henüz tamamlanmadı. Çevrilmemiş bölümler İngilizce olarak gösterilir.',
    my: 'ဤစာမျက်နှာ၏ ဘာသာပြန်ဆိုမှု မပြီးမြောက်သေးပါ။ ဘာသာမပြန်ရသေးသော အပိုင်းများကို အင်္ဂလိပ်ဘာသာဖြင့် ဖော်ပြထားပါသည်။',
    _: 'Translation of this page is still in progress. Untranslated parts are shown in English.'
  };

  function updatePartialNotice(lang) {
    var el = document.getElementById('i18n-partial-notice');
    if (PARTIAL.indexOf(lang) === -1) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'i18n-partial-notice';
      el.className = 'partial-notice';
      var header = document.querySelector('header');
      if (header && header.parentNode) {
        header.parentNode.insertBefore(el, header.nextSibling);
      } else {
        document.body.insertBefore(el, document.body.firstChild);
      }
    }
    el.textContent = '🌐 ' + (PARTIAL_MSG[lang] || PARTIAL_MSG._);
  }

  function updateKidsToggleUI() {
    var isJa = _currentLang === DEFAULT;
    document.querySelectorAll('.kids-toggle').forEach(function (btn) {
      btn.style.display = isJa ? '' : 'none';
      var active = _kidsMode && isJa;
      btn.classList.toggle('kids-toggle--active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function fetchJson(lang) {
    return fetch(BASE + lang + '.json').then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  // 辞書は「ページ別に切り出したもの」を優先して取りに行く。
  // 各ページが実際に使うキーは全体の 1〜2 割しかないのに全キーを配っていたため、
  // 1ページ表示あたり gzip 45KB を使っていた（body は .i18n-ready まで非表示なので、
  // この転送がそのまま描画の律速になる）。切り出すと 4〜10KB で済む。
  //
  // ページ別辞書は .github/scripts/build_page_dicts.py が生成してコミットする生成物。
  // 生成し忘れ・新規ページなどで 404 になったときは全体辞書に自動で落ちるので、
  // 表示が壊れることはない（遅くなるだけ）。
  function fetchDict(lang) {
    return fetch(PAGE_BASE + PAGE_ID + '.' + lang + '.json')
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .catch(function () { return fetchJson(lang); });
  }

  function loadAndApply(lang) {
    if (!LANGS.includes(lang)) lang = DEFAULT;
    _currentLang = lang;

    _safetyTimer = setTimeout(showPage, SAFETY_MS);

    var useKids = _kidsMode && lang === DEFAULT;
    applyKidsSeoMeta(useKids);
    updateKidsToggleUI();

    if (lang === DEFAULT && useKids) {
      Promise.all([fetchDict(DEFAULT), fetchDict('ja-kids')])
        .then(function (results) {
          applyDict(applyTemporal(Object.assign({}, results[0], results[1])), DEFAULT);
        })
        .catch(function () {
          fetchDict(DEFAULT)
            .then(function (dict) { applyDict(applyTemporal(dict), DEFAULT); })
            .catch(showPage);
        });
    } else if (lang === DEFAULT) {
      fetchDict(DEFAULT)
        .then(function (dict) { applyDict(applyTemporal(dict), DEFAULT); })
        .catch(showPage);
    } else {
      // en → 対象言語 の順に重ねる。対象言語に無いキーは英語で出る。
      // 英語を挟むのは、翻訳が部分的な言語で日本語が露出するのを避けるため
      // （日本語より英語のほうが読める閲覧者が多い）。
      //
      // ★ ja は取得しない。en は ja と同一のキー集合を持つ規約なので
      //   （auto_gates.py のチェック3「ja / en のキー集合一致」が機械的に保証している）、
      //   ja 層は最終辞書に 1 キーも寄与せず、gzip 約 23KB を捨てているだけだった。
      //   万一 en に欠けたキーがあっても、HTML には日本語の既定文が
      //   そのまま書かれているので、表示は従来と同じ日本語に落ちる。
      Promise.all([fetchDict(BRIDGE), fetchDict(lang)])
        .then(function (results) {
          applyDict(applyTemporal(Object.assign({}, results[0], results[1])), lang);
        })
        .catch(function () {
          // 対象言語が取れない場合は en だけ、それも駄目なら ja で表示
          fetchDict(BRIDGE)
            .then(function (dict) { applyDict(applyTemporal(dict), lang); })
            .catch(function () {
              fetchDict(DEFAULT)
                .then(function (dict) { applyDict(applyTemporal(dict), DEFAULT); })
                .catch(showPage);
            });
        });
    }
  }

  function setKidsMode(kids) {
    _kidsMode = kids;
    try { localStorage.setItem('komaki_kids', kids ? '1' : '0'); } catch (e) {}
    loadAndApply(_currentLang);
  }

  function init() {
    var savedLang;
    try { savedLang = localStorage.getItem('komaki_lang'); } catch (e) {}
    // URL の ?lang= が最優先。共有されたリンクを開いた人には、その言語で見せる。
    var lang = langFromUrl() || (LANGS.includes(savedLang) ? savedLang : DEFAULT);

    var savedKids;
    try { savedKids = localStorage.getItem('komaki_kids'); } catch (e) {}
    _kidsMode = savedKids === '1';

    // 言語を変えたら、その言語の URL で読み直す（2026-09-14）。
    // 辞書で差し替わるのは data-i18n の付いた要素だけで、js/main.js が読み込み時の言語で
    // 組み立てる部分（自動取得コーナーの見出しの訳・日付・ラベル、カレンダー、帯など）は
    // 追従しない。以前はそのまま前の言語で残っていた。?lang= は localStorage より優先されるので、
    // 読み直した先で確実にその言語になる。履歴は増やさない（syncUrl と同じ考え方）。
    document.querySelectorAll('.lang-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var v = LANGS.indexOf(sel.value) !== -1 ? sel.value : DEFAULT;
        try { localStorage.setItem('komaki_lang', v); } catch (e) {}
        try {
          var u = new URL(window.location.href);
          if (v === DEFAULT) u.searchParams.delete(LANG_PARAM);
          else u.searchParams.set(LANG_PARAM, v);
          window.location.replace(u.href);
          return;
        } catch (e) {}
        loadAndApply(v);
      });
    });

    document.querySelectorAll('.kids-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () { setKidsMode(!_kidsMode); });
    });

    loadAndApply(lang);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
