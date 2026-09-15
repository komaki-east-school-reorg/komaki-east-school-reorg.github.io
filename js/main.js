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

/* ===== 市の原文の「日時」を表示言語に直す（このファイル共通） =====
   自動取得コーナーの日時欄は市の書いた日本語のまま届く（例:「9月23日 13時30分～16時00分」
   「令和8年11月15日(日曜日)14時から（開場13時）」）。見出しとちがい、日時は表記の問題で
   しかないので、読み取れた日付と時刻だけを表示言語の書式に組み直す。
   ・日本語表示では原文をそのまま返す。
   ・opts.timeOnly のときは時刻だけを返す（日付を別の欄で出しているコーナー用）。
     時刻が無く日付だけ読めたときは空文字（＝同じ日付を二度出さない）。
   ・日付も時刻も読めなければ原文を返す（欠測より原文のほうがまし）。 */
window.KomakiJaWhen = (function () {
  var DOORS = {en: 'doors open', pt: 'abertura', vi: 'mở cửa', tl: 'bukas ang pinto', es: 'apertura de puertas',
               zh: '入场', id: 'pintu dibuka', tr: 'kapılar açılır', my: 'တံခါးဖွင့်'};
  var LOCALE = {tl: 'fil'};
  function hm(h, m) { return h + ':' + ('0' + (m || 0)).slice(-2); }
  return function (text, lang, opts) {
    opts = opts || {};
    if (!text || lang === 'ja') return text || '';
    var t = String(text).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
    var date = '';
    var dm = /(?:令和(\d+)年)?(\d{1,2})月(\d{1,2})日/.exec(t);
    if (dm) {
      var y = dm[1] ? 2018 + (+dm[1]) : new Date().getFullYear();
      var d = new Date(y, +dm[2] - 1, +dm[3]);
      var o = {month: 'short', day: 'numeric', weekday: 'short'};
      if (dm[1]) o.year = 'numeric';
      try { date = d.toLocaleDateString(LOCALE[lang] || lang, o); } catch (e) { date = ''; }
    }
    var doors = '';
    t = t.replace(/開場\s*(\d{1,2})時(?:(\d{1,2})分)?/, function (_, h, m) { doors = hm(h, m); return ''; });
    var time = '';
    var rm = /(\d{1,2})時(?:(\d{1,2})分)?\s*[～〜~\-－ー]\s*(\d{1,2})時(?:(\d{1,2})分)?/.exec(t);
    if (rm) {
      time = hm(rm[1], rm[2]) + '–' + hm(rm[3], rm[4]);
    } else {
      var sm = /(\d{1,2})時(?:(\d{1,2})分)?(から)?/.exec(t);
      if (sm) time = hm(sm[1], sm[2]) + (sm[3] ? ' –' : '');
    }
    if (time && doors) time += ' (' + (DOORS[lang] || DOORS.en) + ' ' + doors + ')';
    if (opts.timeOnly) return time || (date ? '' : text);
    if (!date && !time) return text;
    return [date, time].filter(Boolean).join(' ');
  };
})();

/* ===== 自動取得した見出しの訳（このファイル共通） =====
   2026-09-14 ユーザー指示：自動取得した見出しを原文のまま残さず、表示言語に訳す。
   訳は data/headline_i18n.json（.github/workflows/translate-headlines.yml が毎日更新）に
   「見出しの原文 → 9言語」で入っている。各コーナーは見出しの要素に data-hl="原文" を付けて
   描き、描き終えたら apply(container) を呼ぶ。日本語以外の表示なら、その要素の文字を訳に
   置き換える。
   ・訳がまだ無い見出し（取得された直後で、翻訳ジョブがまだ走っていないもの）だけは原文のまま。
     見出しごと隠すと、新着があったこと自体が伝わらなくなるため。
   ・日本語（こどもむけを含む）では何もしない。
   ・訳を取るのは text() でも同じ。帯（TOP CUT-IN）のように文字列で持つところが使う。 */
window.KomakiHeadline = (function () {
  var p = null;
  function load() {
    if (!p) {
      p = fetch('./data/headline_i18n.json')
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (d) { return (d && d.items) || {}; })
        .catch(function () { return {}; });
    }
    return p;
  }
  function pick(map, src, lang) {
    var e = map[src];
    return (e && e[lang]) || '';
  }
  function apply(root) {
    var lang = window.KomakiLang();
    if (lang === 'ja' || !root) return Promise.resolve();
    return load().then(function (map) {
      root.querySelectorAll('[data-hl]').forEach(function (el) {
        var tr = pick(map, el.getAttribute('data-hl'), lang);
        if (!tr) return;
        el.textContent = tr;
        el.setAttribute('lang', lang);
      });
    });
  }
  // 文字列の見出しを訳す（訳が無ければ原文）。呼ぶ前に load() を待つこと。
  function text(map, src) {
    var lang = window.KomakiLang();
    return lang === 'ja' ? src : (pick(map, src, lang) || src);
  }
  if (window.KomakiLang() !== 'ja') load();   // 各コーナーの描画より先に取りに行っておく
  return {load: load, apply: apply, text: text};
})();

/* ===== 学年の解決（このファイル共通） =====
   URL の ?grade=xx を最優先し、次に localStorage。指定が無ければ空文字。
   ?lang= と同じ考え方で、共有されたリンクを開いた人にもその学年で見せる。
   値は「令和8年度（2026年度）に何年生か」で、y3=年少 y4=年中 y5=年長
   e1〜e6=小学1〜6年 j1〜j3=中学1〜3年。
   学年は日付から学年を計算するためだけに使う。市の計画に学年別の扱いが
   あるという意味ではない（その旨は grade_lead に明記してある）。 */
window.KomakiGrade = (function () {
  var CODES = ['y3', 'y4', 'y5', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'j1', 'j2', 'j3'];
  return function getGrade() {
    try {
      var q = new URLSearchParams(location.search).get('grade');
      if (CODES.indexOf(q) !== -1) return q;
    } catch (e) {}
    try {
      var v = localStorage.getItem('komaki_grade') || '';
      return CODES.indexOf(v) !== -1 ? v : '';
    } catch (e) { return ''; }
  };
})();

/* ===== TOP CUT-IN（index.html 上部）=====
   「このサイトで今何が新しいか」に気づいてもらうための、期間限定の帯。
   WINDOW_DAYS 日以内のものを、ヘッダの上にスライドインさせる。出すのは3種類:
     ・新機能   … data/site-updates.json の type:"feature"
     ・更新     … data/site-updates.json の type:"content"（掲載内容の追加・修正）
     ・お知らせ … data/news.json（市公式サイトのお知らせ。日本語以外では見出しを訳して出す）
   type:"fix" は出さない。誤字直しや体裁の修正は、帯で知らせる話ではない。

   【新しい情報源を作らない】
   文面は更新履歴と市のお知らせ、どちらも既にサイトが持っているデータそのもの。
   カットイン専用のお知らせデータを別に持つと、元の一覧と食い違ったまま
   気づけなくなる。だから「更新履歴に1行足す」「市がページを更新する」だけで、
   ここは自動で出る。期間を過ぎれば自動で消えるので、消し忘れも起きない。

   【リンクは中に留める】
   市のお知らせでも、飛び先は本文の該当コーナー（#news）にする。帯から直接
   市の個別ページへ出すと、読者が説明を読まないまま外へ抜けてしまう。

   【うるさくしない】
   ・閉じたら、その項目は二度と出さない（localStorage: komaki_feature_seen）。
   ・複数あるときは1本ずつ入れ替える（最大3件）。ページを開いた直後は
     読み込み中の視線を奪わないよう、少し置いてから出す。
   ・prefers-reduced-motion のときはスライドさせず、そのまま出す。 */
