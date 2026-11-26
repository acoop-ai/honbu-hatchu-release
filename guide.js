'use strict';
// テンチャク【惣菜】利用ガイド（v2.12）。言葉（本文）はログインの後に窓口（getGuide）から受け取る＝公開の画面に本文を置かない。
//   窓口は、ログインした人の役割（店舗の方／本部の方／管理者）に合う節だけを返す（ほかの役割の節の言葉は届かない）。
//   節 = { id, title, fig: 図の名前, steps: [{ h: 見出し, t: 補い }]（図の番号の丸 ①②… の説明・順番が番号）, items: [短い文], table: { head, rows }, forWho }
//   図の名前は、下の FIGS（流れの図）と guide-img/figs.js（作り物のデータの写真と丸の位置・tests/guide_shots.js が作る）にある物だけを出す。
//   窓口の文字は全部 textContent（HTML として入れない）。見出しの番号はここで振る（節を減らしても番号がずれない）。
//   型: 左に目次・右に本文・双方向に連動。移るときは滑らせて、着いた所を光らせる。
//   v2.13: 「ひとつ前に戻る」「TOPに戻る」は上の帯の中（目次・本文を送っても同じ所で押せる＝原則0）。待つ間は本文の場所の真ん中にハチ（ミツバチの部品）・
//          30 秒・通信の失敗は困り顔のハチと「もう一度読み込む」。いちばん下に節「待つ間のハチの絵」（画面の側の節＝窓口は変えない）と、生成AIの明示の1行。
(function () {
  // 窓口のアドレス（index.html の CONFIG.GAS_URL と同じ・tests/guide_test.js が同じかを確かめる）とログインの札の置き場（index.html と同じ）
  var GAS_URL = 'https://script.google.com/macros/s/AKfycbwhb1kd2Zp12nSdBiNo3Ac87TBLd8pjw2gYX6OVQEANfJcyzdIsmNIADWbjgE_xtn4/exec';
  var SESSION_STORE_KEY = 'honbu_hatchu_session_v1';
  var SHOTS = window.GUIDE_SHOTS || {};
  var own = function (o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); };
  var el = function (t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x !== undefined && x !== null) n.textContent = String(x); return n; };
  var status = document.getElementById('guide-status');
  var scroller = document.getElementById('guide-scroll');
  var toc = document.getElementById('guide-toc');
  var narrow = window.matchMedia('(max-width: 760px)');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ------------------------------------------------------------ 流れの図（写真でない図）。部品の見本の字は画面と同じ
  var FIGS = {
    'flow-excel': { ui: [['btn', '📊 Excel保存', true], ['file', '店舗別発注確認書_見本店A.xlsx'], ['paper', '']] },
    'flow-import': { ui: [['file', '2026.10月本部発注書.xlsx'], ['sheet', '2026.10月本部発注書'], ['btn', '⚙ 管理者同期'], ['btn', '発注データを同期', true], ['cells', '']] }
  };
  function figOf(name) {
    if (own(FIGS, name)) return Object.assign({ kind: 'flow' }, FIGS[name]);
    if (own(SHOTS, name) && /^guide-img\/[a-z0-9-]+\.png(\?v=[0-9a-f]+)?$/.test(String(SHOTS[name].src))) return Object.assign({ kind: 'shot' }, SHOTS[name]);
    return null;
  }
  function ui(kind, text, primary) {
    switch (kind) {
      case 'btn': return el('span', 'gui-btn' + (primary ? ' is-primary' : ''), text);
      case 'file': case 'sheet': { var b = el('span', 'gui-file' + (kind === 'sheet' ? ' is-sheet' : '')); b.append(el('i', '', kind === 'sheet' ? '表' : 'X'), document.createTextNode(text)); return b; }
      case 'paper': { var p = el('span', 'gui-paper'); for (var i = 0; i < 5; i++) p.append(el('i')); return p; }
      case 'cells': { var c = el('span', 'gui-cells'); for (var j = 0; j < 8; j++) c.append(el('span')); return c; }
      default: return el('span', '', text);
    }
  }
  function num(n) { var c = el('span', 'gnum', n); c.setAttribute('aria-hidden', 'true'); return c; }
  function flowFig(f, steps) {
    var box = el('div', 'gflow');
    var list = el('ol', 'gflow-list');
    steps.forEach(function (s, i) {
      var li = el('li', 'gflow-step'); li.append(num(i + 1));
      var u = f.ui && f.ui[i]; if (u) { var w = el('span', 'gflow-ui'); w.setAttribute('aria-hidden', 'true'); w.append(ui(u[0], u[1], u[2])); li.append(w); }
      li.append(el('strong', '', s.h)); if (s.t) li.append(el('span', 'gflow-t', s.t));
      list.append(li);
    });
    box.append(list);
    return box;
  }
  // 写真＋番号の丸（丸の位置は％なので、どの大きさでもずれない）。丸か手順にさわると、同じ番号の枠が光る
  function shotFig(f) {
    var fig = el('figure', 'gshot'); fig.style.setProperty('--gw', f.w + 'px');
    var sc = el('div', 'gshot-scroll');
    var frame = el('div', 'gshot-frame');
    var img = el('img'); img.alt = String(f.alt || ''); img.width = f.w; img.height = f.h; img.loading = 'lazy'; img.decoding = 'async'; img.src = f.src;
    frame.append(img);
    (f.marks || []).forEach(function (m, i) {
      var n = String(i + 1);
      var b = el('span', 'gbox'); b.dataset.n = n; b.style.left = m[2] + '%'; b.style.top = m[3] + '%'; b.style.width = m[4] + '%'; b.style.height = m[5] + '%';
      var c = num(n); c.classList.add('gmark'); c.dataset.n = n; c.style.left = m[0] + '%'; c.style.top = m[1] + '%';
      frame.append(b, c);
    });
    sc.append(frame); fig.append(sc);
    var cap = el('figcaption', 'gcap'); cap.append(el('span', '', '見本の写真（作り物のデータ）'));
    if (f.w > 640) {
      var z = el('button', 'gzoom', '大きく見る'); z.type = 'button'; z.setAttribute('aria-pressed', 'false');
      var setZoom = function (on) { fig.classList.toggle('is-zoom', on); z.textContent = on ? '画面の幅に戻す' : '大きく見る'; z.setAttribute('aria-pressed', String(on)); };
      z.addEventListener('click', function () { setZoom(!fig.classList.contains('is-zoom')); });
      // スマホの幅では、横に広い写真は縮めると字が読めない＝はじめから元の大きさ（写真の枠の中で横に送る）
      if (narrow.matches) setZoom(true);
      cap.append(z);
    }
    fig.append(cap);
    return fig;
  }
  function stepList(steps) {
    var ol = el('ol', 'gsteps');
    steps.forEach(function (s, i) { var li = el('li'); li.dataset.n = String(i + 1); li.append(num(i + 1), el('strong', '', s.h)); if (s.t) li.append(el('span', 'gstep-t', s.t)); ol.append(li); });
    return ol;
  }
  function linkHot(sec) {
    var set = function (n) { sec.querySelectorAll('[data-n]').forEach(function (x) { x.classList.toggle('is-hot', x.dataset.n === n); }); };
    sec.addEventListener('mouseover', function (e) { var t = e.target.closest('.gshot [data-n], .gsteps [data-n]'); set(t ? t.dataset.n : ''); });
    sec.addEventListener('mouseleave', function () { set(''); });
    sec.addEventListener('click', function (e) { var t = e.target.closest('.gmark, .gsteps li'); if (t) set(t.dataset.n); });
  }
  // このアカウントでできること（表）。見出しの行と左の列は CSS の sticky で残す（スマホは上の目次の帯の下に）
  //   行ごとに、くわしい節（t.go）があれば、行を押すとその節へ移る（右に「→ 番号」の札。番号は全部の節を描いた後に入れる）
  function tableFig(t) {
    var table = el('table', 'gtable');
    var thead = el('thead'); var hr = el('tr');
    (t.head || []).forEach(function (h) { var th = el('th', '', h); th.scope = 'col'; hr.append(th); });
    thead.append(hr); table.append(thead);
    var tb = el('tbody'); var go = Array.isArray(t.go) ? t.go : [];
    (t.rows || []).forEach(function (r, i) {
      if (!Array.isArray(r)) return;
      var tr = el('tr'); var th = el('th', '', r[0]); th.scope = 'row'; tr.append(th);
      var cells = r.slice(1).map(function (c) { var td = el('td', '', c); tr.append(td); return td; });
      var id = typeof go[i] === 'string' ? go[i].replace(/[^a-z0-9-]/gi, '') : '';
      if (id && cells.length) {
        var b = el('button', 'ggo', '→'); b.type = 'button'; b.dataset.go = id; cells[cells.length - 1].append(b);
        tr.classList.add('is-go');   // 押したときの動きは render の終わりで付ける（行のどこを押しても1回だけ移る）
      }
      tb.append(tr);
    });
    table.append(tb);
    return table;
  }

  // ------------------------------------------------------------ 目次と本文の連動・移る・戻る
  var pinned = '';
  var history_ = [];
  var backBtn = document.getElementById('g-back');
  var topGap = function () { return narrow.matches ? document.querySelector('.guide-side').offsetHeight : 0; }; // スマホでは目次の帯が上に残る分
  function setTableTop() { document.documentElement.style.setProperty('--gtable-top', topGap() + 'px'); }
  function setCurrent(id) {
    toc.querySelectorAll('a').forEach(function (a) {
      var on = a.dataset.id === id; a.classList.toggle('is-current', on);
      if (on) {
        a.setAttribute('aria-current', 'true');
        // 目次の現在地が、目次の見えている範囲から外れないように（縦の目次・スマホの横の帯の両方）
        if (toc.scrollHeight > toc.clientHeight + 1) { var ar = a.getBoundingClientRect(), tr = toc.getBoundingClientRect(); if (ar.top < tr.top || ar.bottom > tr.bottom) toc.scrollTop += ar.top - tr.top - (toc.clientHeight - a.offsetHeight) / 2; }
        if (toc.scrollWidth > toc.clientWidth + 1) toc.scrollLeft = a.offsetLeft - (toc.clientWidth - a.offsetWidth) / 2;
      } else a.removeAttribute('aria-current');
    });
  }
  function spy() {
    if (pinned) { setCurrent(pinned); return; }
    var secs = Array.prototype.slice.call(document.querySelectorAll('.guide-section')); if (!secs.length) return;
    var top = scroller.getBoundingClientRect().top + topGap() + 40; var cur = secs[0];
    secs.forEach(function (s) { if (s.getBoundingClientRect().top <= top) cur = s; });
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) cur = secs[secs.length - 1];
    setCurrent(cur.id.replace('g-', ''));
  }
  var toastTimer = 0;
  function say(text) { var t = document.getElementById('g-toast'); t.textContent = text; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 1400); }
  // 光らせるのは着いた所の1つだけ（前に光らせた節の印は外す）。光り終えたら印も外す
  function flash(node) {
    if (!node) return;
    document.querySelectorAll('.guide-section.is-landing').forEach(function (x) { x.classList.remove('is-landing'); });
    void node.offsetWidth; node.classList.add('is-landing');
    node.addEventListener('animationend', function done() { node.classList.remove('is-landing'); node.removeEventListener('animationend', done); });
  }
  // すっと滑らせる（0.28〜0.65 秒・始めと終わりを緩める）。描画の合図が止まっても、時間切れの保険で必ず着く。自分で送ったらやめる
  //   行き先は毎こま測り直す（通り過ぎた節を描くと上の節の高さが変わり、行き先がずれる＝着いてから跳ねない）
  var glideJob = 0;
  function glideTo(target, done) {
    var at = typeof target === 'function' ? target : function () { return target; };
    var start = scroller.scrollTop, job = ++glideJob, dist = at() - start;
    var finish = function () { if (job !== glideJob) return; glideJob++; scroller.scrollTop = at(); if (done) done(); };
    if (Math.abs(dist) < 2 || reduce.matches || document.visibilityState === 'hidden') { finish(); return; }
    var dur = Math.min(650, Math.max(280, Math.abs(dist) / 5)), t0 = performance.now();
    var step = function (now) {
      if (job !== glideJob) return;
      var p = Math.min(1, (now - t0) / dur), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      scroller.scrollTop = start + (at() - start) * e; spy();
      if (p < 1) requestAnimationFrame(step); else finish();
    };
    requestAnimationFrame(step);
    setTimeout(finish, dur + 90);
  }
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) { scroller.addEventListener(ev, function () { pinned = ''; glideJob++; }, { passive: true }); });
  scroller.addEventListener('scroll', spy, { passive: true });
  function targetOf(s) { return Math.max(0, scroller.scrollTop + s.getBoundingClientRect().top - scroller.getBoundingClientRect().top - topGap() - 8); }
  function pushHistory() { history_.push({ top: scroller.scrollTop, id: currentId() }); backBtn.disabled = false; }
  function currentId() { var a = toc.querySelector('a.is-current'); return a ? a.dataset.id : ''; }
  // 画面の外の節は描いていない（大きさが仮）。行き先は毎こま測り直し、着いた次のこまで1回だけ確かめる（そのとき描いた節の分）
  function jump(id, label) {
    var s = document.getElementById('g-' + id); if (!s) return;
    pushHistory(); pinned = id; setCurrent(id);
    glideTo(function () { return targetOf(s); }, function () {
      requestAnimationFrame(function () { if (pinned === id) { var d = targetOf(s) - scroller.scrollTop; if (Math.abs(d) > 1) scroller.scrollTop += d; } });
      flash(s);
    });
    say('→ ' + label);
  }
  backBtn.addEventListener('click', function () {
    var h = history_.pop(); backBtn.disabled = history_.length === 0; if (!h) return;
    pinned = '';
    glideTo(h.top, function () { var s = h.id && document.getElementById('g-' + h.id); flash(s); spy(); });
    say('← 元の場所へ戻りました');
  });
  document.getElementById('g-top').addEventListener('click', function () {
    pushHistory(); pinned = '';
    glideTo(0, function () { flash(document.querySelector('.guide-section')); spy(); });
    say('↑ はじめへ');
  });
  // 印刷のときは、まだ読んでいない写真も読む
  window.addEventListener('beforeprint', function () { document.querySelectorAll('.gshot img').forEach(function (i) { i.loading = 'eager'; }); });
  narrow.addEventListener('change', setTableTop);
  window.addEventListener('resize', setTableTop);

  // 節「待つ間のハチの絵」（v2.13）: 出る3つの場面（止まった絵に番号の丸）・選ぶ所（もふ／むぎわら）・見本の入口（画面のハチの見本が開く）
  function beeSection(n) {
    var M = window.Mitsubachi;
    var sec = el('section', 'guide-section gbee'); sec.id = 'g-bee';
    var h2 = el('h2', '', '待つ間のハチの絵'); h2.dataset.n = String(n); sec.append(h2);
    var cards = el('ol', 'gbee-scenes');
    [['F', '', '長い待ち', '読み込みに 0.3 秒より長くかかったとき。8 の字に飛びます。8 秒を超えると「時間がかかっています」'],
      ['F', 'sad', 'つながらない・30 秒', '通信が切れた・30 秒たっても返事が無いとき。「もう一度」で続きから（ログインし直さなくてよい）'],
      ['3F', '', '空', '発注がまだ無い・絞り込みで0件のとき。「読み込み直す」「絞り込みを外す」']].forEach(function (x, i) {
      var li = el('li', 'gbee-scene'); li.append(num(i + 1));
      var b = M.bee({ view: x[0], mood: x[1], size: 's56' }); b.setAttribute('aria-hidden', 'true');
      li.append(b, el('strong', '', x[2]), el('span', 'gbee-t', x[3]));
      cards.append(li);
    });
    sec.append(cards);
    var pick = el('div', 'gbee-pick');
    pick.append(el('p', 'gbee-pick-title', 'ハチの絵を選ぶ（押すと、すぐ替わります）'));
    M.picker(pick, { label: 'ハチの絵を選ぶ' });
    var demo = el('a', 'gbee-demo', '▶ ハチの見本を見る'); demo.href = 'index.html?beedemo=1';
    pick.append(demo, el('span', 'gbee-demo-t', '画面が開いて、14 の場面を1つずつ見られます（見るだけ）'));
    sec.append(pick);
    var ul = el('ul', 'gnotes');
    ['選んだ絵は、このパソコンに覚えます。店のパソコンはみんなで使うので、選ぶと、そのパソコンを使う全員の絵が替わります（テンチャク・番号表など、同じ所の画面は全部同じ絵）。',
      '0.3 秒より早く終わるときは、何も出ません。ログインの期限・使えないアカウントなど、人がすることのお知らせには、ハチは出しません（字だけ）。',
      '画面の右上のアカウント（▾）からも、選ぶ・見本を見るができます。'].forEach(function (t) { ul.append(el('li', '', t)); });
    sec.append(ul);
    return sec;
  }
  var textList = function (a) { return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string' && x; }) : []; };
  var stepsOf = function (a) { return Array.isArray(a) ? a.filter(function (s) { return s && typeof s.h === 'string'; }).map(function (s) { return { h: s.h, t: typeof s.t === 'string' ? s.t : '' }; }) : []; };
  function render(g) {
    document.title = String(g.title || document.title);
    var who = document.getElementById('guide-who'); if (g.who) { who.textContent = String(g.who) + '向け'; who.hidden = false; }
    var box = document.getElementById('guide-content');
    var sections = Array.isArray(g.sections) ? g.sections : [];
    var n = 0, lastFor = '', labels = {};
    sections.forEach(function (s) {
      var id = String(s.id || '').replace(/[^a-z0-9-]/gi, ''); if (!id || !s.title) return;
      n++;
      var label = n + ' ' + String(s.title); labels[id] = { n: n, label: label };
      var forWho = typeof s.forWho === 'string' ? s.forWho : '';
      if (forWho && forWho !== lastFor) toc.append(el('div', 'tgroup', forWho)); lastFor = forWho;
      var a = el('a'); a.href = '#g-' + id; a.dataset.id = id; a.append(el('span', 'tn', n), el('span', '', s.title));
      a.addEventListener('click', function (e) { e.preventDefault(); jump(id, label); }); toc.append(a);
      var sec = el('section', 'guide-section'); sec.id = 'g-' + id;
      var h2 = el('h2', '', s.title); h2.dataset.n = String(n); if (forWho) h2.append(el('span', 'gfor-tag', forWho));
      sec.append(h2);
      var steps = stepsOf(s.steps), fig = figOf(s.fig);
      if (fig && fig.kind === 'flow') sec.append(flowFig(fig, steps));
      else if (fig && fig.kind === 'shot') { var pair = el('div', 'gpair' + (fig.w <= 640 || (fig.w <= 1000 && fig.w / fig.h < 1.6) ? ' is-side' : '')); pair.append(shotFig(fig)); if (steps.length) pair.append(stepList(steps)); sec.append(pair); linkHot(sec); }
      else if (steps.length) sec.append(stepList(steps));
      var items = textList(s.items);
      if (items.length) { var ul = el('ul', 'gnotes'); items.forEach(function (t) { ul.append(el('li', '', t)); }); sec.append(ul); }
      if (s.table && typeof s.table === 'object') sec.append(tableFig(s.table));
      box.append(sec);
    });
    // いちばん下: 待つ間のハチの絵（v2.13・画面の側の節＝窓口を貼り直さない。中身は公開の部品の説明だけ）
    if (window.Mitsubachi) {
      n++;
      var bl = n + ' 待つ間のハチの絵'; labels.bee = { n: n, label: bl };
      if (lastFor) toc.append(el('div', 'tgroup', 'どなたでも'));
      var ba = el('a'); ba.href = '#g-bee'; ba.dataset.id = 'bee'; ba.append(el('span', 'tn', n), el('span', '', '待つ間のハチの絵'));
      ba.addEventListener('click', function (e) { e.preventDefault(); jump('bee', bl); }); toc.append(ba);
      box.append(beeSection(n));
    }
    var credit = el('p', 'gcredit', '生成物の作成にAIを利用しています。'); box.append(credit);   // 社内の生成AI利用ガイドライン 6.(4)・いちばん最後に小さく
    // 表の行 → くわしい節（番号は描いた節から。返されていない節を指す札は外す）
    box.querySelectorAll('.gtable .ggo').forEach(function (b) {
      var to = own(labels, b.dataset.go) ? labels[b.dataset.go] : null, tr = b.closest('tr');
      if (!to) { b.remove(); tr.classList.remove('is-go'); return; }
      b.textContent = '→ ' + to.n; b.setAttribute('aria-label', to.label + ' へ移る');
      tr.addEventListener('click', function () { jump(b.dataset.go, to.label); });
    });
    status.hidden = true; document.getElementById('guide-root').hidden = false;
    setTableTop(); spy();
    // 画面から戻ってきた（guide.html#g-bee など）: その節へ滑らせて着く（ひとつ前に戻るの履歴は積まない）
    var hid = String(location.hash || '').replace(/^#g-/, '');
    if (hid && own(labels, hid)) {
      var hs = document.getElementById('g-' + hid); pinned = hid; setCurrent(hid);
      // 画面の外の節は大きさが仮＝着いた次のこまで、描いた節の分だけ測り直す（jump と同じ）
      var fix = function (k) { requestAnimationFrame(function () { if (pinned !== hid) return; var d = targetOf(hs) - scroller.scrollTop; if (Math.abs(d) > 1) { scroller.scrollTop += d; if (k > 0) fix(k - 1); } }); };
      glideTo(function () { return targetOf(hs); }, function () { fix(3); setTimeout(function () { fix(2); }, 250); flash(hs); });
    }
  }

  function session() { try { var o = JSON.parse(localStorage.getItem(SESSION_STORE_KEY) || 'null'); return o && typeof o.t === 'string' && Date.now() < Number(o.e) - 60000 ? o.t : ''; } catch (_) { return ''; } }
  // 窓口が札を断った（7日を過ぎた・止められた）: 端末の札を捨てる（送った札のときだけ＝別のタブで入り直した新しい札は消さない。画面の clearSession_ と同じ）
  function dropSession(sent) { try { var o = JSON.parse(localStorage.getItem(SESSION_STORE_KEY) || 'null'); if (o && o.t === sent) localStorage.removeItem(SESSION_STORE_KEY); } catch (_) { /* 読めない端末 */ } }

  // ------------------------------------------------------------ 待つ間（v2.13・ハチ）: 本文の場所の真ん中に、8 の字に飛ぶハチと「利用ガイドを読み込んでいます…」（0.3 秒たってから）。
  //   8 秒で「時間がかかっています」・30 秒で待つのをやめて、困り顔のハチと理由と「もう一度読み込む」（通信の失敗・窓口の混雑も同じ）。
  //   ログインが要る・期限が切れた（人がすること）は、前と同じ字とリンク（ハチなし）。部品が読めない端末は前と同じ回る印と字
  var MB = window.Mitsubachi || null;
  var WAIT_TEXT = '利用ガイドを読み込んでいます…';
  var waitH = null;
  function placeBox() { status.classList.remove('is-loading'); status.classList.add('is-wait'); status.replaceChildren(); var p = el('div', 'wait-place'); status.append(p); return p; }
  function showWait() {
    if (MB) { waitH = MB.wait(placeBox(), { text: WAIT_TEXT }); return; }
    status.classList.add('is-loading'); status.replaceChildren(el('span', 'guide-status-text', WAIT_TEXT));
    waitH = { end: function () {} , timer: setTimeout(function () { var t = status.querySelector('.guide-status-text'); if (t) t.textContent = WAIT_TEXT + '（時間がかかっています。通信を確かめています）'; }, 8000) };
  }
  function endWait() { if (waitH) { if (waitH.timer) clearTimeout(waitH.timer); waitH.end(); waitH = null; } }
  // 文字だけの知らせ（人がすること・読めない形）
  function done_(nodes) { endWait(); status.classList.remove('is-loading', 'is-wait'); status.replaceChildren.apply(status, nodes); }
  function say_(text) { done_([document.createTextNode(text)]); }
  function askLogin(msg) { done_([document.createTextNode(msg + ' '), Object.assign(el('a', '', '画面でログインする'), { href: 'index.html?guide=1' })]); }
  // やり直せば直る失敗（通信・30 秒・混雑）: 同じ所に困り顔のハチ・理由・「もう一度読み込む」（このページのまま読み直す）
  function showRetry(title, text) {
    endWait();
    if (!MB) { done_([document.createTextNode(title + '。' + text + ' '), Object.assign(el('a', '', 'もう一度読み込む'), { href: 'guide.html' })]); return; }
    MB.error(placeBox(), { title: title, text: text, retryLabel: 'もう一度読み込む', onRetry: function () { start(); }, closeLabel: '画面へ戻る', onClose: function () { location.href = 'index.html'; }, size: 's64' });
    var b = status.querySelector('button'); if (b) b.focus();
  }
  var NET = { timeout: '30 秒たっても返事がありませんでした。通信を確かめて、もう一度お試しください。', offline: '通信できませんでした。電波やネットワークを確かめて、もう一度お試しください。', busy: '窓口が混み合っています。少し待ってから、もう一度お試しください。' };
  function start() {
    var s = session(); if (!s) { askLogin('ログインすると、利用ガイドを表示します。'); return; }
    showWait();
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var gaveUp = false;
    var stop = setTimeout(function () { gaveUp = true; if (ctl) ctl.abort(); }, 30000);
    var net = function (kind) { var e = new Error(NET[kind]); e.net = kind; return e; };
    fetch(GAS_URL, { method: 'POST', cache: 'no-store', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ action: 'getGuide', session: s }), signal: ctl ? ctl.signal : undefined })
      .catch(function () { throw net(gaveUp ? 'timeout' : 'offline'); })
      .then(function (res) { if (!res.ok) throw net(res.status >= 500 || res.status === 429 ? 'busy' : 'offline'); return res.json().catch(function () { throw net(gaveUp ? 'timeout' : 'busy'); }); })
      .then(function (out) {
        clearTimeout(stop);
        if (out && (out.code === 'BUSY' || out.error === 'BUSY')) { showRetry('利用ガイドを開けませんでした', NET.busy); return; }
        if (!out || out.error) { if (out && out.code === 'SESSION') { dropSession(s); askLogin(String(out.error)); } else say_('利用ガイドを読めませんでした。開き直してください。' + (out && out.error ? '（' + out.error + '）' : '')); return; }
        var g = out.result || {};
        // 窓口が v2.11 以前（本文を html で返す）: 画面だけ先に公開した形。画面と同じ言い方で止める
        if (!Array.isArray(g.sections) && typeof g.html === 'string') { say_('ログインの窓口（GAS）が、まだ新しい版になっていません（E-GAS-OLD）。管理担当へ連絡してください。'); return; }
        if (!Array.isArray(g.sections) || !g.sections.length) { say_('利用ガイドを読めませんでした。開き直してください。'); return; }
        endWait();
        status.classList.remove('is-loading', 'is-wait');
        render(g);
      })
      .catch(function (e) {
        clearTimeout(stop);
        if (e && e.net) { showRetry('利用ガイドを開けませんでした', e.message); return; }
        say_('利用ガイドを読めませんでした。開き直してください。');
      });
  }

  // ------------------------------------------------------------ 新しい版の自動の読み直し（v2.13・画面と同じ ver.js と比べる）。開いた直後でまだ何も押していない → 1回だけ読み直す／途中 → 知らせだけ
  var GUIDE_VER = '2.13', VER_KEY = 'tenchaku_ver_reloaded_guide', touched = false, openedAt = Date.now();
  ['pointerdown', 'keydown', 'wheel'].forEach(function (ev) { window.addEventListener(ev, function () { touched = true; }, { capture: true, passive: true }); });
  window.__tenchaVer = function (v) {
    v = String(v || ''); if (!/^[0-9]+(\.[0-9]+){1,3}$/.test(v)) return;
    if (v === GUIDE_VER) { try { sessionStorage.removeItem(VER_KEY); } catch (_) { } return; }
    var tried = ''; try { tried = sessionStorage.getItem(VER_KEY) || ''; } catch (_) { tried = v; }
    if (!touched && Date.now() - openedAt < 20000 && tried !== v) { try { sessionStorage.setItem(VER_KEY, v); } catch (_) { } location.reload(); return; }
    say('新しい版があります（v' + v + '）。読み直すと新しいガイドになります');
  };
  function verCheck() { var sc = document.createElement('script'); sc.src = 'ver.js?t=' + Date.now(); sc.async = true; sc.onload = sc.onerror = function () { sc.remove(); }; document.head.append(sc); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') verCheck(); });

  function boot() { verCheck(); start(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
