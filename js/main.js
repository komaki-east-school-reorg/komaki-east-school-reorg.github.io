/* ===== 表示言語の解決（このファイル共通） =====
   URL の ?lang=xx を最優先し、次に localStorage、どちらも無ければ既定の ja。
   URL を先に見るのは、共有された「?lang=pt のリンク」を初めて開いた人でも、
   i18n.js が localStorage を書き終える前にこのファイルの各ブロック
   （公式ニュース・学校HP更新・更新履歴・カレンダー）が正しい言語で描けるようにするため。 */
window.KomakiLang = (function () {
  const LANGS = ['ja', 'en', 'pt', 'vi', 'tl', 'es', 'zh', 'id', 'tr', 'my'];
  return function getLang() {
    try {
      const q = new URLSearchParams(location.search).get('lang');
      if (LANGS.indexOf(q) !== -1) return q;
    } catch (e) {}
    try { return localStorage.getItem('komaki_lang') || 'ja'; } catch (e) { return 'ja'; }
  };
})();

/* ===== HAMBURGER NAV ===== */
(function () {
  const btn = document.querySelector('.hamburger');
  const menu = document.querySelector('nav ul');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    btn.classList.toggle('open');
    menu.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
      btn.classList.remove('open');
      menu.classList.remove('open');
    }
  });
})();

/* ===== ACTIVE NAV LINK ===== */
(function () {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();

/* ===== AUTO DATE STATUS ===== */
(function () {
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  var todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  // index.html 「現在の状況」ステータス項目
  document.querySelectorAll('.status-item[data-event-date]').forEach(function (item) {
    if (item.dataset.eventDate <= todayStr && !item.classList.contains('done') && !item.classList.contains('current')) {
      item.classList.add('done');
      var label = item.querySelector('.status-label');
      if (label) {
        label.setAttribute('data-i18n', 'status_done');
        label.textContent = '完了';
      }
      var timeline = item.closest('.status-timeline');
      if (timeline) {
        var currentItem = timeline.querySelector('.status-item.current');
        if (currentItem) timeline.insertBefore(item, currentItem);
      }
    }
  });

  // schedule.html イベント一覧項目
  document.querySelectorAll('.event-item[data-event-date]').forEach(function (item) {
    if (item.dataset.eventDate <= todayStr) {
      item.classList.remove('upcoming', 'current');
      item.classList.add('done');
      var list = item.closest('.event-list');
      if (list) {
        var currentItem = list.querySelector('.event-item.current');
        if (currentItem) list.insertBefore(item, currentItem);
      }
    }
  });

  // schedule.html: 各イベントに状態ラベル（完了/進行中/予定）を付与する。
  // 上の処理で done クラスが確定した後に実行。data-i18n を付けるので
  // 全言語・こどもモードへの翻訳・言語切替への追従は i18n.js が自動で行う。
  document.querySelectorAll('.event-list .event-item').forEach(function (item) {
    var state = item.classList.contains('done') ? 'done'
      : item.classList.contains('current') ? 'current' : 'upcoming';
    var fallback = { done: '完了', current: '進行中', upcoming: '予定' };
    var badge = item.querySelector('.event-status');
    if (!badge) {
      badge = document.createElement('span');
      var dateEl = item.querySelector('.event-date');
      if (dateEl) dateEl.appendChild(badge);
      else item.insertBefore(badge, item.firstChild);
    }
    badge.className = 'event-status ' + state;
    badge.setAttribute('data-i18n', 'event_status_' + state);
    badge.textContent = fallback[state];
  });
})();

/* ===== UPCOMING SCHEDULE EXPIRY ===== */
(function () {
  var bar = document.querySelector('.upcoming-bar');
  if (!bar) return;
  var d = new Date();
  var todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  var items = bar.querySelectorAll('.upcoming-item[data-expires]');
  var visible = 0;
  items.forEach(function (item) {
    if (item.dataset.expires < todayStr) {
      item.remove();
    } else {
      visible++;
    }
  });
  if (visible === 0) bar.style.display = 'none';
})();

/* ===== SECTION LAST UPDATED (auto) ===== */
(function () {
  var els = document.querySelectorAll('.section-updated');
  if (!els.length) return;

  // セクション（「現在の状況」「主要イベント一覧」など）の最終更新日を自動表示する。
  // document.lastModified（配信ファイルの Last-Modified）を使うので、
  // 内容を更新して再デプロイするたびに自動で日付が変わる（手動更新不要）。
  var lm = new Date(document.lastModified);
  // 取得できない/不正な場合（一部サーバーは 0 を返す）は表示しない
  if (isNaN(lm.getTime()) || lm.getFullYear() < 2020) {
    els.forEach(function (el) { el.style.display = 'none'; });
    return;
  }

  var LOCALE_MAP = { ja: 'ja-JP', en: 'en-US', pt: 'pt-BR', vi: 'vi-VN', tl: 'fil-PH', es: 'es-ES', zh: 'zh-Hans-CN', id: 'id-ID', tr: 'tr-TR', my: 'my-MM' };
  // 「最終更新: {date}」のラベル（main.js 内で言語管理：既存カレンダーと同じ方式）
  var LABEL = {
    ja: '最終更新: {d}', en: 'Last updated: {d}', pt: 'Última atualização: {d}', vi: 'Cập nhật lần cuối: {d}',
    tl: 'Huling na-update: {d}', es: 'Última actualización: {d}', zh: '最后更新：{d}', id: 'Terakhir diperbarui: {d}',
    tr: 'Son güncelleme: {d}', my: 'နောက်ဆုံး ပြင်ဆင်သည့်ရက်- {d}'
  };
  var KIDS_LABEL_JA = 'さいごに 直した日: {d}';

  function getLang() { return window.KomakiLang(); }
  function isKids() { try { return localStorage.getItem('komaki_kids') === '1'; } catch (e) { return false; } }

  function render() {
    var lang = getLang();
    var locale = LOCALE_MAP[lang] || 'ja-JP';
    var dateStr;
    try {
      dateStr = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(lm);
    } catch (e) {
      dateStr = lm.getFullYear() + '-' + String(lm.getMonth() + 1).padStart(2, '0') + '-' + String(lm.getDate()).padStart(2, '0');
    }
    var tpl = (lang === 'ja' && isKids()) ? KIDS_LABEL_JA : (LABEL[lang] || LABEL.en || LABEL.ja);
    var text = tpl.replace('{d}', dateStr);
    els.forEach(function (el) { el.textContent = text; });
  }

  render();
  // 言語切替・こどもモード切替に追従
  document.querySelectorAll('.lang-select').forEach(function (sel) { sel.addEventListener('change', render); });
  document.querySelectorAll('.kids-toggle').forEach(function (btn) { btn.addEventListener('click', function () { setTimeout(render, 0); }); });
})();

/* ===== FAQ ACCORDION ===== */
(function () {
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const isOpen = btn.classList.contains('open');
      document.querySelectorAll('.faq-q').forEach(b => {
        b.classList.remove('open');
        b.nextElementSibling.classList.remove('open');
      });
      if (!isOpen) {
        btn.classList.add('open');
        btn.nextElementSibling.classList.add('open');
      }
    });
  });
})();

