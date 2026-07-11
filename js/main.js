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

  var LOCALE_MAP = { ja: 'ja-JP', en: 'en-US', pt: 'pt-BR', vi: 'vi-VN', tl: 'fil-PH', es: 'es-ES', zh: 'zh-Hans-CN', id: 'id-ID' };
  // 「最終更新: {date}」のラベル（main.js 内で言語管理：既存カレンダーと同じ方式）
  var LABEL = {
    ja: '最終更新: {d}', en: 'Last updated: {d}', pt: 'Última atualização: {d}', vi: 'Cập nhật lần cuối: {d}',
    tl: 'Huling na-update: {d}', es: 'Última actualización: {d}', zh: '最后更新：{d}', id: 'Terakhir diperbarui: {d}'
  };
  var KIDS_LABEL_JA = 'さいごに 直した日: {d}';

  function getLang() { try { return localStorage.getItem('komaki_lang') || 'ja'; } catch (e) { return 'ja'; } }
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
    var tpl = (lang === 'ja' && isKids()) ? KIDS_LABEL_JA : (LABEL[lang] || LABEL.ja);
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

  var _nl = 'ja';
  try { _nl = localStorage.getItem('komaki_lang') || 'ja'; } catch(e) {}
  var _nt = {
    no_items: {ja:'直近{d}日以内に更新された情報はありません。', en:'No updates found in the past {d} days.', pt:'Nenhuma atualização nos últimos {d} dias.', vi:'Không có cập nhật trong {d} ngày qua.', tl:'Walang mga update sa nakalipas na {d} araw.', es:'No hay actualizaciones en los últimos {d} días.', zh:'近{d}天内暂无更新。', id:'Tidak ada pembaruan dalam {d} hari terakhir.'},
    see_all:  {ja:'公式サイトで全ての情報を確認する →', en:'View all on the official site →', pt:'Ver tudo no site oficial →', vi:'Xem tất cả trên trang chính thức →', tl:'Tingnan ang lahat sa opisyal na site →', es:'Ver todo en el sitio oficial →', zh:'在官方网站查看全部信息 →', id:'Lihat semua di situs resmi →'},
    showing:  {ja:'直近{d}日以内に更新されたページを表示しています', en:'Showing pages updated in the past {d} days', pt:'Exibindo páginas atualizadas nos últimos {d} dias', vi:'Hiển thị các trang cập nhật trong {d} ngày qua', tl:'Ipinapakita ang mga pahinang na-update sa nakalipas na {d} araw', es:'Mostrando páginas actualizadas en los últimos {d} días', zh:'显示近{d}天内更新的页面', id:'Menampilkan halaman yang diperbarui dalam {d} hari terakhir'},
    updated:  {ja:' 更新', en:' updated', pt:' atualizado', vi:' cập nhật', tl:' na-update', es:' actualizado', zh:' 更新', id:' diperbarui'},
    error:    {ja:'情報の取得に失敗しました。', en:'Failed to load information.', pt:'Falha ao carregar as informações.', vi:'Không tải được thông tin.', tl:'Nabigo ang pag-load ng impormasyon.', es:'Error al cargar la información.', zh:'信息加载失败。', id:'Gagal memuat informasi.'},
    official: {ja:'公式サイト', en:'official website', pt:'site oficial', vi:'trang chính thức', tl:'opisyal na site', es:'sitio oficial', zh:'官方网站', id:'situs resmi'},
    check:    {ja:'をご確認ください。', en:'.', pt:'.', vi:'.', tl:'.', es:'.', zh:'。', id:'.'},
  };
  function ntr(key, d) {
    var s = (_nt[key][_nl] || _nt[key]['ja']);
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
      var l = 'ja';
      try { l = localStorage.getItem('komaki_lang') || 'ja'; } catch(e) {}
      var ev = events[key];
      return ev ? (ev[l] || ev.ja) : '';
    }

    const CAL_LOCALE_MAP = {ja:'ja-JP', en:'en-US', pt:'pt-BR', vi:'vi-VN', tl:'fil-PH', es:'es-ES', zh:'zh-Hans-CN', id:'id-ID'};
    function getCalLocale() {
      try { var l = localStorage.getItem('komaki_lang'); return CAL_LOCALE_MAP[l] || 'ja-JP'; } catch(e) { return 'ja-JP'; }
    }

    var _ct = {
      done_marker: {ja:'済', en:'✓', pt:'✓', vi:'✓', tl:'✓', es:'✓', zh:'✓', id:'✓'},
      done_prefix: {ja:'[済] ', en:'[Done] ', pt:'[Concluído] ', vi:'[Xong] ', tl:'[Tapos] ', es:'[Hecho] ', zh:'[已完成] ', id:'[Selesai] '},
      plan_prefix: {ja:'[予定] ', en:'[Planned] ', pt:'[Previsto] ', vi:'[KH] ', tl:'[Nakatakda] ', es:'[Previsto] ', zh:'[计划] ', id:'[Rencana] '},
    };
    function ctr(key) {
      var l = 'ja';
      try { l = localStorage.getItem('komaki_lang') || 'ja'; } catch(e) {}
      return _ct[key][l] || _ct[key]['ja'];
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    function pad(n) { return String(n).padStart(2, '0'); }
    const todayKey = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

    // 初期表示は現在の月。ただしイベントデータのある範囲（最初〜最後のイベント月）に収める
    var _evKeys = Object.keys(events).sort();
    function _evYM(key) { return { y: parseInt(key.slice(0, 4), 10), m: parseInt(key.slice(5, 7), 10) - 1 }; }
    var _firstEv = _evYM(_evKeys[0]);
    var _lastEv = _evYM(_evKeys[_evKeys.length - 1]);

    let currentYear = today.getFullYear();
    let currentMonth = today.getMonth();

    var _curIdx = currentYear * 12 + currentMonth;
    if (_curIdx < _firstEv.y * 12 + _firstEv.m) { currentYear = _firstEv.y; currentMonth = _firstEv.m; }
    else if (_curIdx > _lastEv.y * 12 + _lastEv.m) { currentYear = _lastEv.y; currentMonth = _lastEv.m; }

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
