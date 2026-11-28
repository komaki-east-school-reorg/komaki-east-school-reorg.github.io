/* ===== QUIZ（東部たんけんクイズ。index.html・community.html・quiz.html。2026-11-22） =====
   問題は data/quiz/<言語>.json（o の先頭が正解、ui は画面の文言）。つながりは data/quiz_meta.json。
   先に5問を決めず、1問答えるごとに次の1問を選ぶ。
   ・難しさは1〜5。問いは場所・話題ごとの「道」に、かんたん→むずかしいの順で並ぶ。
   ・正解すると同じ道を一段上へ、まちがえると一段下へ。難易度ボタンは候補の範囲をしぼる。
   ・読者の見立ては localStorage の komaki_quiz（この端末だけ）。外へ送らない（集計は機能の名前だけ）。
   選ぶ処理（Engine）は DOM に触らず、乱数を渡せる。 */
(function () {
  var KEY = 'komaki_quiz', ROUND = 5, THEMES = 'abcdehijfgkl'.split('');   // f・g・k・l はお店1〜4
  function groupOf(th) { return 'fgkl'.indexOf(th) >= 0 ? 'shop' : th; }   // お店は1つのまとまりとして偏りを見る

  function blank() { return { v: 1, a: 3, rounds: 0, th: {}, rt: {}, seen: {}, miss: {} }; }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  /* ---------- 組み立てる問題（QUIZ GEN、2026-11-28 ユーザー指示） ----------
     5000問を書く代わりに、確かめた事実の表（data/quiz_facts.json）と型（gt_*）から、出題のたびに組み立てる。
     ・事実はカード（more）か出どころ（src）で確かめたものだけ。町・種類・年・月は1つずつで、正解はちょうど1つになる。
     ・id は「型＋正解の事実」（年・月の型は3つの組）で決まるので、同じ問いは同じ id になり記録が増えすぎない。
     ・選択肢の組み合わせは毎回変わる。検査と数え上げは site_lint.py の quiz_data（同じ規則を Python で）。 */
  var GEN_TOWNS = ['okusa', 'oyama', 'noguchi', 'kamisue', 'ikenouchi', 'hayashi', 'takane', 'shiroyama', 'koga'];
  function Gen(F, ui, L) {
    var facts = F.facts || [], years = F.years || [], months = F.months || [];
    function nm(f) { return (f.name && (f.name[L] || f.name.en)) || f.id; }
    function town(t) { return ui['pl_' + t] || (F.towns[t] && (F.towns[t][L] || F.towns[t].en)) || t; }
    function tp(k) { var x = F.tpl[k]; return (x && (x[L] || x.en)) || ''; }
    function kname(k) { var x = F.kinds[k].name; return x[L] || x.en; }
    function grp(f) { return f.kind ? F.kinds[f.kind].group : 'A'; }
    function pick(arr, n, rand) {
      var a = arr.slice(), out = [];
      while (out.length < n && a.length) out.push(a.splice(Math.floor(rand() * a.length), 1)[0]);
      return out.length === n ? out : null;
    }
    function one(arr, rand) { return arr.length ? arr[Math.floor(rand() * arr.length)] : null; }
    function make(id, c, q, opts, used, d, extraRt) {
      var easy = used.every(function (f) { return !!f.more; });
      var it = { id: id, gen: true, theme: c.theme, q: q, o: opts, lv: easy ? 'easy' : 'hard',
        d: easy ? clamp(d, 1, 3) : clamp(d, 3, 5), routes: (c.rt || []).concat(extraRt || []) };
      if (easy || !c.src) it.more = c.more || null; else it.src = c.src;
      return it;
    }
    var withTown = facts.filter(function (f) { return f.town; });
    var withKind = facts.filter(function (f) { return f.kind; });
    var T = {
      where: function (rand) {
        var c = one(withTown, rand), o = c && pick(GEN_TOWNS.filter(function (t) { return t !== c.town; }), 2, rand);
        if (!o) return null;
        return make('gw:' + c.id, c, tp('gt_where').replace('{x}', nm(c)), [town(c.town), town(o[0]), town(o[1])], [c], grp(c) === 'B' ? 4 : 2, [c.town]);
      },
      inTown: function (rand) {
        var c = one(withTown, rand);
        var ds = c && pick(withTown.filter(function (f) { return f.town !== c.town && grp(f) === grp(c); }), 2, rand);
        if (!ds) return null;
        return make('gi:' + c.id, c, tp('gt_in').replace('{t}', town(c.town)), [nm(c), nm(ds[0]), nm(ds[1])], [c].concat(ds), grp(c) === 'B' ? 4 : 3, [c.town]);
      },
      notIn: function (rand) {
        var c = one(withTown, rand);
        if (!c) return null;
        var ts = GEN_TOWNS.filter(function (t) {
          return t !== c.town && withTown.filter(function (f) { return f.town === t && grp(f) === grp(c); }).length >= 2;
        });
        var t = one(ts, rand);
        var ins = t && pick(withTown.filter(function (f) { return f.town === t && grp(f) === grp(c); }), 2, rand);
        if (!ins) return null;
        return make('gn:' + t + ':' + c.id, c, tp('gt_notin').replace('{t}', town(t)), [nm(c), nm(ins[0]), nm(ins[1])], [c].concat(ins), 4, [t]);
      },
      kind: function (rand) {
        var c = one(withKind, rand);
        var ds = c && pick(withKind.filter(function (f) { return f.kind !== c.kind && grp(f) === grp(c); }), 2, rand);
        if (!ds) return null;
        return make('gk:' + c.id, c, tp('gt_kind').replace('{k}', kname(c.kind)), [nm(c), nm(ds[0]), nm(ds[1])], [c].concat(ds), grp(c) === 'B' ? 3 : 2);
      },
      notKind: function (rand) {
        var c = one(withKind, rand);
        if (!c) return null;
        var ks = Object.keys(F.kinds).filter(function (k) {
          return k !== c.kind && F.kinds[k].group === grp(c) && withKind.filter(function (f) { return f.kind === k; }).length >= 2;
        });
        var k = one(ks, rand), ins = k && pick(withKind.filter(function (f) { return f.kind === k; }), 2, rand);
        if (!ins) return null;
        return make('gnk:' + k + ':' + c.id, c, tp('gt_notkind').replace('{k}', kname(k)), [nm(c), nm(ins[0]), nm(ins[1])], [c].concat(ins), grp(c) === 'B' ? 4 : 3);
      },
      order: function (rand, key, list, minGap, tplOld, tplNew, pre) {
        var three = pick(list, 3, rand);
        if (!three) return null;
        var v = three.map(function (x) { return x[key]; });
        for (var i = 0; i < 3; i++) for (var j = i + 1; j < 3; j++) if (Math.abs(v[i] - v[j]) < minGap) return null;
        var old = rand() < 0.5;
        three.sort(function (a, b) { return old ? a[key] - b[key] : b[key] - a[key]; });
        var c = three[0], gap = Math.abs(three[1][key] - c[key]);
        var d = key === 'y' ? (gap >= 100 ? 2 : gap >= 20 ? 3 : 4) : (gap >= 3 ? 2 : 3);
        var ids = three.map(function (x) { return x.id; }).slice().sort().join('.');
        return make(pre + (old ? 'o:' : 'n:') + ids, c, tp(old ? tplOld : tplNew), three.map(nm), three, d);
      }
    };
    var plan = [['where', 2], ['inTown', 2], ['notIn', 1], ['kind', 2], ['notKind', 1], ['years', 2], ['months', 1]];
    var total = plan.reduce(function (s, p) { return s + p[1]; }, 0);
    function once(rand) {
      var r = rand() * total, name = plan[0][0];
      for (var i = 0; i < plan.length; i++) { r -= plan[i][1]; if (r <= 0) { name = plan[i][0]; break; } }
      if (name === 'years') return T.order(rand, 'y', years, 3, 'gt_old', 'gt_new', 'gy');
      if (name === 'months') return T.order(rand, 'm', months, 1, 'gt_early', 'gt_late', 'gm');
      return T[name](rand);
    }
    return {
      sample: function (n, rand) {
        rand = rand || Math.random;
        var out = [], seen = {};
        for (var tries = 0; out.length < n && tries < n * 6; tries++) {
          var it = once(rand);
          if (it && !seen[it.id] && it.q) { seen[it.id] = 1; out.push(it); }
        }
        return out;
      }
    };
  }
  window.KomakiQuizGen = Gen;

  /* ---------- 出題の判断 ---------- */
  function Engine(items, meta, state) {
    var byId = {}, routesOf = {}, routes = (meta && meta.routes) || {}, hide = (meta && meta.hide) || {};
    items.forEach(function (it) {
      byId[it.id] = it;
      routesOf[it.id] = [];
    });
    Object.keys(routes).forEach(function (r) {
      routes[r].forEach(function (id) { if (routesOf[id]) routesOf[id].push(r); });
    });
    function diff(id) {
      if (byId[id].d) return byId[id].d;
      var d = meta && meta.d && meta.d[id];
      return d || (byId[id].lv === 'easy' ? 2 : 4);
    }
    /* 組み立てた問題を候補に足す／いらなくなったものを外す（手書きの問いは外さない） */
    function add(list) {
      list.forEach(function (it) {
        if (byId[it.id]) return;
        items.push(it);
        byId[it.id] = it;
        routesOf[it.id] = (it.routes || []).slice();
      });
    }
    function prune(keep) {
      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        if (it.gen && !keep[it.id]) { items.splice(i, 1); delete byId[it.id]; delete routesOf[it.id]; }
      }
    }
    function handOpen(mode) {
      return items.some(function (x) { return !x.gen && inMode(x.id, mode) && state.seen[x.id] == null; });
    }
    function inMode(id, mode) { return mode === 'normal' || byId[id].lv === mode; }
    function target(mode) {
      // 正解率がおよそ7割になる難しさ（力 − 0.85）を、モードの範囲に収める
      var t = state.a - 0.85;
      return mode === 'easy' ? clamp(t, 1, 3) : mode === 'hard' ? clamp(t, 3, 5) : clamp(t, 1, 5);
    }
    function shared(a, b) {
      return routesOf[a].filter(function (r) { return routesOf[b].indexOf(r) >= 0; });
    }
    function seenInTheme(th) {
      return Object.keys(state.seen).filter(function (id) { return byId[id] && !byId[id].gen && byId[id].theme === th; }).length;
    }
    function themesIn(ctx) {
      var out = {};
      ctx.round.forEach(function (r) { var th = groupOf(byId[r.id].theme); out[th] = (out[th] || 0) + 1; });
      return out;
    }
    function pool(ctx) {
      var used = {}, used2 = themesIn(ctx), lastTh = ctx.last ? groupOf(byId[ctx.last.id].theme) : '';
      ctx.round.forEach(function (r) { used[r.id] = 1; });
      // 手書きの問いにまだ見ていないものがあるうちは、組み立てた問題は1回に2問まで
      var genIn = ctx.round.filter(function (r) { return byId[r.id] && byId[r.id].gen; }).length;
      var noGen = genIn >= 2 && handOpen(ctx.mode);
      var all = items.map(function (x) { return x.id; }).filter(function (id) {
        return !used[id] && !(noGen && byId[id].gen) && inMode(id, ctx.mode) && (!ctx.focus || byId[id].theme === ctx.focus);
      });
      if (ctx.focus) return all;
      var strict = all.filter(function (id) {
        var th = groupOf(byId[id].theme);
        return th !== lastTh && (used2[th] || 0) < 2;
      });
      if (strict.length) return strict;
      var soft = all.filter(function (id) { return groupOf(byId[id].theme) !== lastTh; });
      return soft.length ? soft : all;
    }
    function score(id, ctx) {
      var d = diff(id), s = -1.2 * Math.abs(d - target(ctx.mode));
      if (ctx.last) {
        var ld = diff(ctx.last.id), step = 0;
        if (shared(id, ctx.last.id).length) {
          if (ctx.last.ok) step = d === ld + 1 ? 4.5 : d > ld ? 3 : d === ld ? 1.5 : 0;
          else step = d === ld - 1 ? 4.5 : d < ld ? 3.5 : d === ld ? 1.5 : -1;
        }
        s += step;
      }
      if (state.seen[id] == null) s += 3;
      else s += Math.min(state.rounds - state.seen[id], 3) * 0.3;
      var like = 0;
      routesOf[id].forEach(function (r) { like = Math.max(like, state.rt[r] || 0); });
      s += Math.min(like, 4) * 0.25;
      if (ctx.rec && byId[id].theme === ctx.rec && !ctx.round.length) s += 3;
      return s;
    }
    function draw(list, ctx, rand) {
      var ranked = list.map(function (id) { return { id: id, s: score(id, ctx) }; })
        .sort(function (a, b) { return b.s - a.s; }).slice(0, 5);
      var top = ranked[0].s, sum = 0;
      ranked.forEach(function (x) { x.w = Math.exp((x.s - top) / 0.7); sum += x.w; });
      var r = rand() * sum;
      for (var i = 0; i < ranked.length; i++) { r -= ranked[i].w; if (r <= 0) return ranked[i].id; }
      return ranked[0].id;
    }
    function pickRevenge(ctx, list, rand) {
      if (ctx.focus || !ctx.round.length || ctx.round.some(function (r) { return r.why === 'revenge'; })) return null;
      var due = list.filter(function (id) { return state.miss[id] != null && state.miss[id] < state.rounds; });
      if (!due.length) return null;
      if (ctx.round.length < 3 && rand() > 0.4) return null;
      due.sort(function (a, b) { return state.miss[a] - state.miss[b]; });
      return due[0];
    }
    function pickNewTheme(ctx, list) {
      if (ctx.focus || ctx.round.length !== 3 || ctx.round.some(function (r) { return r.why === 'new'; })) return null;
      var usedTh = themesIn(ctx), least = Infinity, out = [];
      list.forEach(function (id) {
        var th = byId[id].theme;
        if (usedTh[groupOf(th)]) return;
        var n = seenInTheme(th);
        if (n < least) { least = n; out = [id]; } else if (n === least) out.push(id);
      });
      return out.length ? out : null;
    }
    function pick(ctx, rand) {
      rand = rand || Math.random;
      var list = pool(ctx);
      if (!list.length) return null;
      var rev = pickRevenge(ctx, list, rand);
      if (rev) return { id: rev, why: 'revenge' };
      var fresh = pickNewTheme(ctx, list);
      if (fresh) return { id: draw(fresh, ctx, rand), why: 'new' };
      return { id: draw(list, ctx, rand), why: '' };
    }
    function record(id, ok) {
      var d = diff(id), it = byId[id];
      state.a = clamp(state.a + 0.6 * ((ok ? 1 : 0) - 1 / (1 + Math.exp(d - state.a))), 1, 5.5);
      var th = state.th[it.theme] || (state.th[it.theme] = [0, 0]);
      th[ok ? 0 : 1]++;
      routesOf[id].forEach(function (r) {
        state.rt[r] = Math.round(((state.rt[r] || 0) * 0.9 + (ok ? 1 : 0.4)) * 100) / 100;
      });
      state.seen[id] = state.rounds;
      if (it.gen) {   // 組み立てた問題はリベンジに使わない。記録は新しい400件まで
        var g = Object.keys(state.seen).filter(function (k) { return k.indexOf(':') > 0; });
        if (g.length > 400) g.sort(function (a, b) { return state.seen[a] - state.seen[b]; }).slice(0, g.length - 400).forEach(function (k) { delete state.seen[k]; });
        return;
      }
      if (ok) delete state.miss[id]; else state.miss[id] = state.rounds;
    }
    /* 問題の上に出す一言の種類と、名前を出す道 */
    function bridge(id, last, why, opts) {
      if (why === 'revenge') return { k: 'br_revenge' };
      if (why === 'new') return { k: 'br_new' };
      if (!last) return null;
      var d = diff(id), ld = diff(last.id), r = shared(id, last.id);
      if (!r.length) return !last.ok && d < ld ? { k: 'br_down0' } : null;
      var dir = d > ld ? 'up' : d < ld ? 'down' : 'same';
      var hidden = hide[id] || [];
      var named = r.filter(function (x) { return x.charAt(0) !== '_' && hidden.indexOf(x) < 0 && opts(x); });
      if (named.length) return { k: 'br_' + dir, x: named[0] };
      return { k: 'br_' + dir + '0' };
    }
    function bestTheme() {
      var best = null, n = 0;
      THEMES.forEach(function (th) {
        var v = state.th[th];
        if (v && v[0] > n) { n = v[0]; best = th; }
      });
      return best;
    }
    function recommend(mode, round) {
      var used = {}, best = null, low = Infinity;
      round.forEach(function (r) { used[byId[r.id].theme] = 1; });
      THEMES.forEach(function (th) {
        if (used[th]) return;
        var open = items.filter(function (x) { return !x.gen && x.theme === th && inMode(x.id, mode) && state.seen[x.id] == null; }).length;
        if (!open) return;
        var n = seenInTheme(th);
        if (n < low) { low = n; best = th; }
      });
      return best;
    }
    return { pick: pick, record: record, bridge: bridge, diff: diff, bestTheme: bestTheme, recommend: recommend, seenInTheme: seenInTheme, add: add, prune: prune, get: function (id) { return byId[id]; } };
  }
  window.KomakiQuizEngine = Engine;

  /* ---------- 画面 ---------- */
  var box = document.getElementById('east-quiz');
  if (!box) return;
  var stage = box.querySelector('.east-quiz-stage');
  var mapBox = document.getElementById('quiz-map');
  var isPage = !!mapBox;
  var state = loadState(), engine = null, items = null, byId = null, meta = null, ui = {}, facts = null, gen = null;
  var pageLink = null, mode = 'normal', modeBox = null, loaded = '', round = [], at = 0, score = 0, picked = -1, counted = false, focus = null, rec = null;

  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && s.v === 1 && s.seen && s.miss && s.th && s.rt) return s;
    } catch (e) {}
    return blank();
  }
  function saveState() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function t(k) {
    if (ui[k] != null) return ui[k];
    var n = box.querySelector('[data-quiz-t="' + k + '"]');
    return n ? n.textContent : '';
  }
  function lang() {
    var l = window.KomakiLang ? window.KomakiLang() : 'ja';
    if (l === 'ja') { try { if (localStorage.getItem('komaki_kids') === '1') return 'ja-kids'; } catch (e) {} }
    return l;
  }
  function pageUrl(file, hash) {
    var l = window.KomakiLang ? window.KomakiLang() : 'ja';
    return file + (l === 'ja' ? '' : '?lang=' + encodeURIComponent(l)) + (hash || '');
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }
  function fmt(s) {
    var m = /^@([ym])(\d+)$/.exec(s);
    if (!m) return s;
    var l = lang() === 'ja-kids' ? 'ja' : lang();
    if (m[1] === 'y') return m[2] + (l === 'ja' || l === 'zh' ? '年' : l === 'ko' ? '년' : '');
    try { return new Intl.DateTimeFormat(l === 'es' ? 'es-419' : l, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, +m[2] - 1, 1))); }
    catch (e) { return m[2]; }
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(text, cls, fn) {
    var b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  function moreHref(id) {
    return document.getElementById(id) ? '#' + id : pageUrl('community.html', '#' + id);
  }
  function lastAnswer() {
    if (!at) return null;
    var p = round[at - 1];
    return { id: p.id, ok: !!p.ok };
  }
  function addNext() {
    if (gen) {   // 組み立てた問題の候補を出題のたびに入れ替える（いま出ている問いは残す）
      var keep = {};
      round.forEach(function (r) { if (r) keep[r.id] = 1; });
      engine.prune(keep);
      engine.add(gen.sample(24));
    }
    var ctx = { mode: mode, focus: focus, rec: rec, last: lastAnswer(), round: round.slice(0, at) };
    var p = engine.pick(ctx);
    if (!p) return false;
    round[at] = { id: p.id, why: p.why, ord: shuffle([0, 1, 2]) };
    return true;
  }
  function newRound() {
    round = []; at = 0; score = 0; picked = -1;
    addNext();
  }
  function want() {
    if (!focus) return ROUND;
    var n = items.filter(function (x) { return x.theme === focus && (mode === 'normal' || x.lv === mode); }).length;
    return Math.min(ROUND, n);
  }
  function drawModes() {
    if (!modeBox) {
      modeBox = el('div', 'east-quiz-modes');
      modeBox.setAttribute('role', 'group');
      box.insertBefore(modeBox, stage.nextSibling);
    }
    modeBox.textContent = '';
    modeBox.setAttribute('aria-label', t('mode'));
    var row = el('div', 'east-quiz-mode-row');
    row.appendChild(el('span', 'east-quiz-mode-label', t('mode')));
    ['easy', 'normal', 'hard'].forEach(function (m) {
      var b = btn(t(m), 'east-quiz-mode', function () {
        if (mode === m) return;
        mode = m; focus = null; rec = null; newRound(); draw();
        if (window.KomakiCount) window.KomakiCount('quiz/mode-' + m);
      });
      b.setAttribute('aria-pressed', mode === m ? 'true' : 'false');
      row.appendChild(b);
    });
    modeBox.appendChild(row);
    modeBox.appendChild(el('p', 'east-quiz-mode-note', t('note_' + mode)));
  }
  function bridgeText(cur) {
    var q = engine.get(cur.id), last = at ? { id: round[at - 1].id, ok: !!round[at - 1].ok } : null;
    var b = engine.bridge(cur.id, last, cur.why, function (r) {
      // 表示する名前が選択肢に入っていると答えが分かるので出さない
      var name = ui['pl_' + r];
      return !!name && !q.o.some(function (o) { return fmt(o).indexOf(name) >= 0; });
    });
    if (!b) return '';
    return (ui[b.k] || '').replace('{x}', b.x ? ui['pl_' + b.x] : '');
  }
  function drawResult() {
    var r = el('p', 'east-quiz-result', t('result').replace('{n}', round.length).replace('{c}', score));
    stage.appendChild(r);
    var bt = engine.bestTheme();
    if (bt && ui.type) stage.appendChild(el('p', 'east-quiz-type', ui.type.replace('{x}', ui['th_' + bt] || '')));
    rec = focus ? null : engine.recommend(mode, round);
    if (rec && ui.rec) stage.appendChild(el('p', 'east-quiz-insight', ui.rec.replace('{x}', ui['th_' + rec] || '')));
    var missed = round.filter(function (p) { return !p.ok && engine.get(p.id) && engine.get(p.id).more; })[0];
    var links = el('p', 'east-quiz-links');
    if (missed && ui.review) {
      var a = el('a', '', ui.review);
      a.href = moreHref(engine.get(missed.id).more);
      links.appendChild(a);
    }
    if (links.childNodes.length) stage.appendChild(links);
    stage.appendChild(btn(t('retry'), 'east-quiz-next', function () { focus = null; newRound(); draw(); }));
  }
  /* トップと community.html の枠から専用ページへ（説明文のすぐ下） */
  function drawPageLink() {
    if (isPage || !ui.page) return;
    if (!pageLink) {
      pageLink = el('a', 'east-quiz-pagelink');
      pageLink.addEventListener('click', function () { if (window.KomakiCount) window.KomakiCount('quiz/page'); });
      var lead = box.querySelector('.east-quiz-lead');
      box.insertBefore(pageLink, lead ? lead.nextSibling : stage);
    }
    pageLink.textContent = ui.page;
    pageLink.href = pageUrl('quiz.html');
  }
  function draw() {
    drawPageLink();
    drawModes();
    stage.textContent = '';
    var n = want();
    if (at >= n || !round[at]) {
      if (!round.finished) {
        round.finished = true;
        state.rounds++;
        saveState();
        if (!counted && window.KomakiCount) { counted = true; window.KomakiCount('quiz/finish'); }
      }
      drawResult();
      drawMap();
      return;
    }
    var cur = round[at], q = engine.get(cur.id);
    var num = el('p', 'east-quiz-num', 'Q' + (at + 1) + ' / ' + n);
    if (isPage) {
      var d = engine.diff(cur.id), stars = el('span', 'east-quiz-stars', '★★★★★'.slice(0, d) + '☆☆☆☆☆'.slice(0, 5 - d));
      if (ui.level) stars.setAttribute('aria-label', ui.level.replace('{n}', d));
      num.appendChild(document.createTextNode(' '));
      num.appendChild(stars);
    }
    stage.appendChild(num);
    var line = picked < 0 ? bridgeText(cur) : (cur.line || '');
    if (picked < 0) cur.line = line;
    if (line) stage.appendChild(el('p', 'east-quiz-bridge', line));
    stage.appendChild(el('p', 'east-quiz-q', q.q));
    var list = el('div', 'east-quiz-opts');
    cur.ord.forEach(function (i) {
      var b = btn(fmt(q.o[i]), 'east-quiz-opt', function () {
        if (picked >= 0) return;
        picked = i;
        cur.ok = i === 0;
        if (cur.ok) score++;
        engine.record(cur.id, cur.ok);
        saveState();
        draw();
        drawMap();
      });
      if (picked >= 0) {
        b.disabled = true;
        if (i === 0) b.classList.add('is-right');
        else if (i === picked) b.classList.add('is-wrong');
      }
      list.appendChild(b);
    });
    stage.appendChild(list);
    if (picked >= 0) {
      var f = el('p', 'east-quiz-feedback', picked === 0 ? t('right') : t('wrong').replace('{a}', fmt(q.o[0])));
      f.appendChild(document.createTextNode(' '));
      if (q.more) {
        var a = el('a', '', t('more'));
        a.href = moreHref(q.more);
        f.appendChild(a);
      } else if (q.src) {
        var c = el('small', '', t('src') + '：' + q.src);
        c.lang = 'ja'; c.setAttribute('translate', 'no');
        f.appendChild(c);
      }
      stage.appendChild(f);
      stage.appendChild(btn(t('next'), 'east-quiz-next', function () {
        at++; picked = -1;
        if (at < want()) addNext();
        draw();
      }));
    }
  }
  /* 専用ページの「テーマの制覇マップ」 */
  function drawMap() {
    if (!isPage || !engine) return;
    var grid = mapBox.querySelector('.quiz-map-grid');
    grid.textContent = '';
    THEMES.forEach(function (th) {
      var total = items.filter(function (x) { return !x.gen && x.theme === th; }).length, n = engine.seenInTheme(th);
      var card = el('div', 'quiz-map-card' + (n >= total ? ' is-done' : ''));
      card.appendChild(el('span', 'quiz-map-name', ui['th_' + th] || th));
      card.appendChild(el('span', 'quiz-map-n', n + ' / ' + total));
      var bar = el('span', 'quiz-map-bar'), fill = el('i');
      bar.setAttribute('aria-hidden', 'true');
      fill.style.width = Math.round(n / total * 100) + '%';
      bar.appendChild(fill);
      card.appendChild(bar);
      card.appendChild(btn(ui.map_go || '', 'quiz-map-go', function () {
        focus = th;
        if (!items.some(function (x) { return !x.gen && x.theme === th && (mode === 'normal' || x.lv === mode); })) mode = 'normal';
        newRound(); draw();
        box.scrollIntoView({ block: 'start' });
        if (window.KomakiCount) window.KomakiCount('quiz/theme');
      }));
      grid.appendChild(card);
    });
    var reset = mapBox.querySelector('.quiz-reset');
    if (reset && !reset.dataset.bound) {
      reset.dataset.bound = '1';
      reset.addEventListener('click', function () {
        if (!window.confirm(ui.reset_ask || '')) return;
        try { localStorage.removeItem(KEY); } catch (e) {}
        var fresh = blank();
        Object.keys(state).forEach(function (k) { delete state[k]; });
        Object.keys(fresh).forEach(function (k) { state[k] = fresh[k]; });
        focus = null; rec = null; newRound(); draw(); drawMap();
        if (window.KomakiCount) window.KomakiCount('quiz/reset');
      });
    }
    mapBox.hidden = false;
  }
  function load() {
    var l = lang();
    if (l === loaded) { if (byId) { draw(); drawMap(); } return; }
    loaded = l;
    var getMeta = meta ? Promise.resolve(meta) : fetch('data/quiz_meta.json').then(function (r) {
      if (!r.ok) throw new Error('meta');
      return r.json();
    }).catch(function () { return { d: {}, routes: {}, hide: {} }; });   // 読めなければ、つながり無しで出題する
    var getFacts = facts ? Promise.resolve(facts) : fetch('data/quiz_facts.json').then(function (r) {
      if (!r.ok) throw new Error('facts');
      return r.json();
    }).catch(function () { return null; });   // 読めなければ、手書きの問いだけで出題する
    Promise.all([fetch('data/quiz/' + l + '.json').then(function (res) {
      if (!res.ok) throw new Error('quiz');
      return res.json();
    }), getMeta, getFacts]).then(function (got) {
      if (l !== loaded) return;
      var first = !byId;
      meta = got[1];
      facts = got[2];
      items = got[0].items.slice();
      ui = got[0].ui || {};
      byId = {};
      items.forEach(function (it) { byId[it.id] = it; });
      engine = Engine(items, meta, state);
      gen = facts ? Gen(facts, ui, l) : null;
      // 言語が変わったとき、組み立てた問題が出ていたら新しい回にする（その言語で作り直せないため）
      if (!first && round.some(function (r) { return r && !byId[r.id]; })) newRound();
      if (first) newRound();
      box.hidden = false;
      draw();
      drawMap();
    }).catch(function () { if (!byId) box.hidden = true; });
  }
  load();
  document.addEventListener('komaki:i18n-applied', load);
})();