/* ===== VOICE FILTER ===== */
(function () {
  const btns = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.voice-card');
  if (!btns.length) return;
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      cards.forEach(card => {
        if (filter === 'all' || card.dataset.type === filter) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });
})();

/* ===== OFFICIAL NEWS ===== */
(function () {
  const container = document.getElementById('official-news-container');
  if (!container) return;

  var _nl = window.KomakiLang();
  var _nt = {
    no_items: {ja:'直近{d}日以内に更新された情報はありません。', en:'No updates found in the past {d} days.', pt:'Nenhuma atualização nos últimos {d} dias.', vi:'Không có cập nhật trong {d} ngày qua.', tl:'Walang mga update sa nakalipas na {d} araw.', es:'No hay actualizaciones en los últimos {d} días.', zh:'近{d}天内暂无更新。', id:'Tidak ada pembaruan dalam {d} hari terakhir.', tr:'Son {d} günde güncelleme yok.', my:'ပြီးခဲ့သည့် {d} ရက်အတွင်း အပ်ဒိတ် မရှိပါ။'},
    see_all:  {ja:'公式サイトで全ての情報を確認する →', en:'View all on the official site →', pt:'Ver tudo no site oficial →', vi:'Xem tất cả trên trang chính thức →', tl:'Tingnan ang lahat sa opisyal na site →', es:'Ver todo en el sitio oficial →', zh:'在官方网站查看全部信息 →', id:'Lihat semua di situs resmi →', tr:'Tümünü resmî sitede görün →', my:'တရားဝင်ဆိုက်တွင် အားလုံး ကြည့်ရန် →'},
    showing:  {ja:'直近{d}日以内に更新されたページを表示しています', en:'Showing pages updated in the past {d} days', pt:'Exibindo páginas atualizadas nos últimos {d} dias', vi:'Hiển thị các trang cập nhật trong {d} ngày qua', tl:'Ipinapakita ang mga pahinang na-update sa nakalipas na {d} araw', es:'Mostrando páginas actualizadas en los últimos {d} días', zh:'显示近{d}天内更新的页面', id:'Menampilkan halaman yang diperbarui dalam {d} hari terakhir', tr:'Son {d} günde güncellenen sayfalar', my:'ပြီးခဲ့သည့် {d} ရက်အတွင်း အပ်ဒိတ်လုပ်ထားသော စာမျက်နှာများ'},
    updated:  {ja:' 更新', en:' updated', pt:' atualizado', vi:' cập nhật', tl:' na-update', es:' actualizado', zh:' 更新', id:' diperbarui', tr:' güncellendi', my:' အပ်ဒိတ်'},
    error:    {ja:'情報の取得に失敗しました。', en:'Failed to load information.', pt:'Falha ao carregar as informações.', vi:'Không tải được thông tin.', tl:'Nabigo ang pag-load ng impormasyon.', es:'Error al cargar la información.', zh:'信息加载失败。', id:'Gagal memuat informasi.', tr:'Bilgiler yüklenemedi.', my:'အချက်အလက် မဖွင့်နိုင်ပါ။'},
    official: {ja:'公式サイト', en:'official website', pt:'site oficial', vi:'trang chính thức', tl:'opisyal na site', es:'sitio oficial', zh:'官方网站', id:'situs resmi', tr:'resmî site', my:'တရားဝင်ဆိုက်'},
    check:    {ja:'をご確認ください。', en:'.', pt:'.', vi:'.', tl:'.', es:'.', zh:'。', id:'.', tr:'.', my:'။'},
  };
  function ntr(key, d) {
    var s = (_nt[key][_nl] || _nt[key]['en'] || _nt[key]['ja']);
    return d !== undefined ? s.replace('{d}', d) : s;
  }

  fetch('./data/news.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      const items = (data.items || []).slice().reverse();
      const days = data.window_days || 30;

      if (items.length === 0) {
        container.innerHTML =
          `<p class="official-news-loading">${ntr('no_items', days)}</p>` +
          `<a href="${data.source_url}" target="_blank" rel="noopener" class="card-link">${ntr('see_all')}</a>`;
        return;
      }

      const listHtml = items.map(item => {
        const date = item.updated_at
          ? `<span class="official-news-date">${item.updated_at}${ntr('updated')}</span>`
          : '';
        return `<li class="official-news-item">` +
                 `<div class="official-news-item-inner">` +
                   `<a href="${item.url}" target="_blank" rel="noopener">${item.title}</a>` +
                   date +
                 `</div>` +
               `</li>`;
      }).join('');

      container.innerHTML =
        `<div class="official-news-meta">${ntr('showing', days)}</div>` +
        `<ul class="official-news-list">${listHtml}</ul>` +
        `<a href="${data.source_url}" target="_blank" rel="noopener" class="card-link">${ntr('see_all')}</a>`;
    })
    .catch(() => {
      container.innerHTML =
        `<p class="official-news-error">` +
          `${ntr('error')}` +
          `<a href="https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/index.html"` +
          ` target="_blank" rel="noopener">${ntr('official')}</a>${ntr('check')}` +
        `</p>`;
    });
})();

