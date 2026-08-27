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

/* ===== AUTO DATE STATUS =====
   予定日を過ぎた項目に done を付け、ラベル／バッジを「完了」にする。

   【並び順は触らない】以前はここで完了項目を .current の前へ移動していたが、
   それをやると HTML 側で data-start（開始日）順に並べた年表が実行時に崩れる。
   実際、2026-05-18 と 2026-06-06 の項目が 2026-02-08 の前へ動いて逆転していた。
   並び順は HTML の記述順（＝data-start 昇順）が正であり、
   このブロックは状態表示だけを担当する。並べ替えを再び入れないこと。
   （CONTRIBUTING.txt ルール7 / auto_gates.py の「年表の並び」を参照） */
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
    }
  });

  // schedule.html イベント一覧項目
  document.querySelectorAll('.event-item[data-event-date]').forEach(function (item) {
    if (item.dataset.eventDate <= todayStr) {
      item.classList.remove('upcoming', 'current');
      item.classList.add('done');
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
        // 各校とも最新1件だけ出す。日付はカード見出しの「最終更新」と同じになるので添えない。
        var items = (s.items || []).slice(0, 1).map(function (it) {
          return '<li><a href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
                   esc(it.title) +
                 '</a></li>';
        }).join('');

        // 「最終更新」は校名やバッジと横幅を取り合うと折り返してしまうので、
        // 見出し行ではなくカード末尾の行に置き、リンクと左右に振り分ける。
        var date = s.latest_date
          ? '<span class="school-date">' + str('updated') + fmtDate(s.latest_date) + '</span>' : '';

        return '<div class="school-card' + (fresh ? ' school-card--fresh' : '') + '">' +
                 '<div class="school-card-head">' +
                   '<a class="school-name" href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
                     esc(schoolName(s.names)) +
                   '</a>' +
                   '<span class="school-badge">' + str(s.level === 'jhs' ? 'jhs' : 'elem') + '</span>' +
                   (fresh ? '<span class="school-badge school-badge--new">' + str('is_new') + '</span>' : '') +
                 '</div>' +
                 (items ? '<ul class="school-items">' + items + '</ul>'
                        : '<p class="school-empty">' + str('empty') + '</p>') +
                 '<div class="school-card-foot">' + date +
                   '<a class="school-card-link" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + str('visit') + '</a>' +
                 '</div>' +
               '</div>';
      }).join('') + '</div>';
    })
    .catch(function () {
      container.innerHTML = '<p class="official-news-error">' + str('error') + '</p>';
    });
})();

/* ===== PRESS COVERAGE ===== */
/* 中日新聞Webが報じた学校再編の記事。data/chunichi_news.json は
   .github/scripts/fetch_chunichi.py が毎日更新する（手編集しない）。
   見出しと引用文は新聞社の原文なので翻訳しない。周りのラベルだけ多言語化する。 */
(function () {
  const container = document.getElementById('press-container');
  if (!container) return;

  var MAX_ITEMS = 6;   // 表示件数。data/chunichi_news.json 側は全件を保持する

  var _pl = window.KomakiLang();

  var _pt = {
    source: {ja:'出典', en:'Source', pt:'Fonte', vi:'Nguồn', tl:'Pinagmulan', es:'Fuente', zh:'出处', id:'Sumber', tr:'Kaynak', my:'ရင်းမြစ်'},
    empty:  {ja:'該当する記事はまだありません。', en:'No articles found yet.', pt:'Ainda não há reportagens.', vi:'Chưa có bài báo nào.', tl:'Wala pang artikulong natagpuan.', es:'Aún no hay artículos.', zh:'尚无相关报道。', id:'Belum ada artikel.', tr:'Henüz haber bulunamadı.', my:'သတင်း မတွေ့ရသေးပါ။'},
    error:  {ja:'報道記事の一覧を取得できませんでした。', en:'Could not load the news coverage list.', pt:'Não foi possível carregar a lista de reportagens.', vi:'Không tải được danh sách bài báo.', tl:'Hindi ma-load ang listahan ng balita.', es:'No se pudo cargar la lista de artículos.', zh:'无法加载报道列表。', id:'Gagal memuat daftar artikel.', tr:'Haber listesi yüklenemedi.', my:'သတင်းစာရင်း မဖွင့်နိုင်ပါ။'}
  };
  function str(key) { return _pt[key][_pl] || _pt[key]['en'] || _pt[key]['ja']; }

  function fmtDate(iso) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!p) return iso || '';
    try {
      return new Date(+p[1], +p[2] - 1, +p[3])
        .toLocaleDateString(_pl === 'ja' ? 'ja-JP' : _pl, {year: 'numeric', month: 'short', day: 'numeric'});
    } catch (e) { return iso; }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
    });
  }

  fetch('./data/chunichi_news.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      var items = (data.items || []).slice()
        .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })
        .slice(0, MAX_ITEMS);
      if (!items.length) {
        container.innerHTML = '<p class="press-empty">' + str('empty') + '</p>';
        return;
      }

      // 見出し・掲載日・出典だけを出す（本文の引用は載せない）。
      var source = data.source_name || '中日新聞Web';
      container.innerHTML = '<ul class="press-list">' + items.map(function (it) {
        return '<li class="press-item">' +
                 '<span class="press-date">' + fmtDate(it.date) + '</span>' +
                 '<a class="press-title" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
                   esc(it.title) +
                 '</a>' +
                 '<span class="press-cite">' + str('source') + '：' + esc(source) + '</span>' +
               '</li>';
      }).join('') + '</ul>';
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

/* ===== COMMUNITY COUNCIL EVENTS ===== */
/* 地域協議会イベント案内（community.html）。data/community_events.json は
   .github/scripts/build_community_events.py が毎日組み立てる（手編集しない）。
   イベント名は市の書いた見出しなので【翻訳しない】。まわりのラベルだけ多言語にする
   （公式ニュース・学校HP更新のコーナーと同じ方針）。 */
