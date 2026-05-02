/* ===== i18n: Multi-language support (JA / EN / PT / VI) ===== */
(function () {
  'use strict';

  const LANGS = ['ja', 'en', 'pt', 'vi'];
  const DEFAULT = 'ja';

  const T = {
    ja: {
      /* ---- notice ---- */
      notice: '⚠️ このサイトは市民有志による情報提供サイトです。小牧市の公式サイトではありません。公式情報は <a href="https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/index.html" target="_blank" rel="noopener" style="color:#5a4000;font-weight:700;">小牧市教育委員会のページ</a> をご確認ください。',
      /* ---- nav ---- */
      nav_home: 'ホーム',
      nav_about: '計画概要',
      nav_schedule: 'スケジュール',
      nav_voices: '賛否の声',
      nav_faq: 'よくある質問',
      nav_council: '議会審議',
      nav_map: '学校の場所（地図）',
      /* ---- site title ---- */
      site_sub: '市民情報サイト（非公式）',
      /* ---- footer ---- */
      footer_title: '小牧市東部（篠岡地区）学校再編計画 市民情報サイト',
      footer_tagline: '篠岡地区の学校再編計画について、小牧市公式情報をもとにわかりやすく情報提供することを目的とした市民有志サイトです。',
      footer_pages: 'ページ一覧',
      footer_official: '参考リンク（公式）',
      footer_official_link: '小牧市 学校再編計画（市公式）',
      footer_copyright: '© 2026 小牧市東部（篠岡地区）学校再編計画 市民情報サイト（非公式）｜このサイトは市民有志が運営しており、小牧市・教育委員会とは無関係です。',
      /* ---- index: hero ---- */
      hero_title: '小牧市東部（篠岡地区）<br>学校再編計画',
      hero_sub: '小牧市東部（篠岡地区）の小中学校の再編について、<br>公式情報をもとにわかりやすくお伝えします。',
      hero_badge1: '📍 小牧市東部（篠岡地区）',
      hero_badge2: '🏫 小学校5校・中学校3校 → 東西各2校',
      hero_badge3: '📅 令和9年度（2027年度）実施予定',
      /* ---- index: upcoming bar ---- */
      upcoming_label: '📅 今後のスケジュール',
      upcoming_more: '詳細 →',
      /* ---- index: section titles ---- */
      section_whatis: '小牧市東部（篠岡地区）学校再編計画とは<small>About the Reorganization Plan</small>',
      section_points: '3つのポイント<small>Key Points</small>',
      section_links: '各ページへのリンク<small>Quick Links</small>',
      section_news: '市公式サイト お知らせ<small>Official Announcements</small>',
      section_status: '現在の状況（2026年5月時点）<small>Current Status</small>',
      /* ---- index: key point cards ---- */
      point1_h: 'なぜ再編が必要なのか',
      point1_link: '詳しく見る →',
      point2_h: '何が計画されているか',
      point2_link: '計画概要を見る →',
      point3_h: 'これまでの経緯',
      point3_link: 'スケジュールを確認 →',
      /* ---- index: quick link cards ---- */
      ql_about_h: '計画概要', ql_about_link: '計画概要を見る →',
      ql_schedule_h: 'スケジュール', ql_schedule_link: 'カレンダーを見る →',
      ql_voices_h: '賛否の声', ql_voices_link: '意見を見る →',
      ql_faq_h: 'よくある質問', ql_faq_link: 'FAQを見る →',
      ql_council_h: '議会審議', ql_council_link: '審議内容を見る →',
      ql_map_h: '学校の場所（地図）', ql_map_link: '地図を見る →',
      /* ---- index: status btn ---- */
      btn_schedule: 'スケジュール詳細を見る →',
      btn_official: '市公式ページ →',
      /* ---- page heroes ---- */
      about_h1: '計画概要',
      about_p: '「小牧市東部（篠岡地区）学校再編計画」の背景・現状・再編内容・通学計画を小牧市の公式情報をもとに解説します。',
      schedule_h1: 'スケジュール',
      schedule_p: '令和7年（2025年）の取組実績と、令和9年（2027年）の再編実施に向けた全体の流れを掲載しています。',
      voices_h1: '賛否の声',
      voices_p: '地域住民・保護者・教員経験者など、さまざまな立場からの意見を公平にご紹介します。',
      faq_h1: 'よくある質問',
      faq_p: '市の公式情報をもとに、地域説明会などで多く寄せられた疑問にお答えします。クリックして回答を表示します。',
      map_h1: '学校の場所（地図）',
      map_p: '篠岡地区の学校の位置情報です。再編前8校・再編後4校の場所をご確認いただけます。',
      council_h1: '議会での審議',
      council_p: '令和8年（2026年）第1回定例会における、学校再編に関する条例改正・委員会審査・一般質問・請願の内容をまとめています。',
    },

    en: {
      notice: '⚠️ This is an unofficial community site and is not the official Komaki City website. For official information, please visit the <a href="https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/index.html" target="_blank" rel="noopener" style="color:#5a4000;font-weight:700;">Komaki City Board of Education</a>.',
      nav_home: 'Home',
      nav_about: 'About the Plan',
      nav_schedule: 'Schedule',
      nav_voices: 'Community Voices',
      nav_faq: 'FAQ',
      nav_council: 'Council Proceedings',
      nav_map: 'School Locations (Map)',
      site_sub: 'Community Info Site (Unofficial)',
      footer_title: 'Komaki East School Reorganization – Community Info Site',
      footer_tagline: 'A volunteer community site providing easy-to-understand information on the Shinooka school reorganization plan, based on official Komaki City sources.',
      footer_pages: 'Pages',
      footer_official: 'Official Links',
      footer_official_link: 'Komaki City School Reorganization (Official)',
      footer_copyright: '© 2026 Komaki East School Reorganization Community Info Site (Unofficial) | This site is operated by community volunteers and is not affiliated with Komaki City or its Board of Education.',
      hero_title: 'Komaki City East (Shinooka Area)<br>School Reorganization Plan',
      hero_sub: 'Easy-to-understand information on the reorganization of elementary and junior high schools in the Shinooka area of eastern Komaki City, based on official sources.',
      hero_badge1: '📍 Komaki City East (Shinooka Area)',
      hero_badge2: '🏫 5 elementary + 3 junior high → 2 + 2 schools',
      hero_badge3: '📅 Planned for FY2027 (April 2027)',
      upcoming_label: '📅 Upcoming Events',
      upcoming_more: 'Details →',
      section_whatis: 'What is the Shinooka School Reorganization Plan?<small>About the Reorganization Plan</small>',
      section_points: 'Three Key Points<small>Key Points</small>',
      section_links: 'Page Links<small>Quick Links</small>',
      section_news: 'Official City Announcements<small>Official Announcements</small>',
      section_status: 'Current Status (as of May 2026)<small>Current Status</small>',
      point1_h: 'Why Is Reorganization Needed?',
      point1_link: 'Learn more →',
      point2_h: 'What Is Planned?',
      point2_link: 'See the plan →',
      point3_h: 'History & Background',
      point3_link: 'View schedule →',
      ql_about_h: 'About the Plan', ql_about_link: 'See the plan →',
      ql_schedule_h: 'Schedule', ql_schedule_link: 'View calendar →',
      ql_voices_h: 'Community Voices', ql_voices_link: 'See opinions →',
      ql_faq_h: 'FAQ', ql_faq_link: 'See FAQ →',
      ql_council_h: 'Council Proceedings', ql_council_link: 'See proceedings →',
      ql_map_h: 'School Locations (Map)', ql_map_link: 'View map →',
      btn_schedule: 'View full schedule →',
      btn_official: 'Official city page →',
      about_h1: 'About the Plan',
      about_p: 'Detailed information on the Shinooka school reorganization plan — background, current situation, target schools, and commuting arrangements — based on official Komaki City sources.',
      schedule_h1: 'Schedule',
      schedule_p: 'Key events from 2025 and the overall roadmap toward the school reorganization in April 2027.',
      voices_h1: 'Community Voices',
      voices_p: 'A balanced overview of perspectives from local residents, parents, former teachers, and others.',
      faq_h1: 'Frequently Asked Questions',
      faq_p: 'Common questions about the reorganization plan and answers based on official city responses. Click to expand each answer.',
      map_h1: 'School Locations (Map)',
      map_p: 'View the locations of current schools and planned new school sites in the Shinooka area.',
      council_h1: 'Council Proceedings',
      council_p: 'A summary of the ordinance amendment, committee review, general questions, and petitions at the 1st Regular Council Session of 2026.',
    },

    pt: {
      notice: '⚠️ Este é um site comunitário não oficial. Não é o site oficial da Cidade de Komaki. Para informações oficiais, acesse o <a href="https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/index.html" target="_blank" rel="noopener" style="color:#5a4000;font-weight:700;">Conselho de Educação de Komaki</a>.',
      nav_home: 'Início',
      nav_about: 'Sobre o Plano',
      nav_schedule: 'Cronograma',
      nav_voices: 'Opiniões da Comunidade',
      nav_faq: 'Perguntas Frequentes',
      nav_council: 'Deliberações do Conselho',
      nav_map: 'Localização das Escolas (Mapa)',
      site_sub: 'Site Informativo da Comunidade (Não Oficial)',
      footer_title: 'Reorganização Escolar do Leste de Komaki – Site Informativo',
      footer_tagline: 'Site de voluntários comunitários com informações sobre o plano de reorganização escolar Shinooka, baseado em fontes oficiais de Komaki.',
      footer_pages: 'Páginas',
      footer_official: 'Links Oficiais',
      footer_official_link: 'Reorganização Escolar de Komaki (Oficial)',
      footer_copyright: '© 2026 Site Informativo da Reorganização Escolar do Leste de Komaki (Não Oficial) | Este site é operado por voluntários comunitários e não é afiliado à Cidade de Komaki ou ao seu Conselho de Educação.',
      hero_title: 'Plano de Reorganização Escolar<br>do Leste de Komaki (Área Shinooka)',
      hero_sub: 'Informações sobre a reorganização das escolas primárias e secundárias na área Shinooka, leste de Komaki, com base em fontes oficiais.',
      hero_badge1: '📍 Leste de Komaki (Área Shinooka)',
      hero_badge2: '🏫 5 primárias + 3 secundárias → 2 + 2 escolas',
      hero_badge3: '📅 Previsto para o ano letivo 2027',
      upcoming_label: '📅 Próximos Eventos',
      upcoming_more: 'Detalhes →',
      section_whatis: 'O que é o Plano de Reorganização Escolar Shinooka?<small>Sobre o Plano</small>',
      section_points: 'Três Pontos Principais<small>Key Points</small>',
      section_links: 'Links das Páginas<small>Quick Links</small>',
      section_news: 'Avisos Oficiais da Cidade<small>Official Announcements</small>',
      section_status: 'Situação Atual (maio de 2026)<small>Current Status</small>',
      point1_h: 'Por que a Reorganização é Necessária?',
      point1_link: 'Saiba mais →',
      point2_h: 'O que Está Planejado?',
      point2_link: 'Ver o plano →',
      point3_h: 'Histórico',
      point3_link: 'Ver cronograma →',
      ql_about_h: 'Sobre o Plano', ql_about_link: 'Ver o plano →',
      ql_schedule_h: 'Cronograma', ql_schedule_link: 'Ver calendário →',
      ql_voices_h: 'Opiniões da Comunidade', ql_voices_link: 'Ver opiniões →',
      ql_faq_h: 'Perguntas Frequentes', ql_faq_link: 'Ver FAQ →',
      ql_council_h: 'Deliberações do Conselho', ql_council_link: 'Ver deliberações →',
      ql_map_h: 'Localização das Escolas (Mapa)', ql_map_link: 'Ver mapa →',
      btn_schedule: 'Ver cronograma completo →',
      btn_official: 'Página oficial da cidade →',
      about_h1: 'Sobre o Plano',
      about_p: 'Informações detalhadas sobre o plano de reorganização escolar Shinooka — contexto, situação atual, escolas-alvo e transporte — com base em fontes oficiais de Komaki.',
      schedule_h1: 'Cronograma',
      schedule_p: 'Eventos principais de 2025 e o roteiro geral para a reorganização escolar em abril de 2027.',
      voices_h1: 'Opiniões da Comunidade',
      voices_p: 'Uma visão equilibrada das perspectivas de moradores locais, pais, ex-professores e outros.',
      faq_h1: 'Perguntas Frequentes',
      faq_p: 'Perguntas comuns sobre o plano de reorganização e respostas baseadas nas declarações oficiais da cidade. Clique para expandir cada resposta.',
      map_h1: 'Localização das Escolas (Mapa)',
      map_p: 'Veja a localização das escolas atuais e dos novos locais planejados na área Shinooka.',
      council_h1: 'Deliberações do Conselho',
      council_p: 'Resumo da emenda à ordenança, revisão em comissão, perguntas gerais e petições na 1ª Sessão Regular do Conselho de 2026.',
    },

    vi: {
      notice: '⚠️ Đây là trang web cộng đồng không chính thức, không phải trang web chính thức của Thành phố Komaki. Để biết thông tin chính thức, vui lòng truy cập <a href="https://www.city.komaki.aichi.jp/admin/soshiki/kyoiku/kyouikusoumu/303/index.html" target="_blank" rel="noopener" style="color:#5a4000;font-weight:700;">Ban Giáo dục Thành phố Komaki</a>.',
      nav_home: 'Trang chủ',
      nav_about: 'Tổng quan kế hoạch',
      nav_schedule: 'Lịch trình',
      nav_voices: 'Tiếng nói cộng đồng',
      nav_faq: 'Câu hỏi thường gặp',
      nav_council: 'Nghị quyết hội đồng',
      nav_map: 'Vị trí trường học (Bản đồ)',
      site_sub: 'Trang thông tin cộng đồng (Không chính thức)',
      footer_title: 'Tái cơ cấu trường học phía Đông Komaki – Trang thông tin cộng đồng',
      footer_tagline: 'Trang web tình nguyện cộng đồng cung cấp thông tin dễ hiểu về kế hoạch tái cơ cấu trường học Shinooka, dựa trên nguồn thông tin chính thức của Komaki.',
      footer_pages: 'Trang',
      footer_official: 'Liên kết chính thức',
      footer_official_link: 'Tái cơ cấu trường học Komaki (Chính thức)',
      footer_copyright: '© 2026 Trang thông tin cộng đồng tái cơ cấu trường học phía Đông Komaki (Không chính thức) | Trang web này do tình nguyện viên cộng đồng vận hành và không liên kết với Thành phố Komaki hay Ban Giáo dục.',
      hero_title: 'Kế hoạch tái cơ cấu trường học<br>phía Đông Komaki (Khu vực Shinooka)',
      hero_sub: 'Thông tin về việc tái cơ cấu các trường tiểu học và THCS tại khu vực Shinooka, phía đông Komaki, dựa trên nguồn thông tin chính thức.',
      hero_badge1: '📍 Phía Đông Komaki (Khu vực Shinooka)',
      hero_badge2: '🏫 5 tiểu học + 3 THCS → 2 + 2 trường',
      hero_badge3: '📅 Dự kiến năm học 2027 (tháng 4/2027)',
      upcoming_label: '📅 Lịch sắp tới',
      upcoming_more: 'Chi tiết →',
      section_whatis: 'Kế hoạch tái cơ cấu trường học Shinooka là gì?<small>Về kế hoạch tái cơ cấu</small>',
      section_points: 'Ba điểm chính<small>Key Points</small>',
      section_links: 'Liên kết trang<small>Quick Links</small>',
      section_news: 'Thông báo chính thức của thành phố<small>Official Announcements</small>',
      section_status: 'Tình trạng hiện tại (tháng 5/2026)<small>Current Status</small>',
      point1_h: 'Tại sao cần tái cơ cấu?',
      point1_link: 'Tìm hiểu thêm →',
      point2_h: 'Điều gì được lên kế hoạch?',
      point2_link: 'Xem kế hoạch →',
      point3_h: 'Lịch sử & Bối cảnh',
      point3_link: 'Xem lịch trình →',
      ql_about_h: 'Tổng quan kế hoạch', ql_about_link: 'Xem kế hoạch →',
      ql_schedule_h: 'Lịch trình', ql_schedule_link: 'Xem lịch →',
      ql_voices_h: 'Tiếng nói cộng đồng', ql_voices_link: 'Xem ý kiến →',
      ql_faq_h: 'Câu hỏi thường gặp', ql_faq_link: 'Xem FAQ →',
      ql_council_h: 'Nghị quyết hội đồng', ql_council_link: 'Xem nghị quyết →',
      ql_map_h: 'Vị trí trường học (Bản đồ)', ql_map_link: 'Xem bản đồ →',
      btn_schedule: 'Xem lịch trình đầy đủ →',
      btn_official: 'Trang chính thức của thành phố →',
      about_h1: 'Tổng quan kế hoạch',
      about_p: 'Thông tin chi tiết về kế hoạch tái cơ cấu trường học Shinooka — bối cảnh, tình hình hiện tại, các trường mục tiêu và phương tiện đi lại — dựa trên nguồn thông tin chính thức của Komaki.',
      schedule_h1: 'Lịch trình',
      schedule_p: 'Các sự kiện chính từ năm 2025 và lộ trình hướng tới việc tái cơ cấu trường học vào tháng 4 năm 2027.',
      voices_h1: 'Tiếng nói cộng đồng',
      voices_p: 'Cái nhìn cân bằng về quan điểm của cư dân địa phương, phụ huynh, cựu giáo viên và những người khác.',
      faq_h1: 'Câu hỏi thường gặp',
      faq_p: 'Các câu hỏi phổ biến và câu trả lời dựa trên tuyên bố chính thức của thành phố. Nhấp để xem câu trả lời.',
      map_h1: 'Vị trí trường học (Bản đồ)',
      map_p: 'Xem vị trí các trường hiện tại và địa điểm trường mới được lên kế hoạch tại khu vực Shinooka.',
      council_h1: 'Nghị quyết hội đồng',
      council_p: 'Tóm tắt sửa đổi quy định, đánh giá ủy ban, câu hỏi chung và kiến nghị tại Phiên họp thường kỳ lần 1 năm 2026.',
    },
  };

  function applyLang(lang) {
    if (!LANGS.includes(lang)) lang = DEFAULT;
    const dict = Object.assign({}, T[DEFAULT], T[lang]);

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.dataset.i18n;
      if (dict[key] != null) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.dataset.i18nHtml;
      if (dict[key] != null) el.innerHTML = dict[key];
    });
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    var langAttr = { ja: 'ja', en: 'en', pt: 'pt-BR', vi: 'vi' };
    document.documentElement.lang = langAttr[lang] || lang;
    try { localStorage.setItem('komaki_lang', lang); } catch (e) {}
  }

  function init() {
    var saved;
    try { saved = localStorage.getItem('komaki_lang'); } catch (e) {}
    var lang = LANGS.includes(saved) ? saved : DEFAULT;
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { applyLang(btn.dataset.lang); });
    });
    applyLang(lang);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