(function () {
  var host = document.getElementById('feature-cutin');
  if (!host) return;

  var WINDOW_DAYS = 14;      // 掲載から何日出すか
  var MAX_ITEMS = 3;         // 入れ替えで見せる最大件数
  var ROTATE_MS = 7000;      // 入れ替えの間隔
  var APPEAR_MS = 900;       // 表示を始めるまでの間

  var _fl = window.KomakiLang();
  var strings = document.getElementById('feature-strings');
  function t(key, fallback) {
    var el = strings && strings.querySelector('[data-fk="' + key + '"]');
    var v = el && el.textContent;
    return (v && v.trim()) || fallback;
  }

  function seen() {
    try { return JSON.parse(localStorage.getItem('komaki_feature_seen') || '[]'); }
    catch (e) { return []; }
  }
  function markSeen(id) {
    try {
      var a = seen();
      if (a.indexOf(id) === -1) a.push(id);
      localStorage.setItem('komaki_feature_seen', JSON.stringify(a.slice(-40)));
    } catch (e) {}
  }

  function daysSince(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
    if (!m) return Infinity;
    var then = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var now = new Date();
    var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((today - then) / 86400000);
  }

  // 市のお知らせの日付は「YYYY年MM月DD日」。帯では他の情報源と同じ物差しで
  // 並べたいので ISO に直す。読めないものは落とす（日付の分からない新着は出さない）。
  function isoOf(t) {
    var m = /^(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(t || '');
    if (!m) return '';
    return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  }

  var KIND = {
    feature: {labelKey: 'label',        labelJa: '新機能',       href: '#site-updates', moreKey: 'more',      moreJa: '更新履歴を見る'},
    content: {labelKey: 'label_update', labelJa: '更新',         href: '#site-updates', moreKey: 'more',      moreJa: '更新履歴を見る'},
    news:    {labelKey: 'label_news',   labelJa: '市からのお知らせ', href: '#news',      moreKey: 'more_news', moreJa: 'お知らせを見る'}
  };

  function inWindow(d) {
    var age = daysSince(d);
    return age >= 0 && age <= WINDOW_DAYS;
  }

  function get(url) {
    return fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  Promise.all([get('./data/site-updates.json'), get('./data/news.json'), window.KomakiHeadline.load()])
    .then(function (res) {
      var done = seen();
      var pool = [];

      // 更新履歴（新機能・掲載内容）。本文は 対象言語 → en → ja
      // （i18n.js のフォールバックと揃える）。
      ((res[0] && res[0].updates) || []).forEach(function (u) {
        if (u.type !== 'feature' && u.type !== 'content') return;
        if (!inWindow(u.date)) return;
        pool.push({
          kind: u.type,
          date: u.date,
          id: u.type + '|' + u.date + '|' + (u.ja || ''),
          text: u[_fl] || u.en || u.ja || ''
        });
      });

      // 市公式サイトのお知らせ。見出しは表示言語に訳す（訳がまだ無いものだけ原文）。
      // 閉じた記録（id）は原文で持つ — 言語を変えても同じ項目として扱うため。
      ((res[1] && res[1].items) || []).forEach(function (it) {
        var d = isoOf(it.updated_at);
        if (!d || !inWindow(d)) return;
        pool.push({
          kind: 'news',
          date: d,
          id: 'news|' + d + '|' + (it.title || ''),
          text: window.KomakiHeadline.text(res[2] || {}, it.title || '')
        });
      });

      var items = pool
        .filter(function (u) { return u.text && done.indexOf(u.id) === -1; })
        .sort(function (a, b) { return (a.date < b.date) - (a.date > b.date); });
      if (!items.length) return;
      // 閉じたときは「期間内の項目ぜんぶ」を見たことにする。表示した3件だけを
      // 記録すると、次に開いたときに少し前の項目が繰り上がって出てきてしまう。
      var all = items;

      /* 3つの枠を種類で取り合わせない。まず種類ごとの最新を1件ずつ確保し、
         余った枠を日付順で埋める。単純に日付順で上から3件にすると、
         サイトを続けて更新した日には市のお知らせが押し出され、
         いちばん知らせたい公式の新着が一度も出ないまま期間が過ぎてしまう。
         枠を取る順は お知らせ → 新機能 → 更新（公式の情報がいちばん強い）。 */
      var firstOf = {};
      items.forEach(function (it) { if (!firstOf[it.kind]) firstOf[it.kind] = it; });
      var picked = [];
      ['news', 'feature', 'content'].forEach(function (k) {
        if (firstOf[k] && picked.length < MAX_ITEMS) picked.push(firstOf[k]);
      });
      items.forEach(function (it) {
        if (picked.length < MAX_ITEMS && picked.indexOf(it) === -1) picked.push(it);
      });
      items = picked.sort(function (a, b) { return (a.date < b.date) - (a.date > b.date); });

      // ラベルと飛び先は項目ごとに変わるので、data-i18n は付けない
      // （i18n.js に上書きされると、種類と食い違った札が出てしまう）。
      var label = document.createElement('span');
      label.className = 'feature-cutin-label';

      var text = document.createElement('span');
      text.className = 'feature-cutin-text';
      text.setAttribute('role', 'status');

      var more = document.createElement('a');
      more.className = 'feature-cutin-more';

      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'feature-cutin-close';
      close.setAttribute('data-i18n-aria', 'feature_new_close');
      close.setAttribute('aria-label', t('close', '閉じる'));
      close.textContent = '×';

      host.appendChild(label);
      host.appendChild(text);
      host.appendChild(more);
      host.appendChild(close);

      var idx = 0, timer = null;
      function show(i) {
        idx = i;
        var k = KIND[items[i].kind] || KIND.feature;
        label.textContent = t(k.labelKey, k.labelJa);
        label.className = 'feature-cutin-label is-' + items[i].kind;
        more.href = k.href;
        more.textContent = t(k.moreKey, k.moreJa);
        text.textContent = items[i].text;
        host.classList.remove('is-swap');
        // 入れ替えを1回のリフローで確実に走らせる
        void host.offsetWidth;
        host.classList.add('is-swap');
      }
      function stop() {
        if (timer) { clearInterval(timer); timer = null; }
      }
      close.addEventListener('click', function () {
        stop();
        all.forEach(function (it) { markSeen(it.id); });
        host.classList.remove('is-open');
        window.setTimeout(function () { host.hidden = true; }, 400);
      });
      // 読んでいる最中に入れ替わらないよう、マウスやフォーカスが乗ったら止める
      ['mouseenter', 'focusin'].forEach(function (ev) {
        host.addEventListener(ev, stop);
      });

      host.hidden = false;
      window.setTimeout(function () {
        host.classList.add('is-open');
        show(0);
        if (items.length > 1) {
          timer = window.setInterval(function () { show((idx + 1) % items.length); }, ROTATE_MS);
        }
      }, APPEAR_MS);
    })
    .catch(function () { /* 出せなくても本文には影響しないので黙って諦める */ });
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

/* ===== HEADER NAV FIT（PC のリンクメニュー）=====
   段数（必ず2段）は CSS のグリッドが保証しているので、ここでやるのは
   「横に溢れない範囲でいちばん大きい文字」を実測で選ぶことだけ。

   なぜ実測するのか: ラベルの合計幅は日本語 26em に対しビルマ語 57em と
   2倍以上ちがい、CSS の clamp() のように窓幅だけで決める式にすると、
   長い言語では溢れ、短い言語では無駄に小さくなる。溢れた場合、CSS 側は
   overflow:hidden なので黙って端が切れる（気づけない壊れ方をする）。

   走らせる契機は「読み込み直後」「i18n.js が文言を差し替えたとき」
   「言語・こどもモードの切替」「窓幅の変化」。文言の差し替えは
   MutationObserver で拾う（i18n.js は完了イベントを出さないため）。 */
(function () {
  var ul = document.querySelector('header nav ul');
  if (!ul) return;

  var MAX = 13.5, MIN = 8, STEP = 0.5;   // px
  var mq = window.matchMedia('(min-width: 769px)');
  var busy = false;

  function pad(fs) { return (fs >= 12 ? 0.42 : fs >= 10 ? 0.3 : 0.2) + 'rem'; }

  function fit() {
    // 768px 以下はハンバーガーの縦並び。ここで付けた値は邪魔になるので外す
    if (!mq.matches) {
      ul.style.fontSize = '';
      ul.style.removeProperty('--nav-pad');
      ul.classList.remove('nav-fit-tight');
      return;
    }
    ul.classList.remove('nav-fit-tight');
    for (var fs = MAX; fs >= MIN; fs -= STEP) {
      ul.style.fontSize = fs + 'px';
      ul.style.setProperty('--nav-pad', pad(fs));
      // scrollWidth は overflow:hidden でも溢れたぶんを含む。
      // 端数の切り上げで 1px 溢れることがあるので、余裕は見ない
      if (ul.scrollWidth <= ul.clientWidth) return;
    }
    // 最小でも1行に収まらないほど狭いとき（ビルマ語×狭い PC 窓など）。
    // セル内で折り返させる。行数は2行のままで、切れて読めなくなるよりよい
    ul.classList.add('nav-fit-tight');
  }

  function schedule() {
    if (busy) return;
    busy = true;
    requestAnimationFrame(function () { busy = false; fit(); });
  }

  fit();
  window.addEventListener('resize', schedule, {passive: true});
  window.addEventListener('load', schedule);
  // i18n.js による文言の差し替え（初回の適用・言語切替・こどもモード）
  if (window.MutationObserver) {
    new MutationObserver(schedule).observe(ul, {
      subtree: true, childList: true, characterData: true
    });
  } else {
    document.querySelectorAll('.lang-select').forEach(function (sel) {
      sel.addEventListener('change', function () { setTimeout(fit, 0); });
    });
    document.querySelectorAll('.kids-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () { setTimeout(fit, 0); });
    });
  }
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
  function nEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
    });
  }
  function ntr(key, d) {
    var s = (_nt[key][_nl] || _nt[key]['en'] || _nt[key]['ja']);
    return d !== undefined ? s.replace('{d}', d) : s;
  }
  // 市の updated_at は「YYYY年MM月DD日」という日本語表記のまま届く。見出し（市の原文）
  // とちがって日付は表記の問題でしかないので、他の3コーナー（学校HP・報道・更新履歴）と
  // 同じく表示言語の書式に直す。読めない文字列はそのまま出す（欠測より原文のほうがまし）。
  function nIso(t) {
    var m = /^(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(t || '');
    return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
  }
  function nFmtDate(t) {
    var iso = nIso(t);
    if (!iso) return t || '';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return t || '';
    return d.toLocaleDateString(_nl === 'ja' ? 'ja-JP' : _nl,
      {year: 'numeric', month: _nl === 'ja' ? 'long' : 'short', day: 'numeric'});
  }

  fetch('./data/news.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      // 更新日の古い順（昇順）に並べる。news.json の items は市のインデックスに
      // 載っている順序（＝更新日順とはかぎらない）なので、ここで必ず並べ替える。
      // 日付は「YYYY年MM月DD日」。読めないものは末尾へ送る（Infinity で最後尾）。
      const dnum = (t) => {
        const m = /^(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(t || '');
        return m ? (+m[1]) * 10000 + (+m[2]) * 100 + (+m[3]) : Infinity;
      };
      const items = (data.items || []).slice()
        .map((it, i) => [it, i])
        .sort((a, b) => (dnum(a[0].updated_at) - dnum(b[0].updated_at)) || (a[1] - b[1]))
        .map(x => x[0]);
      const days = data.window_days || 30;

      if (items.length === 0) {
        container.innerHTML =
          `<p class="official-news-loading">${ntr('no_items', days)}</p>` +
          `<a href="${data.source_url}" target="_blank" rel="noopener" class="card-link">${ntr('see_all')}</a>`;
        return;
      }

      const listHtml = items.map(item => {
        const date = item.updated_at
          ? `<span class="official-news-date">${nFmtDate(item.updated_at)}${ntr('updated')}</span>`
          : '';
        // 回覧板シート（BOARD SHEET）が日付で絞り込めるよう、機械可読な日付を持たせる
        const iso = nIso(item.updated_at);
        return `<li class="official-news-item" data-date="${iso}">` +
                 `<div class="official-news-item-inner">` +
                   `<a href="${nEsc(item.url)}" target="_blank" rel="noopener" data-hl="${nEsc(item.title)}">${nEsc(item.title)}</a>` +
                   date +
                 `</div>` +
               `</li>`;
      }).join('');

      container.innerHTML =
        `<div class="official-news-meta">${ntr('showing', days)}</div>` +
        `<ul class="official-news-list">${listHtml}</ul>` +
        `<a href="${data.source_url}" target="_blank" rel="noopener" class="card-link">${ntr('see_all')}</a>`;
      window.KomakiHeadline.apply(container);   // 見出しを表示言語に
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
          // data-date は回覧板シート（BOARD SHEET）が直近1週間を絞り込むのに使う
          return '<li data-date="' + esc(it.date || '') + '"><a href="' + esc(it.url) + '" target="_blank" rel="noopener" data-hl="' + esc(it.title) + '">' +
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
      window.KomakiHeadline.apply(container);   // 記事の見出しを表示言語に
    })
    .catch(function () {
      container.innerHTML = '<p class="official-news-error">' + str('error') + '</p>';
    });
})();

/* ===== PRESS COVERAGE ===== */
/* 中日新聞Webが報じた学校再編の記事。data/chunichi_news.json は
   .github/scripts/fetch_chunichi.py が毎日更新する（手編集しない）。
   見出しは日本語以外の表示で data/headline_i18n.json の訳に置き換える（2026-09-14 ユーザー指示）。 */
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
        return '<li class="press-item" data-date="' + esc(it.date || '') + '">' +
                 '<span class="press-date">' + fmtDate(it.date) + '</span>' +
                 '<a class="press-title" href="' + esc(it.url) + '" target="_blank" rel="noopener" data-hl="' + esc(it.title) + '">' +
                   esc(it.title) +
                 '</a>' +
                 '<span class="press-cite">' + str('source') + '：' + esc(source) + '</span>' +
               '</li>';
      }).join('') + '</ul>';
      window.KomakiHeadline.apply(container);   // 見出しを表示言語に
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
        // data-key は SINCE LAST VISIT が「前回見たか」を言語に関係なく照合するための目印
        return '<li class="update-item" data-date="' + esc(it.date || '') + '" data-key="' + esc((it.date || '') + '|' + (it.ja || '')) + '">' +
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
   イベント名は日本語以外の表示で data/headline_i18n.json の訳に置き換え、日時も表示言語の
   書式に直す（2026-09-14 ユーザー指示：見出しを原文のまま残さない）。 */
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
        // 日時は表示言語の書式に組み直す（イベント名は下の apply で訳に置き換える）
        const when = ev.when
          ? `<span class="ce-when">${cet('when')} ${esc(window.KomakiJaWhen(ev.when, _cl))}</span>` : '';
        return `<li class="ce-item${ev.shinooka ? ' ce-item--shinooka' : ''}">` +
                 `<div class="ce-head">${badge}` +
                   `<a href="${esc(ev.url)}" target="_blank" rel="noopener" data-hl="${esc(ev.title)}">${esc(ev.title)}</a>` +
                 `</div>` +
                 when +
               `</li>`;
      }).join('');

      container.innerHTML = `<ul class="ce-list">${rows}</ul>` + seeAll;
      window.KomakiHeadline.apply(container);   // イベント名を表示言語に
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

    /* 1日に複数の予定が入ることがある（10/31 の就学時健診と地域の催しなど）。
       値は「1件ならオブジェクト、複数なら配列」のどちらでも受ける。
       全部を配列に統一しないのは、既存の日付を書き換えずに済ませるため。 */
    function eventsAt(key) {
      var ev = events[key];
      if (!ev) return [];
      return Array.isArray(ev) ? ev : [ev];
    }
    function getEventLabels(key) {
      var l = window.KomakiLang();
      return eventsAt(key).map(function (ev) {
        return (ev && (ev[l] || ev.en || ev.ja)) || '';
      }).filter(Boolean);
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

        const labels = getEventLabels(key);
        if (labels.length) {
          cell.classList.add('has-event');
          const isPast = key <= todayKey;
          labels.forEach(function (lb) {
            const dot = document.createElement('span');
            dot.className = 'cal-event-dot' + (isPast ? ' past' : '');
            dot.textContent = (isPast ? ctr('done_marker') + ' ' : '★ ') + lb;
            cell.appendChild(dot);
          });
          cell.title = (isPast ? ctr('done_prefix') : ctr('plan_prefix')) + labels.join(' / ');
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

/* ===== GRADE VIEW（schedule.html）=====
   「お子さんの学年」を1つ選ぶと、ページ内の各予定に「そのときお子さんは何年生か」を
   添える。あわせて、data/events.json の予定を .ics で書き出してカレンダーアプリに
   取り込めるようにする。

   【この機能が言っていないこと】
   市の計画に学年別の扱いがあるわけではない。ここでやっているのは
   「公表されている日付」と「選んだ学年」からの単純な学年計算だけで、
   どの学校に通うことになるか（＝住所で決まる）には一切触れない。
   その旨は grade_lead に書いてあるので、消さないこと。

   学年の数え方: 令和8年度（2026年度）を基準に n を振る。
   年少 -2 / 年中 -1 / 年長 0 / 小1〜小6 = 1〜6 / 中1〜中3 = 7〜9。
   ある日付 D の年度は「4月始まり」なので、D が1〜3月なら年-1。
   その年度の学年 = 基準 n + (年度 - 2026)。

   .ics をサーバに置いた購読用ファイルにしていないのは、events.json が
   自動更新パイプラインの編集対象で、静的な .ics を置くと更新のたびに
   古くなるため。読み込み時に events.json から組み立てれば必ず最新になる。 */
(function () {
  var sel = document.getElementById('grade-select');
  if (!sel) return;

  var BASE_FY = 2026;                 // 令和8年度。学年コードはこの年度の学年。
  var REORG = '2027-04-01';           // 第1期再編（令和9年4月）
  var OFFSET = {y3: -2, y4: -1, y5: 0, e1: 1, e2: 2, e3: 3, e4: 4, e5: 5, e6: 6,
                j1: 7, j2: 8, j3: 9};

  var summary = document.getElementById('grade-summary');
  var icsBtn = document.getElementById('grade-ics');
  var dict = document.getElementById('grade-strings');   // 訳文の置き場（data-i18n）

  // 辞書は i18n.js が非同期に流し込むので、使う直前に隠し要素から読む。
  function t(key, fallback) {
    var el = dict && dict.querySelector('[data-gk="' + key + '"]');
    var v = el && el.textContent;
    return (v && v.trim()) || fallback;
  }

  function fy(dateStr) {
    var m = /^(\d{4})-(\d{2})/.exec(dateStr || '');
    if (!m) return null;
    return (+m[2]) >= 4 ? +m[1] : (+m[1]) - 1;
  }

  // その日付のときの学年ラベル。範囲外は「就学前」「中学校卒業後」でまとめる。
  function labelAt(dateStr, code) {
    var f = fy(dateStr);
    if (f === null || !OFFSET.hasOwnProperty(code)) return '';
    var n = OFFSET[code] + (f - BASE_FY);
    if (n <= 0) return t('pre', '就学前');
    if (n <= 6) return t('elem', '小学{n}年生').replace('{n}', n);
    if (n <= 9) return t('jhs', '中学{n}年生').replace('{n}', n - 6);
    return t('post', '中学校卒業後');
  }

  function apply() {
    var code = sel.value;
    document.querySelectorAll('.event-item').forEach(function (item) {
      var old = item.querySelector('.grade-badge');
      if (old) old.remove();
      if (!code) return;
      var lab = labelAt(item.getAttribute('data-start'), code);
      if (!lab) return;
      var b = document.createElement('span');
      b.className = 'grade-badge';
      b.textContent = t('badge', '{grade}のとき').replace('{grade}', lab);
      var head = item.querySelector('.event-date') || item;
      head.appendChild(b);
    });
    if (summary) {
      if (!code) {
        summary.textContent = '';
        summary.hidden = true;
      } else {
        summary.textContent = t('at_reorg', '第1期再編（2027年4月）のとき、お子さんは{grade}です')
          .replace('{grade}', labelAt(REORG, code));
        summary.hidden = false;
      }
    }
  }

  // 選んだ学年を URL にも残す（同じ学年の保護者にそのまま渡せるようにする）。
  // 履歴は増やさない。?lang= と同じ扱い。
  function syncUrl(code) {
    try {
      var u = new URL(window.location.href);
      if (code) u.searchParams.set('grade', code);
      else u.searchParams.delete('grade');
      if (u.href !== window.location.href) window.history.replaceState(null, '', u.href);
    } catch (e) {}
  }

  sel.addEventListener('change', function () {
    try { localStorage.setItem('komaki_grade', sel.value); } catch (e) {}
    syncUrl(sel.value);
    apply();
  });

  var initial = window.KomakiGrade();
  if (initial) sel.value = initial;
  apply();
  // 辞書の適用は非同期（i18n.js は完了イベントを出さない）。訳文が
  // #grade-strings に流し込まれた瞬間を見て、ラベルを組み直す。
  if (dict && window.MutationObserver) {
    new MutationObserver(apply).observe(dict, {childList: true, subtree: true, characterData: true});
  }

  /* ---- .ics の書き出し ---- */
  function esc(v) {
    return String(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;')
                    .replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }
  // RFC 5545 の折り返しは「75オクテット」。日本語は1文字3バイトなので文字数では数えない。
  function fold(line) {
    var out = '', len = 0, i, ch, b;
    for (i = 0; i < line.length; i++) {
      ch = line[i];
      b = encodeURIComponent(ch).replace(/%../g, 'x').length;
      if (len + b > 73) { out += '\r\n '; len = 1; }
      out += ch; len += b;
    }
    return out;
  }
  function stamp() {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  }
  function ymd(d) { return d.replace(/-/g, ''); }
  function nextDay(d) {
    var t2 = new Date(d + 'T00:00:00Z');
    t2.setUTCDate(t2.getUTCDate() + 1);
    return t2.toISOString().slice(0, 10).replace(/-/g, '');
  }

  function buildIcs(events, lang, code) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0',
             'PRODID:-//komaki-east-school-reorg//schedule//' + lang.toUpperCase(),
             'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
             'X-WR-CALNAME:' + esc(t('calname', '小牧市東部 学校再編の予定'))];
    Object.keys(events).sort().forEach(function (d) {
      // 1日に複数件のことがある（カレンダーと同じく、オブジェクトと配列の両方を受ける）
      var list = Array.isArray(events[d]) ? events[d] : [events[d]];
      list.forEach(function (e, idx) {
        var title = (e && (e[lang] || e.en || e.ja)) || '';
        if (!title) return;
        var lab = code ? labelAt(d, code) : '';
        var sum = lab ? title + '（' + lab + '）' : title;
        L.push('BEGIN:VEVENT');
        // 2件目以降だけ連番を足す。既存の予定の UID を変えると、
        // 取り込み済みのカレンダー側で別の予定として二重に増える。
        L.push('UID:' + d + (idx ? '-' + (idx + 1) : '') + '-komaki-saihen@komaki-east-school-reorg.github.io');
        L.push('DTSTAMP:' + stamp());
        L.push('DTSTART;VALUE=DATE:' + ymd(d));
        L.push('DTEND;VALUE=DATE:' + nextDay(d));
        L.push(fold('SUMMARY:' + esc(sum)));
        L.push(fold('DESCRIPTION:' + esc(t('icsdesc', 'この予定は市民有志のサイトがまとめたものです。正式な案内は市から届く書類でご確認ください。'))));
        L.push('URL:https://komaki-east-school-reorg.github.io/schedule.html');
        L.push('END:VEVENT');
      });
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  if (icsBtn) {
    icsBtn.addEventListener('click', function () {
      var lang = window.KomakiLang(), code = sel.value;
      icsBtn.disabled = true;
      fetch('./data/events.json')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) {
          var text = buildIcs(data.events || {}, lang, code);
          var blob = new Blob([text], {type: 'text/calendar;charset=utf-8'});
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'komaki-saihen' + (code ? '-' + code : '') + '.ics';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        })
        .catch(function () {
          // ラベルは data-i18n 管理なので、書き換えたら必ず戻す。
          // 戻さないと、そのあと言語を切り替えても失敗文言が残る。
          var keep = icsBtn.textContent;
          icsBtn.textContent = t('icsfail', 'カレンダーの書き出しに失敗しました');
          window.setTimeout(function () { icsBtn.textContent = keep; }, 4000);
        })
        .then(function () { icsBtn.disabled = false; });
    });
  }
})();

/* ===== SHARE BUTTONS ===== */
/* 全ページ共通の「このページを共有する」欄。HTML 側には見出しと空の入れ物だけがあり、
   ボタンはここで組み立てる（共有先URLに表示中の言語を載せるため、静的に書けない）。

   ラベルは data-i18n を付けて i18n.js に任せる。公式ニュース等のブロックが
   インライン辞書を持っているのは JSON 取得より先に描くためだが、こちらは
   applyDict より前に DOM を作れるので、辞書に一本化したほうが10言語を揃えやすい。
   HTML に現れないキーなので build_page_dicts.py の RUNTIME_KEYS に入れてある。

   2026-09 に、画面下部に常時追従する固定バー（.share-sticky）を追加した。
   中身は本文最後の共有欄とまったく同じボタン一式（＋index.htmlでは回覧板ボタンも）で、
   ボタンの生成・href の組み直し・タイトル同期はすべて2つの入れ物（boxes）に対して
   まとめて行う。2026-09-15 にユーザー指示で固定バーにも「はてなスター」を置いた。
   ただし固定バーは常に画面内にあるので、IntersectionObserver では読み込みの合図に
   ならない。固定バーの ☆ は、読者がそこに触れた（マウスを載せた・押した・フォーカスした）
   ときに初めて HatenaStar.js を読む。「読者が自分で星の欄に近づかないかぎり、
   はてなへ通信しない」という設計（下の ===== はてなスター ===== 参照）は保たれる。

   固定バーの先頭には「共有」の一語（share_sticky_label）を必ず添える。アイコンだけの
   丸ボタンが横に並ぶだけでは、初見の読者にはこの帯が何のためのものか伝わらない。
   本文側の共有欄には見出し（share_heading・全文）が別にあるので重複を避け、
   固定バー側は横幅の限られる帯にふさわしい短い単語だけにしてある。 */
(function () {
  var mainBox = document.getElementById('share-buttons');
  if (!mainBox) return;

  var stickyBar = document.createElement('div');
  stickyBar.className = 'share-sticky';
  stickyBar.setAttribute('role', 'region');
  stickyBar.setAttribute('aria-labelledby', 'share-sticky-label');
  var stickyLabel = document.createElement('span');
  stickyLabel.className = 'share-sticky-label';
  stickyLabel.id = 'share-sticky-label';
  stickyLabel.setAttribute('data-i18n', 'share_sticky_label');
  stickyLabel.textContent = '共有';
  stickyBar.appendChild(stickyLabel);
  var stickyBox = document.createElement('div');
  stickyBox.className = 'share-buttons share-buttons--sticky';
  stickyBox.id = 'share-buttons-sticky';
  stickyBar.appendChild(stickyBox);
  document.body.appendChild(stickyBar);
  document.documentElement.classList.add('has-share-sticky');

  var boxes = [mainBox, stickyBox];

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
  // schedule.html で学年が選ばれているときは ?grade= も足す。同じ学年の保護者に
  // 渡したときに、相手も同じ見え方（各予定に「○年生のとき」が付いた状態）で開ける。
  function shareUrl() {
    var lang = currentLang();
    var u = lang === 'ja' ? CANON : CANON + '?lang=' + lang;
    var g = document.getElementById('grade-select');
    var code = g && g.value;
    if (code) u += (u.indexOf('?') === -1 ? '?' : '&') + 'grade=' + code;
    return u;
  }

  function shareTitle() { return document.title || CANON; }

  function enc(v) { return encodeURIComponent(v); }

  /* url() は生の URL と題名を受け取る（エスケープは各自）。Threads・Bluesky は
     本文欄しか受け取らないので、題名と URL を1つのテキストにまとめて渡す。
     Instagram・TikTok は、リンクを渡せる共有 URL を公開していないためここには
     並べられない（下のコピー方式のボタンと、端末標準の共有が受け皿）。

     【アプリが入っていればアプリで開く】（2026-09-15 ユーザー指示）
     ・Android: intent:// の形にして package（アプリ）を名指しし、
       S.browser_fallback_url に従来の Web の共有 URL を入れる。アプリが無い・その URL を
       受け付けないときは Chrome が黙って Web 版を開くので、壊れた状態にはならない。
       android.url はアプリに渡す URL（https のアプリリンク、または X の twitter:// ）。
     ・iPhone/iPad: 独自スキーム（twitter:// など）はアプリが無いと「アドレスが無効」の
       警告が出るので使わない。https のユニバーサルリンクだけを使う — X・Facebook・
       Threads・Bluesky・Reddit は従来の URL のままでアプリが引き受ける。LINE だけは
       従来の social-plugins.line.me がアプリの受け皿にならないので、スマートフォンでは
       LINE 公式の line.me/R/share に切り替える（mobile）。
     ・はてなブックマークと Mastodon は、アプリを確実に名指しできないので Web のまま。 */
  var SERVICES = [
    {cls: 'line',    icon: 'L',  key: 'share_line',     ja: 'LINEで送る',
     url: function (u, t) { return 'https://social-plugins.line.me/lineit/share?url=' + enc(u) + '&text=' + enc(t); },
     mobile: function (u, t) { return 'https://line.me/R/share?text=' + enc(t + ' ' + u); },
     android: {pkg: 'jp.naver.line.android',
               url: function (u, t) { return 'https://line.me/R/share?text=' + enc(t + ' ' + u); }}},
    {cls: 'x',       icon: 'X',  key: 'share_x',        ja: 'Xでポスト',
     url: function (u, t) { return 'https://x.com/intent/post?url=' + enc(u) + '&text=' + enc(t); },
     android: {pkg: 'com.twitter.android',
               url: function (u, t) { return 'twitter://post?message=' + enc(t + ' ' + u); }}},
    {cls: 'fb',      icon: 'f',  key: 'share_facebook', ja: 'Facebookでシェア',
     url: function (u)    { return 'https://www.facebook.com/sharer/sharer.php?u=' + enc(u); },
     android: {pkg: 'com.facebook.katana',
               url: function (u) { return 'https://www.facebook.com/sharer/sharer.php?u=' + enc(u); }}},
    {cls: 'hatena',  icon: 'B!', key: 'share_hatena',   ja: 'はてなブックマーク',
     url: function (u, t) { return 'https://b.hatena.ne.jp/entry/panel/?url=' + enc(u) + '&btitle=' + enc(t); }},
    {cls: 'threads', icon: '@',  key: 'share_threads',  ja: 'Threadsで投稿',
     url: function (u, t) { return 'https://www.threads.net/intent/post?text=' + enc(t + ' ' + u); },
     android: {pkg: 'com.instagram.barcelona',
               url: function (u, t) { return 'https://www.threads.net/intent/post?text=' + enc(t + ' ' + u); }}},
    {cls: 'bluesky', icon: '🦋', key: 'share_bluesky',  ja: 'Blueskyで投稿',
     url: function (u, t) { return 'https://bsky.app/intent/compose?text=' + enc(t + ' ' + u); },
     android: {pkg: 'xyz.blueskyweb.app',
               url: function (u, t) { return 'https://bsky.app/intent/compose?text=' + enc(t + ' ' + u); }}},
    {cls: 'reddit',  icon: 'r',  key: 'share_reddit',   ja: 'Redditに投稿',
     url: function (u, t) { return 'https://www.reddit.com/submit?url=' + enc(u) + '&title=' + enc(t); },
     android: {pkg: 'com.reddit.frontpage',
               url: function (u, t) { return 'https://www.reddit.com/submit?url=' + enc(u) + '&title=' + enc(t); }}}
  ];

  var UA = navigator.userAgent || '';
  var IS_ANDROID = /Android/i.test(UA);
  var IS_IOS = /iPhone|iPad|iPod/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);

  // scheme://rest を intent://rest#Intent;scheme=…;package=…;S.browser_fallback_url=…;end にする。
  // rest に生の # は入らない（題名・URL は encodeURIComponent 済み）。
  function androidIntent(appUrl, pkg, fallback) {
    var m = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(appUrl);
    if (!m) return fallback;
    return 'intent://' + m[2] + '#Intent;scheme=' + m[1] + ';package=' + pkg +
           ';S.browser_fallback_url=' + enc(fallback) + ';end';
  }

  function serviceHref(s) {
    var u = shareUrl(), t = shareTitle(), web = s.url(u, t);
    if (IS_ANDROID && s.android) return androidIntent(s.android.url(u, t), s.android.pkg, web);
    if ((IS_IOS || IS_ANDROID) && s.mobile) return s.mobile(u, t);
    return web;
  }

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
  // 描画時ではなく「使う直前」に写す。両方の入れ物ぶんをまとめて拾う。
  function syncTitles() {
    document.querySelectorAll('.share-btn').forEach(function (el) {
      var t = el.getAttribute('aria-label');
      if (t && el.title !== t) el.title = t;
    });
  }

  var links = [];

  // 同じサービス一式を、共有欄と固定バーの両方に作る。href の組み直しは
  // 入れ物を区別せず、links に集めた <a> をまとめて refresh() するだけでよい。
  boxes.forEach(function (box) {
    SERVICES.forEach(function (s) {
      var a = makeBtn('a', s.cls, s.icon, s.key, s.ja);
      a.target = '_blank';
      a.rel = 'noopener';
      a._build = function () { a.href = serviceHref(s); };
      a._build();
      links.push(a);
      box.appendChild(a);
    });
  });

  // href は「使われる直前」に組み直す。ページ題名は i18n.js が辞書取得後に
  // 差し替えるので、描画時の値のままだと日本語の題名で共有されてしまう。
  function refresh() {
    links.forEach(function (a) { a._build(); });
    syncTitles();
    starPermalinks.forEach(function (a) { a.textContent = shareTitle(); });
  }
  var starPermalinks = [];   // はてなスターの題名リンク（共有欄と固定バーに1つずつ。下で作る）
  boxes.forEach(function (box) {
    ['pointerdown', 'focusin', 'touchstart', 'mouseover'].forEach(function (ev) {
      box.addEventListener(ev, refresh, {passive: true});
    });
  });
  document.querySelectorAll('.lang-select').forEach(function (sel) {
    sel.addEventListener('change', function () {
      _selectedLang = LANGS.indexOf(sel.value) !== -1 ? sel.value : null;
      refresh();
    });
  });

  /* --- コピー結果などの案内文言 ---
     文言そのもの（辞書からの訳文）は1組のテンプレートだけ持てばよいが、
     表示する場所（トースト）は入れ物ごとに要る。押されたあとに作ると、
     そのとき i18n.js の適用は終わっているので日本語のまま出てしまうため、
     テンプレートは最初から DOM に置いて出し入れするだけにする。 */
  var tpl = document.createElement('div');
  tpl.hidden = true;
  document.body.appendChild(tpl);

  function tplSpan(key, ja) {
    var el = document.createElement('span');
    el.setAttribute('data-i18n', key);
    el.textContent = ja;
    tpl.appendChild(el);
    return el;
  }
  var msgOkTpl = tplSpan('share_copied', 'コピーしました');
  var msgNgTpl = tplSpan('share_copy_failed', 'コピーできませんでした');
  var msgHostNgTpl = tplSpan('share_mastodon_invalid', 'サーバーのドメインが正しくないようです');
  // アプリ名を差し込んで組み立てる文言（Instagram 等）もここに置く。
  var pasteTpl = tplSpan('share_copied_paste', 'リンクをコピーしました。{app} に貼り付けてください');
  var hostPromptTpl = tplSpan('share_mastodon_prompt', '使っている Mastodon サーバーのドメインを入力してください（例：mstdn.jp）');

  // トースト本体は入れ物ごとに1つ。結果表示はボタンの行の外（下）に置く。
  // 行の中に空の要素を混ぜると flex の gap ぶんだけ最後のボタンの右に隙間が残るため。
  function makeToast(box) {
    var el = document.createElement('span');
    el.className = 'share-copy-msg';
    el.setAttribute('role', 'status');
    box.parentNode.insertBefore(el, box.nextSibling);
    return el;
  }
  function showMsg(toast, text) {
    toast.textContent = text;
    toast.classList.add('is-visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.classList.remove('is-visible'); }, 3000);
  }

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

  /* --- Mastodon ---
     分散型なので共有先のサーバーが1つに決まらない。利用者のサーバーのドメインを
     一度だけ聞いて localStorage（komaki_mastodon）に覚える。第三者のリダイレクト
     サービスを挟む方法もあるが、このサイトの外部通信先を増やしたくないので採らない。 */
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

  var hasNative = !!navigator.share;

  // Mastodon・Instagram・TikTok・コピー・端末共有は、両方の入れ物にそれぞれ
  // 独立したボタンとトーストを持たせる（ボタン自体は複製できないため）。
  boxes.forEach(function (box) {
    var toast = makeToast(box);

    // <a> ではなく <button>：サーバーが未登録のうちは行き先が決まらず、
    // href の無い <a> はキーボードで到達できなくなるため。
    var mastodonBtn = makeBtn('button', 'mastodon', 'm', 'share_mastodon', 'Mastodonで共有');
    mastodonBtn.addEventListener('click', function () {
      var host = mastodonHost();
      if (!host) {
        var raw = window.prompt(hostPromptTpl.textContent, '');
        if (raw === null) return;                 // 取り消し
        host = normalizeHost(raw);
        if (!host) { showMsg(toast, msgHostNgTpl.textContent); return; }
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
    [{cls: 'instagram', icon: 'IG', key: 'share_instagram', ja: 'Instagram（リンクをコピー）', app: 'Instagram'},
     {cls: 'tiktok',    icon: '♪',  key: 'share_tiktok',    ja: 'TikTok（リンクをコピー）',    app: 'TikTok'}
    ].forEach(function (s) {
      var b = makeBtn('button', s.cls, s.icon, s.key, s.ja);
      b.addEventListener('click', function () {
        copyLink(shareUrl(), function (okFlag) {
          if (!okFlag) { showMsg(toast, msgNgTpl.textContent); return; }
          showMsg(toast, pasteTpl.textContent.replace('{app}', s.app));
        });
      });
      box.appendChild(b);
    });

    var copyBtn = makeBtn('button', 'copy', '🔗', 'share_copy', 'リンクをコピー');
    copyBtn.addEventListener('click', function () {
      copyLink(shareUrl(), function (okFlag) { showMsg(toast, okFlag ? msgOkTpl.textContent : msgNgTpl.textContent); });
    });
    box.appendChild(copyBtn);

    /* --- このページをそのまま印刷する（2026-09-14 追加）---
       Ctrl+P を知らない読者やスマートフォンから、ページを紙にする入口。ふつうの印刷と
       まったく同じで、画面用の部品（ヘッダ・共有欄・固定バーなど）は css/style.css の
       共通印刷スタイルが消し、Q&A は答えを開いた状態で刷られる。
       index.html の「回」（回覧板シート＝要約1枚）とは別物なので、アイコンも分けてある。 */
    var printBtn = makeBtn('button', 'print', '🖨', 'share_print', 'このページを印刷する');
    printBtn.addEventListener('click', function () { window.print(); });
    box.appendChild(printBtn);

    /* --- 端末標準の共有（スマートフォン）---
       WhatsApp・Zalo・Messenger など、ここに並べきれない共有先の受け皿。
       Instagram・TikTok も、スマートフォンならこの共有シートから直接開ける
       （上の2ボタンはコピーまでしかできないPC向けの経路）。 */
    if (hasNative) {
      var nativeBtn = makeBtn('button', 'native', '↗', 'share_native', 'ほかのアプリで共有');
      nativeBtn.addEventListener('click', function () {
        navigator.share({title: shareTitle(), url: shareUrl()}).catch(function () {});
      });
      box.appendChild(nativeBtn);
    }
  });

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
  starPermalinks.push(permalink);

  var holder = document.createElement('span');
  holder.className = 'hatena-star-holder';

  entry.appendChild(starLabel);
  entry.appendChild(permalink);
  entry.appendChild(holder);
  starBox.appendChild(entry);

  /* 固定バーの星（2026-09-15 追加）。共有欄と同じ形の entry（題名リンク＋holder）を作る
     — はてな側は div.hatena-star-entry をすべて拾うので、設定は1つで両方に効く。
     題名リンクは星の登録先 URL と題名を読ませるためだけのもので、帯の中では見せない
     （visually-hidden。innerText は読める）。スクリプトを読むまでは holder が空で
     帯に何も出ないので、代わりに ☆ のボタンを置き、触れられたら読み込む。
     星が描かれたらボタンは引っ込める。 */
  var stickyStar = document.createElement('div');
  stickyStar.className = 'hatena-star-entry share-sticky-star';
  var stickyPermalink = document.createElement('a');
  stickyPermalink.className = 'hatena-star-permalink visually-hidden';
  stickyPermalink.href = CANON;
  stickyPermalink.tabIndex = -1;
  stickyPermalink.textContent = shareTitle();
  starPermalinks.push(stickyPermalink);
  var stickyHolder = document.createElement('span');
  stickyHolder.className = 'hatena-star-holder';
  var stickyStarBtn = makeBtn('button', 'star', '☆', 'share_star_label', 'このページに星をつける');
  stickyStar.appendChild(stickyPermalink);
  stickyStar.appendChild(stickyStarBtn);
  stickyStar.appendChild(stickyHolder);
  stickyBar.appendChild(stickyStar);

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
    starPermalinks.forEach(function (a) { a.textContent = shareTitle(); });   // i18n 適用後の題名で登録する

    var s = document.createElement('script');
    s.src = 'https://s.hatena.ne.jp/js/HatenaStar.js';
    s.async = true;
    s.onerror = function () { starBox.hidden = true; stickyStar.hidden = true; };
    s.onload = function () {
      /* ★ SiteConfig は「読み込んだあと」に入れること。
         HatenaStar.js は  void 0 === window.Hatena.Star && (window.Hatena.Star = {...})
         という書き方なので、先回りして window.Hatena.Star を作っておくと
         本体側の代入がまるごとスキップされ、初期化に必要な中身が入らない。 */
      if (!window.Hatena || !window.Hatena.Star) { starBox.hidden = true; stickyStar.hidden = true; return; }
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
        if (!stickyHolder.querySelector('[data-hatena-star]')) stickyStar.hidden = true;
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

  // 固定バーの ☆：触れたら読み込む。描かれたら ☆ のボタンを引っ込める
  // （はてな側が holder に差し込むのは setTimeout(0) のあとなので、子の追加を見張る）。
  ['pointerenter', 'focusin', 'touchstart'].forEach(function (ev) {
    stickyStar.addEventListener(ev, loadHatenaStar, {once: true, passive: true});
  });
  stickyStarBtn.addEventListener('click', loadHatenaStar);
  if (window.MutationObserver) {
    new MutationObserver(function (_, mo) {
      if (stickyHolder.querySelector('[data-hatena-star]')) {
        stickyStarBtn.hidden = true;
        mo.disconnect();
      }
    }).observe(stickyHolder, {childList: true, subtree: true});
  }
})();

/* ===== BOARD SHEET（回覧板・掲示用のA4 1枚印刷）=====
   index.html 専用。「最新の動き」4コーナーの新着一覧を、共有欄の「回」ボタンと、
   「最新の動き」節内の専用ボタン（#latest-print-btn）のどちらからでも同じ内容で刷る。

   【ほかのページには置かない】
   以前はページごとの要約シート（各ページの共有欄の「回」ボタンで、その節の見出しと
   代表文を集めたもの）もあったが廃止した。「お知らせ」「学校HP更新」等のコーナー DOM は
   index.html にしか無く、下の【文章はページ内の既存要素からしか取らない】原則のもとでは
   ほかのページで再現しようがないため、この機能は index.html だけに一本化してある。
   このIIFEは #latest-print-btn が無いページ（= index.html 以外）では何もしない。

   なぜ作ったか: この地区で実際に情報が回るのは回覧板と掲示板で、
   SNS のリンクでは届かない層がいる。紙で配り、QR で戻ってこられるようにする。

   【文章はページ内の既存要素からしか取らない】
   各コーナーの一覧を、表示されているものからそのまま拾う。
   ここで独自の要約文を書き起こすと、出典のないニ次情報が紙になって出て行く。
   紙幅の都合で切り詰めるので、そのことは board_excerpt で紙面にも書く。

   【A4 1枚に収める】
   #board-sheet は常に DOM にあり、画面外（position:fixed, left:-10000px）に
   印刷と同じ幅 178mm（A4 210mm − 左右16mm）で置いてある。だから刷る前に
   実寸で高さを測れる。収まるまで「1行の字数」「1コーナーの行数」を段階的に
   詰め、それでも溢れるときは末尾のコーナーから落とす。
   高さの上限は 250mm（印刷できる 265mm から 15mm のゆとりを残す）を実測の px に直して使う。

   【QR は自前生成しない】
   qr/<pageId>.<lang>.svg を .github/scripts/build_qr.py（segno）で書き出して
   コミットしてあり、ここでは <img> を1枚読むだけ。JS の QR エンコーダを自作すると、
   壊れていても「QR に見える絵」が出て、印刷して配ったあとまで気づけない。
   CDN から読むと「自動で読む外部スクリプトははてなスター1本だけ」の方針が崩れる。 */
(function () {
  var shareBox = document.getElementById('share-buttons');
  var latestBtn = document.getElementById('latest-print-btn');
  if (!latestBtn) return;   // 「最新の動き」節が無いページ = index.html 以外では機能ごと出さない

  var pageId = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
  var strings = document.getElementById('board-strings');

  function t(key, fallback) {
    var el = strings && strings.querySelector('[data-bk="' + key + '"]');
    var v = el && el.textContent;
    return (v && v.trim()) || fallback;
  }

  // 共有ボタンと同じ考え方で、URL は canonical から組み立てる（アドレスバーは1手遅れる）。
  var CANON = (function () {
    var el = document.querySelector('link[rel="canonical"]');
    var href = (el && el.getAttribute('href')) || location.href;
    return href.split('#')[0].split('?')[0];
  })();
  function pageUrl(lang) { return lang === 'ja' ? CANON : CANON + '?lang=' + lang; }

  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // 見出しの <small>（英語併記）は紙では冗長なので落とす
  function headText(h) {
    var c = h.cloneNode(true);
    c.querySelectorAll('small').forEach(function (s) { s.remove(); });
    return (c.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function clean(el) { return ((el && el.textContent) || '').replace(/\s+/g, ' ').trim(); }
  // 場所の括弧は日本語・中国語では全角、ほかの言語では半角（英文に全角括弧が混ざらないように）
  function paren(v) {
    var l = window.KomakiLang();
    return (l === 'ja' || l === 'zh') ? '（' + v + '）' : ' (' + v + ')';
  }

  /* ---- 材料あつめ ---- */

  /* これからの催し（地域の取組）。
     「最新の動き」は起きたことを配る紙なので直近7日の data-date で絞るが、
     地域の催しはこれから開かれるもので、回覧板でこそ知らせる値打ちがある。
     だから7日の窓とは別枠にして、紙のいちばん最後に置く。
     文面は画面に描かれた要素からそのまま取る。終わった催しは COMMUNITY ACTIONS が
     描画時に落としているので、ここで日付を見る必要はない。 */
  function actionRowValue(item, idx) {
    var r = item.querySelectorAll('.action-row')[idx];
    if (!r) return '';
    var c = r.cloneNode(true);
    var lab = c.querySelector('.action-label');
    if (lab) lab.remove();
    return (c.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function upcomingActionsBlock() {
    var items = document.querySelectorAll('#community-actions-container .action-item');
    if (!items.length) return null;
    var lines = [];
    [].forEach.call(items, function (it) {
      var title = clean(it.querySelector('.action-title'));
      if (!title) return;
      var when = actionRowValue(it, 0);
      var place = actionRowValue(it, 1);
      var line = (when ? when + ' ' : '') + title + (place ? paren(place) : '');
      if (lines.indexOf(line) === -1) lines.push(line);
    });
    return lines.length ? {h: t('actions', 'これからの催し'), kind: 'list', lines: lines} : null;
  }

  /* 最新の動き: 4つのコーナーを、描画済みの DOM からそのまま拾う。
     構造はコーナーごとに違うので、入れ物の id ごとに書き分ける。

     載せるのは直近 LATEST_DAYS 日ぶんだけ。画面のコーナーは30日ぶんを出すが、
     紙は「今どうなっているか」を短く伝えるためのもので、1か月ぶんを刷ると
     読み飛ばされる。日付は各コーナーの描画時に data-date（YYYY-MM-DD）で
     持たせてあるので、それで絞る。data-date が無い項目は落とす
     （日付が分からないものを「直近1週間」として配れないため）。 */
  var LATEST_DAYS = 7;

  function withinDays(el, days) {
    var d = el.getAttribute('data-date') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    var then = Date.parse(d + 'T00:00:00Z');
    var now = new Date();
    var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    var age = Math.floor((today - then) / 86400000);
    return age >= 0 && age < days;
  }

  function latestBlocks() {
    var out = [];
    document.querySelectorAll('main h3.section-title.sub').forEach(function (h) {
      var box = h.closest('.container');
      if (!box) return;
      var lines = [];
      function take(sel, fn) {
        box.querySelectorAll(sel).forEach(function (el) {
          if (!withinDays(el, LATEST_DAYS)) return;
          var line = fn(el);
          if (line) lines.push(line);
        });
      }
      take('.official-news-item', function (li) {
        return clean(li.querySelector('.official-news-date')) + ' ' + clean(li.querySelector('a'));
      });
      // 学校HPは記事1件ずつに日付が付いている。校名は親カードから取る。
      take('.school-items li', function (li) {
        var card = li.closest('.school-card');
        return clean(card && card.querySelector('.school-name')) + '｜' + clean(li);
      });
      take('.press-item', function (li) {
        return clean(li.querySelector('.press-date')) + ' ' + clean(li.querySelector('.press-title'));
      });
      take('.update-item', function (li) {
        return clean(li.querySelector('.update-date')) + ' ' + clean(li.querySelector('.update-text'));
      });
      if (lines.length) out.push({h: headText(h), kind: 'list', lines: lines});
    });
    var tobu = tobuBlock();
    if (tobu) out.push(tobu);
    var acts = upcomingActionsBlock();
    if (acts) out.push(acts);
    return out;
  }

  /* 東部まちづくりの動き（2026-09-14 ユーザー指示で紙に追加）。
     市の東部まちづくり推進室が公表したもので、すぐ下の「これからの催し」（住民・協議会の催し）とは
     出どころが違うので、見出しを分けた別の塊にする（画面と同じ分け方）。
     市の記録は月に数件しか増えず、7日の窓で絞るとほぼ毎回空になるため、この塊だけは
     「これから開かれる催し」ぜんぶ＋「さいきんの動き」の新しい3件を載せる。どの行にも日付を
     付けるので、古い記録を新着と取り違えることはない。文面は画面に描かれた要素から取る
     （日本語以外の表示なら、見出しはすでに訳に置き換わっている）。 */
  var TOBU_RECENT_ON_SHEET = 3;
  function tobuBlock() {
    var box = document.getElementById('tobu-actions-container');
    var h = document.querySelector('[data-i18n-html="tobu_actions_h"]');
    if (!box || !h) return null;
    var today = (function () {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    })();
    var up = [], recent = [];
    box.querySelectorAll('.tobu-item').forEach(function (li) {
      var title = clean(li.querySelector('.tobu-title'));
      if (!title) return;
      var date = clean(li.querySelector('.tobu-date'));
      var placeEl = li.querySelector('.tobu-from [data-hl]');
      var place = placeEl ? clean(placeEl) : '';
      var line = (date ? date + ' ' : '') + title + (place ? paren(place) : '');
      if ((li.getAttribute('data-date') || '') >= today) up.push(line);
      else if (recent.length < TOBU_RECENT_ON_SHEET) recent.push(line);
    });
    var lines = up.concat(recent);
    return lines.length ? {h: headText(h), kind: 'list', lines: lines} : null;
  }

  /* ---- シートの組み立てと、A4 1枚に収める調整 ---- */

  var sheet = null;
  function ensureSheet() {
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'board-sheet';
      sheet.setAttribute('aria-hidden', 'true');
      document.body.appendChild(sheet);
    }
    return sheet;
  }

  /* 紙面の高さの上限が何 px かを実測する。印刷できる高さは 265mm（A4 297mm − 上下16mm）
     だが、上限いっぱいまで詰めると、画面での計測と印刷時の組版のわずかな差（行の折り返し・
     フォントの丸め）や、@page の余白を大きめに取るブラウザ・プリンタで最後の数行が2枚目に
     こぼれる。2026-09-15 に実測で979px（上限1002px）のシートが2枚になったので、15mm の
     ゆとりを残した 250mm を上限にする。 */
  var SHEET_MAX_MM = 250;
  function targetHeight() {
    var probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1mm;height:' + SHEET_MAX_MM + 'mm;';
    document.body.appendChild(probe);
    var h = probe.offsetHeight;
    document.body.removeChild(probe);
    return h || 1000;
  }

  function render(title, lead, blocks, lang, cfg) {
    var el = ensureSheet();
    var today = new Date();
    var ymd = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) +
              '-' + ('0' + today.getDate()).slice(-2);
    var body = blocks.map(function (b) {
      var inner = '<ul>' + b.lines.slice(0, cfg.maxLines).map(function (l) {
        return '<li>' + esc(l) + '</li>';
      }).join('') + '</ul>';
      return '<div class="board-block"><div class="board-block-h">' + esc(b.h) + '</div>' +
             inner + '</div>';
    }).join('');
    el.style.setProperty('--board-scale', cfg.scale);
    el.innerHTML =
      // 回覧板の体裁: 左肩に「回覧」の枠、その横に発行元。発行元がすぐ隣に来るのは、
      // 自治会や市の回覧と取り違えられないようにするため。非公式である旨は必ず並べる。
      '<div class="board-head">' +
        '<div class="board-stamp">' + esc(t('stamp', '回 覧')) + '</div>' +
        '<div class="board-head-text">' +
          '<div class="board-site">小牧市東部（篠岡地区）学校再編計画</div>' +
          '<div class="board-unofficial">' + esc(t('unofficial',
            '市民有志による非公式の情報サイトです。公式情報は小牧市教育委員会のページをご確認ください。')) + '</div>' +
        '</div>' +
      '</div>' +
      '<h1 class="board-title">' + esc(title) + '</h1>' +
      (lead ? '<p class="board-desc">' + esc(lead) + '</p>' : '') +
      '<div class="board-body">' + body + '</div>' +
      '<div class="board-qr">' +
        '<img id="board-qr-img" alt="" src="qr/' + pageId + '.' + lang + '.svg">' +
        '<div class="board-qr-text">' +
          '<div class="board-cta">' + esc(t('cta', 'この紙に載せきれなかったことは、サイトにすべて載っています。')) + '</div>' +
          '<div class="board-url">' + esc(pageUrl(lang)) + '</div>' +
          '<div class="board-scan">' + esc(t('scan', 'スマートフォンのカメラで読み取れます。')) + '</div>' +
        '</div>' +
      '</div>' +
      /* 紙は掲示板や回覧板の上に何週間も残る。だから「いつ時点か」と
         「公式に聞く先」を必ず入れる。画面と違って、読者はその場で
         最新かどうかを確かめられないため。 */
      '<div class="board-notes">' +
        '<div>' + esc(t('asof', 'この紙は{date}時点の内容です。計画は今後も動きます。最新の情報はサイトでご確認ください。')
                        .replace('{date}', ymd)) + '</div>' +
        '<div>' + esc(t('excerpt', '紙面の都合で要点だけを載せています。')) + '</div>' +
        '<div>' + esc(t('contact', '計画そのものについての公式の問い合わせ先：小牧市教育委員会事務局 教育総務課 学校再編推進係（電話 0568-39-5261）')) + '</div>' +
        '<div>' + esc(t('issuer', '発行：小牧市東部（篠岡地区）学校再編計画 市民情報サイト（市民有志・非公式）')) + '</div>' +
      '</div>';
    return el;
  }

  /* 詰め方の順番。文や見出しを途中で切ることは一切しない。
     一覧の項目数 → 文字の倍率、の順に減らし、
     それでも溢れるときは fit() が末尾の見出しごと落とす。 */
  var LADDER = [
    {maxLines: 8, scale: 1},
    {maxLines: 7, scale: 1},
    {maxLines: 6, scale: 1},
    {maxLines: 5, scale: .95},
    {maxLines: 4, scale: .9},
    {maxLines: 3, scale: .85},
    {maxLines: 2, scale: .85}
  ];

  function fit(title, lead, blocks, lang) {
    var limit = targetHeight();
    var el, i;
    for (i = 0; i < LADDER.length; i++) {
      el = render(title, lead, blocks, lang, LADDER[i]);
      if (el.scrollHeight <= limit) return el;
    }
    // いちばん詰めても溢れる場合は、末尾の見出しごと落とす（先頭ほど重要なため）。
    // 文を削るのではなく見出し単位で落とすので、載った節は必ず文が完結している。
    var cut = blocks.slice();
    while (cut.length > 1) {
      cut = cut.slice(0, cut.length - 1);
      el = render(title, lead, cut, lang, LADDER[LADDER.length - 1]);
      if (el.scrollHeight <= limit) return el;
    }
    return el;
  }

  function printSheet(title, lead, blocks) {
    var lang = window.KomakiLang();
    var el = fit(title, lead, blocks, lang);
    var img = el.querySelector('#board-qr-img');
    var root = document.documentElement;
    var go = function () {
      root.classList.add('board-printing');
      var done = function () { root.classList.remove('board-printing'); };
      window.addEventListener('afterprint', done, {once: true});
      window.setTimeout(done, 8000);   // afterprint を出さないブラウザ向けの保険
      window.print();
    };
    if (img && !img.complete) {
      img.addEventListener('load', go, {once: true});
      // QR が取れなくてもシートは出す（URL は文字でも書いてある）
      img.addEventListener('error', function () { img.remove(); go(); }, {once: true});
    } else {
      go();
    }
  }

  /* ---- 印刷実行と、ボタン2つ（共有欄の「回」＋「最新の動き」節内の専用ボタン） ----
     両方とも同じ内容（「最新の動き」4コーナーの新着一覧）を刷る。 */

  function printLatest() {
    var h2 = document.querySelector('#latest h2.section-title');
    var blocks = latestBlocks();
    // 画面の説明文（「4つのコーナーは毎日自動で取得して…」）は紙では意味がない。
    // 代わりに「いつからいつまでの分か」を出す。紙は日付が命なので。
    var now = new Date();
    var to = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    var from = new Date(to.getTime() - (LATEST_DAYS - 1) * 86400000);
    var fmt = function (d) { return d.toISOString().slice(0, 10); };
    var lead = t('range', '直近1週間（{from}〜{to}）に更新された内容です。')
                 .replace('{from}', fmt(from)).replace('{to}', fmt(to));
    if (!blocks.length) lead += ' ' + t('none', 'この1週間に新しい動きはありませんでした。');
    printSheet((h2 && headText(h2)) || '', lead, blocks);
  }

  latestBtn.addEventListener('click', printLatest);

  // 共有欄・固定バー（画面下部に常時表示、SHARE BUTTONS が作る）の両方に置く。
  // 固定バーは index.html にしか無い latestBtn がある前提でしか作られないので、
  // ここに来ている時点でどちらも存在する（他ページはこの関数より前で return 済み）。
  [shareBox, document.getElementById('share-buttons-sticky')].forEach(function (box) {
    if (!box) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'share-btn share-btn--board';
    btn.setAttribute('data-i18n-aria', 'board_btn');
    btn.setAttribute('aria-label', '印刷して回覧・掲示する');
    var ic = document.createElement('span');
    ic.className = 'share-icon';
    ic.setAttribute('aria-hidden', 'true');
    ic.textContent = '回';        // 「回」＝回覧
    btn.appendChild(ic);
    btn.addEventListener('click', printLatest);
    box.appendChild(btn);
  });
})();

/* ===== PAGE TOC（全ページの「このページの目次」）=====
   2026-09-14 に長いページだけで始め、2026-09-15 にユーザー指示で全11ページに広げた。
   ヒーローの直下（index.html は「いまの状況」と直近の予定の帯の下）に、節
   （main の h2.section-title）へのジャンプリンクを置く。review.html の手書きの目次
   （rev_nav*）はこれに置き換えて廃止した — 目次が2つ並ぶため。
   ・目次は見出しから自動で組むので、節を足しても消しても直す場所は無い。
   ・飛び先は、見出しが属する section の id → 見出しの id → 無ければ見出しの
     data-i18n(-html) のキーを id として付ける。既存のアンカー（#contact など、
     他ページからリンクされているもの）は変えない。
   ・文言は見出しの文字をそのまま使い、<small> の副題は落とす。見出しは i18n.js が
     辞書で書き換えるので、MutationObserver で追いかけて目次の文字も直す。
   ・スマートフォンでは閉じた状態（details）で出す。10項目を開いたまま置くと本文が
     画面の外へ押し出されるため。 */
(function () {
  // 目次を差し込む位置。index.html は「いまの状況」を最初に読んでもらいたいので、その帯の下。
  var anchor = document.querySelector('main > .upcoming-bar') || document.querySelector('main > .now-bar') ||
               document.querySelector('main > .page-hero') || document.querySelector('main > .hero');
  var heads = [].slice.call(document.querySelectorAll('main h2.section-title'));
  if (!anchor || heads.length < 2) return;

  function label(h) {
    var c = h.cloneNode(true);
    c.querySelectorAll('small').forEach(function (s) { s.remove(); });
    return (c.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function targetId(h) {
    var sec = h.closest('section');
    if (sec && sec.id && sec.querySelector('h2.section-title') === h) return sec.id;
    if (h.id) return h.id;
    var key = h.getAttribute('data-i18n-html') || h.getAttribute('data-i18n') || '';
    var id = key ? 'toc-' + key : '';
    if (!id || document.getElementById(id)) id = 'toc-' + (heads.indexOf(h) + 1);
    h.id = id;
    return id;
  }

  // <nav> にするとヘッダ用の nav / nav a のスタイル（白文字・横並び）がかかるので、
  // div に role="navigation" を付ける。
  var nav = document.createElement('div');
  nav.setAttribute('role', 'navigation');
  nav.className = 'page-toc';
  var wrap = document.createElement('div');
  wrap.className = 'container';
  var det = document.createElement('details');
  var sum = document.createElement('summary');
  sum.className = 'page-toc-h';
  sum.setAttribute('data-i18n', 'page_toc_h');
  sum.textContent = 'このページの目次';
  var ol = document.createElement('ol');
  ol.className = 'page-toc-list';

  heads.forEach(function (h) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = '#' + targetId(h);
    a.textContent = label(h);
    li.appendChild(a);
    ol.appendChild(li);
    if (window.MutationObserver) {
      new MutationObserver(function () { a.textContent = label(h); })
        .observe(h, {childList: true, subtree: true, characterData: true});
    }
  });

  det.appendChild(sum);
  det.appendChild(ol);
  try { det.open = !window.matchMedia('(max-width: 700px)').matches; } catch (e) { det.open = true; }
  nav.setAttribute('aria-label', sum.textContent);
  new MutationObserver(function () { nav.setAttribute('aria-label', sum.textContent); })
    .observe(sum, {childList: true, characterData: true, subtree: true});
  wrap.appendChild(det);
  nav.appendChild(wrap);
  anchor.parentNode.insertBefore(nav, anchor.nextSibling);
})();

/* ===== HEADER HEIGHT（全ページ）=====
   ヘッダは position: sticky で、幅によってナビが1段にも2段にもなる（1000px 前後で2段、約122px）。
   目次などのアンカーへ飛んだとき見出しがヘッダの下に隠れないよう、実際の高さを
   --header-h に入れて scroll-margin-top の計算に使う（css/style.css）。 */
(function () {
  var header = document.querySelector('body > header, header');
  if (!header) return;
  function sync() {
    document.documentElement.style.setProperty('--header-h', Math.ceil(header.getBoundingClientRect().height) + 'px');
  }
  sync();
  if (window.ResizeObserver) new ResizeObserver(sync).observe(header);
  else window.addEventListener('resize', sync);
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
     この枠は市の公表図（48603.html の R9sinooka_busarea.png、1639×1179px）と同じ範囲で、
     枠の大きさ・縮尺も原図に合わせてある。原図も桃花台東の北東側は切れている。
   ・対象エリア（紫・busarea）… 市が公表している対象エリア図の着色部分を色で抽出し、
     原図の学校区線に上の通学区域データを重ねて位置合わせしたもの（約3.785 m/px、
     誤差はおおむね1画素）。【目視トレースではない。引き直すなら同じ手順で原図から】
     公表バスエリア 18.5 km² のうち、原図の枠に写っている 12.28 km² が入っている。
     内側に穴（バス対象外の一画）があるので Polygon の2本目以降のリングも描くこと
     （fill-rule="evenodd"）。HTML の注記（bus_map_caveat）と必ずセットで出す。
   ・道路・地区名・施設… OpenStreetMap（ODbL）。出典表示（bus_map_osm）には OSM に加えて
     国土数値情報・e-Stat も並べてある。どれも消さないこと。
     cls='local' は桃花台の主要生活道路（OSM の tertiary）と桃花台鳥居松線
     （OSM 上の名称は「桃花台・春日井線」）。localroad レイヤで表示を切り替える。

   投影は簡易正距円筒。ただし縮尺を原図に厳密に合わせるため、1度あたりの長さは
   経度・緯度それぞれの実長を使う（cos(緯度) だけの近似だと縦が約0.5%伸びる）。
   地物が多いので層ごとに <g data-layer> を作り、チェックボックスで表示を切り替える。

   【拡大縮小（2026-09-15 ユーザー指示で追加）】
   図形の座標には触れず、SVG の viewBox（表示範囲）だけを動かす。倍率1では従来の表示と同一。
   ・範囲は原図の枠の中だけ（枠の外へは動かせない）、倍率は 1〜MAX_ZOOM 倍。
   ・文字・印・線をそのまま拡大すると大きくなりすぎるので、倍率 z のとき 1/√z 倍に縮めて
     描き直す（見た目は √z 倍）。SCALE_ITEMS（位置を中心に縮める）と STROKES（線の太さ）。
   ・縮尺バーと方位記号は画面に対して固定し、縮尺バーの距離は倍率に応じて 1km→500m→200m→100m。
   ・操作: ＋／−／元に戻すボタン、Ctrl（Mac は ⌘）＋ホイール（トラックパッドのピンチを含む）、
     ダブルクリック、拡大中のドラッグ。スマートフォンは2本指で拡大縮小し、拡大中は1本指で動かす。
     倍率1のあいだは1本指の操作をページのスクロールに残す（地図が画面を塞いでも先へ読めるように）。 */
(function () {
  var host = document.getElementById('bus-area-map');
  if (!host) return;

  var _bl = window.KomakiLang();
  var NS = 'http://www.w3.org/2000/svg';
  // 枠は市の公表図（R9sinooka_busarea.png）と同じ 1639×1179px、同じ縮尺。
  // 1ユニット＝原図の1px＝約3.785m。原図に余白は無いので地図は枠いっぱいに描き、
  // スケールバーと方位記号だけ UI_PAD ぶん内側に置く。
  var VIEW_W = 1639;
  var UI_PAD = 40;
  var MAX_ZOOM = 6;
  var SCALE_ITEMS = [];   // [要素, 中心x, 中心y]
  var STROKES = [];       // [要素, 倍率1での線の太さ]
  function scalable(g, x, y) { SCALE_ITEMS.push([g, x, y]); return g; }
  function stroked(e, w) { STROKES.push([e, w]); return e; }

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
        else if (g.type === 'Polygon') busPolys.push(g.coordinates);
        else if (g.type === 'Point') newSchools.push(f);
      });
      if (!busPolys.length) throw new Error('no bus area');

      // --- 範囲
      // view_bbox がある場合はそれに従う。これは市の公表図と同じ範囲で、桃花台東の
      // 通学区域は原図と同じく枠の北東へさらに広がる。枠からはみ出す線は viewBox が
      // 切るので、ここで座標を加工する必要はない。
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
        busPolys.forEach(function (poly) { poly.forEach(function (ring) { ring.forEach(function (c) { grow(c[0], c[1]); }); }); });
        districts.forEach(function (f) { f.geometry.coordinates[0].forEach(function (c) { grow(c[0], c[1]); }); });
        places.forEach(function (f) { grow(f.geometry.coordinates[0], f.geometry.coordinates[1]); });
      }

      // 1度あたりのメートル数は経度と緯度で違うので、両方の実長を使う。
      var rad = (la0 + la1) / 2 * Math.PI / 180;
      var MPD_LON = 111412.84 * Math.cos(rad) - 93.5 * Math.cos(3 * rad);
      var MPD_LAT = 111132.92 - 559.82 * Math.cos(2 * rad) + 1.175 * Math.cos(4 * rad);
      var S = VIEW_W / ((lo1 - lo0) * MPD_LON);   // 1メートルあたりのSVGユニット
      var VIEW_H = (la1 - la0) * MPD_LAT * S;
      function px(lon) { return (lon - lo0) * MPD_LON * S; }
      function py(lat) { return (la1 - lat) * MPD_LAT * S; }
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
        g.appendChild(stroked(el('path', {d: path(f.geometry.coordinates), fill: 'none',
          stroke: ROAD_C[cls] || '#ccc', 'stroke-width': ROAD_W[cls] || 2,
          'stroke-linecap': 'round', 'stroke-linejoin': 'round'}), ROAD_W[cls] || 2));
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
              g.appendChild(scalable(label(px(m[0]), py(m[1]) - 6, nm, small ? 15 : 17, 400,
                                  small ? '#77878e' : '#5a6a70'), px(m[0]), py(m[1]) - 6));
            }
          }
        }
      });

      // --- 通学区域（赤線＝新通学区域界）
      var DFILL = {east: 'rgba(212,170,48,.16)', west: 'rgba(88,117,149,.16)'};
      var gDist = layer('district');
      districts.forEach(function (f) {
        gDist.appendChild(stroked(el('path', {d: path(f.geometry.coordinates[0]) + ' Z',
          fill: DFILL[f.properties.key] || 'rgba(0,0,0,.05)',
          stroke: '#d32f2f', 'stroke-width': 3, 'stroke-linejoin': 'round'}), 3));
      });

      // --- 対象エリア
      // 外周のほかに穴（対象外の一画）を持つので、リングを全部つないで evenodd で塗る。
      // coordinates[0] だけを描く形に戻さないこと。
      busPolys.forEach(function (poly) {
        layer('busarea').appendChild(stroked(el('path', {
          d: poly.map(function (ring) { return path(ring) + ' Z'; }).join(' '),
          'fill-rule': 'evenodd',
          fill: 'rgba(126,110,196,.40)', stroke: '#5b48a8',
          'stroke-width': 2.5, 'stroke-linejoin': 'round'}), 2.5));
      });

      // --- 施設（種類ごとの層）
      facs.forEach(function (f) {
        var cat = f.properties.cat, m = MARK[cat];
        if (!m) return;
        var c = f.geometry.coordinates;
        if (!inView(c[0], c[1])) return;
        var x = px(c[0]), y = py(c[1]);
        var g = scalable(el('g', {}), x, y);   // 印と名前をひとまとめにして、拡大時に一緒に縮める
        layer(cat).appendChild(g);
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
        var g = scalable(el('g', {}), x, y);
        gNew.appendChild(g);
        g.appendChild(el('circle', {cx: x, cy: y, r: 11, fill: 'var(--primary)',
          stroke: 'var(--accent)', 'stroke-width': 3.5}));
        var nm = (_bl === 'ja' ? f.properties.name : (f.properties.name_en || f.properties.name)) || '';
        g.appendChild(label(x, y - 18, nm, 20, 700, 'var(--text)'));
      });

      // --- 地区名（いちばん上・大きめ）
      var gPlace = layer('place');
      places.forEach(function (f) {
        var c = f.geometry.coordinates;
        gPlace.appendChild(scalable(label(px(c[0]), py(c[1]), f.properties.name, 24, 700, '#3b4a55'), px(c[0]), py(c[1])));
      });
      // 通学区域の名前
      districts.forEach(function (f) {
        var p = f.properties;
        if (p.label_lon == null) return;
        var nm = (_bl === 'ja' ? p.name : (p.name_en || p.name));
        gDist.appendChild(scalable(label(px(p.label_lon), py(p.label_lat), nm, 27, 700, '#8a5a00'), px(p.label_lon), py(p.label_lat)));
      });

      // --- スケールバーと方位（白い下地つき）
      function plate(x, y, w, h) {
        return el('rect', {x: x, y: y, width: w, height: h, rx: 6, fill: 'var(--white)', 'fill-opacity': .82});
      }
      var barLen = 1000 * S, bx = UI_PAD, by = VIEW_H - UI_PAD * 0.5;
      var gUi = el('g', {});
      var barPlate = plate(bx - 8, by - 36, barLen + 16, 44);
      gUi.appendChild(barPlate);
      var barPath = el('path', {d: 'M' + bx + ' ' + (by - 8) + ' V' + by + ' H' + (bx + barLen) + ' V' + (by - 8),
        fill: 'none', stroke: 'var(--text)', 'stroke-width': 2.5});
      gUi.appendChild(barPath);
      var lt = el('text', {x: bx, y: by - 13, 'font-size': 20, fill: 'var(--text)'});
      lt.textContent = '1 km';
      gUi.appendChild(lt);
      var nx = VIEW_W - UI_PAD - 12, ny = UI_PAD;
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

      // --- 拡大縮小（viewBox を動かすだけ。図形の座標は変えない）
      var view = {x: 0, y: 0, w: VIEW_W, h: VIEW_H};
      var raf = 0;
      function zoomOf() { return VIEW_W / view.w; }
      function clampView() {
        view.w = Math.min(VIEW_W, Math.max(VIEW_W / MAX_ZOOM, view.w));
        view.h = view.w * VIEW_H / VIEW_W;
        view.x = Math.min(VIEW_W - view.w, Math.max(0, view.x));
        view.y = Math.min(VIEW_H - view.h, Math.max(0, view.y));
      }
      function render() {
        raf = 0;
        var z = zoomOf(), one = z < 1.0001;
        svg.setAttribute('viewBox', one ? '0 0 ' + VIEW_W + ' ' + Math.round(VIEW_H)
                                        : [view.x, view.y, view.w, view.h].map(function (v) { return v.toFixed(2); }).join(' '));
        var k = 1 / Math.sqrt(z);
        SCALE_ITEMS.forEach(function (it) {
          if (one) it[0].removeAttribute('transform');
          else it[0].setAttribute('transform', 'translate(' + it[1] + ' ' + it[2] + ') scale(' + k.toFixed(4) + ') translate(' + (-it[1]) + ' ' + (-it[2]) + ')');
        });
        STROKES.forEach(function (it) { it[0].setAttribute('stroke-width', one ? it[1] : (it[1] * k).toFixed(3)); });
        // 縮尺バーと方位記号は画面に固定する
        if (one) gUi.removeAttribute('transform');
        else gUi.setAttribute('transform', 'translate(' + view.x.toFixed(2) + ' ' + view.y.toFixed(2) + ') scale(' + (1 / z).toFixed(5) + ')');
        var D = [1000, 500, 200, 100].filter(function (d) { return d * z <= 1050; })[0] || 100;
        var len = D * S * z;
        barPlate.setAttribute('width', len + 16);
        barPath.setAttribute('d', 'M' + bx + ' ' + (by - 8) + ' V' + by + ' H' + (bx + len) + ' V' + (by - 8));
        lt.textContent = D >= 1000 ? (D / 1000) + ' km' : D + ' m';
        host.classList.toggle('is-zoomed', !one);
        if (zoomBox) {
          zoomBox.querySelector('[data-zoom="in"]').disabled = z >= MAX_ZOOM - 0.001;
          zoomBox.querySelector('[data-zoom="out"]').disabled = one;
          zoomBox.querySelector('[data-zoom="reset"]').disabled = one;
        }
      }
      function schedule() { if (!raf) raf = requestAnimationFrame(render); }
      // 画面上の点 → 地図の座標
      function toMap(clientX, clientY) {
        var r = svg.getBoundingClientRect();
        return {x: view.x + (clientX - r.left) / r.width * view.w,
                y: view.y + (clientY - r.top) / r.height * view.h, r: r};
      }
      function zoomAt(mx, my, factor) {
        var nw = Math.min(VIEW_W, Math.max(VIEW_W / MAX_ZOOM, view.w / factor));
        var f = nw / view.w;
        view.x = mx - (mx - view.x) * f;
        view.y = my - (my - view.y) * f;
        view.w = nw;
        clampView();
        schedule();
      }
      function zoomCenter(factor) { zoomAt(view.x + view.w / 2, view.y + view.h / 2, factor); }

      var fig = host.closest('.bus-map-figure');
      var zoomBox = fig && fig.querySelector('.bus-map-zoom');
      if (zoomBox) {
        zoomBox.hidden = false;
        zoomBox.addEventListener('click', function (e) {
          var b = e.target.closest('button[data-zoom]');
          if (!b) return;
          var act = b.getAttribute('data-zoom');
          if (act === 'in') zoomCenter(1.6);
          else if (act === 'out') zoomCenter(1 / 1.6);
          else { view = {x: 0, y: 0, w: VIEW_W, h: VIEW_H}; schedule(); }
        });
      }

      // マウス・トラックパッド: Ctrl／⌘＋ホイールで拡大縮小（ふつうのホイールはページのスクロールに残す）
      host.addEventListener('wheel', function (e) {
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        var p = toMap(e.clientX, e.clientY);
        zoomAt(p.x, p.y, Math.exp(Math.max(-1, Math.min(1, -e.deltaY * (e.deltaMode ? 0.05 : 0.002)))));
      }, {passive: false});
      host.addEventListener('dblclick', function (e) {
        var p = toMap(e.clientX, e.clientY);
        zoomAt(p.x, p.y, e.shiftKey ? 1 / 2 : 2);
      });
      var drag = null;
      host.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch' || e.button !== 0 || zoomOf() < 1.0001) return;
        drag = {id: e.pointerId, cx: e.clientX, cy: e.clientY, vx: view.x, vy: view.y};
        try { host.setPointerCapture(e.pointerId); } catch (err) {}
        host.classList.add('is-dragging');
      });
      host.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var r = svg.getBoundingClientRect();
        view.x = drag.vx - (e.clientX - drag.cx) / r.width * view.w;
        view.y = drag.vy - (e.clientY - drag.cy) / r.height * view.h;
        clampView();
        schedule();
      });
      function endDrag(e) {
        if (!drag || e.pointerId !== drag.id) return;
        drag = null;
        host.classList.remove('is-dragging');
      }
      host.addEventListener('pointerup', endDrag);
      host.addEventListener('pointercancel', endDrag);

      // タッチ: 2本指で拡大縮小・移動。拡大中は1本指でも動かす。
      var touch = null;
      function touchStart(e) {
        var t = e.touches;
        if (t.length >= 2) {
          var a = t[0], b = t[1];
          var mid = toMap((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
          touch = {mode: 'pinch', dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
                   w: view.w, mx: mid.x, my: mid.y};
          e.preventDefault();
        } else if (t.length === 1 && zoomOf() > 1.0001) {
          touch = {mode: 'pan', cx: t[0].clientX, cy: t[0].clientY, vx: view.x, vy: view.y};
          e.preventDefault();
        } else {
          touch = null;
        }
      }
      host.addEventListener('touchstart', touchStart, {passive: false});
      host.addEventListener('touchmove', function (e) {
        if (!touch) return;
        var t = e.touches, r = svg.getBoundingClientRect();
        e.preventDefault();
        if (touch.mode === 'pinch' && t.length >= 2) {
          var a = t[0], b = t[1];
          var d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
          view.w = Math.min(VIEW_W, Math.max(VIEW_W / MAX_ZOOM, touch.w * touch.dist / d));
          view.h = view.w * VIEW_H / VIEW_W;
          // 指を置いた地点が、2本の指のまん中に来つづけるように動かす
          var cx = (a.clientX + b.clientX) / 2, cy = (a.clientY + b.clientY) / 2;
          view.x = touch.mx - (cx - r.left) / r.width * view.w;
          view.y = touch.my - (cy - r.top) / r.height * view.h;
        } else if (touch.mode === 'pan' && t.length === 1) {
          view.x = touch.vx - (t[0].clientX - touch.cx) / r.width * view.w;
          view.y = touch.vy - (t[0].clientY - touch.cy) / r.height * view.h;
        }
        clampView();
        schedule();
      }, {passive: false});
      host.addEventListener('touchend', function (e) {
        if (!touch) return;
        // 2本指のうち1本を離したら、残りの1本での移動に切り替える（倍率1なら終わり）
        if (e.touches.length) touchStart(e); else touch = null;
      });
      host.addEventListener('touchcancel', function () { touch = null; });
      render();

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

/* ===== COMMUNITY ACTIONS（community.html「地域の取組」）=====
   地域で行われている取組。data/community_actions.json は手動管理。

   【このコーナーだけ出典の性格が違う】市の公式情報でも報道でもなく、
   主催者自身の発信（Instagram や紙の回覧板）。報道コーナーと同じく、
   計画の内容・数値の根拠には決して使わない。発信元の表示が
   「誰の発信か」を示す唯一の手がかりなので、外さないこと。

   バッジは主催者の別で切り替える（data 側の badge）。市民有志の催しと
   地域協議会の催しは主催が違うので、まとめて「市民有志」と書いてはいけない
   ——主催者を偽ることになる。協議会の催しでも、市が公式サイトで案内した
   ものはすぐ上の自動取得コーナーに出る。こちらは紙の回覧など、
   自動取得では拾えない経路で知った分を手で載せる場所。

   取組の名称は日本語以外の表示で data/headline_i18n.json の訳に、学校名は school_<言語> に
   置き換える（2026-09-14 ユーザー指示：見出しを原文のまま残さない）。 */
(function () {
  var container = document.getElementById('community-actions-container');
  if (!container) return;

  var _al = window.KomakiLang();
  var _at = {
    when:   {ja:'日時', en:'Date', pt:'Data', vi:'Thời gian', tl:'Petsa', es:'Fecha', zh:'日期', id:'Waktu', tr:'Tarih', my:'ရက်စွဲ'},
    place:  {ja:'場所', en:'Place', pt:'Local', vi:'Địa điểm', tl:'Lugar', es:'Lugar', zh:'地点', id:'Tempat', tr:'Yer', my:'နေရာ'},
    source: {ja:'発信元', en:'Posted by', pt:'Divulgado por', vi:'Nguồn tin', tl:'Mula sa', es:'Publicado por', zh:'发布方', id:'Diposting oleh', tr:'Paylaşan', my:'တင်သူ'},
    citizen:{ja:'市民有志', en:'Citizen-run', pt:'Iniciativa de cidadãos', vi:'Do người dân tổ chức', tl:'Mamamayan ang nagpapatakbo', es:'Iniciativa ciudadana', zh:'市民自发', id:'Inisiatif warga', tr:'Vatandaş girişimi', my:'ပြည်သူ့ဦးဆောင်'},
    council:{ja:'地域協議会', en:'Community council', pt:'Conselho comunitário', vi:'Hội đồng cộng đồng', tl:'Konseho ng komunidad', es:'Consejo comunitario', zh:'地区协议会', id:'Dewan komunitas', tr:'Bölge konseyi', my:'ဒေသဆိုင်ရာ ကောင်စီ'},
    empty:  {ja:'現在、掲載されている取組はありません。', en:'Nothing is listed at the moment.', pt:'No momento não há nada publicado.', vi:'Hiện chưa có nội dung nào.', tl:'Wala pang nakalista sa ngayon.', es:'Por ahora no hay nada publicado.', zh:'目前没有刊登的活动。', id:'Saat ini belum ada yang ditampilkan.', tr:'Şu anda listelenen bir şey yok.', my:'လက်ရှိတွင် ဖော်ပြထားသည် မရှိပါ။'},
    error:  {ja:'地域の取組を取得できませんでした。', en:'Could not load community efforts.', pt:'Não foi possível carregar.', vi:'Không tải được nội dung.', tl:'Hindi ma-load ang listahan.', es:'No se pudo cargar.', zh:'无法加载地区行动。', id:'Gagal memuat.', tr:'Yüklenemedi.', my:'မဖွင့်နိုင်ပါ။'}
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
        // 取組名は data/headline_i18n.json の訳に、学校名は school_<言語>（無ければ英語）に置き換える
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
                   '<span class="action-title" data-hl="' + esc(it.title_ja || '') + '">' + esc(it.title_ja || '') + '</span>' +
                   '<span class="action-badge">' + at(it.badge === 'council' ? 'council' : 'citizen') + '</span>' +
                 '</div>' +
                 '<div class="action-school">' + esc(pick(it, 'school')) + '</div>' +
                 rows +
                 (body ? '<p class="action-body">' + esc(body) + '</p>' : '') +
                 '<div class="action-source">' + at('source') + '：' + src + '</div>' +
               '</li>';
      }).join('') + '</ul>';
      window.KomakiHeadline.apply(container);   // 取組名を表示言語に
    })
    .catch(function () {
      container.innerHTML = '<p class="official-news-error">' + at('error') + '</p>';
    });
})();