(function () {
  const container = document.getElementById('community-events-container');
  if (!container) return;

  var _cl = window.KomakiLang();
  var _cet = {
    badge:   {ja:'篠岡地区', en:'Shinooka area', pt:'Área de Shinooka', vi:'Khu vực Shinooka', tl:'Lugar ng Shinooka', es:'Zona de Shinooka', zh:'篠冈地区', id:'Wilayah Shinooka', tr:'Shinooka bölgesi', my:'Shinooka ဒေသ'},
    when:    {ja:'日時', en:'Date', pt:'Data', vi:'Thời gian', tl:'Petsa', es:'Fecha', zh:'日期', id:'Waktu', tr:'Tarih', my:'ရက်စွဲ'},
    none:    {ja:'現在、掲載されているイベントはありません。', en:'No events are listed at the moment.', pt:'No momento não há eventos publicados.', vi:'Hiện chưa có sự kiện nào được đăng.', tl:'Wala pang nakalistang kaganapan sa ngayon.', es:'Por ahora no hay eventos publicados.', zh:'目前没有刊登的活动。', id:'Saat ini belum ada acara yang ditampilkan.', tr:'Şu anda yayımlanmış etkinlik yok.', my:'လက်ရှိတွင် ဖော်ပြထားသော ပွဲများ မရှိပါ။'},
    error:   {ja:'イベント案内を取得できませんでした。', en:'Could not load the event listings.', pt:'Não foi possível carregar os eventos.', vi:'Không tải được danh sách sự kiện.', tl:'Hindi ma-load ang listahan ng kaganapan.', es:'No se pudieron cargar los eventos.', zh:'无法加载活动信息。', id:'Gagal memuat daftar acara.', tr:'Etkinlik listesi yüklenemedi.', my:'ပွဲစာရင်း မဖွင့်နိုင်ပါ။'},
    see_all: {ja:'市の公式ページで確認する →', en:'Check on the official city page →', pt:'Ver na página oficial da cidade →', vi:'Xem trên trang chính thức của thành phố →', tl:'Tingnan sa opisyal na pahina ng lungsod →', es:'Ver en la página oficial del municipio →', zh:'在市政府官方页面确认 →', id:'Lihat di halaman resmi kota →', tr:'Belediyenin resmî sayfasında görün →', my:'မြို့တော် တရားဝင်စာမျက်နှာတွင် ကြည့်ရန် →'}
  };
  function cet(key) { return _cet[key][_cl] || _cet[key]['en'] || _cet[key]['ja']; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  // 許可された所管課インデックス。JSON が読めなかったときの案内先にも使う。
  var FALLBACK_SRC = 'https://www.city.komaki.aichi.jp/admin/soshiki/kenkouikigai/sasaeai/3/3_2/index.html';

  fetch('./data/community_events.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      const events = data.events || [];
      const src = data.source_url || FALLBACK_SRC;
      const seeAll = `<a href="${esc(src)}" target="_blank" rel="noopener" class="card-link">${cet('see_all')}</a>`;

      if (!events.length) {
        container.innerHTML = `<p class="official-news-loading">${cet('none')}</p>` + seeAll;
        return;
      }

      // 「市公式サイト お知らせ」と同じ見た目にそろえる：見出しのリンク＋日時の1行だけ。
      // 会場・更新日は記事側にあるので、ここでは出さない。
      const rows = events.map(ev => {
        const badge = ev.shinooka
          ? `<span class="ce-badge">${cet('badge')}</span>` : '';
        const when = ev.when
          ? `<span class="ce-when">${cet('when')} ${esc(ev.when)}</span>` : '';
        return `<li class="ce-item${ev.shinooka ? ' ce-item--shinooka' : ''}">` +
                 `<div class="ce-head">${badge}` +
                   `<a href="${esc(ev.url)}" target="_blank" rel="noopener">${esc(ev.title)}</a>` +
                 `</div>` +
                 when +
               `</li>`;
      }).join('');

      container.innerHTML = `<ul class="ce-list">${rows}</ul>` + seeAll;
    })
    .catch(() => {
      container.innerHTML =
        `<p class="official-news-error">${cet('error')}` +
        `<a href="${FALLBACK_SRC}" target="_blank" rel="noopener">${cet('see_all')}</a></p>`;
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

/* ===== SHARE BUTTONS ===== */
/* 全ページ共通の「このページを共有する」欄。HTML 側には見出しと空の入れ物だけがあり、
   ボタンはここで組み立てる（共有先URLに表示中の言語を載せるため、静的に書けない）。

   ラベルは data-i18n を付けて i18n.js に任せる。公式ニュース等のブロックが
   インライン辞書を持っているのは JSON 取得より先に描くためだが、こちらは
   applyDict より前に DOM を作れるので、辞書に一本化したほうが10言語を揃えやすい。
   HTML に現れないキーなので build_page_dicts.py の RUNTIME_KEYS に入れてある。 */
(function () {
  var box = document.getElementById('share-buttons');
  if (!box) return;

  var LANGS = ['ja', 'en', 'pt', 'vi', 'tl', 'es', 'zh', 'id', 'tr', 'my'];

  /* 共有する URL は「アドレスバーの URL」ではなく canonical から組み立てる。
     i18n.js が ?lang= を replaceState で書き足すのは辞書取得のあとなので、
     読み込み直後や言語切替の直後に location.href を読むと 1 手遅れた URL になる。
     canonical を読むのもこの時点だけ（i18n.js があとで言語別 URL に書き換えるため）。 */
  var CANON = (function () {
    var el = document.querySelector('link[rel="canonical"]');
    var href = (el && el.getAttribute('href')) || location.href;
    return href.split('#')[0].split('?')[0];
  })();

  // 言語切替の直後は、まだ URL にも localStorage にも新しい言語が入っていない
  // （i18n.js が書くのは辞書取得のあと）。切替イベントで受け取った値を一時的に優先する。
  var _selectedLang = null;
  function currentLang() { return _selectedLang || window.KomakiLang(); }

  // 共有される URL。日本語は素の URL（正規形）、他言語は ?lang= 付き。
  function shareUrl() {
    var lang = currentLang();
    return lang === 'ja' ? CANON : CANON + '?lang=' + lang;
  }

  function shareTitle() { return document.title || CANON; }

  function enc(v) { return encodeURIComponent(v); }

  /* url() は生の URL と題名を受け取る（エスケープは各自）。Threads・Bluesky は
     本文欄しか受け取らないので、題名と URL を1つのテキストにまとめて渡す。
     Instagram・TikTok は、リンクを渡せる共有 URL を公開していないためここには
     並べられない（下のコピー方式のボタンと、端末標準の共有が受け皿）。 */
  var SERVICES = [
    {cls: 'line',    icon: 'L',  key: 'share_line',     ja: 'LINEで送る',
     url: function (u, t) { return 'https://social-plugins.line.me/lineit/share?url=' + enc(u) + '&text=' + enc(t); }},
    {cls: 'x',       icon: 'X',  key: 'share_x',        ja: 'Xでポスト',
     url: function (u, t) { return 'https://x.com/intent/post?url=' + enc(u) + '&text=' + enc(t); }},
    {cls: 'fb',      icon: 'f',  key: 'share_facebook', ja: 'Facebookでシェア',
     url: function (u)    { return 'https://www.facebook.com/sharer/sharer.php?u=' + enc(u); }},
    {cls: 'hatena',  icon: 'B!', key: 'share_hatena',   ja: 'はてなブックマーク',
     url: function (u, t) { return 'https://b.hatena.ne.jp/entry/panel/?url=' + enc(u) + '&btitle=' + enc(t); }},
    {cls: 'threads', icon: '@',  key: 'share_threads',  ja: 'Threadsで投稿',
     url: function (u, t) { return 'https://www.threads.net/intent/post?text=' + enc(t + ' ' + u); }},
    {cls: 'bluesky', icon: '🦋', key: 'share_bluesky',  ja: 'Blueskyで投稿',
     url: function (u, t) { return 'https://bsky.app/intent/compose?text=' + enc(t + ' ' + u); }},
    {cls: 'reddit',  icon: 'r',  key: 'share_reddit',   ja: 'Redditに投稿',
     url: function (u, t) { return 'https://www.reddit.com/submit?url=' + enc(u) + '&title=' + enc(t); }}
  ];

  /* ボタンはアイコンだけ。サービス名は aria-label（＝辞書）に持たせ、
     マウスを載せたときだけ title として見せる。10個以上並ぶ列で
     1つずつ文字ラベルを付けると、共有欄がページで一番大きな塊になってしまうため。 */
  function makeBtn(tag, cls, icon, key, ja) {
    var el = document.createElement(tag);
    el.className = 'share-btn share-btn--' + cls;
    if (tag === 'button') el.type = 'button';
    el.setAttribute('data-i18n-aria', key);
    el.setAttribute('aria-label', ja);
    var ic = document.createElement('span');
    ic.className = 'share-icon';
    ic.setAttribute('aria-hidden', 'true');
    ic.textContent = icon;
    el.appendChild(ic);
    return el;
  }

  // aria-label（辞書が入れた訳文）をそのまま title に写す。辞書の取得は非同期なので、
  // 描画時ではなく「使う直前」に写す。
  function syncTitles() {
    box.querySelectorAll('.share-btn').forEach(function (el) {
      var t = el.getAttribute('aria-label');
      if (t && el.title !== t) el.title = t;
    });
  }

  var links = [];

  SERVICES.forEach(function (s) {
    var a = makeBtn('a', s.cls, s.icon, s.key, s.ja);
    a.target = '_blank';
    a.rel = 'noopener';
    a._build = function () { a.href = s.url(shareUrl(), shareTitle()); };
    a._build();
    links.push(a);
    box.appendChild(a);
  });

  // href は「使われる直前」に組み直す。ページ題名は i18n.js が辞書取得後に
  // 差し替えるので、描画時の値のままだと日本語の題名で共有されてしまう。
  function refresh() {
    links.forEach(function (a) { a._build(); });
    syncTitles();
    if (starPermalink) starPermalink.textContent = shareTitle();
  }
  var starPermalink = null;   // はてなスターの題名リンク（下で作る）
  ['pointerdown', 'focusin', 'touchstart', 'mouseover'].forEach(function (ev) {
    box.addEventListener(ev, refresh, {passive: true});
  });
  document.querySelectorAll('.lang-select').forEach(function (sel) {
    sel.addEventListener('change', function () {
      _selectedLang = LANGS.indexOf(sel.value) !== -1 ? sel.value : null;
      refresh();
    });
  });

  // --- リンクをコピー ---
  // 結果の文言は最初から DOM に置いて出し入れするだけにする。押されたあとに
  // 作ると、そのとき i18n.js の適用は終わっているので日本語のまま出てしまう。
  var msg = document.createElement('span');
  msg.className = 'share-copy-msg';
  msg.setAttribute('role', 'status');

  function msgSpan(key, ja) {
    var el = document.createElement('span');
    el.setAttribute('data-i18n', key);
    el.textContent = ja;
    el.style.display = 'none';
    msg.appendChild(el);
    return el;
  }
  var msgOk = msgSpan('share_copied', 'コピーしました');
  var msgNg = msgSpan('share_copy_failed', 'コピーできませんでした');
  var msgHostNg = msgSpan('share_mastodon_invalid', 'サーバーのドメインが正しくないようです');
  // アプリ名を差し込んで組み立てる文言（Instagram 等）はここに書き出す。
  var msgFree = document.createElement('span');
  msgFree.style.display = 'none';
  msg.appendChild(msgFree);
  var msgAll = [msgOk, msgNg, msgHostNg, msgFree];
  var msgTimer = null;

  function showMsg(target) {
    msgAll.forEach(function (el) { el.style.display = el === target ? '' : 'none'; });
    msg.classList.add('is-visible');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { msg.classList.remove('is-visible'); }, 3000);
  }

  function showText(text) { msgFree.textContent = text; showMsg(msgFree); }

  // クリップボードへのコピー。成否を cb(true/false) で返す。
  function copyLink(text, cb) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { cb(true); },
        function () { cb(fallbackCopy(text)); });
    } else {
      cb(fallbackCopy(text));
    }
  }

  /* --- Mastodon ---
     分散型なので共有先のサーバーが1つに決まらない。利用者のサーバーのドメインを
     一度だけ聞いて localStorage（komaki_mastodon）に覚える。第三者のリダイレクト
     サービスを挟む方法もあるが、このサイトの外部通信先を増やしたくないので採らない。
     入力を促す文言も辞書から出したいので、非表示の要素に data-i18n で持たせて
     その textContent を prompt に渡している（main.js からは辞書を直接読めない）。 */
  var MASTODON_KEY = 'komaki_mastodon';

  function mastodonHost() {
    try { return localStorage.getItem(MASTODON_KEY) || ''; } catch (e) { return ''; }
  }

  function normalizeHost(v) {
    var h = String(v == null ? '' : v).trim().toLowerCase();
    h = h.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (h.indexOf('@') !== -1) h = h.split('@').pop();   // @user@example.social 形式
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h) ? h : '';
  }

  var hostPrompt = document.createElement('span');
  hostPrompt.setAttribute('data-i18n', 'share_mastodon_prompt');
  hostPrompt.textContent = '使っている Mastodon サーバーのドメインを入力してください（例：mstdn.jp）';
  hostPrompt.style.display = 'none';
  box.appendChild(hostPrompt);

  // <a> ではなく <button>：サーバーが未登録のうちは行き先が決まらず、
  // href の無い <a> はキーボードで到達できなくなるため。
  var mastodonBtn = makeBtn('button', 'mastodon', 'm', 'share_mastodon', 'Mastodonで共有');
  mastodonBtn.addEventListener('click', function () {
    var host = mastodonHost();
    if (!host) {
      var raw = window.prompt(hostPrompt.textContent, '');
      if (raw === null) return;                 // 取り消し
      host = normalizeHost(raw);
      if (!host) { showMsg(msgHostNg); return; }
      try { localStorage.setItem(MASTODON_KEY, host); } catch (e) {}
    }
    window.open('https://' + host + '/share?text=' + enc(shareTitle() + ' ' + shareUrl()),
                '_blank', 'noopener');
  });
  box.appendChild(mastodonBtn);

  /* --- Instagram・TikTok ---
     この2つは「リンクを渡して投稿画面を開く」共有URLを公開していないので、
     ボタンとしては作れない。押したらリンクをコピーして、アプリに貼り付けて
     もらう案内を出す（ストーリーズやプロフィール欄に貼る使い方に合わせている）。
     ラベルに「（リンクをコピー）」と書いてあるのは、押しても投稿画面が
     開かないことを押す前に分かるようにするため。 */
  var pasteTpl = document.createElement('span');
  pasteTpl.setAttribute('data-i18n', 'share_copied_paste');
  pasteTpl.textContent = 'リンクをコピーしました。{app} に貼り付けてください';
  pasteTpl.style.display = 'none';
  box.appendChild(pasteTpl);

  [{cls: 'instagram', icon: 'IG', key: 'share_instagram', ja: 'Instagram（リンクをコピー）', app: 'Instagram'},
   {cls: 'tiktok',    icon: '♪',  key: 'share_tiktok',    ja: 'TikTok（リンクをコピー）',    app: 'TikTok'}
  ].forEach(function (s) {
    var b = makeBtn('button', s.cls, s.icon, s.key, s.ja);
    b.addEventListener('click', function () {
      copyLink(shareUrl(), function (okFlag) {
        if (!okFlag) { showMsg(msgNg); return; }
        showText(pasteTpl.textContent.replace('{app}', s.app));
      });
    });
    box.appendChild(b);
  });

  var copyBtn = makeBtn('button', 'copy', '🔗', 'share_copy', 'リンクをコピー');
  copyBtn.addEventListener('click', function () {
    copyLink(shareUrl(), function (okFlag) { showMsg(okFlag ? msgOk : msgNg); });
  });
  box.appendChild(copyBtn);

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:absolute;left:-9999px;top:0;';
      document.body.appendChild(ta);
      ta.select();
      var okFlag = document.execCommand('copy');
      document.body.removeChild(ta);
      return okFlag;
    } catch (e) { return false; }
  }

  /* --- 端末標準の共有（スマートフォン）---
     WhatsApp・Zalo・Messenger など、ここに並べきれない共有先の受け皿。
     Instagram・TikTok も、スマートフォンならこの共有シートから直接開ける
     （上の2ボタンはコピーまでしかできないPC向けの経路）。 */
  if (navigator.share) {
    var nativeBtn = makeBtn('button', 'native', '↗', 'share_native', 'ほかのアプリで共有');
    nativeBtn.addEventListener('click', function () {
      navigator.share({title: shareTitle(), url: shareUrl()}).catch(function () {});
    });
    box.appendChild(nativeBtn);
  }

  // 結果表示はボタンの行の外（下）に置く。行の中に空の要素を混ぜると
  // flex の gap ぶんだけ最後のボタンの右に隙間が残るため。
  box.parentNode.insertBefore(msg, box.nextSibling);

  /* ===== はてなスター ===== */
  /* 星は「共有」ではなくページへの反応なので、URL は言語を付けない canonical に
     固定する。?lang= 付きにすると同じページの星が10か所に散ってしまう。 */
  var starBox = document.getElementById('share-star');
  if (!starBox) return;

  /* 並びは「ラベル → ページ題名のリンク → 星」。題名リンクを実体にするのは
     はてなスターの標準の貼り方で、押しても同じページに戻るだけの空リンクを
     作らずに済むため（スターの登録先 URL と題名は、この a から読まれる）。 */
  var entry = document.createElement('div');
  entry.className = 'hatena-star-entry';

  var starLabel = document.createElement('span');
  starLabel.className = 'share-star-label';
  starLabel.setAttribute('data-i18n', 'share_star_label');
  starLabel.textContent = 'このページに星をつける';

  var permalink = document.createElement('a');
  permalink.className = 'hatena-star-permalink';
  permalink.href = CANON;
  permalink.textContent = shareTitle();
  starPermalink = permalink;

  var holder = document.createElement('span');
  holder.className = 'hatena-star-holder';

  entry.appendChild(starLabel);
  entry.appendChild(permalink);
  entry.appendChild(holder);
  starBox.appendChild(entry);

  var note = document.createElement('p');
  note.className = 'share-star-note';
  note.setAttribute('data-i18n', 'share_star_note');
  note.textContent = '★は「はてなスター」。はてなのアカウントで「読んだよ」の印を残せます。';
  starBox.appendChild(note);

  /* セレクタは entryNode（div.hatena-star-entry）の中を querySelector する。
     ★ 現行の HatenaStar.js は登録先 URL も表示題名も uri のノードから読む
     （題名は title ではなく uri のノードの innerText。はてな側の実装がそうなっている）。
     題名リンクを実体にしているので、どちらの読み方でも正しい値になる。 */
  var STAR_CONFIG = {
    entryNodes: {
      'div.hatena-star-entry': {
        uri: 'a.hatena-star-permalink',
        title: 'a.hatena-star-permalink',
        container: 'span.hatena-star-holder'
      }
    }
  };

  /* スクリプトは共有欄が画面に入るまで読み込まない。このサイトは外部の
     スクリプトをほかに1つも読んでいないので、最下部まで来なかった閲覧者に
     はてなへの通信を発生させたくない。IntersectionObserver が無い環境では
     星の欄をクリックしたときに読み込む。 */
  var starLoaded = false;
  function loadHatenaStar() {
    if (starLoaded) return;
    starLoaded = true;
    permalink.textContent = shareTitle();   // i18n 適用後の題名で登録する

    var s = document.createElement('script');
    s.src = 'https://s.hatena.ne.jp/js/HatenaStar.js';
    s.async = true;
    s.onerror = function () { starBox.hidden = true; };
    s.onload = function () {
      /* ★ SiteConfig は「読み込んだあと」に入れること。
         HatenaStar.js は  void 0 === window.Hatena.Star && (window.Hatena.Star = {...})
         という書き方なので、先回りして window.Hatena.Star を作っておくと
         本体側の代入がまるごとスキップされ、初期化に必要な中身が入らない。 */
      if (!window.Hatena || !window.Hatena.Star) { starBox.hidden = true; return; }
      window.Hatena.Star.SiteConfig = STAR_CONFIG;

      /* ★ 本体の初期化は window の DOMContentLoaded に紐づいている。この欄は
         画面に入ってから読み込むので本物の DOMContentLoaded はとうに過ぎており、
         そのままでは初期化関数が一度も走らない。同じイベントを window に投げて
         走らせる。二重に走っても、はてな側が [data-hatena-star] の有無で弾く。
         （EntryLoader.loadEntries() という入口は現行ビルドには無い。） */
      try { window.dispatchEvent(new Event('DOMContentLoaded')); } catch (e) {}

      // 描画されなかったとき（読み込み失敗・仕様変更）は、星の出ないラベルだけが
      // 残るのを避けて欄ごと畳む。はてな側は setTimeout(0) で差し込むので4秒あれば足りる。
      setTimeout(function () {
        if (!holder.querySelector('[data-hatena-star]')) starBox.hidden = true;
      }, 4000);
    };
    document.body.appendChild(s);
  }

  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { io.disconnect(); loadHatenaStar(); }
      });
    }, {rootMargin: '200px'});
    io.observe(starBox);
  } else {
    starBox.addEventListener('click', loadHatenaStar, {once: true});
  }
})();