/* ===== SCHOOL WEBSITE UPDATES ===== */
/* 再編対象8校のホームページ新着記事。data/school_news.json は
   .github/scripts/fetch_schools.py が毎日更新する（手編集しない）。 */
(function () {
  const container = document.getElementById('school-news-container');
  if (!container) return;

  var _sl = window.KomakiLang(), _sk = false;
  try { _sk = localStorage.getItem('komaki_kids') === '1'; } catch (e) {}

  var _st = {
    elem:    {ja:'小学校', en:'Elementary', pt:'Primária', vi:'Tiểu học', tl:'Elementarya', es:'Primaria', zh:'小学', id:'SD', tr:'İlkokul', my:'မူလတန်း'},
    jhs:     {ja:'中学校', en:'Junior High', pt:'Ginásio', vi:'THCS', tl:'Junior High', es:'Secundaria', zh:'中学', id:'SMP', tr:'Ortaokul', my:'အလယ်တန်း'},
    is_new:  {ja:'新着',   en:'NEW', pt:'NOVO', vi:'MỚI', tl:'BAGO', es:'NUEVO', zh:'最新', id:'BARU', tr:'YENİ', my:'အသစ်'},
    updated: {ja:'最終更新 ', en:'Updated ', pt:'Atualizado ', vi:'Cập nhật ', tl:'Na-update ', es:'Actualizado ', zh:'最后更新 ', id:'Diperbarui ', tr:'Güncellendi ', my:'အပ်ဒိတ် '},
    visit:   {ja:'学校ホームページを見る →', en:'Visit school website →', pt:'Ver site da escola →', vi:'Xem trang trường →', tl:'Bisitahin ang website →', es:'Ver sitio de la escuela →', zh:'访问学校网站 →', id:'Kunjungi situs sekolah →', tr:'Okul web sitesini ziyaret et →', my:'ကျောင်းဝဘ်ဆိုက်သို့ →'},
    empty:   {ja:'新着記事を取得できませんでした。', en:'No articles could be retrieved.', pt:'Não foi possível obter artigos.', vi:'Không lấy được bài viết.', tl:'Walang nakuhang artikulo.', es:'No se pudieron obtener artículos.', zh:'未能获取文章。', id:'Tidak ada artikel yang diperoleh.', tr:'Yazı alınamadı.', my:'ဆောင်းပါး မရရှိပါ။'},
    error:   {ja:'学校ホームページの情報を取得できませんでした。', en:'Could not load school website updates.', pt:'Não foi possível carregar as atualizações.', vi:'Không tải được cập nhật từ trang trường.', tl:'Hindi ma-load ang mga update.', es:'No se pudieron cargar las actualizaciones.', zh:'无法加载学校网站更新。', id:'Gagal memuat pembaruan situs sekolah.', tr:'Okul sitesi güncellemeleri yüklenemedi.', my:'ကျောင်းဝဘ်ဆိုက် အပ်ဒိတ်များ မဖွင့်နိုင်ပါ။'}
  };
  function str(key) { return _st[key][_sl] || _st[key]['en'] || _st[key]['ja']; }

  function schoolName(names) {
    if (_sl === 'ja') return (_sk && names.ja_kids) ? names.ja_kids : names.ja;
    return names[_sl] || names.en || names.ja;
  }

  // ISO 日付 → 閲覧者の言語の表記に。失敗したら元の文字列のまま。
  function fmtDate(iso) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!p) return iso || '';
    var d = new Date(+p[1], +p[2] - 1, +p[3]);
    try {
      return d.toLocaleDateString(_sl === 'ja' ? 'ja-JP' : _sl, {year: 'numeric', month: 'short', day: 'numeric'});
    } catch (e) { return iso; }
  }

  function daysSince(iso) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!p) return Infinity;
    var then = new Date(+p[1], +p[2] - 1, +p[3]);
    var now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.floor((now - then) / 86400000);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
    });
  }

  fetch('./data/school_news.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      var schools = (data.schools || []).slice();
      if (!schools.length) { container.innerHTML = '<p class="school-empty">' + str('empty') + '</p>'; return; }

      // 更新の新しい順（データ側でも整列済みだが表示側でも保証する）
      schools.sort(function (a, b) { return (b.latest_date || '').localeCompare(a.latest_date || ''); });

      container.innerHTML = '<div class="school-grid">' + schools.map(function (s) {
        var fresh = daysSince(s.latest_date) <= 7;
        var items = (s.items || []).map(function (it) {
          return '<li><a href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
                   '<span class="school-item-date">' + fmtDate(it.date) + '</span>' +
                   esc(it.title) +
                 '</a></li>';
        }).join('');

        return '<div class="school-card' + (fresh ? ' school-card--fresh' : '') + '">' +
                 '<div class="school-card-head">' +
                   '<a class="school-name" href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
                     esc(schoolName(s.names)) +
                   '</a>' +
                   '<span class="school-badge">' + str(s.level === 'jhs' ? 'jhs' : 'elem') + '</span>' +
                   (fresh ? '<span class="school-badge school-badge--new">' + str('is_new') + '</span>' : '') +
                   '<span class="school-date">' + (s.latest_date ? str('updated') + fmtDate(s.latest_date) : '') + '</span>' +
                 '</div>' +
                 (items ? '<ul class="school-items">' + items + '</ul>'
                        : '<p class="school-empty">' + str('empty') + '</p>') +
                 '<a class="school-card-link" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + str('visit') + '</a>' +
               '</div>';
      }).join('') + '</div>';
    })
    .catch(function () {
      container.innerHTML = '<p class="official-news-error">' + str('error') + '</p>';
    });
})();

