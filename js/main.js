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

  const events = {
    '2025-05-10': {ja:'第1回「学校を考える会」',         en:'1st School Discussion Meeting',          pt:'1ª Reunião de Discussão Escolar',         vi:'Cuộc họp thảo luận lần 1',              tl:'Ika-1 Pagpupulong ng Talakayan',       es:'1ª Reunión de Debate Escolar',          zh:'第1次学校研讨会',            id:'Diskusi Sekolah ke-1'},
    '2025-05-30': {ja:'第2回「学校を考える会」',         en:'2nd School Discussion Meeting',          pt:'2ª Reunião de Discussão Escolar',         vi:'Cuộc họp thảo luận lần 2',              tl:'Ika-2 Pagpupulong ng Talakayan',       es:'2ª Reunión de Debate Escolar',          zh:'第2次学校研讨会',            id:'Diskusi Sekolah ke-2'},
    '2025-06-13': {ja:'地域協議会代表者報告',             en:'Community Council Report',               pt:'Relatório ao Conselho Comunitário',        vi:'Báo cáo Hội đồng Cộng đồng',           tl:'Ulat sa Konseho ng Komunidad',         es:'Informe al Consejo Comunitario',         zh:'社区委员会报告',              id:'Laporan Dewan Komunitas'},
    '2025-06-14': {ja:'区長会報告（1回目）',              en:'Neighborhood Assoc. Report (1st)',        pt:'Relatório Assoc. de Bairro (1º)',          vi:'Báo cáo Hội Khu dân cư (1)',            tl:'Ulat ng Samahan ng Kapitbahayan (1)',   es:'Informe Asoc. Vecinos (1º)',             zh:'自治区协会报告（第1次）',      id:'Laporan Asosiasi Warga (1)'},
    '2025-06-27': {ja:'第3回「学校を考える会」',         en:'3rd School Discussion Meeting',          pt:'3ª Reunião de Discussão Escolar',         vi:'Cuộc họp thảo luận lần 3',              tl:'Ika-3 Pagpupulong ng Talakayan',       es:'3ª Reunión de Debate Escolar',          zh:'第3次学校研讨会',            id:'Diskusi Sekolah ke-3'},
    '2025-07-27': {ja:'城山3・4丁目説明会',              en:'Shiroyama 3&4-chome Briefing',           pt:'Reunião Shiroyama 3&4 Bairros',           vi:'Buổi thông báo Shiroyama 3&4',          tl:'Briefing Shiroyama 3&4-chome',         es:'Charla Shiroyama 3º y 4º barrios',       zh:'城山3&4丁目说明会',          id:'Sosialisasi Shiroyama 3&4'},
    '2025-08-24': {ja:'第1回保護者等意見交換会',          en:'1st Parent Opinion Exchange',            pt:'1ª Reunião de Opiniões de Pais',          vi:'Trao đổi ý kiến PH lần 1',              tl:'Ika-1 Pagpapalitan ng Opinyon',        es:'1ª Reunión Intercambio Padres',          zh:'第1次家长意见交流会',         id:'Pertukaran Pendapat Orang Tua (1)'},
    '2025-08-30': {ja:'第2・3回保護者等意見交換会',       en:'2nd & 3rd Parent Opinion Exchange',      pt:'2ª e 3ª Reuniões de Opiniões',            vi:'Trao đổi ý kiến PH lần 2&3',            tl:'Ika-2 at 3 na Pagpapalitan',           es:'2ª y 3ª Reuniones Intercambio',          zh:'第2次&第3次家长意见交流会',   id:'Pertukaran Pendapat Orang Tua (2&3)'},
    '2025-09-21': {ja:'住民説明会',                      en:'Community Briefing',                     pt:'Reunião Comunitária',                     vi:'Buổi Thông báo Cộng đồng',             tl:'Briefing sa Komunidad',                es:'Charla Comunitaria',                     zh:'社区说明会',                  id:'Sosialisasi Komunitas'},
    '2025-09-26': {ja:'区長会報告（2回目）',              en:'Neighborhood Assoc. Report (2nd)',        pt:'Relatório Assoc. de Bairro (2º)',          vi:'Báo cáo Hội Khu dân cư (2)',            tl:'Ulat ng Samahan ng Kapitbahayan (2)',   es:'Informe Asoc. Vecinos (2º)',             zh:'自治区协会报告（第2次）',      id:'Laporan Asosiasi Warga (2)'},
    '2025-10-11': {ja:'第4回「学校を考える会」',         en:'4th School Discussion Meeting',          pt:'4ª Reunião de Discussão Escolar',         vi:'Cuộc họp thảo luận lần 4',              tl:'Ika-4 Pagpupulong ng Talakayan',       es:'4ª Reunión de Debate Escolar',          zh:'第4次学校研讨会',            id:'Diskusi Sekolah ke-4'},
    '2025-11-02': {ja:'区長会報告（3回目）',              en:'Neighborhood Assoc. Report (3rd)',        pt:'Relatório Assoc. de Bairro (3º)',          vi:'Báo cáo Hội Khu dân cư (3)',            tl:'Ulat ng Samahan ng Kapitbahayan (3)',   es:'Informe Asoc. Vecinos (3º)',             zh:'自治区协会报告（第3次）',      id:'Laporan Asosiasi Warga (3)'},
    '2025-11-10': {ja:'パブコメ開始・新校名アンケート開始', en:'Public Comment Opens / Name Survey',   pt:'Com. Público Abre / Pesquisa de Nome',    vi:'Lấy ý kiến bắt đầu / Khảo sát tên',    tl:'Simula ng Pampublikong Komento',       es:'Com. Público Abre / Encuesta Nombre',    zh:'公众意见征集开始·新校名调查',  id:'Komentar Publik Dibuka / Survei Nama'},
    '2025-11-27': {ja:'地域協議会代表者報告（2回目）',     en:'Community Council Report (2nd)',         pt:'Relatório ao Conselho Comunitário (2º)',  vi:'Báo cáo HĐ Cộng đồng (2)',              tl:'Ulat sa Konseho ng Komunidad (2)',      es:'Informe al Consejo Comunitario (2º)',    zh:'社区委员会报告（第2次）',      id:'Laporan Dewan Komunitas (2)'},
    '2025-12-09': {ja:'パブリックコメント締切（55件）',   en:'Public Comment Closes (55 subs.)',       pt:'Com. Público Encerra (55)',               vi:'Hết hạn ý kiến công cộng (55)',         tl:'Pagtatapos ng Pampublikong Komento',   es:'Com. Público Cierra (55 envíos)',        zh:'公众意见截止（55件）',        id:'Komentar Publik Ditutup (55)'},
    '2026-01-13': {ja:'通学区域審議会',                  en:'School District Advisory Cmte.',         pt:'Comitê de Distrito Escolar',              vi:'Ủy ban Tư vấn Khu vực Trường',         tl:'Komite ng Distrito ng Paaralan',       es:'Comité del Distrito Escolar',            zh:'学区审议委员会',              id:'Komite Penasehat Distrik Sekolah'},
    '2026-02-07': {ja:'第5回「学校を考える会」',         en:'5th School Discussion Meeting',          pt:'5ª Reunião de Discussão Escolar',         vi:'Cuộc họp thảo luận lần 5',              tl:'Ika-5 Pagpupulong ng Talakayan',       es:'5ª Reunión de Debate Escolar',          zh:'第5次学校研讨会',            id:'Diskusi Sekolah ke-5'},
    '2026-05-18': {ja:'校章デザイン募集締切',             en:'School Emblem Design Deadline',          pt:'Prazo do Concurso de Emblema',            vi:'Hạn chót thiết kế huy hiệu',            tl:'Deadline ng Disenyo ng Sagisag',       es:'Plazo Diseño Emblema Escolar',           zh:'校徽设计截止日期',            id:'Batas Desain Lambang Sekolah'},
    '2026-06-06': {ja:'保護者等説明会（桃陵中）',         en:'Parent Briefing (Toryou JHS)',           pt:'Sessão Pais (JHS Toryou)',                vi:'Thông tin PH (THCS Toryou)',            tl:'Briefing Magulang (Toryou JHS)',        es:'Sesión Padres (JHS Toryou)',             zh:'家长说明会（登竜中）',         id:'Sosialisasi Orang Tua (SMP Toryou)'},
    '2026-06-07': {ja:'保護者等説明会（篠岡中）',         en:'Parent Briefing (Shinooka JHS)',         pt:'Sessão Pais (JHS Shinooka)',              vi:'Thông tin PH (THCS Shinooka)',          tl:'Briefing Magulang (Shinooka JHS)',      es:'Sesión Padres (JHS Shinooka)',           zh:'家长说明会（篠岡中）',         id:'Sosialisasi Orang Tua (SMP Shinooka)'},
    '2026-06-14': {ja:'保護者等説明会（陶小）',           en:'Parent Briefing (Sue Elem.)',            pt:'Sessão Pais (Sue Elem.)',                 vi:'Thông tin PH (TH Sue)',                 tl:'Briefing Magulang (Sue Elem.)',         es:'Sesión Padres (Sue Elem.)',              zh:'家长说明会（陶小）',           id:'Sosialisasi Orang Tua (SD Sue)'},
    '2026-06-20': {ja:'保護者等説明会（大城小）',         en:'Parent Briefing (Oshiro Elem.)',         pt:'Sessão Pais (Oshiro Elem.)',              vi:'Thông tin PH (TH Oshiro)',              tl:'Briefing Magulang (Oshiro Elem.)',      es:'Sesión Padres (Oshiro Elem.)',           zh:'家长说明会（大城小）',         id:'Sosialisasi Orang Tua (SD Oshiro)'},
    '2026-06-21': {ja:'保護者等説明会（光ヶ丘中）',       en:'Parent Briefing (Hikarigaoka JHS)',      pt:'Sessão Pais (JHS Hikarigaoka)',           vi:'Thông tin PH (THCS Hikarigaoka)',       tl:'Briefing Magulang (Hikarigaoka JHS)',   es:'Sesión Padres (JHS Hikarigaoka)',        zh:'家长说明会（光丘中）',         id:'Sosialisasi Orang Tua (SMP Hikarigaoka)'},
    '2026-06-29': {ja:'保護者等説明会（東部市民センター）', en:'Parent Briefing (East Community Ctr.)', pt:'Sessão Pais (Centro Comunit. Leste)',     vi:'Thông tin PH (TT Cộng đồng Đông)',     tl:'Briefing Magulang (Sentro Komunidad)',  es:'Sesión Padres (Centro Comunit. Este)',   zh:'家长说明会（东部市民中心）',    id:'Sosialisasi Orang Tua (Pusat Komunitas Timur)'},
    '2027-04-01': {ja:'第1期再編 実施予定（しのおか学園）', en:'Phase 1 Reorganization (Shinooka Gakuen)', pt:'Fase 1 Reorganização (Shinooka Gakuen)', vi:'Tái cơ cấu GĐ1 (Shinooka Gakuen)',    tl:'Bahagi 1 Muling Pagsasaayos',          es:'Fase 1 Reorganización (Shinooka Gakuen)', zh:'第1期整合（篠岡学园）',      id:'Reorganisasi Tahap 1 (Shinooka Gakuen)'},
  };
  function getEventLabel(key) {
    var l = 'ja';
    try { l = localStorage.getItem('komaki_lang') || 'ja'; } catch(e) {}
    var ev = events[key];
    return ev ? (ev[l] || ev.ja) : '';
  }
  const pastDates = new Set([
    '2025-05-10','2025-05-30','2025-06-13','2025-06-14','2025-06-27',
    '2025-07-27','2025-08-24','2025-08-30','2025-09-21','2025-09-26',
    '2025-10-11','2025-11-02','2025-11-10','2025-11-27','2025-12-09',
    '2026-01-13','2026-02-07',
  ]);

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
})();
