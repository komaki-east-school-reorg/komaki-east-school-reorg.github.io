/* ===== i18n: Multi-language support ===== */
(function () {
  'use strict';

  var LANGS = ['ja', 'en', 'pt', 'vi', 'tl', 'es', 'zh', 'id', 'tr', 'my'];
  var DEFAULT = 'ja';
  var BRIDGE = 'en';   // 未翻訳キーの中継言語。ja へ直接落とさず英語を挟む
  // 全キーが揃っていない言語。ページ上部に「一部は英語表示」の断りを出す。
  // 翻訳が 100% 揃ったらこの配列から外すこと（配列が空でも動作する）。
  var PARTIAL = ['tr', 'my'];
  var BASE = './data/i18n/';
  var SAFETY_MS = 1000;

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

    var langAttr = { ja: 'ja', en: 'en', pt: 'pt-BR', vi: 'vi', tl: 'tl', es: 'es', zh: 'zh-Hans', id: 'id', tr: 'tr', my: 'my' };
    document.documentElement.lang = langAttr[lang] || lang;

    var pageId = (window.location.pathname.match(/([^/]+)\.html$/) || ['', 'index'])[1] || 'index';
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

    try { localStorage.setItem('komaki_lang', lang); } catch (e) {}
    showPage();
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

  function loadAndApply(lang) {
    if (!LANGS.includes(lang)) lang = DEFAULT;
    _currentLang = lang;

    _safetyTimer = setTimeout(showPage, SAFETY_MS);

    var useKids = _kidsMode && lang === DEFAULT;
    applyKidsSeoMeta(useKids);
    updateKidsToggleUI();

    if (lang === DEFAULT && useKids) {
      Promise.all([fetchJson(DEFAULT), fetchJson('ja-kids')])
        .then(function (results) {
          applyDict(applyTemporal(Object.assign({}, results[0], results[1])), DEFAULT);
        })
        .catch(function () {
          fetchJson(DEFAULT)
            .then(function (dict) { applyDict(applyTemporal(dict), DEFAULT); })
            .catch(showPage);
        });
    } else if (lang === DEFAULT) {
      fetchJson(DEFAULT)
        .then(function (dict) { applyDict(applyTemporal(dict), DEFAULT); })
        .catch(showPage);
    } else {
      // ja → en → 対象言語 の順に重ねる。対象言語に無いキーは英語で出る。
      // 英語を挟むのは、翻訳が部分的な言語で日本語が露出するのを避けるため
      // （日本語より英語のほうが読める閲覧者が多い）。en は ja と同じ 627 キーを
      // 揃えてあるので、全キー翻訳済みの言語では見た目は一切変わらない。
      Promise.all([fetchJson(DEFAULT), fetchJson(BRIDGE), fetchJson(lang)])
        .then(function (results) {
          applyDict(applyTemporal(Object.assign({}, results[0], results[1], results[2])), lang);
        })
        .catch(function () {
          // 対象言語が取れない場合は ja+en まで、それも駄目なら ja だけで表示
          Promise.all([fetchJson(DEFAULT), fetchJson(BRIDGE)])
            .then(function (r) { applyDict(applyTemporal(Object.assign({}, r[0], r[1])), lang); })
            .catch(function () {
              fetchJson(DEFAULT)
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
    var lang = LANGS.includes(savedLang) ? savedLang : DEFAULT;

    var savedKids;
    try { savedKids = localStorage.getItem('komaki_kids'); } catch (e) {}
    _kidsMode = savedKids === '1';

    document.querySelectorAll('.lang-select').forEach(function (sel) {
      sel.addEventListener('change', function () { loadAndApply(sel.value); });
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