/* ===== TOBU ACTIONS（「地域の取組」欄の中の「東部まちづくりの動き」）=====
   2026-09-13 追加（ユーザー指示）。市の東部まちづくり推進室が公表している
   東部地域の取組を、市民有志の取組のすぐ下に出す。data/tobu_actions.json は
   .github/scripts/build_tobu_actions.py が毎日の取得結果から組み立てる生成物で、
   手編集しない（自動更新パイプラインの ALLOWED にも入れない）。

   【市民有志の取組とは分けて出す】上は住民自身が始めたもの、ここは市の部署が
   公表したもの。同じ一覧に混ぜると「誰が出している情報か」が消える。だから
   見出しを分け、行の形（.tobu-item）も市民有志の取組（.action-item）と変えてある。

   【これからの催しを先に出す】参加できるものが先、済んだ動きが後。載せるのは
   直近2か月ぶん（絞り込みは build_tobu_actions.py 側。これからの催しは日付が
   未来なので必ず残る）。

   【出典だけリンクする】市サイトへのリンクは許可された索引ページのみ
   （CLAUDE.md／auto_gates.py check 6）。2026-09-13 に東部まちづくりの索引が
   許可されたので、出典の行だけそこへリンクする。URL をこのファイルに置いてあるのは、
   ゲートの検査対象（js/*.js）に入れて機械で守らせるため — JSON 側に持たせると
   検査をすり抜ける。個々の記事ページは許可されていないので項目にリンクは張らない。

   取組の名称・会場名は日本語以外の表示で data/headline_i18n.json の訳に置き換える
   （2026-09-14 ユーザー指示：見出しを原文のまま残さない）。 */