/* ===== SITE UPDATE LOG ===== */
/* このサイト自身の更新履歴。data/site-updates.json は手動管理（自動生成ではない）。 */
(function () {
  const container = document.getElementById('site-updates-container');
  if (!container) return;

  var MAX_ITEMS = 6;   // 表示件数。data/site-updates.json 側は全履歴を保持する

  var _ul = window.KomakiLang();

  var _ut = {
    content: {ja:'掲載内容', en:'Content', pt:'Conteúdo', vi:'Nội dung', tl:'Nilalaman', es:'Contenido', zh:'内容', id:'Konten', tr:'İçerik', my:'အကြောင်းအရာ'},
    feature: {ja:'機能',     en:'Feature', pt:'Recurso',  vi:'Tính năng', tl:'Tampok', es:'Función',   zh:'功能', id:'Fitur',  tr:'Özellik', my:'လုပ်ဆောင်ချက်'},
    fix:     {ja:'修正',     en:'Fix',     pt:'Correção', vi:'Sửa lỗi',   tl:'Ayos',   es:'Corrección',zh:'修正', id:'Perbaikan', tr:'Düzeltme', my:'ပြင်ဆင်မှု'},
    empty:   {ja:'更新履歴はまだありません。', en:'No updates recorded yet.', pt:'Ainda não há atualizações.', vi:'Chưa có cập nhật nào.', tl:'Wala pang naitalang update.', es:'Aún no hay actualizaciones.', zh:'尚无更新记录。', id:'Belum ada pembaruan.', tr:'Henüz kayıtlı güncelleme yok.', my:'အပ်ဒိတ် မှတ်တမ်း မရှိသေးပါ။'},
    error:   {ja:'更新履歴を取得できませんでした。', en:'Could not load the update log.', pt:'Não foi possível carregar o histórico.', vi:'Không tải được nhật ký cập nhật.', tl:'Hindi ma-load ang update log.', es:'No se pudo cargar el historial.', zh:'无法加载更新记录。', id:'Gagal memuat log pembaruan.', tr:'Güncelleme kaydı yüklenemedi.', my:'အပ်ဒိတ် မှတ်တမ်း မဖွင့်နိုင်ပါ။'}
  };
  function str(key) { return _ut[key][_ul] || _ut[key]['en'] || _ut[key]['ja']; }

  function fmtDate(iso) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!p) return iso || '';
    try {
      return new Date(+p[1], +p[2] - 1, +p[3])
        .toLocaleDateString(_ul === 'ja' ? 'ja-JP' : _ul, {year: 'numeric', month: 'short', day: 'numeric'});
    } catch (e) { return iso; }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
    });
  }

  fetch('./data/site-updates.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      var items = (data.updates || []).slice();
      if (!items.length) { container.innerHTML = '<p class="school-empty">' + str('empty') + '</p>'; return; }

      // 新しい順に並べ、直近 MAX_ITEMS 件だけ出す。
      // JSON には履歴を残したままにして、表示だけを絞る。
      items.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      items = items.slice(0, MAX_ITEMS);

      container.innerHTML = '<ol class="update-list">' + items.map(function (it) {
        // 本文は 対象言語 → en → ja の順（i18n.js のフォールバックと揃える）
        var text = it[_ul] || it.en || it.ja || '';
        var type = (it.type === 'feature' || it.type === 'fix') ? it.type : 'content';
        return '<li class="update-item">' +
                 '<div class="update-meta">' +
                   '<time class="update-date" datetime="' + esc(it.date || '') + '">' + fmtDate(it.date) + '</time>' +
                   '<span class="update-tag update-tag--' + type + '">' + str(type) + '</span>' +
                 '</div>' +
                 '<div class="update-text">' + esc(text) + '</div>' +
               '</li>';
      }).join('') + '</ol>';
    })
    .catch(function () {
      container.innerHTML = '<p class="official-news-error">' + str('error') + '</p>';
    });
})();

