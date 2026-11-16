/* sky.js
   The window on the home page:
   - flips a coin for san diego or st. louis on every visit (?city=sd or ?city=stl forces one)
   - lights the skyline by the real local time in that city
   - the time chip opens a slider that previews any time of day
   - fog on the glass you can draw through; hold shift to fog it back up
   - the whole page turns to night after dark, in that city's time
*/
(function () {
  'use strict';

  var CITIES = {
    sd: { name: 'san diego', tz: 'America/Los_Angeles' },
    stl: { name: 'st. louis', tz: 'America/Chicago' }
  };

  var root = document.documentElement;
  var hero = document.querySelector('[data-sky]');
  if (!hero) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var forced = new URLSearchParams(location.search).get('city');
  var state = {
    city: CITIES[forced] ? forced : (Math.random() < 0.5 ? 'sd' : 'stl'),
    live: true,
    scrub: 720
  };

  /* ---------- small helpers ---------- */
  function rng(seed) {
    var a = seed;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hx(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(a, b, t) {
    var A = hx(a), B = hx(b);
    return '#' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0'); }).join('');
  }
  function rgb(h) { return hx(h).join(','); }
  function f1(n) { return n.toFixed(1); }

  /* ---------- skyline geometry (built once) ---------- */
  var R = rng(7);
  var G = {};
  (function build() {
    var s = '';
    for (var i = 0; i < 70; i++) {
      var x = R() * 1200, y = R() * 330, z = 1.2 + R() * 1.6;
      s += 'M' + f1(x) + ' ' + f1(y) + 'h' + f1(z) + 'v' + f1(z) + 'h-' + f1(z) + 'z';
    }
    G.stars = s;

    var stl = [[0,410,64],[64,392,58],[122,404,70],[192,356,48],[240,318,60],[300,366,66],[366,384,84],[450,420,60],[540,438,74],[614,430,62],[676,440,58],[734,434,70],[812,408,40],[852,368,52],[904,262,58],[962,334,62],[1024,386,70],[1094,404,56],[1150,392,50]];
    s = '';
    stl.forEach(function (b) { s += 'M' + b[0] + ' ' + b[1] + 'h' + b[2] + 'V470H' + b[0] + 'z'; });
    G.stlFar = s + 'M904 262L933 226L962 262z M252 318v-14h36v14z';

    var sd = [[30,402,46],[76,380,40],[116,352,44],[160,318,40],[204,298,32],[240,298,32],[282,262,46],[334,330,52],[392,346,40],[436,372,58],[500,396,50],[556,412,56],[612,424,40]];
    s = '';
    sd.forEach(function (b) { s += 'M' + b[0] + ' ' + b[1] + 'h' + b[2] + 'V452H' + b[0] + 'z'; });
    G.sdFar = s + 'M282 262L290 248L297 240L305 222L313 240L320 248L328 262z';

    // the gateway arch: a weighted catenary, outer edge then inner edge
    var k = 2.1, n = 48, c = Math.cosh(k) - 1, pts = [], u, f;
    for (i = 0; i <= n; i++) { u = -1 + 2 * i / n; f = 1 - (Math.cosh(k * u) - 1) / c; pts.push(f1(675 + 120 * u) + ' ' + f1(476 - 330 * f)); }
    for (i = n; i >= 0; i--) { u = -1 + 2 * i / n; f = 1 - (Math.cosh(k * u) - 1) / c; pts.push(f1(675 + 104 * u) + ' ' + f1(476 - 322 * f)); }
    G.arch = 'M' + pts.join('L') + 'z';

    s = '';
    for (var tx = 0; tx < 1210; tx += 18 + R() * 14) {
      var r = 6 + R() * 6;
      s += 'M' + f1(tx - r) + ' 474a' + f1(r) + ' ' + f1(r) + ' 0 1 0 ' + f1(2 * r) + ' 0a' + f1(r) + ' ' + f1(r) + ' 0 1 0 -' + f1(2 * r) + ' 0z';
    }
    G.trees = s;

    function refl(y0, y1) {
      var out = '';
      for (var j = 0; j < 46; j++) {
        var x = R() * 1180, y = y0 + R() * (y1 - y0), w = 8 + R() * 34;
        out += 'M' + f1(x) + ' ' + f1(y) + 'h' + f1(w) + 'v1.6h-' + f1(w) + 'z';
      }
      return out;
    }
    G.stlRefl = refl(498, 536);
    G.sdRefl = refl(462, 536);

    // coronado bridge piers, hung off the same curve as the deck
    s = '';
    for (k = 1; k < 24; k++) {
      var t = k / 24;
      var bx = (1 - t) * (1 - t) * 400 + 2 * (1 - t) * t * 800 + t * t * 1240;
      var by = (1 - t) * (1 - t) * 504 + 2 * (1 - t) * t * 330 + t * t * 428;
      s += 'M' + f1(bx) + ' ' + f1(by) + 'V540';
    }
    G.piers = s;

    function palm(x0, y0, x1, y1) {
      var p = 'M' + x0 + ' ' + y0 + 'Q' + ((x0 + x1) / 2 + 6) + ' ' + ((y0 + y1) / 2) + ' ' + x1 + ' ' + y1;
      [-160, -128, -96, -60, -24, 10].forEach(function (a) {
        var rr = a * Math.PI / 180;
        p += 'M' + x1 + ' ' + y1 + 'Q' + f1(x1 + Math.cos(rr) * 30) + ' ' + f1(y1 + Math.sin(rr) * 30 - 8) + ' ' + f1(x1 + Math.cos(rr) * 58) + ' ' + f1(y1 + Math.sin(rr) * 58 + 16);
      });
      return p;
    }
    G.palms = palm(92, 540, 132, 372) + palm(190, 540, 168, 404);

    s = '';
    [[700, 474, 1], [858, 490, 0.8], [1046, 480, 0.9]].forEach(function (b) {
      var q = b[2];
      s += 'M' + b[0] + ' ' + b[1] + 'v' + f1(-28 * q) + 'l' + f1(17 * q) + ' ' + f1(28 * q) + 'z';
      s += 'M' + f1(b[0] - 7 * q) + ' ' + (b[1] + 2) + 'h' + f1(28 * q) + 'l' + f1(-5 * q) + ' ' + f1(6 * q) + 'h' + f1(-18 * q) + 'z';
    });
    G.boats = s;
  })();

  var LIT = '<defs><pattern id="lit" width="12" height="16" patternUnits="userSpaceOnUse"><rect x="3" y="4" width="5" height="7" fill="#FFD9A0"/></pattern></defs>';

  function heroScene(city) {
    var s = LIT + '<path class="sk-stars" d="' + G.stars + '"/>';
    if (city === 'stl') {
      s += '<path class="sk-far" d="' + G.stlFar + '"/><path class="sk-lit" d="' + G.stlFar + '"/>' +
        '<path class="sk-far-line" d="M933 226V200"/>' +
        '<path class="sk-arch" d="' + G.arch + '"/>' +
        '<rect class="sk-near" x="0" y="470" width="1200" height="22"/><path class="sk-near" d="' + G.trees + '"/>' +
        '<rect class="sk-water" x="0" y="490" width="1200" height="50"/><path class="sk-refl" d="' + G.stlRefl + '"/>';
    } else {
      s += '<path class="sk-far" d="M760 452C860 420 1010 404 1200 416L1200 452Z"/>' +
        '<path class="sk-far" d="' + G.sdFar + '"/><path class="sk-lit" d="' + G.sdFar + '"/>' +
        '<rect class="sk-water" x="0" y="452" width="1200" height="88"/><path class="sk-refl" d="' + G.sdRefl + '"/>' +
        '<path class="sk-near" d="' + G.boats + '"/>' +
        '<path class="sk-near-line" style="stroke-width:5" d="' + G.piers + '"/>' +
        '<path class="sk-near-line" style="stroke-width:8" d="M400 504Q800 330 1240 428"/>' +
        '<path class="sk-near-line" style="stroke-width:6;stroke-linecap:round" d="' + G.palms + '"/>';
    }
    return s;
  }

  // the night city at the bottom of the page, always after dark
  function footScene(city) {
    var s = LIT;
    if (city === 'stl') {
      s += '<path fill="#1A2852" d="' + G.stlFar + '"/><path fill="url(#lit)" opacity=".35" d="' + G.stlFar + '"/><path fill="#2E3F70" d="' + G.arch + '"/>';
    } else {
      s += '<path fill="#141F42" d="M760 452C860 420 1010 404 1200 416L1200 452Z"/>' +
        '<path fill="#1A2852" d="' + G.sdFar + '"/><path fill="url(#lit)" opacity=".35" d="' + G.sdFar + '"/>' +
        '<rect fill="#0E1838" x="0" y="452" width="1200" height="88"/><path fill="#FFD69A" opacity=".5" d="' + G.sdRefl + '"/>' +
        '<path fill="none" stroke="#2E3F70" stroke-width="5" d="' + G.piers + '"/>' +
        '<path fill="none" stroke="#2E3F70" stroke-width="8" d="M400 504Q800 330 1240 428"/>';
    }
    return s;
  }

  var heroSvg = hero.querySelector('.sky-scene');
  var footSvg = document.querySelector('.foot-sky');

  function drawCity() {
    heroSvg.innerHTML = heroScene(state.city);
    if (footSvg) {
      footSvg.setAttribute('viewBox', state.city === 'sd' ? '0 230 1200 280' : '0 200 1200 270');
      footSvg.innerHTML = footScene(state.city);
    }
    document.querySelectorAll('[data-city-name]').forEach(function (el) { el.textContent = CITIES[state.city].name; });
    document.querySelectorAll('[data-pick-city]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-pick-city') === state.city));
    });
    hero.setAttribute('data-city', state.city);
  }

  /* ---------- time ---------- */
  function localMinutes(tz) {
    var h = 0, m = 0;
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false })
      .formatToParts(new Date()).forEach(function (p) {
        if (p.type === 'hour') h = Number(p.value) % 24;
        if (p.type === 'minute') m = Number(p.value);
      });
    return h * 60 + m;
  }
  function tzAbbr(tz) {
    var z = '';
    new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date()).forEach(function (p) { if (p.type === 'timeZoneName') z = p.value; });
    return z.toLowerCase();
  }
  function fmt(min) {
    var h = Math.floor(min / 60) % 24, m = min % 60, h12 = h % 12 || 12;
    return h12 + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'am' : 'pm');
  }
  var SKY = [[0,'#0B1020','#1C2540'],[5,'#121A33','#343A60'],[6,'#36406C','#D99A7C'],[7.5,'#6B98CF','#F0CDA6'],[10,'#4C88D4','#A8CCEA'],[15,'#4783D0','#B4D3EB'],[17.5,'#5A7DBD','#EDB98E'],[18.75,'#3A4576','#E5875E'],[19.75,'#1E2546','#57486C'],[21,'#0E142A','#222B4B'],[24,'#0B1020','#1C2540']];
  function skyAt(t) {
    for (var i = 0; i < SKY.length - 1; i++) {
      if (t >= SKY[i][0] && t <= SKY[i + 1][0]) {
        var u = (t - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]);
        return [mix(SKY[i][1], SKY[i + 1][1], u), mix(SKY[i][2], SKY[i + 1][2], u)];
      }
    }
    return [SKY[0][1], SKY[0][2]];
  }

  var timeEls = document.querySelectorAll('[data-time]');
  var tzEls = document.querySelectorAll('[data-tz]');
  var range = document.getElementById('sky-time');
  var nowBtn = document.querySelector('[data-now]');
  var sunIcon = document.querySelector('.chip-sun');
  var moonIcon = document.querySelector('.chip-moon');
  var light = 1;

  function paint() {
    var city = CITIES[state.city];
    var minutes = state.live ? localMinutes(city.tz) : state.scrub;
    var t = minutes / 60;
    var sky = skyAt(t);
    var alt = Math.sin(Math.PI * (t - 6) / 12);
    light = Math.max(0, Math.min(1, (alt + 0.12) / 0.45));
    var day = light > 0.45;
    var near = mix('#121726', '#55657F', light);
    var showSun = t > 5.6 && t < 18.4;
    var nt = t >= 18.4 ? (t - 18.4) / 11.2 : (t + 5.6) / 11.2;
    var st = hero.style;

    st.setProperty('--sky-top', sky[0]);
    st.setProperty('--sky-bottom', sky[1]);
    st.setProperty('--sk-far', mix('#232C45', '#8D9DB4', light));
    st.setProperty('--sk-near', near);
    st.setProperty('--sk-arch', mix('#7C869C', '#D3D9E0', light));
    st.setProperty('--sk-water', mix(sky[1], near, 0.5));
    st.setProperty('--sk-refl', mix('#FFFFFF', '#FFD69A', 1 - light));
    st.setProperty('--sk-refl-op', (0.2 + 0.55 * (1 - light)).toFixed(2));
    st.setProperty('--sk-lit-op', ((1 - light) * 0.95).toFixed(2));
    st.setProperty('--sk-star-op', (Math.max(0, Math.min(1, 1 - light * 2.5)) * 0.85).toFixed(2));
    st.setProperty('--sun-x', (8 + 84 * (t - 6) / 12).toFixed(2) + '%');
    st.setProperty('--sun-y', (74 - 60 * Math.max(0, alt)).toFixed(2) + '%');
    st.setProperty('--sun-color', mix('#FFD3A0', '#FFF7E6', light));
    st.setProperty('--moon-x', (8 + 84 * nt).toFixed(2) + '%');
    st.setProperty('--moon-y', (64 - 46 * Math.sin(Math.PI * nt)).toFixed(2) + '%');
    hero.classList.toggle('is-night-sky', !showSun);

    root.setAttribute('data-theme', day ? 'day' : 'night');

    var label = fmt(minutes);
    timeEls.forEach(function (el) { el.textContent = label; });
    tzEls.forEach(function (el) { el.textContent = tzAbbr(city.tz); });
    if (sunIcon) { sunIcon.hidden = !showSun; moonIcon.hidden = showSun; }
    if (range && document.activeElement !== range) range.value = minutes;
    if (range) range.setAttribute('aria-valuetext', label);
    if (nowBtn) nowBtn.hidden = state.live;
    var view = hero.querySelector('.sky-view');
    if (view) view.setAttribute('aria-label', 'The ' + city.name + ' skyline at ' + label + ', seen through a fogged window');

    fog.retint();
  }

  /* ---------- the fog ---------- */
  var fog = (function () {
    var canvas = hero.querySelector('.sky-fog');
    var ctx, fogC, mask, mctx, w = 0, h = 0, dpr = 1, last = null, painted = -1, raf = 0;

    function paintFog() {
      var f = fogC.getContext('2d');
      f.setTransform(1, 0, 0, 1, 0, 0); f.clearRect(0, 0, fogC.width, fogC.height);
      f.setTransform(dpr, 0, 0, dpr, 0, 0);
      var L = light; painted = L;
      var base = mix('#2B3554', '#E3E9F1', L), hi = mix('#3E4A70', '#FFFFFF', L), lo = mix('#1E2640', '#C4CEDC', L);
      f.fillStyle = 'rgba(' + rgb(base) + ',' + (0.8 + 0.06 * L).toFixed(2) + ')';
      f.fillRect(0, 0, w, h);
      var r = rng(11);
      for (var i = 0; i < 34; i++) {
        var x = r() * w, y = r() * h, rad = 80 + r() * 220;
        var col = r() < 0.5 ? rgb(hi) : rgb(lo), a = 0.05 + r() * 0.08;
        var g = f.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
        f.fillStyle = g; f.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    }
    function dab(x, y, r, clear, a) {
      mctx.globalCompositeOperation = clear ? 'source-over' : 'destination-out';
      var g = mctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(0.55, 'rgba(0,0,0,' + (a * 0.8) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = g; mctx.beginPath(); mctx.arc(x, y, r, 0, Math.PI * 2); mctx.fill();
    }
    function line(x0, y0, x1, y1, r, clear, a) {
      var d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / Math.max(2, r / 4)));
      for (var i = 0; i <= n; i++) { var t = i / n; dab(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, clear, a); }
    }
    // "hi", written in the fog with a fingertip, so people know they can draw
    function writeHi() {
      var s = Math.max(1.4, h / 260), ox = w * (w < 600 ? 0.58 : 0.64), oy = h * 0.16;
      [[[0, 0], [0, 64]], [[0, 40], [5, 32], [13, 28], [21, 31], [24, 40], [24, 64]], [[40, 30], [40, 64]]].forEach(function (st) {
        for (var i = 1; i < st.length; i++) line(ox + st[i - 1][0] * s, oy + st[i - 1][1] * s, ox + st[i][0] * s, oy + st[i][1] * s, 9 * s / 1.6, true, 0.95);
      });
      dab(ox + 40 * s, oy + 14 * s, 8 * s / 1.6, true, 0.95);
    }
    function render() {
      raf = 0;
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(fogC, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(render); }
    function init() {
      var r = canvas.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      if (ctx && Math.abs(r.width - w) < 2 && Math.abs(r.height - h) < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      var W = Math.round(w * dpr), H = Math.round(h * dpr);
      canvas.width = W; canvas.height = H;
      ctx = canvas.getContext('2d');
      fogC = document.createElement('canvas'); fogC.width = W; fogC.height = H;
      mask = document.createElement('canvas'); mask.width = W; mask.height = H;
      mctx = mask.getContext('2d'); mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintFog(); writeHi(); render();
    }
    function move(e) {
      if (!ctx) return;
      var r = canvas.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      if (y < 0 || y > h) { last = null; return; }
      var l = last || { x: x, y: y };
      if (e.shiftKey) line(l.x, l.y, x, y, 80, false, 0.2);
      else line(l.x, l.y, x, y, 44, true, 0.7);
      last = { x: x, y: y };
      schedule();
    }
    // press and drag to wipe the glass; hold shift while moving to fog it back up
    var drawing = false;
    function start(e) {
      if (e.button !== 0) return;
      if (e.target.closest('.nav, .time-panel, a, button, input, label')) return;
      drawing = true; last = null;
      if (e.pointerType === 'mouse') e.preventDefault(); // don't select the headline while drawing
      try { hero.setPointerCapture(e.pointerId); } catch (err) {}
      hero.classList.add('is-drawing');
      move(e);
    }
    function stop(e) {
      drawing = false; last = null;
      hero.classList.remove('is-drawing');
      try { hero.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    hero.addEventListener('pointerdown', start);
    hero.addEventListener('pointermove', function (e) {
      if (drawing || e.shiftKey) move(e);
      else last = null;
    });
    hero.addEventListener('pointerup', stop);
    hero.addEventListener('pointercancel', stop);
    hero.addEventListener('pointerleave', function () { if (!drawing) last = null; });
    // the fog slowly creeps back
    setInterval(function () {
      if (!mctx || document.hidden) return;
      mctx.globalCompositeOperation = 'destination-out';
      mctx.fillStyle = 'rgba(0,0,0,0.008)';
      mctx.fillRect(0, 0, w, h);
      schedule();
    }, 120);
    if ('ResizeObserver' in window) new ResizeObserver(init).observe(canvas);
    else window.addEventListener('resize', init);
    return {
      init: init,
      retint: function () { if (fogC && Math.abs(light - painted) > 0.1) { paintFog(); schedule(); } }
    };
  })();

  /* ---------- the time chip and its panel ---------- */
  var chip = document.querySelector('.time-chip');
  var panel = document.getElementById('time-panel');
  var wrap = chip && chip.parentElement;
  var closeTimer = 0;
  function setOpen(open) {
    if (!panel) return;
    panel.hidden = !open;
    chip.setAttribute('aria-expanded', String(open));
  }
  if (chip && panel) {
    // with a mouse, hovering already opened it, so a click keeps it open;
    // keyboard and touch toggle it
    chip.addEventListener('click', function (e) {
      if (e.pointerType === 'mouse') setOpen(true);
      else setOpen(panel.hidden);
    });
    // hover opens it too, the way the old "hover to change the sky" did
    wrap.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(closeTimer); setOpen(true);
    });
    wrap.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'mouse') return;
      closeTimer = setTimeout(function () { if (!wrap.contains(document.activeElement)) setOpen(false); }, 280);
    });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { setOpen(false); chip.focus(); }
    });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) setOpen(false); });
  }
  if (range) range.addEventListener('input', function () { state.live = false; state.scrub = Number(range.value); paint(); });
  if (nowBtn) nowBtn.addEventListener('click', function () { state.live = true; paint(); });
  document.querySelectorAll('[data-pick-city]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.city = b.getAttribute('data-pick-city');
      drawCity(); paint();
    });
  });

  drawCity();
  paint();
  requestAnimationFrame(fog.init);
  setInterval(function () { if (state.live && !document.hidden) paint(); }, 15000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && state.live) paint(); });
  if (reduceMotion) root.classList.add('reduce-motion');
})();