(function () {
  var container = document.getElementById('tobu-actions-container');
  if (!container) return;

  // 許可された索引ページ（出典リンク）。増やすときは CLAUDE.md・CONTRIBUTING.txt 規則1・
  // README.md・auto_gates.py の PERMITTED_LINKS を同時に直すこと。
  var SOURCE_URL = 'https://www.city.komaki.aichi.jp/admin/soshiki/toshiseisakubu/toubumachidukuri/tobumachidukurisingikai/index.html';

  var _tl = window.KomakiLang();
  var _tt = {
    badge:   {ja:'市公式', en:'City official', pt:'Oficial da cidade', vi:'Chính quyền thành phố', tl:'Opisyal ng lungsod', es:'Oficial municipal', zh:'市官方', id:'Resmi kota', tr:'Belediye resmî', my:'မြို့တော် တရားဝင်'},
    source:  {ja:'出典', en:'Source', pt:'Fonte', vi:'Nguồn', tl:'Pinagkunan', es:'Fuente', zh:'出处', id:'Sumber', tr:'Kaynak', my:'ရင်းမြစ်'},
    upcoming:{ja:'これからの催し', en:'Coming up', pt:'Próximos eventos', vi:'Sắp diễn ra', tl:'Nalalapit na kaganapan', es:'Próximos actos', zh:'即将举办', tr:'Yaklaşan etkinlikler', id:'Akan datang', my:'လာမည့် ပွဲများ'},
    recent:  {ja:'さいきんの動き', en:'Recently', pt:'Recentemente', vi:'Gần đây', tl:'Kamakailan', es:'Recientemente', zh:'最近的动态', id:'Belakangan ini', tr:'Son gelişmeler', my:'မကြာသေးမီက'},
    when:    {ja:'日時', en:'Date', pt:'Data', vi:'Thời gian', tl:'Petsa', es:'Fecha', zh:'日期', id:'Waktu', tr:'Tarih', my:'ရက်စွဲ'},
    place:   {ja:'場所', en:'Place', pt:'Local', vi:'Địa điểm', tl:'Lugar', es:'Lugar', zh:'地点', id:'Tempat', tr:'Yer', my:'နေရာ'},
    empty:   {ja:'この2か月に新しい動きはありませんでした。', en:'Nothing new in the last two months.', pt:'Nada novo nos últimos dois meses.', vi:'Không có gì mới trong hai tháng qua.', tl:'Walang bago sa nakalipas na dalawang buwan.', es:'Nada nuevo en los últimos dos meses.', zh:'最近两个月没有新的动态。', id:'Tidak ada yang baru dalam dua bulan terakhir.', tr:'Son iki ayda yeni bir şey yok.', my:'လွန်ခဲ့သော နှစ်လအတွင်း အသစ်မရှိပါ။'},
    error:   {ja:'東部まちづくりの動きを取得できませんでした。', en:'Could not load the eastern district updates.', pt:'Não foi possível carregar.', vi:'Không tải được nội dung.', tl:'Hindi ma-load ang listahan.', es:'No se pudo cargar.', zh:'无法加载东部城市建设的动态。', id:'Gagal memuat.', tr:'Yüklenemedi.', my:'မဖွင့်နိုင်ပါ။'}
  };
  function tt(k) { return _tt[k][_tl] || _tt[k]['en'] || _tt[k]['ja']; }

  // 「どのページから拾ったか」の分類名。市のページ群の名前で、数が限られた固定の語なので、
  // 表示言語に直す。知らない分類名（市がページ群を増やしたとき）だけは、ここに足すまで原文で出る。
  var _from = {
    '協働提案事業': {en:'Collaborative proposal project', pt:'Projeto de proposta colaborativa', vi:'Dự án đề xuất hợp tác', tl:'Collaborative proposal project', es:'Proyecto de propuesta colaborativa', zh:'协作提案事业', id:'Proyek usulan kolaboratif', tr:'Ortak öneri projesi', my:'ပူးပေါင်းအဆိုပြု စီမံကိန်း'},
    '東部地域トライアル活動': {en:'Eastern district trial activity', pt:'Atividade-piloto da zona leste', vi:'Hoạt động thử nghiệm khu vực phía đông', tl:'Trial na aktibidad sa silangang distrito', es:'Actividad piloto de la zona este', zh:'东部地区试行活动', id:'Kegiatan uji coba wilayah timur', tr:'Doğu bölgesi deneme etkinliği', my:'အရှေ့ပိုင်းဒေသ စမ်းသပ်လှုပ်ရှားမှု'},
    'オープンファクトリー': {en:'Open factory', pt:'Fábrica aberta', vi:'Nhà máy mở cửa', tl:'Open factory', es:'Fábrica abierta', zh:'开放工厂', id:'Pabrik terbuka', tr:'Açık fabrika', my:'စက်ရုံ ဖွင့်လှစ်ပြသပွဲ'},
    '東部まちづくり': {en:'Eastern district development', pt:'Desenvolvimento da zona leste', vi:'Phát triển khu vực phía đông', tl:'Pagpapaunlad ng silangang distrito', es:'Desarrollo de la zona este', zh:'东部城市建设', id:'Pembangunan wilayah timur', tr:'Doğu bölgesi kalkınması', my:'အရှေ့ပိုင်း မြို့ပြဖွံ့ဖြိုးရေး'},
    '東部まちづくりニュース': {en:'Eastern District Development News', pt:'Notícias do desenvolvimento da zona leste', vi:'Bản tin phát triển khu vực phía đông', tl:'Balita sa pagpapaunlad ng silangang distrito', es:'Noticias del desarrollo de la zona este', zh:'东部城市建设新闻', id:'Berita pembangunan wilayah timur', tr:'Doğu bölgesi kalkınma haberleri', my:'အရှေ့ပိုင်း မြို့ပြဖွံ့ဖြိုးရေး သတင်း'},
    '東部まちづくり審議会': {en:'Eastern District Development Council', pt:'Conselho de desenvolvimento da zona leste', vi:'Hội đồng thẩm định phát triển khu vực phía đông', tl:'Konseho sa pagpapaunlad ng silangang distrito', es:'Consejo de desarrollo de la zona este', zh:'东部城市建设审议会', id:'Dewan pembangunan wilayah timur', tr:'Doğu bölgesi kalkınma kurulu', my:'အရှေ့ပိုင်း မြို့ပြဖွံ့ဖြိုးရေး ကောင်စီ'}
  };
  var _fy = {en:'FY', pt:'ano fiscal ', vi:'năm tài chính ', tl:'FY', es:'ejercicio ', zh:'', id:'TA ', tr:'mali yıl ', my:'ဘဏ္ဍာနှစ် '};
  function fromLabel(s) {
    if (!s || _tl === 'ja') return s || '';
    var fy = '', base = s;
    var m = /^令和(\d+)年度\s*(.+)$/.exec(s);
    if (m) { fy = String(2018 + (+m[1])); base = m[2]; }
    var tr = _from[base] && (_from[base][_tl] || _from[base].en);
    if (!tr) return s;
    if (fy) tr += _tl === 'zh' ? '（' + fy + '年度）' : ' (' + (_fy[_tl] || 'FY') + fy + ')';
    return tr;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
    });
  }
  // 日付は表示言語の書式に直す（見出しは apply で訳に置き換える）
  function fmtDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || '';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(_tl === 'ja' ? 'ja-JP' : _tl,
      {year: 'numeric', month: _tl === 'ja' ? 'long' : 'short', day: 'numeric'});
  }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  var MAX_UPCOMING = 3;
  var MAX_RECENT = 5;

  function row(it) {
    // 開催日が分かる催しは「日時」欄に市の原文（例: 令和8年11月15日(日曜日)14時から）を添える。
    var extra = '';
    // 日本語以外では日付を左の欄で出しているので、ここは時刻だけに組み直す（読めなければ原文）。
    var note = it.date_note ? window.KomakiJaWhen(it.date_note, _tl, {timeOnly: true}) : '';
    var sep = (_tl === 'ja' || _tl === 'zh') ? '：' : ': ';
    if (note)         extra += '<span class="tobu-from">' + tt('when') + sep + esc(note) + '</span>';
    if (it.place)     extra += '<span class="tobu-from">' + tt('place') + sep + '<span data-hl="' + esc(it.place) + '">' + esc(it.place) + '</span></span>';
    if (it.from)      extra += '<span class="tobu-from">' + esc(fromLabel(it.from)) + '</span>';
    return '<li class="tobu-item" data-date="' + esc(it.date || '') + '">' +
             '<div class="tobu-head">' +
               '<span class="tobu-date">' + esc(fmtDate(it.date)) + '</span>' +
               '<span class="tobu-title" data-hl="' + esc(it.title || '') + '">' + esc(it.title || '') + '</span>' +
               '<span class="ce-badge">' + tt('badge') + '</span>' +
             '</div>' + extra +
           '</li>';
  }

  fetch('./data/tobu_actions.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      var all = data.items || [];
      var today = todayIso();
      var up = all.filter(function (it) { return it.kind === 'event' && (it.date || '') >= today; }).slice(0, MAX_UPCOMING);
      var rest = all.filter(function (it) { return up.indexOf(it) === -1; }).slice(0, MAX_RECENT);
      if (!up.length && !rest.length) { container.innerHTML = '<p class="school-empty">' + tt('empty') + '</p>'; return; }

      var html = '';
      if (up.length) {
        html += '<div class="tobu-group-h">' + tt('upcoming') + '</div>' +
                '<ul class="tobu-list">' + up.map(row).join('') + '</ul>';
      }
      if (rest.length) {
        html += '<div class="tobu-group-h">' + tt('recent') + '</div>' +
                '<ul class="tobu-list">' + rest.map(row).join('') + '</ul>';
      }
      html += '<div class="tobu-source">' + tt('source') + ((_tl === 'ja' || _tl === 'zh') ? '：' : ': ') +
              '<a href="' + SOURCE_URL + '" target="_blank" rel="noopener">' +
              esc(data.source_label || '') + '</a></div>';
      container.innerHTML = html;
      window.KomakiHeadline.apply(container);   // 取組の名称・会場名を表示言語に
    })
    .catch(function () {
      container.innerHTML = '<p class="official-news-error">' + tt('error') + '</p>';
    });
})();

