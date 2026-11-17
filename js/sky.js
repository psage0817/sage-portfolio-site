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

  // how far the san diego coast is raised in the window, in drawing units (the window is 540 tall):
  // a little on wide screens, more on tall phone screens, so the headline always sits on sand
  var COAST_LIFT_WIDE = 95;

  // how thick the fog on the glass is, from 0 (clear) to 1 (solid)
  /* Photos behind the glass. Put them in img/sky/ with these names and they replace the
     illustration for that city; if a photo is missing, that city keeps the illustration.
     - day: required for the photo to be used. It's colour-graded through the day, so one photo
       becomes golden near sunset and moonlit at night.
     - sunset: optional. If it's there, the day photo crossfades into it from about 5 to 6pm.
     - night: optional. If it's there, the window crossfades to it after dusk.
     - focus: which part of the photo to keep in view when the window crops it, from 0 to 1
       (0.5, 0.6 keeps the centre, slightly below the middle).
     Use photos at least 2400px wide so the view through the beads stays sharp. */
  var PHOTOS = {
    sd:  { day: 'img/sky/sd-day.jpg',  sunset: 'img/sky/sd-sunset.jpg',  night: 'img/sky/sd-night.jpg',  focus: [0.5, 0.6] },
    stl: { day: 'img/sky/stl-day.jpg', sunset: 'img/sky/stl-sunset.jpg', night: 'img/sky/stl-night.jpg', focus: [0.5, 0.6] }
  };

  // how much haze softens the san diego coast's colours in daylight (0 = none, 1 = all sky)
  var COAST_HAZE = 0.28;

  // how thick the frost on the glass is, from 0 (clear) to 1 (solid):
  // FOG_DAY from 7am to 5:30pm, FOG_NIGHT the rest of the time, fading between them over half an hour
  var FOG_DAY = 0.5;
  var FOG_NIGHT = 0.8;
  var FOG = FOG_NIGHT;
  var COAST_LIFT_TALL = 165;

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

    /* ---- san diego: the coast at torrey pines, looking toward la jolla ----
       drawn with smooth, slightly wandering lines so nothing reads as a flat block */
    function wander(x0, x1, step, base, a1, a2, a3) {
      var pts = [], q1 = R() * 6.28, q2 = R() * 6.28, q3 = R() * 6.28;
      for (var x = x0; x <= x1 + 0.01; x += step) {
        pts.push([x, base(x) + a1 * Math.sin(x / 53 + q1) + a2 * Math.sin(x / 19 + q2) + a3 * Math.sin(x / 7.3 + q3)]);
      }
      return pts;
    }
    // a smooth curve through points (catmull-rom turned into beziers)
    function curve(pts, move) {
      var d = (move === false ? 'L' : 'M') + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
      for (var j = 0; j < pts.length - 1; j++) {
        var p0 = pts[j - 1] || pts[j], p1 = pts[j], p2 = pts[j + 1], p3 = pts[j + 2] || p2;
        d += 'C' + f1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
          f1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]);
      }
      return d;
    }
    function ell(cx, cy, rx, ry) { return 'M' + f1(cx - rx) + ' ' + f1(cy) + 'a' + f1(rx) + ' ' + f1(ry) + ' 0 1 0 ' + f1(2 * rx) + ' 0a' + f1(rx) + ' ' + f1(ry) + ' 0 1 0 ' + f1(-2 * rx) + ' 0z'; }

    // la jolla in two layers: the far hills fade into the sea haze, the nearer point is a little clearer
    G.headFar = curve(wander(0, 500, 10, function (x) { return 318 - 42 * Math.pow(Math.max(0, 1 - x / 500), 0.55); }, 3, 1.3, 0.4)) + 'L500 318L0 318Z';
    G.headNear = curve(wander(0, 330, 8, function (x) { return 318 - 16 * Math.pow(Math.max(0, 1 - x / 330), 0.8); }, 1.6, 0.8, 0.4)) + 'L330 318L0 318Z';
    s = '';
    for (i = 0; i < 34; i++) { var hx0 = 6 + R() * 300, hy0 = 300 + R() * 15 + (hx0 / 300) * 4; s += 'M' + f1(hx0) + ' ' + f1(hy0) + 'h1.6v1.6h-1.6z'; }
    G.headlandLights = s;

    // waves: lots of small strokes, finer and denser toward the horizon
    var wThin = '', wMid = '', wWide = '';
    for (i = 0; i < 190; i++) {
      var t = Math.pow(R(), 1.7);
      var wy = 322 + t * 120, len = 3 + t * 30 * (0.5 + R()), wx = R() * 1200, bow = -0.4 - t * 1.2;
      var seg = 'M' + f1(wx) + ' ' + f1(wy) + 'q' + f1(len / 2) + ' ' + f1(bow) + ' ' + f1(len) + ' 0';
      if (t < 0.3) wThin += seg; else if (t < 0.65) wMid += seg; else wWide += seg;
    }
    G.wavesThin = wThin; G.wavesMid = wMid; G.wavesWide = wWide;

    // scripps pier, in perspective: wider and closer on the left, narrowing toward the lab at the end
    var legs = '', legRefl = '';
    for (k = 0; k <= 30; k++) {
      var pt = k / 30, lx = 300 + 312 * pt, ly = 394 - 14 * pt, ll = 22 - 9 * pt;
      legs += 'M' + f1(lx) + ' ' + f1(ly) + 'V' + f1(ly + ll);
      legRefl += 'M' + f1(lx) + ' ' + f1(ly + ll + 1) + 'v' + f1(6 - 3 * pt);
    }
    G.pierLegs = legs; G.pierRefl = legRefl;
    G.pierDeck = 'M298 391.6L612 378.4L612 380.2L298 394.4Z';
    G.pierRail = 'M298 389L612 376.6';
    G.pierHouse = 'M600 368.5h34v10.5h-34z M603 364.5h26l2 4h-30z';
    s = '';
    for (k = 1; k < 9; k++) { var lpx = 300 + k * 34, lpy = 392 - k * 34 * (14 / 312) - 5; s += 'M' + f1(lpx) + ' ' + f1(lpy) + 'h1.8v1.8h-1.8z'; }
    G.pierLights = s + 'M605 371h3v3h-3z M615 371h3v3h-3z M625 371h3v3h-3z';

    // the shoreline: wavering foam, a wash of surf, wet sand, then dry sand
    var foamA = wander(-10, 1210, 8, function () { return 446; }, 2.2, 1.1, 0.5);
    var foamB = wander(-10, 1210, 8, function () { return 439; }, 1.6, 0.9, 0.4);
    var foamC = wander(-10, 1210, 8, function () { return 452; }, 1.4, 0.7, 0.3);
    G.foamA = curve(foamA); G.foamB = curve(foamB); G.foamC = curve(foamC);
    G.wash = curve(foamA) + curve(foamC.slice().reverse(), false) + 'Z';
    var wetTop = wander(-10, 1210, 10, function () { return 453; }, 1.2, 0.6, 0.3);
    var wetBot = wander(-10, 1210, 10, function () { return 468; }, 2.4, 1.2, 0.5);
    G.wet = curve(wetTop) + curve(wetBot.slice().reverse(), false) + 'Z';
    G.sheen = curve(wander(-10, 1210, 12, function () { return 459; }, 1.6, 0.8, 0.3));
    G.sand = curve(wetBot) + 'L1210 545L-10 545Z';

    // the torrey pines bluffs: a wandering top edge, soft gullies, scrub along the top
    var top = [[684,474],[704,452],[722,424],[740,384],[758,352],[776,328],[798,300],[822,284],[858,274],[905,264],[950,258],[1000,252],[1040,248],[1090,244],[1140,240],[1200,236]];
    function topY(x) {
      for (var j = 0; j < top.length - 1; j++) {
        if (x >= top[j][0] && x <= top[j + 1][0]) { var u = (x - top[j][0]) / (top[j + 1][0] - top[j][0]); return top[j][1] + (top[j + 1][1] - top[j][1]) * u; }
      }
      return 236;
    }
    var edge = wander(684, 1210, 6, topY, 1.2, 1.4, 0.8);
    var base = wander(684, 1210, 12, function () { return 471; }, 1, 0.8, 0.4).reverse();
    G.bluff = curve(edge) + curve(base, false) + 'Z';
    var gul = '', ridge = '';
    for (var gx = 752; gx < 1196; gx += 16 + R() * 34) {
      var gt = topY(gx) + 5 + R() * (R() < 0.3 ? 80 : 16), bot = 470;
      var w0 = 1.2 + R() * 2.5, w1 = 5 + R() * 15, lean = (R() - 0.5) * 16;
      var L = [], Rr = [];
      for (var st = 0; st <= 6; st++) {
        var f = st / 6, yy = gt + (bot - gt) * f, ww = w0 + (w1 - w0) * Math.pow(f, 1.4), jx = (R() - 0.5) * 3;
        L.push([gx + lean * f - ww + jx, yy]); Rr.push([gx + lean * f + ww * 0.7 + jx, yy]);
      }
      gul += curve(L) + curve(Rr.slice().reverse(), false) + 'Z';
      if (R() < 0.6) ridge += curve(Rr.map(function (q) { return [q[0] + 1.6, q[1]]; }));
    }
    G.gullies = gul; G.ridges = ridge;
    var scrub = '', scrubDark = '';
    edge.forEach(function (q, n) {
      if (q[0] < 790) return;
      for (var c2 = 0; c2 < 2; c2++) {
        if (R() < 0.25) continue;
        scrub += ell(q[0] + (R() - 0.5) * 6, q[1] - 0.6 - R() * 1.2, 1.8 + R() * 2.6, 0.9 + R() * 1.3);
      }
      if (R() < 0.5) scrubDark += ell(q[0] + (R() - 0.5) * 6, q[1] + 0.6, 1.4 + R() * 2, 0.7 + R() * 0.9);
    });
    G.scrub = scrub; G.scrubDark = scrubDark;

    // torrey pines: tapering trunks, a side branch, and crowns built from many small clumps
    function limb(x0, y0, cx, cy, x1, y1, w0, w1) {
      var Lp = [], Rp = [];
      for (var st = 0; st <= 10; st++) {
        var u = st / 10, iu = 1 - u;
        var px = iu * iu * x0 + 2 * iu * u * cx + u * u * x1, py = iu * iu * y0 + 2 * iu * u * cy + u * u * y1;
        var dx = 2 * iu * (cx - x0) + 2 * u * (x1 - cx), dy = 2 * iu * (cy - y0) + 2 * u * (y1 - cy), dl = Math.hypot(dx, dy) || 1;
        var w = (w0 + (w1 - w0) * u) / 2;
        Lp.push([px - dy / dl * w, py + dx / dl * w]); Rp.push([px + dy / dl * w, py - dx / dl * w]);
      }
      return curve(Lp) + curve(Rp.reverse(), false) + 'Z';
    }
    function pine(x, y, lean, sc) {
      var tx = x + lean, ty = y - 72 * sc;
      var wood = limb(x, y, x + lean * 0.15, y - 40 * sc, tx, ty, 7 * sc, 2.2 * sc) +
        limb(x + lean * 0.3, y - 36 * sc, x + lean * 0.3 + 20 * sc, y - 46 * sc, x + lean * 0.3 + 40 * sc, y - 54 * sc, 2.6 * sc, 1 * sc) +
        limb(tx - 2, ty + 6 * sc, tx - 18 * sc, ty + 2 * sc, tx - 32 * sc, ty - 2 * sc, 2 * sc, 0.8 * sc);
      var dark = '', lite = '';
      [[-32,-2,30,10],[-4,-12,32,12],[26,-2,26,10],[42,16,18,8],[-14,8,24,8]].forEach(function (c) {
        var ccx = tx + c[0] * sc, ccy = ty + c[1] * sc;
        for (var b = 0; b < 34; b++) {
          var ox = (R() - 0.5) * c[2] * 1.8 * sc, oy = (R() - 0.5) * c[3] * 1.5 * sc;
          // flatter toward the edges of each clump, like wind-combed needles
          var edgeF = 1 - Math.min(1, Math.abs(ox) / (c[2] * 0.9 * sc));
          dark += ell(ccx + ox, ccy + oy, (2 + R() * 3) * sc, (1.1 + R() * 1.4 + edgeF) * sc);
          if (oy < -1 && R() < 0.3) lite += ell(ccx + ox - 1.2 * sc, ccy + oy - 1.2 * sc, (1.4 + R() * 2) * sc, (0.7 + R() * 0.9) * sc);
        }
      });
      var side = x + lean * 0.3 + 40 * sc, sideY = y - 56 * sc;
      for (var b2 = 0; b2 < 26; b2++) {
        var sx = (R() - 0.5) * 32 * sc, sy = (R() - 0.5) * 8 * sc;
        dark += ell(side + sx, sideY + sy, (1.8 + R() * 2.8) * sc, (1 + R() * 1.6) * sc);
        if (sy < -1 && R() < 0.3) lite += ell(side + sx - 1, sideY + sy - 1.2, (1.2 + R() * 1.8) * sc, (0.6 + R() * 0.8) * sc);
      }
      return { wood: wood, dark: dark, lite: lite };
    }
    var p1 = pine(985, topY(985) + 1, -18, 1.12), p2 = pine(1118, topY(1118) + 1, 14, 0.92);
    G.pineWood = p1.wood + p2.wood;
    G.pineDark = p1.dark + p2.dark;
    G.pineLite = p1.lite + p2.lite;

    // a line of brown pelicans gliding along the bluffs
    s = '';
    [[520, 226, 1], [544, 231, 0.9], [570, 234, 0.85]].forEach(function (b) {
      var q = b[2];
      s += 'M' + b[0] + ' ' + b[1] + 'q' + f1(5 * q) + ' ' + f1(-4.2 * q) + ' ' + f1(10 * q) + ' ' + f1(-0.6 * q) + 'q' + f1(4.5 * q) + ' ' + f1(-3.2 * q) + ' ' + f1(9.5 * q) + ' ' + f1(0.6 * q);
    });
    G.pelicans = s;
  })();

  var LIT = '<defs><pattern id="lit" width="12" height="16" patternUnits="userSpaceOnUse"><rect x="3" y="4" width="5" height="7" fill="#FFD9A0"/></pattern></defs>';

  // gradients and textures for the coast; their colours come from the time of day (see paint)
  var COAST_DEFS = '<defs>' +
    '<linearGradient id="oceanG" gradientUnits="userSpaceOnUse" x1="0" y1="318" x2="0" y2="470">' +
      '<stop offset="0" style="stop-color:var(--sk-ocean-far)"/><stop offset=".4" style="stop-color:var(--sk-ocean)"/><stop offset="1" style="stop-color:var(--sk-ocean-near)"/></linearGradient>' +
    '<linearGradient id="hazeG" gradientUnits="userSpaceOnUse" x1="0" y1="262" x2="0" y2="338">' +
      '<stop offset="0" style="stop-color:var(--sky-bottom);stop-opacity:0"/><stop offset=".72" style="stop-color:var(--sky-bottom);stop-opacity:.6"/><stop offset="1" style="stop-color:var(--sky-bottom);stop-opacity:0"/></linearGradient>' +
    '<linearGradient id="sandG" gradientUnits="userSpaceOnUse" x1="0" y1="460" x2="0" y2="545">' +
      '<stop offset="0" style="stop-color:var(--sk-sand)"/><stop offset="1" style="stop-color:var(--sk-sand-deep)"/></linearGradient>' +
    '<linearGradient id="cliffG" gradientUnits="userSpaceOnUse" x1="0" y1="236" x2="0" y2="474">' +
      '<stop offset="0" style="stop-color:var(--sk-cliff-top)"/><stop offset="1" style="stop-color:var(--sk-cliff)"/></linearGradient>' +
    // fine sand grain
    '<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/>' +
      '<feColorMatrix values="0 0 0 0 .35  0 0 0 0 .27  0 0 0 0 .16  .55 0 0 0 -.2"/><feComposite in2="SourceAlpha" operator="in"/></filter>' +
    // weathered sandstone: streaks that run down the cliff face
    '<filter id="streaks" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".07 .007" numOctaves="3" seed="8"/>' +
      '<feColorMatrix values="0 0 0 0 .3  0 0 0 0 .2  0 0 0 0 .12  .85 0 0 0 -.3"/><feComposite in2="SourceAlpha" operator="in"/></filter>' +
    '<filter id="soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation=".8"/></filter>' +
    '</defs>';

  function coastLift() {
    var r = hero.getBoundingClientRect();
    return r.width && r.width / r.height < 1 ? COAST_LIFT_TALL : COAST_LIFT_WIDE;
  }

  function heroScene(city) {
    var COAST_LIFT = coastLift();
    var s = LIT + '<path class="sk-stars" d="' + G.stars + '"/>';
    if (city === 'stl') {
      s += '<path class="sk-far" d="' + G.stlFar + '"/><path class="sk-lit" d="' + G.stlFar + '"/>' +
        '<path class="sk-far-line" d="M933 226V200"/>' +
        '<path class="sk-arch" d="' + G.arch + '"/>' +
        '<rect class="sk-near" x="0" y="470" width="1200" height="22"/><path class="sk-near" d="' + G.trees + '"/>' +
        '<rect class="sk-water" x="0" y="490" width="1200" height="50"/><path class="sk-refl" d="' + G.stlRefl + '"/>';
    } else {
      // the coast is lifted so the headline sits over open sand; see COAST_LIFT_WIDE / _TALL at the top
      s += COAST_DEFS +
        '<rect class="sk-sand-deep" x="0" y="' + (540 - COAST_LIFT - 12) + '" width="1200" height="' + (COAST_LIFT + 12) + '"/>' +
        '<rect fill="#000" filter="url(#grain)" x="0" y="' + (540 - COAST_LIFT - 12) + '" width="1200" height="' + (COAST_LIFT + 12) + '"/>' +
        '<g transform="translate(0 ' + (-COAST_LIFT) + ')">' +
        '<rect fill="url(#oceanG)" x="0" y="318" width="1200" height="152"/>' +
        '<path class="sk-wave" style="stroke-width:.7;opacity:calc(var(--sk-refl-op) * 1.1)" d="' + G.wavesThin + '"/>' +
        '<path class="sk-wave" style="stroke-width:1.1;opacity:calc(var(--sk-refl-op) * .85)" d="' + G.wavesMid + '"/>' +
        '<path class="sk-wave" style="stroke-width:1.6;opacity:calc(var(--sk-refl-op) * .6)" d="' + G.wavesWide + '"/>' +
        '<path class="sk-far" style="opacity:.75" d="' + G.headFar + '"/>' +
        '<rect fill="url(#hazeG)" x="0" y="262" width="1200" height="76"/>' +
        '<path class="sk-far" d="' + G.headNear + '"/><path class="sk-dots" d="' + G.headlandLights + '"/>' +
        '<path class="sk-wave" style="stroke-width:1;opacity:calc(var(--sk-refl-op) * .5)" d="' + G.pierRefl + '"/>' +
        '<path class="sk-near-line" style="stroke-width:1.1" d="' + G.pierLegs + '"/>' +
        '<path class="sk-near" d="' + G.pierDeck + '"/><path class="sk-near-line" style="stroke-width:.8" d="' + G.pierRail + '"/>' +
        '<path class="sk-near" d="' + G.pierHouse + '"/><path class="sk-dots" d="' + G.pierLights + '"/>' +
        '<path class="sk-foam" style="stroke-width:1;opacity:calc(var(--sk-foam-op) * .6)" d="' + G.foamB + '"/>' +
        '<path class="sk-wash" d="' + G.wash + '"/>' +
        '<path class="sk-foam" style="stroke-width:1.6" d="' + G.foamA + '"/>' +
        '<path class="sk-foam" style="stroke-width:.9;opacity:calc(var(--sk-foam-op) * .7)" d="' + G.foamC + '"/>' +
        '<path class="sk-wet" d="' + G.wet + '"/>' +
        '<path class="sk-sheen" d="' + G.sheen + '"/>' +
        '<path fill="url(#sandG)" d="' + G.sand + '"/><path fill="#000" filter="url(#grain)" d="' + G.sand + '"/>' +
        '<path fill="url(#cliffG)" d="' + G.bluff + '"/><path fill="#000" filter="url(#streaks)" d="' + G.bluff + '"/>' +
        '<path class="sk-gully" filter="url(#soft)" d="' + G.gullies + '"/>' +
        '<path class="sk-ridge" d="' + G.ridges + '"/>' +
        '<path class="sk-scrub" d="' + G.scrub + '"/><path class="sk-scrub-dark" d="' + G.scrubDark + '"/>' +
        '<path class="sk-pine" d="' + G.pineWood + '"/>' +
        '<path class="sk-pine" d="' + G.pineDark + '"/><path class="sk-pine-lite" d="' + G.pineLite + '"/>' +
        '<path class="sk-birds" d="' + G.pelicans + '"/>' +
        '</g>';
    }
    return s;
  }

  // the night city at the bottom of the page, always after dark
  function footScene(city) {
    var s = LIT;
    if (city === 'stl') {
      s += '<path fill="#1A2852" d="' + G.stlFar + '"/><path fill="url(#lit)" opacity=".35" d="' + G.stlFar + '"/><path fill="#2E3F70" d="' + G.arch + '"/>';
    } else {
      s += '<rect fill="#0E1838" x="0" y="318" width="1200" height="222"/>' +
        '<path fill="none" stroke="#FFD69A" stroke-width=".8" opacity=".35" d="' + G.wavesThin + G.wavesMid + '"/>' +
        '<path fill="#131D40" d="' + G.headFar + '"/><path fill="#16224A" d="' + G.headNear + '"/><path fill="#FFD9A0" opacity=".85" d="' + G.headlandLights + '"/>' +
        '<path fill="none" stroke="#24335F" stroke-width="1.1" d="' + G.pierLegs + '"/><path fill="#24335F" d="' + G.pierDeck + G.pierHouse + '"/><path fill="#FFD9A0" d="' + G.pierLights + '"/>' +
        '<path fill="none" stroke="#3A4C80" stroke-width="1.4" opacity=".6" d="' + G.foamA + G.foamC + '"/>' +
        '<path fill="#141E40" d="' + G.wet + '"/><path fill="#18234A" d="' + G.sand + '"/>' +
        '<path fill="#1C2A57" d="' + G.bluff + '"/><path fill="#162248" d="' + G.gullies + '"/><path fill="#141D40" d="' + G.scrub + '"/>' +
        '<path fill="#0F1733" d="' + G.pineWood + G.pineDark + '"/>';
    }
    return s;
  }

  var heroSvg = hero.querySelector('.sky-scene');
  var footSvg = document.querySelector('.foot-sky');

  function drawCity() {
    heroSvg.innerHTML = heroScene(state.city);
    if (footSvg) {
      footSvg.setAttribute('viewBox', state.city === 'sd' ? '0 190 1200 320' : '0 200 1200 270');
      footSvg.innerHTML = footScene(state.city);
    }
    document.querySelectorAll('[data-city-name]').forEach(function (el) { el.textContent = CITIES[state.city].name; });
    document.querySelectorAll('[data-pick-city]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-pick-city') === state.city));
    });
    hero.setAttribute('data-city', state.city);
    if (photoCity !== state.city) { photoCity = state.city; applyPhotos(); }
  }

  /* ---------- photos ---------- */
  var photoCity = null, plainPhoto = false, photoLoads = {};
  function loadImg(src) {
    if (!photoLoads[src]) {
      photoLoads[src] = new Promise(function (resolve) {
        var im = new Image();
        im.onload = function () {
          var done = function () { resolve(im); };
          if (im.decode) im.decode().then(done, done); else done();
        };
        im.onerror = function () { resolve(null); };
        im.src = src;
      });
    }
    return photoLoads[src];
  }
  function applyPhotos() {
    var want = state.city, cfg = PHOTOS[want];
    if (!cfg) return;
    Promise.all([loadImg(cfg.day), loadImg(cfg.night), loadImg(cfg.sunset)]).then(function (got) {
      if (state.city !== want || typeof fog === 'undefined') return;   // the city changed while loading
      var day = got[0], night = got[1], sunset = got[2];
      photoHas = { night: !!night, sunset: !!sunset };
      var p = day ? { day: day, night: night, sunset: sunset, fx: cfg.focus[0], fy: cfg.focus[1] } : null;
      fog.setPhotos(p);
      // without the condensation layer, show the photo plainly behind the flat fog instead of the drawing
      plainPhoto = !!day && !fog.hasGlass();
      var view = hero.querySelector('.sky-view');
      view.style.backgroundImage = plainPhoto ? 'url("' + cfg.day + '")' : '';
      view.style.backgroundSize = plainPhoto ? 'cover' : '';
      view.style.backgroundPosition = plainPhoto ? (cfg.focus[0] * 100) + '% ' + (cfg.focus[1] * 100) + '%' : '';
      if (!plainPhoto) view.style.filter = '';
      [heroSvg, hero.querySelector('.sky-sun'), hero.querySelector('.sky-moon')].forEach(function (el) {
        if (el) el.style.visibility = plainPhoto ? 'hidden' : '';
      });
      paint();
    });
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
  // how a daytime photo is graded through the day: [hour, colour to multiply by, saturation]
  var GRADE = [[0,'#2B375C',.5],[4.5,'#34406A',.55],[5.75,'#8C84A6',.72],[6.5,'#E9B596',.9],[7.5,'#FAE5CF',.98],[9,'#FFFFFF',1],[16,'#FFFFFF',1],[17.25,'#FFE5C2',1.06],[18.25,'#EBB59A',1.02],[19,'#9A7F9C',.84],[19.75,'#4D557E',.66],[21,'#2B375C',.5],[24,'#2B375C',.5]];
  function gradeAt(t) {
    for (var i = 0; i < GRADE.length - 1; i++) {
      if (t >= GRADE[i][0] && t <= GRADE[i + 1][0]) {
        var u = (t - GRADE[i][0]) / (GRADE[i + 1][0] - GRADE[i][0]);
        return [mix(GRADE[i][1], GRADE[i + 1][1], u), GRADE[i][2] + (GRADE[i + 1][2] - GRADE[i][2]) * u];
      }
    }
    return [GRADE[0][1], GRADE[0][2]];
  }
  // how far into the night photo we are: fully night 19:45 to 5:15, crossfading around dusk and dawn
  function nightness(t) {
    var a = Math.min(1, Math.max(0, (t - 18.6) / 1.15)), b = Math.min(1, Math.max(0, (6.4 - t) / 1.15));
    return Math.max(a, b);
  }
  function rgb01(h) { return hx(h).map(function (v) { return v / 255; }); }

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

  var photoGrade = null, photoFallbackFilter = '', photoHas = { night: false, sunset: false };
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
    // full daytime frost from 7:00 to 17:30, night frost from 18:00 to 6:30
    var dayness = Math.min(1, Math.max(0, (t - 6.5) / 0.5)) * Math.min(1, Math.max(0, (18 - t) / 0.5));
    var gr = gradeAt(t);
    // which photos are blended, and how each is graded, through the evening:
    // day -> (5 to 6pm) sunset -> (6:35 to 7:45pm) night; without a sunset photo, day -> night as before
    var nightGrade = rgb01(mix('#C9D2EA', '#FFFFFF', 0.5));
    var fade = function (a, b) { var k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
    if (photoHas.sunset && t >= 16.9 && t < 18.6) {
      photoGrade = { pair: ['day', 'sunset'], a: rgb01(gr[0]), sa: gr[1], b: [1, 1, 1], sb: 1, n: fade(16.9, 17.95) };
    } else if (photoHas.sunset && t >= 18.6 && t < 21) {
      // the sunset dims and cools as it fades into the night photo (or into darkness, without one)
      var dim = fade(18.6, 20.2);
      photoGrade = { pair: ['sunset', photoHas.night ? 'night' : 'sunset'], a: rgb01(mix('#FFFFFF', '#59618C', dim)), sa: 1 - 0.35 * dim,
                     b: nightGrade, sb: 0.95, n: photoHas.night ? fade(18.6, 19.75) : 0 };
    } else {
      photoGrade = { pair: ['day', photoHas.night ? 'night' : 'day'], a: rgb01(gr[0]), sa: gr[1], b: nightGrade, sb: 0.95, n: photoHas.night ? nightness(t) : 0 };
    }
    photoFallbackFilter = 'brightness(' + (0.35 + 0.65 * light).toFixed(2) + ') saturate(' + gr[1].toFixed(2) + ')';
    FOG = FOG_NIGHT + (FOG_DAY - FOG_NIGHT) * dayness;
    var sky = skyAt(t);
    // san diego's sky is a little softer, like a day with some coastal haze
    if (state.city === 'sd') sky = [mix(sky[0], '#A9B9C9', 0.28), mix(sky[1], '#D3DAE0', 0.25)];
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
    // the san diego coast in one soft, hazy light: muted colours that all lean toward the sky,
    // so they belong together (raise COAST_HAZE for more haze, lower it for crisper colour)
    function coast(nightHex, dayHex) { var c = mix(nightHex, dayHex, light); return mix(c, sky[1], COAST_HAZE * light); }
    st.setProperty('--sk-ocean', coast('#1B2A44', '#47657C'));
    st.setProperty('--sk-ocean-far', mix(sky[1], '#7D93A6', 0.45));
    st.setProperty('--sk-ocean-near', coast('#17233A', '#3A566B'));
    st.setProperty('--sk-cliff', coast('#3B3650', '#BBA58C'));
    st.setProperty('--sk-cliff-top', coast('#4A4560', '#D3C1A8'));
    st.setProperty('--sk-gully', coast('#2A263D', '#9C8670'));
    st.setProperty('--sk-pine', coast('#121722', '#3F4A4E'));
    st.setProperty('--sk-pine-lite', coast('#1B2331', '#56625F'));
    st.setProperty('--sk-scrub', coast('#161C24', '#727565'));
    st.setProperty('--sk-scrub-dark', coast('#10151C', '#585C52'));
    st.setProperty('--sk-sand', coast('#2E3045', '#DCD1BF'));
    st.setProperty('--sk-sand-deep', coast('#262838', '#CBBEA9'));
    st.setProperty('--sk-wet', coast('#262A40', '#BDB2A2'));
    st.setProperty('--sk-foam-op', (0.3 + 0.4 * light).toFixed(2));
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
    if (plainPhoto) hero.querySelector('.sky-view').style.filter = photoFallbackFilter;

    var label = fmt(minutes);
    timeEls.forEach(function (el) { el.textContent = label; });
    tzEls.forEach(function (el) { el.textContent = tzAbbr(city.tz); });
    if (sunIcon) { sunIcon.toggleAttribute('hidden', !showSun); moonIcon.toggleAttribute('hidden', showSun); }   // svg icons need the attribute, not the property
    if (range && document.activeElement !== range) range.value = minutes;
    if (range) range.setAttribute('aria-valuetext', label);
    if (nowBtn) nowBtn.hidden = state.live;
    var view = hero.querySelector('.sky-view');
    var scene = state.city === 'sd' ? 'The coast at Torrey Pines, looking toward La Jolla,' : 'The St. Louis riverfront';
    if (view) view.setAttribute('aria-label', scene + ' at ' + label + ', seen through a fogged window');

    fog.retint();
  }

  /* ---------- the fog ---------- */
  var fog = (function () {
    var canvas = hero.querySelector('.sky-fog');
    var ctx, fogC, mask, mctx, w = 0, h = 0, dpr = 1, ms = 1, last = null, painted = -1, raf = 0;

    // condensation drawn with WebGL (js/glass.js). Without WebGL, or for people who prefer
    // reduced motion, the flat fog below is used instead and everything else works the same.
    var glass = null;
    if (!reduceMotion && window.SPGlass) {
      glass = window.SPGlass.create({
        hero: hero,
        // a sliding bead clears a trail behind it, just like a finger would
        clearAt: function (x0, y0, r, x1, y1) { if (mctx) { line(x0, y0, x1, y1, r, true, 0.55); schedule(); } },
        onFail: function () { useFlatFog(); },
        isClear: function (x, y) {
          if (!mctx) return false;
          var d = mctx.getImageData(Math.round(x * ms), Math.round(y * ms), 1, 1).data;
          return d[3] > 30;
        }
      });
      if (glass) {
        canvas.parentNode.insertBefore(glass.canvas, canvas);
        hero.classList.add('has-glass');
        // the drawing surface stays on top to catch strokes, but shows nothing while the glass is drawing
        canvas.style.opacity = '0';
      }
    }
    console.info(glass ? 'window: condensation (WebGL) is on'
      : 'window: using the flat fog, because ' + (reduceMotion ? 'this device asks for reduced motion' : !window.SPGlass ? 'js/glass.js is not loaded' : 'WebGL is not available here'));
    function useFlatFog() {
      if (!glass) return;
      glass.canvas.remove(); glass = null; hero.classList.remove('has-glass'); canvas.style.opacity = '';
      if (fogC) paintFog();
      schedule();
    }
    function glassLight() {
      if (glass) glass.lightChanged(light, FOG + 0.06 * light, mix('#2B3554', '#E3E9F1', light), mix('#FFD3A0', '#FFF7E6', light), photoGrade);
    }

    function paintFog() {
      var f = fogC.getContext('2d');
      f.setTransform(1, 0, 0, 1, 0, 0); f.clearRect(0, 0, fogC.width, fogC.height);
      f.setTransform(dpr, 0, 0, dpr, 0, 0);
      var L = light; painted = L;
      var base = mix('#2B3554', '#E3E9F1', L), hi = mix('#3E4A70', '#FFFFFF', L), lo = mix('#1E2640', '#C4CEDC', L);
      f.fillStyle = 'rgba(' + rgb(base) + ',' + (FOG + 0.06 * L).toFixed(2) + ')';
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
      var s = Math.max(1.4, h / 260), ox = w * (w < 600 ? 0.64 : 0.64), oy = h * 0.16;
      [[[0, 0], [0, 64]], [[0, 40], [5, 32], [13, 28], [21, 31], [24, 40], [24, 64]], [[40, 30], [40, 64]]].forEach(function (st) {
        for (var i = 1; i < st.length; i++) line(ox + st[i - 1][0] * s, oy + st[i - 1][1] * s, ox + st[i][0] * s, oy + st[i][1] * s, 9 * s / 1.6, true, 0.95);
      });
      dab(ox + 40 * s, oy + 14 * s, 8 * s / 1.6, true, 0.95);
    }
    function render() {
      raf = 0;
      if (!ctx) return;
      if (glass) { glass.maskChanged(mask); return; }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(fogC, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
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
      // the map of where the glass has been wiped; soft-edged, so it doesn't need full resolution
      ms = glass ? 0.5 : dpr;
      mask = document.createElement('canvas'); mask.width = Math.round(w * ms); mask.height = Math.round(h * ms);
      mctx = mask.getContext('2d', { willReadFrequently: true }); mctx.setTransform(ms, 0, 0, ms, 0, 0);
      paintFog(); writeHi();
      if (glass) { glass.resize(w, h); glassLight(); }
      render();
    }
    function move(e) {
      if (!ctx) return;
      var r = canvas.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      if (y < 0 || y > h) { last = null; return; }
      var l = last || { x: x, y: y };
      if (e.shiftKey) line(l.x, l.y, x, y, 80, false, 0.2);
      else {
        line(l.x, l.y, x, y, 44, true, 0.7);
        drawn += Math.hypot(x - l.x, y - l.y);
        if (drawn > 140) peelNote();
        var lp = strokePts[strokePts.length - 1];
        if (!lp || Math.hypot(x - lp.x, y - lp.y) > 18) strokePts.push({ x: x, y: y });
      }
      last = { x: x, y: y };
      schedule();
    }
    // the sticky note: once they've drawn a real stroke, it has done its job
    var note = document.querySelector('[data-note]');
    var drawn = 0, peeled = false;
    function peelNote() {
      if (peeled || !note) return;
      peeled = true;
      note.classList.add('is-lift');
      setTimeout(function () { note.classList.add('is-fall'); }, 260);
      setTimeout(function () { note.classList.add('is-gone'); }, 2400);
    }

    // drips: the water a stroke pushes aside gathers along its lower edge and, after a moment, runs down
    var strokePts = [];
    function scheduleDrips(pts) {
      if (pts.length < 2) return;
      var length = 0;
      for (var i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      var n = Math.max(1, Math.min(4, Math.round(length / 170)));
      for (var k = 0; k < n; k++) {
        var p = pts[Math.floor((k + 0.2 + Math.random() * 0.6) / n * (pts.length - 1))];
        var x = p.x + (Math.random() - 0.5) * 14, y = p.y + 34 + Math.random() * 8;   // just below the wiped band
        setTimeout(function (x, y) { return function () { dripFrom(x, y); }; }(x, y), 1100 + k * 450 + Math.random() * 1500);
      }
    }
    function dripFrom(x, y) {
      if (y > h - 20) return;
      if (glass) { glass.drip(x, y); return; }
      // flat fog: no drop to draw, but the drip still cuts a clear trail as it runs
      var run = 70 + Math.random() * 150, dur = 1500 + Math.random() * 1500, wob = (Math.random() - 0.5) * 8, t0 = performance.now(), prevY = y;
      (function step(now) {
        var f = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - f, 2.2);
        var cy = y + run * e, cx = x + wob * Math.sin(e * 3);
        line(cx, prevY, cx, cy, 6 - 2 * f, true, 0.6); prevY = cy; schedule();
        if (f < 1) requestAnimationFrame(step);
      })(t0);
    }

    // press and drag to wipe the glass; hold shift while moving to fog it back up
    var drawing = false;
    function start(e) {
      if (e.button !== 0) return;
      if (e.target.closest('.nav, .time-panel, a, button, input, label')) return;
      drawing = true; last = null; strokePts = [];
      if (e.pointerType === 'mouse') e.preventDefault(); // don't select the headline while drawing
      try { hero.setPointerCapture(e.pointerId); } catch (err) {}
      hero.classList.add('is-drawing');
      move(e);
    }
    function stop(e) {
      if (drawing) scheduleDrips(strokePts);
      strokePts = [];
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
    // the fog slowly creeps back: clear for about the first 10 seconds, fogged again by about 30
    setInterval(function () {
      if (!mctx || document.hidden) return;
      mctx.globalCompositeOperation = 'destination-out';
      mctx.fillStyle = 'rgba(0,0,0,0.018)';
      mctx.fillRect(0, 0, w, h);
      schedule();
    }, 500);
    if ('ResizeObserver' in window) new ResizeObserver(init).observe(canvas);
    else window.addEventListener('resize', init);
    return {
      init: init,
      // returns true if the condensation is now showing the photos
      setPhotos: function (p) { return glass ? glass.setPhotos(p) : false; },
      hasGlass: function () { return !!glass; },
      retint: function () {
        glassLight();
        if (fogC && Math.abs(light - painted) > 0.1) { paintFog(); schedule(); }
      }
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
  var lastLift = coastLift();
  window.addEventListener('resize', function () {
    var l = coastLift();
    if (l !== lastLift) { lastLift = l; drawCity(); paint(); }
  });
  requestAnimationFrame(fog.init);
  setInterval(function () { if (state.live && !document.hidden) paint(); }, 15000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && state.live) paint(); });
  if (reduceMotion) root.classList.add('reduce-motion');
})();