/* ===== CALENDAR ===== */
(function () {
  const calContainer = document.getElementById('calendar-view');
  if (!calContainer) return;

  // カレンダーイベントは data/events.json で管理する（編集・自動更新の対象はそちら）
  fetch('./data/events.json')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) { initCalendar(data.events || {}); })
    .catch(function () { calContainer.style.display = 'none'; });

  function initCalendar(events) {
    if (!Object.keys(events).length) { calContainer.style.display = 'none'; return; }

    function getEventLabel(key) {
      var l = window.KomakiLang();
      var ev = events[key];
      return ev ? (ev[l] || ev.en || ev.ja) : '';
    }

    const CAL_LOCALE_MAP = {ja:'ja-JP', en:'en-US', pt:'pt-BR', vi:'vi-VN', tl:'fil-PH', es:'es-ES', zh:'zh-Hans-CN', id:'id-ID', tr:'tr-TR', my:'my-MM'};
    // 未知の言語は英語に落とす。ja に落としてはいけない
    // （サイト全体が「日本語より英語のほうが読める閲覧者が多い」前提で作られている）。
    function getCalLocale() {
      return CAL_LOCALE_MAP[window.KomakiLang()] || 'en-US';
    }

    var _ct = {
      done_marker: {ja:'済', en:'✓', pt:'✓', vi:'✓', tl:'✓', es:'✓', zh:'✓', id:'✓', tr:'✓', my:'✓'},
      done_prefix: {ja:'[済] ', en:'[Done] ', pt:'[Concluído] ', vi:'[Xong] ', tl:'[Tapos] ', es:'[Hecho] ', zh:'[已完成] ', id:'[Selesai] ', tr:'[Tamamlandı] ', my:'[ပြီးစီး] '},
      plan_prefix: {ja:'[予定] ', en:'[Planned] ', pt:'[Previsto] ', vi:'[KH] ', tl:'[Nakatakda] ', es:'[Previsto] ', zh:'[计划] ', id:'[Rencana] ', tr:'[Planlanan] ', my:'[စီစဉ်ထားသည်] '},
    };
    // 未知の言語は ja ではなく en に落とすこと
    // （日本語より英語のほうが読める閲覧者が多い、というサイト全体の方針）。
    function ctr(key) {
      var l = window.KomakiLang();
      return _ct[key][l] || _ct[key]['en'];
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    function pad(n) { return String(n).padStart(2, '0'); }
    const todayKey = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

    // 初期表示は常に「今月」。
    // 予定のある月へ自動で飛ばす案もあるが、カレンダーを開いた人がまず知りたいのは
    // 「今がどこか」なので、今月に予定が無くても今月から始める。
    // 予定のある月へは ◀ ▶ で移動する。
    let currentYear = today.getFullYear();
    let currentMonth = today.getMonth();

    function renderCalendar(year, month) {
      const monthLabel = document.getElementById('cal-month-label');
      try {
        monthLabel.textContent = new Intl.DateTimeFormat(getCalLocale(), {year:'numeric', month:'long'}).format(new Date(year, month, 1));
      } catch(e) {
        monthLabel.textContent = year + '年' + (month + 1) + '月';
      }

      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const grid = document.getElementById('cal-grid');
      while (grid.children.length > 7) grid.removeChild(grid.lastChild);

      for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'cal-day empty';
        grid.appendChild(empty);
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const key = `${year}-${pad(month + 1)}-${pad(d)}`;
        const dateObj = new Date(year, month, d);
        const dow = dateObj.getDay();

        const cell = document.createElement('div');
        cell.className = 'cal-day';
        if (dow === 0) cell.classList.add('sun');
        if (dow === 6) cell.classList.add('sat');
        if (dateObj.getTime() === today.getTime()) cell.classList.add('today');

        const numEl = document.createElement('div');
        numEl.className = 'cal-day-num';
        numEl.textContent = d;
        cell.appendChild(numEl);

        if (events[key]) {
          cell.classList.add('has-event');
          const dot = document.createElement('span');
          const isPast = key <= todayKey;
          dot.className = 'cal-event-dot' + (isPast ? ' past' : '');
          dot.textContent = (isPast ? ctr('done_marker') + ' ' : '★ ') + getEventLabel(key);
          cell.appendChild(dot);
          cell.title = (isPast ? ctr('done_prefix') : ctr('plan_prefix')) + getEventLabel(key);
        }

        grid.appendChild(cell);
      }
    }

    document.getElementById('cal-prev').addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      renderCalendar(currentYear, currentMonth);
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      renderCalendar(currentYear, currentMonth);
    });

    renderCalendar(currentYear, currentMonth);

    document.querySelectorAll('.lang-select').forEach(function(sel) {
      sel.addEventListener('change', function() {
        renderCalendar(currentYear, currentMonth);
      });
    });
  }
})();