/* ===== READ ALOUD（全ページ）=====
   2026-09-15 ユーザー採用。節の見出しの下に「🔊 読み上げる」を置き、その節の本文を
   ブラウザに内蔵された音声合成（speechSynthesis）で、表示中の言語のまま読み上げる。
   日本語の読み書きが難しい住民・高齢者・目の不自由な人に、耳で届けるため。

   ・ボタンはページ全体ではなく節ごと。review.html などは全文を一気に読むと長すぎて使えない。
     対象は main 内の h2.section-title と、index の「最新の動き」の各コーナー（h3.section-title.sub）。
   ・表示中の言語の声が端末に無ければ、ボタン自体を出さない（押しても無音、がいちばんまずい）。
     ビルマ語の声はほとんどの端末に無く、タガログ語も端末しだい。声の一覧は非同期に届くので
     voiceschanged と数回の再確認で待つ。
   ・声は端末内のもの（localService）を優先する。ブラウザによっては端末外の音声サービスに
     本文を送って読む声しか無いが（Linux の Chrome など）、読むのは公開中の本文だけで、
     読者がボタンを押したときにしか動かない。新しい外部ドメインをページが読みにいくことはない。
   ・1文ずつ区切って順に渡す。Chrome は長い発話を途中で黙って止めることがある。
   ・読まないもの: 表示されていない要素（閉じた Q&A の答えは読む）、見出しの <small> 副題
     （英語表示では日本語の副題なので、英語の声で日本語を読むことになる）、地図と層の切り替え、
     ボタン類、目次、絵文字（声によっては「虫眼鏡」などと名前を読んでしまう）。表は行ごとに読む。
   ・日本語の地名の読み: 声が読み違えやすい地名は YOMI でかなに置き換えて渡す。
     【読みは事実なので、公表資料で確かめられたものだけを足すこと】（しのおか学園・おおくさ）。
   ・ボタンの文言は data-i18n（tts_play / tts_stop）。HTML に現れないので
     build_page_dicts.py の RUNTIME_KEYS に入れてある。
   ・こどもむけの切り替えで本文が作り直されたら（komaki:i18n-applied）、読み上げを止める。 */
