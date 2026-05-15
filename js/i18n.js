/* ===== i18n: Multi-language support ===== */
(function () {
  'use strict';

  var LANGS = ['ja', 'en', 'pt', 'vi', 'tl', 'es', 'zh', 'id'];
  var DEFAULT = 'ja';
  var BASE = './data/i18n/';
  var SAFETY_MS = 1000;

  var _safetyTimer = null;

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

    var langAttr = { ja: 'ja', en: 'en', pt: 'pt-BR', vi: 'vi', tl: 'tl', es: 'es', zh: 'zh-Hans', id: 'id' };
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

    try { localStorage.setItem('komaki_lang', lang); } catch (e) {}
    showPage();
  }

  function fetchJson(lang) {
    return fetch(BASE + lang + '.json').then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  function loadAndApply(lang) {
    if (!LANGS.includes(lang)) lang = DEFAULT;

    _safetyTimer = setTimeout(showPage, SAFETY_MS);

    if (lang === DEFAULT) {
      fetchJson(DEFAULT)
        .then(function (dict) { applyDict(dict, DEFAULT); })
        .catch(showPage);
    } else {
      Promise.all([fetchJson(DEFAULT), fetchJson(lang)])
        .then(function (results) {
          applyDict(Object.assign({}, results[0], results[1]), lang);
        })
        .catch(function () {
          // 対象言語が失敗した場合は ja だけで表示
          fetchJson(DEFAULT)
            .then(function (dict) { applyDict(dict, DEFAULT); })
            .catch(showPage);
        });
    }
  }

  function init() {
    var saved;
    try { saved = localStorage.getItem('komaki_lang'); } catch (e) {}
    var lang = LANGS.includes(saved) ? saved : DEFAULT;

    document.querySelectorAll('.lang-select').forEach(function (sel) {
      sel.addEventListener('change', function () { loadAndApply(sel.value); });
    });

    loadAndApply(lang);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
