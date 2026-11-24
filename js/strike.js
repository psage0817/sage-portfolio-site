/* strike.js: three issues of Strike Magazine St. Louis as stop-motion mockups.
   - the top: the three covers dropped on a table, one photo at a time
   - each issue below gets its own little player: the printed issue on the table, turning or
     flipping through its spreads at a set frame rate. No CSS transitions anywhere, on purpose:
     every frame is a new "shot", so nothing glides.
   - one set of settings drives every player (the preview's panel changes them all at once) */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RATIO = 880 / 1139;
  var ISSUES = {
    12: { pages: 86, name: 'reverie', ch: [[1, 'cover'], [2, 'front matter'], [12, 'nostalgia'], [28, 'narcissus'], [48, 'sonder'], [72, 'reverie'], [86, 'back cover']] },
    11: { pages: 104, name: 'the classics', ch: [[1, 'cover'], [2, 'front matter'], [10, 'the canon'], [26, 'you’re so classic'], [44, 'haze code'], [48, 'meet the rockwells'], [66, 'the puppeteer'], [82, 'merde, merde, merde!'], [100, 'back matter'], [104, 'back cover']] },
    10: { pages: 92, name: 'sapologie', ch: [[1, 'cover'], [2, 'front matter'], [10, 'black tie'], [26, 'bury me with the lo on'], [40, 'i’m too punk for you?!'], [58, 'to the salon'], [72, 'let the children techno'], [88, 'back matter'], [92, 'back cover']] }
  };
  var TABLE = '#E6E1D6';
  var CHCOL = { nostalgia: '#9DB6D2', narcissus: '#C59E99', sonder: '#2A2624', reverie: '#6D7850' };
  function src(iss, n) { return 'img/strike/' + iss + '/p' + String(n).padStart(2, '0') + '.webp'; }

  // how the issues move. style: 'flip' (cut to the next spread), 'turn' (each page turns in four
  // held positions) or 'pile' (pages dropped on the table). fps: frames a second. wobble: 'none',
  // 'subtle' or 'handheld'. cam: 'top' or 'angled'. table: 'one' colour, or 'chapter' (issue 12 only)
  var set = { style: 'flip', fps: 8, wobble: 'none', cam: 'top', table: 'one' };
  var WOB = { none: [0, 0], subtle: [2, .35], handheld: [6, 1.1] };
  var players = [];

  /* ---------- one issue on the table ---------- */
  function Player(root) {
    var iss = Number(root.getAttribute('data-issue')), I = ISSUES[iss], PAGES = I.pages;
    var stage = root.querySelector('.mag-stage');
    // data-pages limits a player to some page ranges ("10-25,42-47"): for issues where only some
    // stories are mine, the player shows just those spreads. Otherwise it's the whole issue.
    var only = root.getAttribute('data-pages'), SP = [];
    if (only) only.split(',').forEach(function (rg) { var ab = rg.split('-').map(Number); for (var a = ab[0]; a < ab[1]; a += 2) SP.push([a, a + 1]); });
    else { SP.push([0, 1]); for (var a = 2; a < PAGES; a += 2) SP.push([a, a + 1]); SP.push([PAGES, 0]); }
    function chapterOf(i) { var p = SP[i][1] || SP[i][0], c = I.ch[0]; I.ch.forEach(function (x) { if (p >= x[0]) c = x; }); return c; }
    function spreadOf(page) { for (var i = 0; i < SP.length; i++) if (SP[i][0] === page || SP[i][1] === page) return i; return 0; }

    stage.innerHTML = '<div class="mag"><div class="mag-shadow"></div><span class="edge l"></span><span class="edge r"></span>' +
      '<div class="pg l"></div><div class="pg r"></div><div class="leaf" hidden><div class="face front"></div><div class="face back"></div></div></div>' +
      '<div class="pile" hidden></div><div class="mag-flicker"></div>';
    var mag = stage.querySelector('.mag'), L = mag.querySelector('.pg.l'), R = mag.querySelector('.pg.r'), shadow = mag.querySelector('.mag-shadow');
    var edgeL = mag.querySelector('.edge.l'), edgeR = mag.querySelector('.edge.r'), leaf = mag.querySelector('.leaf');
    var front = leaf.querySelector('.front'), back = leaf.querySelector('.back'), flick = stage.querySelector('.mag-flicker'), pile = stage.querySelector('.pile');
    var pw = 300;

    function size() {
      var r = stage.getBoundingClientRect(), fit = r.width < 600 ? 0.94 : 0.86;
      var ph = Math.min(r.height * 0.84, (r.width * fit) / (2 * RATIO)); pw = ph * RATIO;
      mag.style.setProperty('--pw', pw + 'px'); mag.style.setProperty('--ph', ph + 'px');
      pile.style.setProperty('--pw', pw * 0.78 + 'px'); pile.style.setProperty('--ph', ph * 0.78 + 'px');
    }
    function img(el, n) { if (n) { el.style.backgroundImage = 'url(' + src(iss, n) + ')'; el.classList.remove('empty'); } else { el.style.backgroundImage = ''; el.classList.add('empty'); } }
    function offset(i) { return SP[i][0] === 0 ? -0.5 : SP[i][1] === 0 ? 0.5 : 0; }
    var preloaded = {};
    function preload(i) { for (var k = i; k < Math.min(SP.length, i + 4); k++) SP[k].forEach(function (n) { if (n && !preloaded[n]) { preloaded[n] = 1; new Image().src = src(iss, n); } }); }

    var jit = [0, 0, 0], shotN = 0;
    function shoot(f) {
      if (shotN++ % 2 === 0) {
        var w = reduce ? [0, 0] : WOB[set.wobble];
        jit = [(Math.random() * 2 - 1) * w[0], (Math.random() * 2 - 1) * w[0] * .6, (Math.random() * 2 - 1) * w[1]];
      }
      var c = chapterOf(f.ch), col = set.table === 'chapter' && CHCOL[c[1]] ? CHCOL[c[1]] : TABLE;
      stage.style.setProperty('--table', col);
      flick.style.opacity = reduce || set.wobble === 'none' ? 0 : (Math.random() * .035).toFixed(3);
      var cam = set.cam === 'angled' ? 'rotateX(34deg) rotateZ(-9deg) scale(.86) ' : '';
      if (f.pile) { pileShot(f); mag.hidden = true; pile.hidden = false; pile.style.transform = cam + 'translate(' + jit[0] + 'px,' + jit[1] + 'px)'; return; }
      mag.hidden = false; pile.hidden = true;
      img(L, f.l); img(R, f.r);
      mag.style.transform = cam + 'translate(' + (f.off * pw + jit[0]) + 'px,' + jit[1] + 'px) rotate(' + jit[2] + 'deg)';
      var vis0 = f.l || f.turn ? 0 : pw, vis1 = f.r || f.turn ? 2 * pw : pw;
      shadow.style.left = vis0 + 'px'; shadow.style.width = (vis1 - vis0) + 'px';
      edgeL.hidden = !(f.l || f.turn); edgeR.hidden = !(f.r || f.turn);
      if (f.turn) {
        leaf.hidden = false; img(front, f.turn.front); img(back, f.turn.back);
        leaf.style.transform = 'rotateY(' + f.turn.a + 'deg)';
        var k = Math.abs(f.turn.a) / 180;
        front.style.setProperty('--shade', (k * .35).toFixed(2)); back.style.setProperty('--shade', ((1 - k) * .3).toFixed(2));
        R.style.setProperty('--cast', k < .5 ? (Math.sin(k * Math.PI) * .5).toFixed(2) : 0);
        L.style.setProperty('--cast', k >= .5 ? (Math.sin(k * Math.PI) * .5).toFixed(2) : 0);
      } else { leaf.hidden = true; R.style.setProperty('--cast', 0); L.style.setProperty('--cast', 0); }
    }

    var landed = [];
    function pileShot(f) {
      pile.innerHTML = '';
      landed.concat(f.hold ? [f.hold] : []).slice(-10).forEach(function (p) {
        var el = document.createElement('div'); el.className = 'pg' + (p.lift ? ' lifted' : '');
        el.style.backgroundImage = 'url(' + src(iss, p.n) + ')';
        el.style.transform = 'translate(-50%,-50%) translate(' + (p.x + (p.lift ? -14 : 0)) + 'px,' + (p.y + (p.lift ? -22 : 0)) + 'px) rotate(' + (p.r + (p.lift ? 2.5 : 0)) + 'deg) scale(' + (p.lift ? 1.07 : 1) + ')';
        pile.appendChild(el);
      });
    }
    function spot(n) { var r = stage.getBoundingClientRect(); return { n: n, x: (Math.random() * 2 - 1) * r.width * .2, y: (Math.random() * 2 - 1) * r.height * .1, r: (Math.random() * 2 - 1) * 9 }; }
    function pileUpTo(i) { var c = chapterOf(i); landed = []; for (var k = 0; k <= i; k++) if (chapterOf(k) === c) SP[k].forEach(function (n) { if (n) landed.push(spot(n)); }); }

    var idx = 0, q = [], playing = false, timer = 0, visible = false, wanted = !reduce;
    function still(i) { return { ch: i, l: SP[i][0], r: SP[i][1], off: offset(i) }; }
    function hold(i, n) { for (var k = 0; k < n; k++) q.push(still(i)); }
    function build() {
      var i = idx, last = i === SP.length - 1;
      if (set.style === 'pile') {
        if (last) { for (var k = 0; k < set.fps; k++) q.push({ ch: i, pile: 1 }); q.push({ go: 0, ch: 0, pile: 1, clear: 1 }); return; }
        var j = i + 1;
        if (chapterOf(j) !== chapterOf(i)) { q.push({ ch: j, pile: 1, clear: 1 }); q.push({ ch: j, pile: 1 }); }
        SP[j].forEach(function (n) { if (!n) return; var p = spot(n); q.push({ ch: j, pile: 1, hold: Object.assign({ lift: 1 }, p) }); q.push({ ch: j, pile: 1, land: p }); q.push({ ch: j, pile: 1 }); });
        q[q.length - 1].go = j;
        return;
      }
      if (last) { hold(i, set.fps * 2); q.push(Object.assign(still(0), { go: 0 })); return; }
      hold(i, set.style === 'flip' ? Math.max(2, Math.round(set.fps * .45)) : Math.max(3, Math.round(set.fps * .7)));
      var j2 = i + 1;
      if (set.style === 'turn') {
        [-26, -72, -116, -158].forEach(function (a, k) {
          var t = (k + 1) / 5;
          q.push({ ch: i, l: SP[i][0], r: SP[j2][1], off: offset(i) + (offset(j2) - offset(i)) * t, turn: { a: a, front: SP[i][1], back: SP[j2][0] } });
        });
      }
      q.push(Object.assign(still(j2), { go: j2 }));
    }
    function frame() {
      if (!q.length) build();
      var f = q.shift();
      if (f.pile) { if (f.clear) landed = []; if (f.land) landed.push(f.land); }
      shoot(f);
      if (f.go !== undefined) { idx = f.go; if (set.style === 'pile' && f.go === 0) landed = []; label(); preload(idx + 1); }
    }
    function loop() { frame(); timer = setTimeout(loop, 1000 / set.fps); }
    function run() {
      var on = wanted && visible && !document.hidden;
      if (on === playing) return;
      playing = on; clearTimeout(timer); playBtn.setAttribute('aria-pressed', String(on));
      if (on) timer = setTimeout(loop, 1000 / set.fps);
    }
    function go(i) {
      idx = Math.max(0, Math.min(SP.length - 1, i)); q = [];
      if (set.style === 'pile') { pileUpTo(idx); shoot({ ch: idx, pile: 1 }); } else shoot(still(idx));
      label(); preload(idx);
    }

    var playBtn = root.querySelector('[data-mplay]'), seek = root.querySelector('[data-mseek]');
    var cur = root.querySelector('[data-mcur]'), chap = root.querySelector('[data-mch]');
    var chips = Array.prototype.slice.call(root.querySelectorAll('[data-jump]'));
    seek.max = SP.length - 1;
    function label() {
      var c = chapterOf(idx), p = SP[idx].filter(Boolean);
      seek.value = idx; seek.style.setProperty('--p', (idx / (SP.length - 1) * 100) + '%');
      cur.textContent = 'p. ' + p.join('–'); chap.textContent = c[1];
      chips.forEach(function (b) { b.setAttribute('aria-current', String(Number(b.getAttribute('data-jump')) === c[0])); });
    }
    function stop() { playing = false; clearTimeout(timer); playBtn.setAttribute('aria-pressed', 'false'); }
    playBtn.addEventListener('click', function () { wanted = !playing; if (wanted) run(); else stop(); });
    root.querySelector('[data-mprev]').addEventListener('click', function () { go(idx - 1); });
    root.querySelector('[data-mnext]').addEventListener('click', function () { go(idx + 1); });
    seek.addEventListener('input', function () { go(Number(seek.value)); });
    stage.addEventListener('click', function () { playBtn.click(); });
    chips.forEach(function (b) { b.addEventListener('click', function () { go(spreadOf(Number(b.getAttribute('data-jump')))); }); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; run(); }, { threshold: 0.35 }).observe(stage);
    document.addEventListener('visibilitychange', run);

    this.refresh = function () { q = []; root.classList.toggle('angled', set.cam === 'angled'); size(); go(idx); if (playing) { clearTimeout(timer); timer = setTimeout(loop, 1000 / set.fps); } };
    this.step = frame;
    this.pause = function () { wanted = false; stop(); };
    this.go = go;
    addEventListener('resize', function () { size(); go(idx); });
    size(); go(0);
  }

  document.querySelectorAll('[data-issue]').forEach(function (el) { players.push(new Player(el)); });

  /* ---------- the top: the three covers dropped on the table ---------- */
  var heap = document.querySelector('[data-covers]');
  if (heap) {
    var COVERS = [[10, -9, -0.62, 0.06], [11, 7, 0, -0.05], [12, -3, 0.6, 0.03]]; // issue, rotation, x (in cover widths), y (in heights)
    var els = COVERS.map(function (c) {
      var b = document.createElement('a'); b.className = 'cover'; b.href = '#issue-' + c[0];
      b.setAttribute('aria-label', 'Issue ' + c[0] + ': ' + ISSUES[c[0]].name);
      b.innerHTML = '<span class="cover-img" style="background-image:url(' + src(c[0], 1) + ')"></span><span class="cover-tag">issue ' + c[0] + ' · ' + ISSUES[c[0]].name + '</span>';
      heap.appendChild(b); return b;
    });
    var cw = 200;
    function place(k, state) {
      var c = COVERS[k], e = els[k];
      e.hidden = state === 'out';
      var lift = state === 'held', x = c[2] * cw + (lift ? -16 : 0), y = c[3] * cw / RATIO + (lift ? -26 : 0);
      e.classList.toggle('lifted', lift);
      e.style.transform = 'translate(-50%,-50%) translate(' + x + 'px,' + y + 'px) rotate(' + (c[1] + (lift ? 3 : 0)) + 'deg) scale(' + (lift ? 1.06 : 1) + ')';
    }
    function sizeHeap() {
      var r = heap.getBoundingClientRect();
      cw = Math.min(r.height * 0.76 * RATIO, r.width / 2.45);
      heap.style.setProperty('--cw', cw + 'px'); heap.style.setProperty('--ch', cw / RATIO + 'px');
    }
    // one cover at a time: held over the table for a frame, then down, then the next
    var seq = [];
    COVERS.forEach(function (c, k) { seq.push([k, 'held'], [k, 'down'], [k, 'down']); });
    function drop() {
      els.forEach(function (e, k) { place(k, 'out'); });
      var f = 0;
      (function next() {
        if (f >= seq.length) return;
        var s = seq[f++]; place(s[0], s[1]);
        setTimeout(next, 1000 / set.fps);
      })();
    }
    sizeHeap();
    if (reduce) els.forEach(function (e, k) { place(k, 'down'); }); else { els.forEach(function (e, k) { place(k, 'out'); }); setTimeout(drop, 350); }
    addEventListener('resize', function () { sizeHeap(); els.forEach(function (e, k) { if (!e.hidden) place(k, 'down'); }); });
    var again = document.querySelector('[data-redrop]');
    if (again) again.addEventListener('click', drop);
  }

  // for trying other settings from the browser console, e.g. SPMag.set('style', 'turn')
  window.SPMag = { set: function (k, v) { set[k] = v; players.forEach(function (p) { p.refresh(); }); }, get: function () { return set; } };
})();