(function () {
  var synth = window.speechSynthesis;
  if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return;
  var main = document.querySelector('main');
  if (!main) return;

  var lang = window.KomakiLang();
  var VOICE_LANGS = {ja: ['ja'], en: ['en'], pt: ['pt-br', 'pt'], vi: ['vi'], tl: ['fil', 'tl'],
                     es: ['es'], zh: ['zh-cn', 'cmn-hans-cn', 'zh-hans', 'zh'], id: ['id', 'in'],
                     tr: ['tr'], my: ['my']};
  // 公表資料で読みが確かめられた地名だけ。推測で足さないこと。
  var YOMI = {ja: [['篠岡', 'しのおか'], ['大草', 'おおくさ']]};
  // 1回に渡す長さ。日本語・中国語は1文字あたりの読み時間が長いので短めに切る。
  var MAX = (lang === 'ja' || lang === 'zh') ? 70 : 180;
  var COMMA = (lang === 'ja' || lang === 'zh') ? '、' : ', ';

  var SKIP = 'script,style,noscript,svg,rt,select,input,textarea,button:not(.faq-q),' +
             '.tts-row,.page-toc,.faq-q-icon,.section-updated,.bus-map-layers,.bus-area-map,' +
             '[hidden],[aria-hidden="true"],.section-title small';
  var BLOCK = 'h2,h3,h4,h5,p,li,dt,dd,tr,caption,figcaption,blockquote,summary,.faq-q,div';
  // 札（「概要」などの分類ラベル）は直後の文とつなげて読むと意味が崩れるので、あとに読点を挟む
  var TAGLIKE = '[class*="tag"],[class*="badge"],[class*="label"],[class*="date"],[class*="cite"],time';
  var EMOJI = null, LETTER = null;
  try { EMOJI = new RegExp('[\\p{Extended_Pictographic}\\uFE0F\\u200D\\u20E3]', 'gu'); } catch (e) {}
  try { LETTER = new RegExp('[\\p{L}\\p{N}]', 'u'); } catch (e) {}

  var heads = Array.prototype.filter.call(
    main.querySelectorAll('h2.section-title, h3.section-title.sub'),
    function (h) { return !h.closest('.group-head, .share, .related, #board-sheet'); });
  if (!heads.length) return;

  function pickVoice() {
    var vs = [];
    try { vs = synth.getVoices() || []; } catch (e) {}
    var want = VOICE_LANGS[lang] || [lang];
    for (var i = 0; i < want.length; i++) {
      var hit = vs.filter(function (v) {
        var l = String(v.lang || '').toLowerCase().replace(/_/g, '-');
        return l === want[i] || l.indexOf(want[i] + '-') === 0;
      });
      if (hit.length) {
        hit.sort(function (a, b) {
          return ((b.localService ? 1 : 0) - (a.localService ? 1 : 0)) || ((b['default'] ? 1 : 0) - (a['default'] ? 1 : 0));
        });
        return hit[0];
      }
    }
    return null;
  }

  // 見出し h の節にある文字を、ブロック（段落・項目・表の行など）ごとに集める
  function blocksOf(h) {
    var root = h.closest('section') || h.parentNode;
    var i = heads.indexOf(h);
    var stop = (i + 1 < heads.length && root.contains(heads[i + 1])) ? heads[i + 1] : null;
    var FOLLOW = Node.DOCUMENT_POSITION_FOLLOWING;
    var out = [], cur = null, prevTag = null, n;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    while ((n = w.nextNode())) {
      var pe = n.parentElement;
      if (!pe) continue;
      if (!(h.compareDocumentPosition(n) & FOLLOW)) continue;          // 見出しより前
      if (stop && (stop.compareDocumentPosition(n) & FOLLOW)) break;   // 次の見出しから先
      if (pe.closest(SKIP)) continue;
      if (!pe.closest('.faq-a') && !pe.getClientRects().length) continue;   // 表示されていない
      var t = n.nodeValue.replace(/\s+/g, ' ');
      if (!t.trim()) continue;
      var b = pe.closest(BLOCK) || pe;
      var cell = pe.closest('td,th');
      var tag = pe.closest(TAGLIKE);
      if (!cur || cur.el !== b) { cur = {el: b, text: '', cell: cell}; out.push(cur); }
      else if (cell && cell !== cur.cell) { cur.text += COMMA; cur.cell = cell; }
      else if (prevTag && prevTag !== tag) cur.text += COMMA;
      prevTag = tag;
      cur.text += t;
    }
    return out;
  }

  function sentences(text) {
    if (EMOJI) text = text.replace(EMOJI, '');
    (YOMI[lang] || []).forEach(function (p) { text = text.split(p[0]).join(p[1]); });
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) return [];
    var out = [];
    text.replace(/([。！？!?။]|\.(?=\s))\s*/g, '$1\n').split('\n').forEach(function (s) {
      s = s.trim();
      while (s.length > MAX) {
        var cut = Math.max(s.lastIndexOf('、', MAX), s.lastIndexOf('，', MAX), s.lastIndexOf(',', MAX), s.lastIndexOf(' ', MAX));
        if (cut < MAX / 3) cut = MAX - 1;
        out.push(s.slice(0, cut + 1));
        s = s.slice(cut + 1).trim();
      }
      if (s && (!LETTER || LETTER.test(s))) out.push(s);
    });
    return out;
  }

  // --- 再生
  var token = 0, current = null, activeBtn = null, lit = null;
  function highlight(el) {
    if (lit === el) return;
    if (lit) lit.classList.remove('tts-reading');
    lit = el;
    if (el) el.classList.add('tts-reading');
  }
  function setActive(btn) {
    if (activeBtn) {
      activeBtn.setAttribute('aria-pressed', 'false');
      activeBtn.children[0].hidden = false;
      activeBtn.children[1].hidden = true;
    }
    activeBtn = btn;
    if (btn) {
      btn.setAttribute('aria-pressed', 'true');
      btn.children[0].hidden = true;
      btn.children[1].hidden = false;
    }
  }
  function stop() {
    token++;
    current = null;
    try { synth.cancel(); } catch (e) {}
    setActive(null);
    highlight(null);
  }
  function play(h, btn) {
    var voice = pickVoice();
    stop();
    if (!voice) return;
    var queue = [];
    blocksOf(h).forEach(function (b) {
      sentences(b.text).forEach(function (s) { queue.push({el: b.el, s: s}); });
    });
    if (!queue.length) return;
    var my = token;
    setActive(btn);
    function next() {
      if (my !== token) return;
      var item = queue.shift();
      if (!item) { stop(); return; }
      highlight(item.el);
      var u = new SpeechSynthesisUtterance(item.s);
      u.voice = voice;
      u.lang = voice.lang;
      u.onend = next;
      u.onerror = function () { if (my === token) next(); };
      current = u;   // 参照を持っておかないと、Chrome では読み終わりの合図が来ないことがある
      synth.speak(u);
    }
    // cancel() の直後に speak() すると、読み始めずに捨てられるブラウザがある
    setTimeout(next, 80);
  }

  // --- ボタン
  var rows = [];
  heads.forEach(function (h) {
    var row = document.createElement('div');
    row.className = 'tts-row';
    row.hidden = true;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tts-btn';
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = '<span data-i18n="tts_play">🔊 読み上げる</span><span data-i18n="tts_stop" hidden>■ 止める</span>';
    btn.addEventListener('click', function () {
      if (activeBtn === btn) stop(); else play(h, btn);
    });
    row.appendChild(btn);
    var after = h.nextElementSibling;
    (after && after.classList.contains('section-updated') ? after : h).insertAdjacentElement('afterend', row);
    rows.push(row);
  });

  function reveal() {
    var ok = !!pickVoice();
    rows.forEach(function (r) { r.hidden = !ok; });
    if (!ok && activeBtn) stop();
  }
  reveal();
  try { synth.addEventListener('voiceschanged', reveal); } catch (e) { synth.onvoiceschanged = reveal; }
  [400, 1500, 4000].forEach(function (ms) { setTimeout(reveal, ms); });

  try { synth.cancel(); } catch (e) {}   // 前のページで読みかけていたものを残さない
  document.addEventListener('komaki:i18n-applied', function () { if (activeBtn) stop(); });
  window.addEventListener('pagehide', function () { try { synth.cancel(); } catch (e) {} });
})();