/* ===== DEADLINE BOX EXPIRY =====
   「提出期限」のように、その日を過ぎたら出しっぱなしにしたくない告知を自動で消す。
   .upcoming-item の data-expires と同じ考え方だが、あちらはトップの予定バー専用なので分けてある。
   期限当日は残す（data-expires の日付を含む）。 */
(function () {
  var boxes = document.querySelectorAll('.deadline-box[data-expires]');
  if (!boxes.length) return;
  var d = new Date();
  var today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  boxes.forEach(function (box) {
    if (box.dataset.expires < today) box.remove();
  });
})();

/* ===== BUS SERVICE AREA MAP（bus.html）=====
   data/bus_map.geojson を読んで、スクールバスの対象エリアと周辺の地図を SVG で描く。

   【出典が3系統あり、精度が違うことに注意】
   ・通学区域（赤線・layer='district'）… 国土数値情報「小学校区」（国土交通省 A27-21）の
     現行5校区を、『学校再編だより』が示す統合の組合せどおりに合成したもの。大城小学校区の
     分割は e-Stat 国勢調査小地域境界（総務省統計局）の町丁境で行い、大草・城山三丁目を東、
     城山二・四・五丁目を西とした。得られた面積は東 20.31 km²・西 6.89 km² で、だより vol.3 の
     公表値 20.3・6.9 と小数第1位まで一致する。【トレースではない。目視で引き直さないこと】
     表示範囲は geojson の view_bbox で決めており、桃花台東はその北東の枠外へさらに広がる。
     枠に全部収めると桃花台の住宅地が小さくなりすぎるため、意図的に切ってある。
   ・対象エリア（紫・busarea）… だより vol.6 の図を目視トレースし、上の通学区域の内側に
     切り詰めたもの。非公式の近似で、原図の北端が枠で切れているため、公表バスエリア
     18.5 km² のうち 9.81 km² しか入っていない。切り詰めで飛び地3片に分かれるので、
     1枚のポリゴン前提のコードに戻さないこと。HTML の注記（bus_map_caveat）と必ずセットで出す。
   ・道路・地区名・施設… OpenStreetMap（ODbL）。出典表示（bus_map_osm）には OSM に加えて
     国土数値情報・e-Stat も並べてある。どれも消さないこと。
     cls='local' は桃花台の主要生活道路（OSM の tertiary）と桃花台鳥居松線
     （OSM 上の名称は「桃花台・春日井線」）。localroad レイヤで表示を切り替える。

   投影は緯度経度をそのまま使う簡易正距円筒（x に cos(緯度) を掛けるだけ）。
   6km 四方なのでこれで形は合う。地物が多いので層ごとに <g data-layer> を作り、
   チェックボックスで表示を切り替える。 */
