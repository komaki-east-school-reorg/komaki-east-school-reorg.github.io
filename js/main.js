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

  const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
  const today = new Date();
  today.setHours(0,0,0,0);

  let currentYear = 2026;
  let currentMonth = 4; // 0-indexed: May = 4

  function pad(n) { return String(n).padStart(2, '0'); }

  function renderCalendar(year, month) {
    const monthLabel = document.getElementById('cal-month-label');
    monthLabel.textContent = `${year}年${month + 1}月`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const grid = document.getElementById('cal-days');
    grid.innerHTML = '';

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
        dot.textContent = (isPast ? '済 ' : '★ ') + events[key];
        cell.appendChild(dot);
        cell.title = (isPast ? '[済] ' : '[予定] ') + events[key];
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
})();