/* ===== SINCE LAST VISIT（index.html「最新の動き」）=====
   2026-09-15 ユーザー採用。前回このページを見たときに無かった項目に「前回から」の印を付ける。
   毎日のぞきに来る保護者が、30日ぶん並んだ一覧から「何が増えたか」を目で探さずに済むように。
   読者は何も操作しない（チェックを入れる方式ではない）。

   ・比べるのは日付ではなく「前回表示した項目の目印」の集合。日付だと、同じ日に2回来たとき
     その日の項目を見たかどうかが分からない。目印は表示言語に左右されないもの
     （リンク先 URL、見出しの原文 data-hl、更新履歴は data-key）。
   ・初めて来た人（記録が無い人）には印を付けない。全部に印が付くと意味が無い。
   ・「前回」の記録はタブを開いている間 sessionStorage に持ち続ける（SNAP_MS まで）。開いた瞬間に
     「見た」と上書きするので、そうしないと再読み込みで印が消えてしまう。
   ・印の文字は CSS の ::after { content: attr(data-unseen) } で出す。回覧板シート（BOARD SHEET）は
     描画済みの一覧の textContent を拾うので、普通の文字で入れると紙に「前回から」と刷られる。
   ・学校HPのカードの「新着」（7日以内）とは別物。混同しないよう、言葉も色も変えてある。
   ・記録は端末の localStorage（komaki_seen_items）だけ。どこにも送らない。KEEP_DAYS を過ぎた目印は捨てる。
   ・各コーナーは非同期に描かれ、見出しの訳でも書き換わるので、MutationObserver で追いかける。
     コーナーの描画クラス名を変えたら、下の CORNERS も直すこと。 */