(function () {
  var host = document.getElementById('bus-area-map');
  if (!host) return;

  var _bl = window.KomakiLang();
  var NS = 'http://www.w3.org/2000/svg';
  var VIEW_W = 1400;
  var PAD = 40;

  function el(n, a) {
    var e = document.createElementNS(NS, n);
    for (var k in a) if (a.hasOwnProperty(k)) e.setAttribute(k, a[k]);
    return e;
  }
  // 下の図形の上でも読めるよう、白フチを敷いてから文字を重ねる
  function label(x, y, text, size, weight, fill) {
    var g = el('g', {});
    [1, 0].forEach(function (halo) {
      var t = el('text', {x: x, y: y, 'text-anchor': 'middle', 'font-size': size,
                          'font-weight': weight, fill: halo ? 'var(--white)' : fill});
      if (halo) { t.setAttribute('stroke', 'var(--white)'); t.setAttribute('stroke-width', Math.max(3, size / 4)); t.setAttribute('stroke-linejoin', 'round'); }
      t.textContent = text;
      g.appendChild(t);
    });
    return g;
  }

  var MARK = {
    school:   {r: 8,   fill: 'var(--primary)',  icon: '\u5b66'},
    kinder:   {r: 6,   fill: '#2f8f7a',         icon: '\u5712'},
    facility: {r: 6,   fill: '#587595',         icon: '\u516c'},
    shop:     {r: 6.5, fill: '#b8722a',         icon: '\u5e97'},
    conveni:  {r: 5,   fill: '#8a7f2a',         icon: 'C'},
    worship:  {r: 5.5, fill: '#8a5a8a',         icon: '\u795e'},
    park:     {r: 4.5, fill: '#4a8a4a',         icon: ''}
  };

  fetch('./data/bus_map.geojson')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (gj) {
      var feats = gj.features || [];
      var busPolys = [], districts = [], roads = [], places = [], facs = [], newSchools = [];
      feats.forEach(function (f) {
        var p = f.properties || {}, g = f.geometry || {};
        if (p.layer === 'district') districts.push(f);
        else if (p.layer === 'road') roads.push(f);
        else if (p.layer === 'place') places.push(f);
        else if (p.layer === 'facility') facs.push(f);
        else if (g.type === 'Polygon') busPolys.push(g.coordinates[0]);
        else if (g.type === 'Point') newSchools.push(f);
      });
      if (!busPolys.length) throw new Error('no bus area');

      // --- 範囲
      // view_bbox がある場合はそれに従う。桃花台東の通学区域は枠の北東へさらに広がって
      // いるが、全部を収めると桃花台の住宅地が小さくなりすぎるので、意図的に切っている。
      // 枠からはみ出す線は viewBox が切るので、ここで座標を加工する必要はない。
      var lo0 = Infinity, lo1 = -Infinity, la0 = Infinity, la1 = -Infinity;
      function grow(lon, lat) {
        if (lon < lo0) lo0 = lon; if (lon > lo1) lo1 = lon;
        if (lat < la0) la0 = lat; if (lat > la1) la1 = lat;
      }
      var vb = gj.view_bbox;
      if (vb && vb.length === 4) {
        grow(vb[0], vb[1]); grow(vb[2], vb[3]);
      } else {
        // 指定が無ければ全データが収まるように取る
        busPolys.forEach(function (ring) { ring.forEach(function (c) { grow(c[0], c[1]); }); });
        districts.forEach(function (f) { f.geometry.coordinates[0].forEach(function (c) { grow(c[0], c[1]); }); });
        places.forEach(function (f) { grow(f.geometry.coordinates[0], f.geometry.coordinates[1]); });
      }

      var K = Math.cos((la0 + la1) / 2 * Math.PI / 180);
      var S = (VIEW_W - PAD * 2) / ((lo1 - lo0) * K);
      var VIEW_H = (la1 - la0) * S + PAD * 2;
      function px(lon) { return PAD + (lon - lo0) * K * S; }
      function py(lat) { return PAD + (la1 - lat) * S; }
      function inView(lon, lat) { return lon >= lo0 && lon <= lo1 && lat >= la0 && lat <= la1; }

      var svg = el('svg', {viewBox: '0 0 ' + VIEW_W + ' ' + Math.round(VIEW_H),
                           role: 'presentation', 'aria-hidden': 'true'});
      svg.appendChild(el('rect', {x: 0, y: 0, width: VIEW_W, height: VIEW_H, fill: 'var(--white)'}));

      var layers = {};
      function layer(name) {
        if (!layers[name]) {
          layers[name] = el('g', {'data-layer': name});
          svg.appendChild(layers[name]);
        }
        return layers[name];
      }
      function path(coords) {
        return coords.map(function (c, i) {
          return (i ? 'L' : 'M') + px(c[0]).toFixed(1) + ' ' + py(c[1]).toFixed(1);
        }).join(' ');
      }

      // --- 道路（いちばん下）
      // cls='local' は桃花台の主要生活道路と桃花台鳥居松線。別レイヤに分け、
      // チェックボックスで消せるようにしてある（本数が多く、消さないと地区名が読みにくい）。
      var ROAD_W = {motorway: 5.5, trunk: 3.6, secondary: 2.2, local: 1.3};
      var ROAD_C = {motorway: '#9aa7ad', trunk: '#b0a58f', secondary: '#c3c9cc', local: '#dde1e4'};
      var gLocal = layer('localroad');   // 生活道路は幹線の下
      var gRoad = layer('road');
      var nameSeen = {};
      roads.forEach(function (f) {
        var cls = f.properties.cls;
        var g = (cls === 'local') ? gLocal : gRoad;
        g.appendChild(el('path', {d: path(f.geometry.coordinates), fill: 'none',
          stroke: ROAD_C[cls] || '#ccc', 'stroke-width': ROAD_W[cls] || 2,
          'stroke-linecap': 'round', 'stroke-linejoin': 'round'}));
        // 名前ごとに1回だけラベルを出す。県道まで出すのは、通学区域界が
        // どの県道に沿っているかを読者が自分で確かめられるようにするため。
        // 無名の生活道路は出さない（本数が多く、地図が読めなくなる）。
        var nm = f.properties.name;
        var named = (cls === 'motorway' || cls === 'trunk' || cls === 'secondary' || cls === 'local');
        if (nm && named && !nameSeen[nm]) {
          var cs = f.geometry.coordinates;
          if (cs.length >= 2) {
            var m = cs[Math.floor(cs.length / 2)];
            if (inView(m[0], m[1])) {
              nameSeen[nm] = 1;
              var small = (cls === 'secondary' || cls === 'local');
              g.appendChild(label(px(m[0]), py(m[1]) - 6, nm, small ? 15 : 17, 400,
                                  small ? '#77878e' : '#5a6a70'));
            }
          }
        }
      });

      // --- 通学区域（赤線＝新通学区域界）
      var DFILL = {east: 'rgba(212,170,48,.16)', west: 'rgba(88,117,149,.16)'};
      var gDist = layer('district');
      districts.forEach(function (f) {
        gDist.appendChild(el('path', {d: path(f.geometry.coordinates[0]) + ' Z',
          fill: DFILL[f.properties.key] || 'rgba(0,0,0,.05)',
          stroke: '#d32f2f', 'stroke-width': 3, 'stroke-linejoin': 'round'}));
      });

      // --- 対象エリア
      // 通学区域の内側に切り詰めてあるため、飛び地に分かれる（3片）。
      // 1枚のポリゴン前提に戻さないこと。
      busPolys.forEach(function (ring) {
        layer('busarea').appendChild(el('path', {d: path(ring) + ' Z',
          fill: 'rgba(126,110,196,.40)', stroke: '#5b48a8',
          'stroke-width': 2.5, 'stroke-linejoin': 'round'}));
      });

      // --- 施設（種類ごとの層）
      facs.forEach(function (f) {
        var cat = f.properties.cat, m = MARK[cat];
        if (!m) return;
        var c = f.geometry.coordinates;
        if (!inView(c[0], c[1])) return;
        var g = layer(cat);
        var x = px(c[0]), y = py(c[1]);
        g.appendChild(el('circle', {cx: x, cy: y, r: m.r, fill: m.fill,
          stroke: 'var(--white)', 'stroke-width': 2}));
        if (m.icon) {
          var t = el('text', {x: x, y: y + m.r * 0.55, 'text-anchor': 'middle',
            'font-size': m.r * 1.15, 'font-weight': 700, fill: '#fff'});
          t.textContent = m.icon;
          g.appendChild(t);
        }
        if (cat !== 'park' && cat !== 'conveni') {
          g.appendChild(label(x, y - m.r - 5, f.properties.name, cat === 'school' ? 17 : 14, 700,
            cat === 'school' ? 'var(--primary)' : 'var(--text)'));
        }
      });

      // --- 新設校（対象エリアの主役なので施設より上）
      var gNew = layer('school');
      newSchools.forEach(function (f) {
        var c = f.geometry.coordinates, x = px(c[0]), y = py(c[1]);
        gNew.appendChild(el('circle', {cx: x, cy: y, r: 11, fill: 'var(--primary)',
          stroke: 'var(--accent)', 'stroke-width': 3.5}));
        var nm = (_bl === 'ja' ? f.properties.name : (f.properties.name_en || f.properties.name)) || '';
        gNew.appendChild(label(x, y - 18, nm, 20, 700, 'var(--text)'));
      });

      // --- 地区名（いちばん上・大きめ）
      var gPlace = layer('place');
      places.forEach(function (f) {
        var c = f.geometry.coordinates;
        gPlace.appendChild(label(px(c[0]), py(c[1]), f.properties.name, 24, 700, '#3b4a55'));
      });
      // 通学区域の名前
      districts.forEach(function (f) {
        var p = f.properties;
        if (p.label_lon == null) return;
        var nm = (_bl === 'ja' ? p.name : (p.name_en || p.name));
        gDist.appendChild(label(px(p.label_lon), py(p.label_lat), nm, 27, 700, '#8a5a00'));
      });

      // --- スケールバーと方位（白い下地つき）
      function plate(x, y, w, h) {
        return el('rect', {x: x, y: y, width: w, height: h, rx: 6, fill: 'var(--white)', 'fill-opacity': .82});
      }
      var barLen = (1000 / 110946) * S, bx = PAD, by = VIEW_H - PAD * 0.5;
      var gUi = el('g', {});
      gUi.appendChild(plate(bx - 8, by - 36, barLen + 16, 44));
      gUi.appendChild(el('path', {d: 'M' + bx + ' ' + (by - 8) + ' V' + by + ' H' + (bx + barLen) + ' V' + (by - 8),
        fill: 'none', stroke: 'var(--text)', 'stroke-width': 2.5}));
      var lt = el('text', {x: bx, y: by - 13, 'font-size': 20, fill: 'var(--text)'});
      lt.textContent = '1 km';
      gUi.appendChild(lt);
      var nx = VIEW_W - PAD - 12, ny = PAD;
      gUi.appendChild(plate(nx - 19, ny - 8, 38, 64));
      gUi.appendChild(el('path', {d: 'M' + nx + ' ' + (ny + 28) + ' L' + nx + ' ' + ny,
        stroke: 'var(--text)', 'stroke-width': 2.5, fill: 'none'}));
      gUi.appendChild(el('path', {d: 'M' + (nx - 6) + ' ' + (ny + 9) + ' L' + nx + ' ' + ny + ' L' + (nx + 6) + ' ' + (ny + 9) + ' Z',
        fill: 'var(--text)'}));
      var nl = el('text', {x: nx, y: ny + 46, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, fill: 'var(--text)'});
      nl.textContent = 'N';
      gUi.appendChild(nl);
      svg.appendChild(gUi);

      host.appendChild(svg);

      // --- 層の表示切り替え
      var box = document.getElementById('bus-map-layers');
      if (box) {
        var inputs = box.querySelectorAll('input[data-layer]');
        function sync() {
          inputs.forEach(function (inp) {
            var g = layers[inp.dataset.layer];
            if (g) g.style.display = inp.checked ? '' : 'none';
          });
        }
        inputs.forEach(function (inp) { inp.addEventListener('change', sync); });
        sync();
      }
    })
    .catch(function () {
      var fig = host.closest('.bus-map-figure');
      (fig || host).hidden = true;
      var box = document.getElementById('bus-map-layers');
      if (box) box.hidden = true;
    });
})();

