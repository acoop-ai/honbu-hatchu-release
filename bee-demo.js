'use strict';
// ハチの見本（テンチャク【惣菜】v2.13・商品呼出番号表 0.2.9 の見本と同じ形）。右上のアカウントのメニュー（▾）の「ハチの見本を見る」から。
//   この画面で出るハチの場面（短い待ち・長い待ち・つながらない・30 秒・空・絞り込みで0件・利用ガイドを開くとき）を、本物と同じ部品・同じ置き場・同じ字で、
//   もふ・むぎわら の 14 場面。既定は「自動で進まない」＝1つの場面を出したまま止まる。「次へ ▶」「◀ 前へ」（キーの → ←）で進める。
//   左の「場面の一覧」から見たい場面へ直に飛べる。いま何番目か（3 / 14）・場面の名前・どんな時に出るかの1行を大きめに。
//   「自動で流す」を選んだときだけ 1 場面 10 秒（長い待ちは字が替わってから 6 秒）・一時停止できる。長い待ちは本物と同じ 8 秒で字が替わる（あと◯秒）。
//   見るだけ: 窓口を呼ばない（callGAS を使わない）・発注データ・ログインの札・この PC に覚えた絵の選び（mitsubachi_style）・絞り込みを変えない（絵の案はカードごとに渡す）。
//   カードの釦（もう一度・閉じる・読み込み直す など）を押しても、次の場面へ進むだけ。
//   上の帯と同じ所に見本の帯（← 元の画面へ戻る は ← ひとつ前に戻る と同じ所）。Esc でも戻る。戻ると元の画面のまま（開いていた店・月・表・送った位置）。
//   字は全部 textContent（部品も同じ）。外から読む物は無い。
(function () {
  var MB = window.Mitsubachi, App = window.TENCHA_BEE;
  if (!MB || !App || !App.fillGridEmpty) return;   // 部品が読めない端末では、見本を出さない（メニューにも出さない）
  var NAME = { B: 'もふ', C: 'むぎわら' };
  var GUIDE_TEXT = '利用ガイドを読み込んでいます…';   // guide.js の待ちと同じ字
  var AUTO_MS = 10000, AFTER_SLOW_MS = 6000, SLOW_AT_MS = 8300;   // 自動で流すときの 1 場面・長い待ちで字が替わってから・字が替わる時刻（カードが出る 0.3 秒＋8 秒＝本物と同じ）
  var NARROW = 760;   // これより狭い幅では、場面の一覧は「☰ 場面の一覧」で開け閉め
  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = String(text); return e; };
  var storeName = function () { var s = ($('currentStoreDisplay') || {}).textContent || ''; s = s.replace(/^店舗:\s*/, ''); return s || '見本店A'; };

  // ---------------------------------------------------------------- 場面（play(絵の案, 次へ) → 止める関数）
  var SCENES = [
    { key: 'short', name: '短い待ち', when: '店を替える・部門を替える・開くときなどに 0.3 秒より長くかかったとき、真ん中に出ます。終わるとすぐ消えます。',
      note: '見本では出したままにしています（ハチはずっと 8 の字に飛びます）。「↺ この場面をもう一度」で、0.3 秒たって出る所から見られます。',
      play: function (st) { App.showLoading('発注データを読み込んでいます...', { style: st, maxMs: 600000 }); return function () { App.hideLoading(); }; } },
    { key: 'long', name: '長い待ち（8 秒を超えた）', when: '8 秒を超えても終わらないとき、下の字が「時間がかかっています」に替わります。', slow: true, note: '',
      play: function (st) { App.showLoading('発注データを読み込んでいます...', { style: st, maxMs: 600000 }); return function () { App.hideLoading(); }; } },
    { key: 'offline', name: 'つながらない', when: '通信が切れたとき、困り顔と理由と「もう一度」が出ます。「もう一度」で同じ操作をやり直せます（ログインし直さなくてよい）。',
      note: '見本なので、カードの釦を押すと次の場面へ進みます。',
      play: function (st, next) { App.showRetry({ title: '発注データを読めませんでした', text: App.NET_MSG.offline, retry: next, close: next, style: st }); return function () { App.hideLoading(); }; } },
    { key: 'timeout', name: '30 秒たっても返事がない', when: '30 秒たっても返事が無いとき、待つのをやめて、理由と「もう一度」を出します。',
      note: '見本なので、カードの釦を押すと次の場面へ進みます。',
      play: function (st, next) { App.showRetry({ title: '発注データを読めませんでした', text: App.NET_MSG.timeout, retry: next, close: next, style: st }); return function () { App.hideLoading(); }; } },
    { key: 'empty', name: '空（発注データがまだ無い）', when: 'その店・部門の発注を、本部がまだ取り込んでいないとき。表の代わりに、止まったハチと次の一手の釦が出ます。',
      note: '見本なので、カードの釦を押すと次の場面へ進みます。',
      play: function (st, next) { var sg = stage(''); var box = el('div', 'grid-empty'); sg.appendChild(box); App.fillGridEmpty(box, 'none', { style: st, onAction: next, sample: { store: storeName(), dept: '惣菜' } }); return function () { sg.remove(); }; } },
    { key: 'filtered', name: '絞り込みで0件', when: '取引先や商品の名前で絞って、当たる商品が無いとき。「絞り込みを外す」で、その月の発注が全部出ます。',
      note: '見本なので、カードの釦を押すと次の場面へ進みます（いまの絞り込みは変えません）。',
      play: function (st, next) { var sg = stage(''); var box = el('div', 'grid-empty'); sg.appendChild(box); App.fillGridEmpty(box, 'filtered', { style: st, onAction: next, sample: { q: 'コロッケ' } }); return function () { sg.remove(); }; } },
    { key: 'guide', name: '利用ガイドを開くとき', when: '右上の「📖 利用ガイド」を開いて 0.3 秒より長くかかったとき、本文の場所の真ん中に出ます。', note: '',
      play: function (st) { var sg = stage('is-guide'); var place = el('div', 'wait-place'); place.setAttribute('role', 'status'); sg.appendChild(place); var h = MB.wait(place, { text: GUIDE_TEXT, style: st }); return function () { h.end(); sg.remove(); }; } }
  ];
  var STEPS = [];
  ['B', 'C'].forEach(function (st) { SCENES.forEach(function (sc) { STEPS.push({ st: st, sc: sc }); }); });

  // ---------------------------------------------------------------- 見本の帯（上の帯と同じ所）・左の場面の一覧・場面の上の進める釦と説明・下の画面を押せなくする透明の幕
  var run = null;
  function stage(cls) { var sg = el('div', 'bee-demo-stage' + (cls ? ' ' + cls : '')); sg.style.top = run.top + 'px'; sg.style.left = run.left + 'px'; document.body.appendChild(sg); return sg; }
  function btn(cls, text, title, fn) { var b = el('button', cls, text); b.type = 'button'; if (title) b.title = title; b.addEventListener('click', fn); return b; }
  function build() {
    var bar = el('div', 'bee-demo-bar'); bar.id = 'bee-demo'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'ハチの見本');
    var nav = el('nav', 'nav-fixed bd-nav'); nav.setAttribute('aria-label', '戻る');
    var back = btn('btn btn-secondary nav-btn bd-back', '← 元の画面へ戻る', '見本を終えて、元の画面へ戻ります（Esc でも戻ります）', function () { end(''); });
    back.setAttribute('aria-label', '見本を終えて、元の画面へ戻る');
    var top = btn('btn btn-secondary nav-btn bd-top', '↑ TOP', '場面の一覧と場面を、いちばん上へ', function () { run.list.scrollTop = 0; document.querySelectorAll('.bee-demo-stage').forEach(function (sg) { sg.scrollTop = 0; }); });
    top.setAttribute('aria-label', 'TOP（いちばん上へ）');
    nav.appendChild(back); nav.appendChild(top);
    bar.appendChild(el('span', 'bd-badge', 'ハチの見本'));
    bar.appendChild(nav);
    bar.appendChild(el('span', 'bd-lead', '待ち・つながらない・空のときのハチを、1場面ずつ見られます（見るだけ）'));
    bar.appendChild(el('span', 'bd-keys', 'キー: → 次へ・← 前へ・Esc 戻る'));
    // 左の場面の一覧（もふ 1〜7・むぎわら 8〜14）
    var list = el('nav', 'bee-demo-list'); list.id = 'bee-demo-list'; list.setAttribute('aria-label', '場面の一覧');
    list.appendChild(el('p', 'bdl-title', '場面の一覧（' + STEPS.length + '）'));
    var items = [];
    ['B', 'C'].forEach(function (st) {
      list.appendChild(el('p', 'bdl-head', '絵: ' + NAME[st]));
      STEPS.forEach(function (s, i) {
        if (s.st !== st) return;
        var b = btn('bdl-item', '', s.sc.when, function () { closeList(); show(i); });
        b.appendChild(el('span', 'bdl-n', String(i + 1))); b.appendChild(el('span', 'bdl-name', s.sc.name));
        b.dataset.step = String(i + 1);
        list.appendChild(b); items.push(b);
      });
    });
    // 場面の上: 進める釦（前へ・何番目・次へ・もう一度・自動で流す）・場面の名前・どんな時に出るか
    var cap = el('div', 'bee-demo-cap'); cap.id = 'bee-demo-cap';
    var row = el('div', 'bd-row');
    var prev = btn('btn btn-secondary bd-prev', '◀ 前へ', '前の場面（キーの ←）', function () { go(-1); });
    var count = el('strong', 'bd-count');
    var next = btn('btn btn-primary bd-next', '次へ ▶', '次の場面（キーの →）', function () { go(+1); });
    var replay = btn('btn btn-secondary bd-replay', '↺ ', 'いまの場面を、はじめから出し直します', function () { show(run.i); }); replay.appendChild(el('span', 'bd-long', 'この場面を')); replay.appendChild(document.createTextNode('もう一度'));
    var autoBox = el('span', 'bd-autobox');
    var autoBtn = btn('btn btn-secondary bd-auto', '自動で流す', '1 場面 10 秒で次へ進みます（もう一度押すとやめる）', function () { setAuto(!run.auto); }); autoBtn.setAttribute('aria-pressed', 'false');
    var pauseBtn = btn('btn btn-secondary bd-pause', '‖ 一時停止', 'いまの場面のまま止める（もう一度押すと続ける）', function () { setPaused(!run.paused); }); pauseBtn.setAttribute('aria-pressed', 'false'); pauseBtn.hidden = true;
    var leftTxt = el('span', 'bd-left');
    autoBox.appendChild(autoBtn); autoBox.appendChild(pauseBtn); autoBox.appendChild(leftTxt);
    var listBtn = btn('btn btn-secondary bd-listbtn', '☰ 場面の一覧', '見たい場面を選ぶ', function () { toggleList(); }); listBtn.setAttribute('aria-expanded', 'false'); listBtn.setAttribute('aria-controls', 'bee-demo-list');
    [prev, count, next, listBtn, replay, autoBox].forEach(function (x) { row.appendChild(x); });
    var title = el('div', 'bd-title'); title.setAttribute('aria-live', 'polite');
    var style = el('span', 'bd-style'), name = el('strong', 'bd-name'); title.appendChild(style); title.appendChild(name);
    var when = el('p', 'bd-when'), note = el('p', 'bd-note'), still = el('p', 'bd-still', 'この PC は『動きを減らす』の設定なので、ハチは止まって見えます。');
    still.hidden = !MB.deviceReduced();
    [row, title, when, note, still].forEach(function (x) { cap.appendChild(x); });
    var shield = el('div', 'bee-demo-shield'); shield.setAttribute('aria-hidden', 'true');
    [shield, list, cap, bar].forEach(function (x) { document.body.appendChild(x); });
    run.bar = bar; run.nav = nav; run.list = list; run.cap = cap; run.shield = shield; run.items = items; run.count = count; run.style = style; run.name = name;
    run.when = when; run.note = note; run.prev = prev; run.next = next; run.replay = replay; run.autoBtn = autoBtn; run.pauseBtn = pauseBtn; run.leftTxt = leftTxt; run.listBtn = listBtn; run.back = back;
  }
  var narrow = function () { return window.innerWidth <= NARROW; };
  // 帯・一覧・説明の大きさに合わせて、場面の置き場（上と左）を決める（場面の説明が替わったとき・幅が替わったときも。狭い幅では帯と説明が何行にもなる）
  function place() {
    if (!run) return;
    var tb = $('topbar'), nw = narrow();
    // PC の幅では、見本の帯を上の帯と同じ高さにし、「← 元の画面へ戻る」を「← ひとつ前に戻る」と同じ所に置く
    var tr = tb ? tb.getBoundingClientRect() : null;
    run.bar.style.minHeight = tr && !nw ? Math.round(tr.bottom + 6) + 'px' : '';
    run.nav.style.marginLeft = '';
    var nb = $('navBack');
    if (nb && !nw) { var want = nb.getBoundingClientRect().left, have = run.back.getBoundingClientRect().left; if (want > 0 && Math.abs(want - have) > 0.5) run.nav.style.marginLeft = Math.max(0, parseFloat(getComputedStyle(run.nav).marginLeft) + want - have) + 'px'; }
    run.list.classList.toggle('is-drop', nw);
    run.listBtn.hidden = !nw;
    if (!nw) { run.list.hidden = false; run.listBtn.setAttribute('aria-expanded', 'false'); } else if (!run.listOpen) run.list.hidden = true;
    var barH = run.bar.getBoundingClientRect().height;   // 端数のまま（説明と場面の間に 1px の隙間も重なりも作らない）
    run.left = nw ? 0 : run.list.offsetWidth;
    run.cap.style.top = barH + 'px'; run.cap.style.left = run.left + 'px';
    run.capH = run.cap.getBoundingClientRect().height;
    run.top = barH + run.capH;
    run.list.style.top = (nw ? run.top : barH) + 'px';
    document.querySelectorAll('.bee-demo-stage').forEach(function (sg) { sg.style.top = run.top + 'px'; sg.style.left = run.left + 'px'; });
    // 本物の幕を、場面の置き場の中に（真ん中に寄せる作りはそのまま）
    document.body.style.setProperty('--bd-top', run.top + 'px'); document.body.style.setProperty('--bd-left', run.left + 'px');
  }
  function toggleList(on) {
    if (!run || !narrow()) return;
    run.listOpen = on === undefined ? !run.listOpen : on;
    run.list.hidden = !run.listOpen; run.listBtn.setAttribute('aria-expanded', String(run.listOpen));
    if (run.listOpen && run.items[run.i]) run.items[run.i].focus();
  }
  function closeList() { if (run && run.listOpen) { toggleList(false); run.listBtn.focus(); } }
  function paint(i) {
    var st = STEPS[i].st, sc = STEPS[i].sc;
    run.count.textContent = (i + 1) + ' / ' + STEPS.length;
    run.style.textContent = '絵: ' + NAME[st];
    run.name.textContent = sc.name;
    run.when.textContent = sc.when;
    run.note.textContent = sc.slow ? '本物と同じ 8 秒で、カードの下の字が替わります（あと 9 秒）。' : sc.note; run.note.hidden = !sc.note && !sc.slow;
    run.prev.disabled = i === 0;
    run.next.textContent = i === STEPS.length - 1 ? '終える ▶' : '次へ ▶';
    run.next.title = i === STEPS.length - 1 ? '見本を終えて、元の画面へ戻ります' : '次の場面（キーの →）';
    run.items.forEach(function (b, k) { if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    place();
  }
  function stopScene() { var s = run.stop; run.stop = null; if (s) { try { s(); } catch (_) { /* 片付けの失敗で止めない */ } } }
  function show(i) {
    stopScene();
    run.i = i; paint(i);
    var st = STEPS[i].st, sc = STEPS[i].sc;
    var me = ++run.seq;
    var keep = document.activeElement;   // 本物のエラーのカードは「もう一度」に手を移すので、見本の釦に手を戻す（キーで続けて進められる）
    run.stop = sc.play(st, function () { if (run && run.seq === me) go(+1); });   // カードの釦＝次の場面へ（二度押しで2つ進まない）
    var mine = keep && keep !== document.body && keep.isConnected && (run.bar.contains(keep) || run.cap.contains(keep) || run.list.contains(keep));
    (mine ? keep : run.next).focus({ preventScroll: true });
    run.t0 = Date.now();
    run.ms = sc.slow ? SLOW_AT_MS + AFTER_SLOW_MS : AUTO_MS; run.deadline = run.t0 + run.ms; run.rest = run.ms;
    tick();
  }
  function go(d) { if (!run) return; var j = run.i + d; if (j < 0) return; if (j >= STEPS.length) { end('ハチの見本は、ここまでです（元の画面のままです）'); return; } show(j); }
  // 0.25 秒ごと: 長い待ちの「字が替わるまで あと◯秒」と、自動で流すときの「あと◯秒で次へ」
  function tick() {
    if (!run) return;
    var sc = STEPS[run.i].sc;
    if (sc.slow) {
      var changed = !!document.querySelector('#loadingCard .mb-wait.mb-slow');
      var sec = Math.max(1, Math.ceil((SLOW_AT_MS - (Date.now() - run.t0)) / 1000));
      var t = changed ? '✓ カードの下の字が替わりました（本物と同じ、8 秒を超えたとき）。' : '本物と同じ 8 秒で、カードの下の字が替わります（あと ' + sec + ' 秒）。';
      if (run.note.textContent !== t) { run.note.textContent = t; if (run.cap.getBoundingClientRect().height !== run.capH) place(); }
    }
    if (!run.auto) return;
    if (run.paused) { run.leftTxt.textContent = '止めています'; return; }
    if (run.i === STEPS.length - 1) { setAuto(false); run.leftTxt.textContent = '最後の場面です'; return; }
    var rest = run.deadline - Date.now();
    if (rest <= 0) { go(+1); return; }
    var lt = 'あと ' + Math.ceil(rest / 1000) + ' 秒で次へ';
    if (run.leftTxt.textContent !== lt) run.leftTxt.textContent = lt;
  }
  function setAuto(on) {
    run.auto = on; run.paused = false;
    run.autoBtn.setAttribute('aria-pressed', String(on)); run.autoBtn.textContent = on ? '✓ 自動で流す' : '自動で流す';
    run.pauseBtn.hidden = !on; run.pauseBtn.textContent = '‖ 一時停止'; run.pauseBtn.setAttribute('aria-pressed', 'false');
    run.leftTxt.textContent = '';
    if (on) { run.deadline = Date.now() + run.ms; tick(); }
    place();
  }
  function setPaused(on) {
    if (!run.auto) return;
    if (on) run.rest = Math.max(0, run.deadline - Date.now()); else run.deadline = Date.now() + run.rest;
    run.paused = on; run.pauseBtn.textContent = on ? '▶ 続ける' : '‖ 一時停止'; run.pauseBtn.setAttribute('aria-pressed', String(on));
    tick();
  }
  function start(opt) {
    if (run) return;
    opt = opt && typeof opt === 'object' ? opt : {};
    if ($('loadingOverlay').style.display === 'flex') return;   // 本物の待ちの最中は始めない
    App.closeAcctMenu();
    run = { i: 0, seq: 0, stop: null, auto: false, paused: false, listOpen: false, top: 0, left: 0, t0: 0, ms: AUTO_MS, deadline: 0, rest: 0, ticker: 0, fromGuide: !!opt.fromGuide };
    build();
    if (run.fromGuide) { run.back.textContent = '← 利用ガイドに戻る'; run.back.title = '見本を終えて、利用ガイドへ戻ります（Esc でも戻ります）'; run.back.setAttribute('aria-label', '見本を終えて、利用ガイドに戻る'); }   // 利用ガイドの「ハチの見本を見る」から来た
    document.body.classList.add('bee-demo-on');   // 本物の幕を場面の置き場へ（html でなく body に付ける＝上の帯の sticky を外さない）
    run.ticker = setInterval(tick, 250);
    window.addEventListener('resize', place, { passive: true });
    show(0);
  }
  function end(message) {
    if (!run) return;
    clearInterval(run.ticker);
    stopScene(); App.hideLoading();
    [run.bar, run.cap, run.list, run.shield].forEach(function (x) { x.remove(); });
    document.body.classList.remove('bee-demo-on');
    document.body.style.removeProperty('--bd-top'); document.body.style.removeProperty('--bd-left');
    window.removeEventListener('resize', place);
    var fromGuide = run.fromGuide;
    run = null;
    if (fromGuide) { location.href = 'guide.html#g-bee'; return; }   // 来た所（利用ガイドの節）へ戻る
    var ab = $('acctBtn'); if (ab) ab.focus();
    if (message && window.showToast) window.showToast(message, 'success');
  }
  // キー: Esc＝見本を終える（本物の幕の Esc〈閉じる〉より先に受ける）・→ 次へ・← 前へ
  window.addEventListener('keydown', function (e) {
    if (!run || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(''); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(+1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
  }, true);

  // ---------------------------------------------------------------- メニューの入口（ハチの絵を選ぶ所の下）。メニューを最初に開いたとき、画面が呼ぶ
  window.TENCHA_BEE_DEMO_ENTRY = function (host) {
    if (!host || document.getElementById('bee-demo-open')) return;
    var open = el('button', 'bee-demo-open'); open.type = 'button'; open.id = 'bee-demo-open';
    open.appendChild(el('strong', '', 'ハチの見本を見る'));
    open.appendChild(el('small', '', '待ち・つながらない・空のときのハチを、1場面ずつ自分のペースで見ます（見るだけ）'));
    open.addEventListener('click', start);
    host.appendChild(open);
  };
  window.TENCHA_BEE_DEMO = { start: start, end: end, steps: STEPS.length };
})();
