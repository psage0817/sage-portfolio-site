/* sayhi.js: the contact section's paint window.
   "let's say hi" is written onto the canvas in my handwriting when it scrolls into view,
   then anyone can draw on it: pencil, brush, spray, eraser, undo and clear, with a palette. */
(function () {
  'use strict';
  var paint = document.querySelector('[data-paint]');
  if (!paint) return;


  var paper = paint.querySelector('.paper'), cv = paper.querySelector('canvas'), ctx = cv.getContext('2d');
  var hint = paint.querySelector('[data-hint]'), xy = paint.querySelector('[data-xy]');
  var W = 0, H = 0, dpr = 1, drawn = false, pen = '#1F3A93', tool = 'pencil', undo = [];
  var HINTS = { pencil: 'pencil: drag to draw', brush: 'brush: drag to paint', spray: 'spray: hold and move', eraser: 'eraser: drag to rub out' };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- the handwriting ---------- */
  var helloP = 0, helloRaf = 0, helloDone = false;
  function hello(p) {
    var fs = Math.min(W * (W < 600 ? 0.2 : 0.15), H * 0.36), x = W * 0.07, y = H * 0.5;
    ctx.save();
    ctx.font = '300 ' + fs + 'px "Le Jardin Du Bonheur", "Segoe Print", cursive';
    var tw = ctx.measureText('let’s say hi').width;
    ctx.beginPath(); ctx.rect(0, 0, x + tw * Math.min(1, p / 0.8) + 8, H); ctx.clip();
    ctx.fillStyle = '#1F3A93'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('let’s say hi', x, y);
    ctx.restore();
    // a loose underline, drawn after the words
    var u = Math.max(0, Math.min(1, (p - 0.78) / 0.22));
    if (u > 0) {
      ctx.save(); ctx.strokeStyle = '#1F3A93'; ctx.lineWidth = Math.max(2, fs * 0.035); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      var x0 = x + fs * 0.05, y0 = y + fs * 0.28, len = tw * 0.92;
      for (var k = 0; k <= 40 * u; k++) {
        var t = k / 40, px = x0 + len * t, py = y0 + Math.sin(t * Math.PI * 3) * fs * 0.035 - t * fs * 0.06;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke(); ctx.restore();
    }
  }
  function blank() { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore(); }
  function write(animate) {
    cancelAnimationFrame(helloRaf);
    if (!animate || reduce) { blank(); hello(1); helloDone = true; return; }
    var t0 = 0, dur = 1700;
    (function step(now) {
      if (!t0) t0 = now;
      var p = Math.min(1, (now - t0) / dur);
      blank(); hello(1 - Math.pow(1 - p, 2));
      if (p < 1) helloRaf = requestAnimationFrame(step); else helloDone = true;
    })(performance.now());
  }

  /* ---------- size: keep what's drawn when the window changes size ---------- */
  function size() {
    var r = paper.getBoundingClientRect(), nw = Math.round(r.width), nh = Math.round(r.height);
    if (!nw || !nh || (nw === W && nh === H)) return;
    var keep = null;
    if (drawn && W) { keep = document.createElement('canvas'); keep.width = cv.width; keep.height = cv.height; keep.getContext('2d').drawImage(cv, 0, 0); }
    W = nw; H = nh; dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    blank();
    if (keep) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(keep, 0, 0, cv.width, cv.height); ctx.restore(); }
    else hello(helloDone ? 1 : 0);
  }

  /* ---------- drawing ---------- */
  var down = false, last = null;
  function at(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function snapshot() {
    var c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c.getContext('2d').drawImage(cv, 0, 0);
    undo.push(c); if (undo.length > 10) undo.shift();
  }
  function spray(p) {
    ctx.fillStyle = pen;
    for (var i = 0; i < 26; i++) {
      var a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 15;
      ctx.fillRect(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.4, 1.4);
    }
  }
  function seg(a, b) {
    if (tool === 'spray') { spray(b); return; }
    ctx.save();
    ctx.lineCap = tool === 'eraser' ? 'square' : 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = tool === 'eraser' ? '#fff' : pen;
    ctx.lineWidth = tool === 'pencil' ? 2.6 : tool === 'brush' ? 11 : 24;
    if (tool === 'brush') ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  }
  var sprayT = 0;
  cv.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    if (!helloDone) write(false);
    snapshot(); down = true; drawn = true; last = at(e);
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    seg(last, { x: last.x + 0.01, y: last.y });
    if (tool === 'spray') { clearInterval(sprayT); sprayT = setInterval(function () { if (down && last) spray(last); }, 40); }
    e.preventDefault();
  });
  cv.addEventListener('pointermove', function (e) {
    var p = at(e);
    xy.textContent = Math.max(0, Math.round(p.x)) + ', ' + Math.max(0, Math.round(p.y)) + 'px';
    if (!down) return;
    seg(last, p); last = p;
  });
  function up() { down = false; last = null; clearInterval(sprayT); }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', function () { xy.textContent = ''; });

  /* ---------- tools and colours ---------- */
  paint.querySelectorAll('[data-tool]').forEach(function (b) {
    b.addEventListener('click', function () {
      tool = b.getAttribute('data-tool');
      paint.querySelectorAll('[data-tool]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      hint.textContent = HINTS[tool];
    });
  });
  paint.querySelector('[data-act="undo"]').addEventListener('click', function () {
    var c = undo.pop(); if (!c) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(c, 0, 0, cv.width, cv.height); ctx.restore();
  });
  paint.querySelector('[data-act="clear"]').addEventListener('click', function () { snapshot(); drawn = false; write(true); });
  paint.querySelectorAll('.sw').forEach(function (b) {
    b.style.backgroundColor = b.getAttribute('data-c');
    b.addEventListener('click', function () {
      pen = b.getAttribute('data-c'); paint.style.setProperty('--pen', pen);
      paint.querySelectorAll('.sw').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      if (tool === 'eraser') paint.querySelector('[data-tool="pencil"]').click();
    });
  });

  /* ---------- start: size the paper, then write "let's say hi" when it comes into view ---------- */
  function start() {
    size();
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(paper); else addEventListener('resize', size);
    if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); if (!drawn) write(true); } }, { threshold: 0.45 });
      io.observe(paper);
    } else write(false);
  }
  var f = document.fonts && document.fonts.load ? document.fonts.load('300 80px "Le Jardin Du Bonheur"') : Promise.resolve();
  Promise.race([f, new Promise(function (ok) { setTimeout(ok, 2500); })]).then(start, start);
})();