/* ===== COMMUNITY ACTIONS（index.html「地域の取組」）=====
   閉校を惜しむ市民有志の取組。data/community_actions.json は手動管理。

   【このコーナーだけ出典の性格が違う】市の公式情報でも報道でもなく、
   市民有志自身の発信（Instagram）。報道コーナーと同じく、
   計画の内容・数値の根拠には決して使わない。発信元へのリンクが
   「有志の発信である」ことを示す唯一の手がかりなので、外さないこと。

   取組の名称と学校名は主催者・市の書いた固有名なので【翻訳しない】。
   まわりのラベルだけ多言語にする（公式ニュース・報道コーナーと同じ方針）。 */
(function () {
  var container = document.getElementById('community-actions-container');
  if (!container) return;

  var _al = window.KomakiLang();
  var _at = {
    when:   {ja:'日時', en:'Date', pt:'Data', vi:'Thời gian', tl:'Petsa', es:'Fecha', zh:'日期', id:'Waktu', tr:'Tarih', my:'ရက်စွဲ'},
    place:  {ja:'場所', en:'Place', pt:'Local', vi:'Địa điểm', tl:'Lugar', es:'Lugar', zh:'地点', id:'Tempat', tr:'Yer', my:'နေရာ'},
    source: {ja:'発信元', en:'Posted by', pt:'Divulgado por', vi:'Nguồn tin', tl:'Mula sa', es:'Publicado por', zh:'发布方', id:'Diposting oleh', tr:'Paylaşan', my:'တင်သူ'},
    citizen:{ja:'市民有志', en:'Citizen-run', pt:'Iniciativa de cidadãos', vi:'Do người dân tổ chức', tl:'Mamamayan ang nagpapatakbo', es:'Iniciativa ciudadana', zh:'市民有志', id:'Inisiatif warga', tr:'Vatandaş girişimi', my:'ပြည်သူ့ဦးဆောင်'},
    empty:  {ja:'現在、掲載されている取組はありません。', en:'Nothing is listed at the moment.', pt:'No momento não há nada publicado.', vi:'Hiện chưa có nội dung nào.', tl:'Wala pang nakalista sa ngayon.', es:'Por ahora no hay nada publicado.', zh:'目前没有刊登的取组。', id:'Saat ini belum ada yang ditampilkan.', tr:'Şu anda listelenen bir şey yok.', my:'လက်ရှိတွင် ဖော်ပြထားသည် မရှိပါ။'},
    error:  {ja:'地域の取組を取得できませんでした。', en:'Could not load community efforts.', pt:'Não foi possível carregar.', vi:'Không tải được nội dung.', tl:'Hindi ma-load ang listahan.', es:'No se pudo cargar.', zh:'无法加载地域取组。', id:'Gagal memuat.', tr:'Yüklenemedi.', my:'မဖွင့်နိုင်ပါ။'}
  };
  function at(k) { return _at[k][_al] || _at[k]['en'] || _at[k]['ja']; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
    });
  }
  function pick(it, base) { return it[base + '_' + _al] || it[base + '_en'] || it[base + '_ja'] || ''; }

  // 終わった取組は落とす（当日は残す）
  function notPast(it) {
    if (!it.date) return true;
    var d = new Date();
    var today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return it.date >= today;
  }

  fetch('./data/community_actions.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      var items = (data.actions || []).filter(notPast);
      if (!items.length) { container.innerHTML = '<p class="school-empty">' + at('empty') + '</p>'; return; }
      items.sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });

      container.innerHTML = '<ul class="action-list">' + items.map(function (it) {
        // 取組名と学校名は主催者・市の固有名なので翻訳しない
        var rows = '';
        var when = pick(it, 'date_note');
        var place = pick(it, 'place');
        if (when)  rows += '<div class="action-row"><span class="action-label">' + at('when') + '</span>' + esc(when) + '</div>';
        if (place) rows += '<div class="action-row"><span class="action-label">' + at('place') + '</span>' + esc(place) + '</div>';
        var body = pick(it, 'body');
        var src = it.source_url
          ? '<a href="' + esc(it.source_url) + '" target="_blank" rel="noopener">' + esc(it.source_label || it.source_url) + '</a>'
          : esc(it.source_label || '');
        return '<li class="action-item">' +
                 '<div class="action-head">' +
                   '<span class="action-title">' + esc(it.title_ja || '') + '</span>' +
                   '<span class="action-badge">' + at('citizen') + '</span>' +
                 '</div>' +
                 '<div class="action-school">' + esc(it.school_ja || '') + '</div>' +
                 rows +
                 (body ? '<p class="action-body">' + esc(body) + '</p>' : '') +
                 '<div class="action-source">' + at('source') + '：' + src + '</div>' +
               '</li>';
      }).join('') + '</ul>';
    })
    .catch(function () {
      container.innerHTML = '<p class="official-news-error">' + at('error') + '</p>';
    });
})();