(function () {
  var latest = document.getElementById('latest');
  if (!latest) return;

  var STORE = 'komaki_seen_items', SNAP = 'komaki_seen_prev';
  var SNAP_MS = 60 * 60 * 1000, KEEP_DAYS = 120;
  var lang = window.KomakiLang();
  var kids = false;
  try { kids = lang === 'ja' && localStorage.getItem('komaki_kids') === '1'; } catch (e) {}
  var LABEL = {ja: '前回から', kids: 'まえに 見たあと', en: 'Since last visit', pt: 'Desde a última visita',
               vi: 'Mới từ lần trước', tl: 'Bago mula sa huling bisita', es: 'Desde tu última visita',
               zh: '上次访问后新增', id: 'Baru sejak kunjungan terakhir', tr: 'Son ziyaretten beri',
               my: 'နောက်ဆုံးလာပြီးနောက် အသစ်'};
  var SUMMARY = {
    ja: function (n) { return n ? '前回ご覧になったあとに増えた項目が ' + n + ' 件あります（「前回から」の印）。' : '前回ご覧になったあとに増えた項目はありません。'; },
    kids: function (n) { return n ? 'まえに 見たあと ふえた ものが ' + n + 'こ あります。' : 'まえに 見たあと ふえた ものは ありません。'; },
    en: function (n) { return n ? n + (n === 1 ? ' item has' : ' items have') + ' appeared since your last visit (marked "Since last visit").' : 'Nothing new since your last visit.'; },
    pt: function (n) { return n ? n + (n === 1 ? ' item novo' : ' itens novos') + ' desde a sua última visita (marcados “Desde a última visita”).' : 'Nada de novo desde a sua última visita.'; },
    vi: function (n) { return n ? 'Có ' + n + ' mục mới kể từ lần bạn xem trước (đánh dấu “Mới từ lần trước”).' : 'Không có gì mới kể từ lần bạn xem trước.'; },
    tl: function (n) { return n ? n + ' bagong item mula sa iyong huling bisita (may markang “Bago mula sa huling bisita”).' : 'Walang bago mula sa iyong huling bisita.'; },
    es: function (n) { return n ? n + (n === 1 ? ' elemento nuevo' : ' elementos nuevos') + ' desde tu última visita (marcados «Desde tu última visita»).' : 'Nada nuevo desde tu última visita.'; },
    zh: function (n) { return n ? '自您上次访问以来新增了 ' + n + ' 项（标有“上次访问后新增”）。' : '自您上次访问以来没有新增内容。'; },
    id: function (n) { return n ? 'Ada ' + n + ' item baru sejak kunjungan terakhir Anda (bertanda “Baru sejak kunjungan terakhir”).' : 'Tidak ada yang baru sejak kunjungan terakhir Anda.'; },
    tr: function (n) { return n ? 'Son ziyaretinizden beri ' + n + ' yeni öğe var (“Son ziyaretten beri” işaretli).' : 'Son ziyaretinizden beri yeni bir şey yok.'; },
    my: function (n) { return n ? 'သင် နောက်ဆုံးလာပြီးနောက် အသစ် ' + n + ' ခု ရှိသည်။' : 'သင် နောက်ဆုံးလာပြီးနောက် အသစ် မရှိပါ။'; }
  };
  var which = kids ? 'kids' : lang;
  var label = LABEL[which] || LABEL.en;
  var summaryFn = SUMMARY[which] || SUMMARY.en;

  // [コンテナ, 項目, 目印の取り方, 印を付ける要素（null なら項目そのもの）]
  // 印はリンク（<a>）には付けない。外部リンクの「↗」が同じ ::after を使っていて、印の文字が消える。
  var CORNERS = [
    ['official-news-container', '.official-news-item', function (li) { var a = li.querySelector('a[href]'); return a && 'n|' + a.getAttribute('href'); }, '.official-news-item-inner'],
    ['school-news-container', '.school-items li', function (li) { var a = li.querySelector('a[href]'); return a && 's|' + a.getAttribute('href'); }, null],
    ['community-actions-container', '.action-item', function (li) { var t = li.querySelector('.action-title'); return t && 'a|' + t.getAttribute('data-hl'); }, '.action-head'],
    ['tobu-actions-container', '.tobu-item', function (li) { var t = li.querySelector('.tobu-title'); return t && 't|' + (li.getAttribute('data-date') || '') + '|' + t.getAttribute('data-hl'); }, '.tobu-head'],
    ['press-container', '.press-item', function (li) { var a = li.querySelector('a[href]'); return a && 'p|' + a.getAttribute('href'); }, '.press-date'],
    ['site-updates-container', '.update-item', function (li) { var k = li.getAttribute('data-key'); return k && 'u|' + k; }, '.update-meta']
  ];

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // localStorage / sessionStorage は参照するだけで例外になる環境がある（保存を禁止したブラウザなど）
  function readJson(name, key) {
    try { var v = window[name].getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function writeJson(name, key, val) {
    try { window[name].setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  // 前回の記録。タブを開いている間は最初に読んだものを使い続ける。
  var stored = readJson('localStorage', STORE);          // {目印: 最後に見た日}
  var snap = readJson('sessionStorage', SNAP);           // {at: ms, seen: {…} | null}
  if (!snap || typeof snap.at !== 'number' || Date.now() - snap.at > SNAP_MS) {
    snap = {at: Date.now(), seen: (stored && typeof stored === 'object') ? stored : null};
    writeJson('sessionStorage', SNAP, snap);
  }
  var prev = snap.seen;   // null なら初めての訪問

  var summary = document.createElement('p');
  summary.className = 'since-last-summary';
  summary.hidden = true;
  summary.setAttribute('aria-live', 'polite');
  var lead = latest.querySelector('.school-lead');
  (lead || latest.querySelector('h2')).insertAdjacentElement('afterend', summary);

  var timer = null;
  function run() {
    timer = null;
    var cur = stored && typeof stored === 'object' ? stored : {};
    var t = today(), count = 0, any = false;
    CORNERS.forEach(function (c) {
      var box = document.getElementById(c[0]);
      if (!box) return;
      box.querySelectorAll(c[1]).forEach(function (li) {
        var key = c[2](li);
        if (!key) return;
        any = true;
        var unseen = !!prev && !Object.prototype.hasOwnProperty.call(prev, key);
        var target = c[3] ? li.querySelector(c[3]) : li;
        li.classList.toggle('unseen-item', unseen);
        if (target) {
          if (unseen) target.setAttribute('data-unseen', label);
          else target.removeAttribute('data-unseen');
        }
        if (unseen) count++;
        cur[key] = t;
      });
    });
    // 古い目印を捨てて保存
    var limit = new Date(Date.now() - KEEP_DAYS * 864e5);
    var lim = limit.getFullYear() + '-' + String(limit.getMonth() + 1).padStart(2, '0') + '-' + String(limit.getDate()).padStart(2, '0');
    Object.keys(cur).forEach(function (k) { if (!(cur[k] >= lim)) delete cur[k]; });
    stored = cur;
    writeJson('localStorage', STORE, cur);
    if (prev && any) {
      summary.textContent = summaryFn(count);
      summary.classList.toggle('since-last-summary--none', !count);
      summary.hidden = false;
    }
  }
  function schedule() { if (!timer) timer = setTimeout(run, 120); }

  if (window.MutationObserver) {
    var mo = new MutationObserver(schedule);
    CORNERS.forEach(function (c) {
      var box = document.getElementById(c[0]);
      if (box) mo.observe(box, {childList: true, subtree: true});
    });
  }
  schedule();
})();
