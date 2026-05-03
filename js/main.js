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
    no_items: {ja:'直近{d}日以内に更新された情報はありません。', en:'No updates found in the past {d} days.', pt:'Nenhuma atualização nos últimos {d} dias.', vi:'Không có cập nhật trong {d} ngày qua.', tl:'Walang mga update sa nakalipas na {d} araw.', es:'No hay actualizaciones en los últimos {d} días.', zh:'近{d}天内暂无更新。'},
    see_all:  {ja:'公式サイトで全ての情報を確認する →', en:'View all on the official site →', pt:'Ver tudo no site oficial →', vi:'Xem tất cả trên trang chính thức →', tl:'Tingnan ang lahat sa opisyal na site →', es:'Ver todo en el sitio oficial →', zh:'在官方网站查看全部信息 →'},
    showing:  {ja:'直近{d}日以内に更新されたページを表示しています', en:'Showing pages updated in the past {d} days', pt:'Exibindo páginas atualizadas nos últimos {d} dias', vi:'Hiển thị các trang cập nhật trong {d} ngày qua', tl:'Ipinapakita ang mga pahinang na-update sa nakalipas na {d} araw', es:'Mostrando páginas actualizadas en los últimos {d} días', zh:'显示近{d}天内更新的页面'},
    updated:  {ja:' 更新', en:' updated', pt:' atualizado', vi:' cập nhật', tl:' na-update', es:' actualizado', zh:' 更新'},
    error:    {ja:'情報の取得に失敗しました。', en:'Failed to load information.', pt:'Falha ao carregar as informações.', vi:'Không tải được thông tin.', tl:'Nabigo ang pag-load ng impormasyon.', es:'Error al cargar la información.', zh:'信息加载失败。'},
    official: {ja:'公式サイト', en:'official website', pt:'site oficial', vi:'trang chính thức', tl:'opisyal na site', es:'sitio oficial', zh:'官方网站'},
    check:    {ja:'をご確認ください。', en:'.', pt:'.', vi:'.', tl:'.', es:'.', zh:'。'},
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

  const events = {
    '2025-05-10': '第1回「学校を考える会」',
    '2025-05-30': '第2回「学校を考える会」',
    '2025-06-13': '地域協議会代表者報告',
    '2025-06-14': '区長会報告（1回目）',
    '2025-06-27': '第3回「学校を考える会」',
    '2025-07-27': '城山3・4丁目説明会',
    '2025-08-24': '第1回保護者等意見交換会',
    '2025-08-30': '第2・3回保護者等意見交換会',
    '2025-09-21': '住民説明会',
    '2025-09-26': '区長会報告（2回目）',
    '2025-10-11': '第4回「学校を考える会」',
    '2025-11-02': '区長会報告（3回目）',
    '2025-11-10': 'パブコメ開始・新校名アンケート開始',
    '2025-11-27': '地域協議会代表者報告（2回目）',
    '2025-12-09': 'パブリックコメント締切（55件）',
    '2026-01-13': '通学区域審議会',
    '2026-02-07': '第5回「学校を考える会」',
    '2026-05-18': '校章デザイン募集締切',
    '2026-06-06': '保護者等説明会（桃陵中）',
    '2026-06-07': '保護者等説明会（篠岡中）',
    '2026-06-14': '保護者等説明会（陶小）',
    '2026-06-20': '保護者等説明会（大城小）',
    '2026-06-21': '保護者等説明会（光ヶ丘中）',
    '2026-06-29': '保護者等説明会（東部市民センター）',
    '2027-04-01': '第1期再編 実施予定（しのおか学園）',
  };
  const pastDates = new Set([
    '2025-05-10','2025-05-30','2025-06-13','2025-06-14','2025-06-27',
    '2025-07-27','2025-08-24','2025-08-30','2025-09-21','2025-09-26',
    '2025-10-11','2025-11-02','2025-11-10','2025-11-27','2025-12-09',
    '2026-01-13','2026-02-07',
  ]);

  const CAL_LOCALE_MAP = {ja:'ja-JP', en:'en-US', pt:'pt-BR', vi:'vi-VN', tl:'fil-PH', es:'es-ES', zh:'zh-Hans-CN'};
  function getCalLocale() {
    try { var l = localStorage.getItem('komaki_lang'); return CAL_LOCALE_MAP[l] || 'ja-JP'; } catch(e) { return 'ja-JP'; }
  }

  var _ct = {
    done_marker: {ja:'済', en:'✓', pt:'✓', vi:'✓', tl:'✓', es:'✓', zh:'✓'},
    done_prefix: {ja:'[済] ', en:'[Done] ', pt:'[Concluído] ', vi:'[Xong] ', tl:'[Tapos] ', es:'[Hecho] ', zh:'[已完成] '},
    plan_prefix: {ja:'[予定] ', en:'[Planned] ', pt:'[Previsto] ', vi:'[KH] ', tl:'[Nakatakda] ', es:'[Previsto] ', zh:'[计划] '},
  };
  function ctr(key) {
    var l = 'ja';
    try { l = localStorage.getItem('komaki_lang') || 'ja'; } catch(e) {}
    return _ct[key][l] || _ct[key]['ja'];
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  let currentYear = 2026;
  let currentMonth = 4; // 0-indexed: May = 4

  function pad(n) { return String(n).padStart(2, '0'); }

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
        const isPast = pastDates.has(key);
        dot.className = 'cal-event-dot' + (isPast ? ' past' : '');
        dot.textContent = (isPast ? ctr('done_marker') + ' ' : '★ ') + events[key];
        cell.appendChild(dot);
        cell.title = (isPast ? ctr('done_prefix') : ctr('plan_prefix')) + events[key];
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
})();
