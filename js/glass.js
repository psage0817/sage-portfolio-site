/* glass.js
   Condensation on the window, drawn with WebGL.

   - thousands of beads of water, each a tiny lens: the scene behind shows through it
     magnified and upside down, with a dark rim and a highlight from the sky
   - fog between the beads, softened and mottled
   - wiping clears beads and fog; beads hang on along the edges of the stroke
   - every so often a bead gathers, grows, and slides a short way down, clearing a trail
   - highlights follow the time of day: bright at noon, warm at sunset, dim at night

   sky.js decides whether to use this (it falls back to the flat fog if WebGL isn't
   available or the visitor prefers reduced motion) and keeps doing the drawing,
   shift-to-fog, regrowth and the sticky note. This file only draws the glass. */
(function () {
  'use strict';

  var VERT =
    'attribute vec2 aPos;' +
    'varying vec2 vUv;' +
    'void main(){ vUv = vec2(aPos.x * .5 + .5, .5 - aPos.y * .5); gl_Position = vec4(aPos, 0., 1.); }';

  var FRAG = [
    'precision PRECISION float;',
    'uniform sampler2D uScene, uBlur, uBeads, uMask, uNoise, uTrail;',
    'uniform vec2 uRes;',
    'uniform float uFog, uLight, uAspect;',
    'uniform vec3 uFogCol, uHi;',
    'uniform vec4 uDrops[NDROPS];',
    'uniform vec2 uLightPos;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec2 uv = vUv;',
    '  vec2 px = uv * uRes;',
    '  float raw = texture2D(uMask, uv).a;',
    // a wipe that's mostly clear counts as fully clear
    '  float clear = smoothstep(.02, .55, raw);',
    '  vec4 b = texture2D(uBeads, uv);',
    '  vec2 n = b.rg * 2. - 1.;',
    '  float h = b.b;',
    '  float cov = b.a;',
    // beads hang on along the edges of a wipe
    '  float edge = smoothstep(.04, .2, raw) * (1. - smoothstep(.26, .46, raw));',
    '  float keep = clamp(1. - clear + edge * .95, 0., 1.);',
    '  cov *= keep;',
    '  h *= mix(.45, 1., keep);',
    // beads that are alive: creeping, growing, running. w holds stretch (whole part) and opacity (fraction)
    '  for (int i = 0; i < NDROPS; i++) {',
    '    vec4 d = uDrops[i];',
    '    if (d.w > 0.) {',
    '      float st = floor(d.w / 2.) / 8.;',
    '      float da = d.w - floor(d.w / 2.) * 2.;',
    '      vec2 q = (px - d.xy) / vec2(d.z, d.z * 1.06);',
    // a moving bead is drawn out above, like water running down glass
    '      if (q.y < 0.) q.y /= 1. + st * 1.7;',
    '      float r2 = dot(q, q);',
    '      if (r2 < 1.) {',
    '        float a = (1. - smoothstep(.78, 1., r2)) * da;',
    '        n = mix(n, q, a); h = mix(h, pow(1. - r2, .62), a); cov = max(cov, a);',
    '      }',
    '    }',
    '  }',
    // the glass: sharp scene where it's clear, soft milky fog elsewhere
    '  float mott = texture2D(uNoise, uv * vec2(uAspect, 1.) * 1.3).r;',
    '  float mott2 = texture2D(uNoise, uv * vec2(uAspect, 1.) * 5.1 + .37).r;',
    '  float trail = texture2D(uTrail, uv).a;',
    '  float fogAmt = clamp(uFog * (1. - clear) * (1. - trail * .6) * (.94 + .14 * mott + .06 * mott2), 0., 1.);',
    '  vec3 sharp = texture2D(uScene, uv).rgb;',
    '  vec3 soft = texture2D(uBlur, uv).rgb;',
    '  float grain = texture2D(uNoise, uv * vec2(uAspect, 1.) * 38.).r - .5;',
    '  vec3 fogged = mix(soft, uFogCol, .8 + .08 * mott) * (1. + grain * .025);',
    '  vec3 glass = mix(sharp, fogged, fogAmt);',
    // each bead is a little lens: the view through it is magnified and flipped
    '  vec2 refr = -n * (10. + 26. * h) / uRes;',
    '  vec3 through = mix(mix(texture2D(uScene, uv + refr).rgb, texture2D(uBlur, uv + refr).rgb, .65), glass, .4);',
    '  float rim = 1. - smoothstep(0., .6, h);',
    '  vec3 drop = through * (.93 + .1 * h);',
    '  drop = mix(drop, drop * .62, rim * .5);',
    // light from the sky, up and to the left
    '  vec3 N = normalize(vec3(n * 1.15, max(h, .04)));',
    '  vec2 toLight = (uLightPos - px) / uRes.y;',
    '  vec3 L = normalize(vec3(toLight * 1.6, .55));',
    '  vec3 H = normalize(L + vec3(0., 0., 1.));',
    '  float ndh = max(dot(N, H), 0.);',
    '  float spec = pow(ndh, 100.) * (.3 + .9 * uLight);',
    '  float sheen = pow(ndh, 9.) * .045;',
    // light gathered by the bead and focused on its lower edge
    '  float caustic = smoothstep(.6, 1., dot(n, normalize(vec2(.5, .86)))) * h * .12 * (.3 + uLight);',
    '  drop += uHi * (spec + sheen + caustic);',
    '  vec3 col = mix(glass, drop, cov);',
    // a faint shadow under each bead on the fog
    '  float under = texture2D(uBeads, uv - vec2(0., 2.5) / uRes).a * keep;',
    '  col *= 1. - under * (1. - cov) * .12 * fogAmt;',
    '  gl_FragColor = vec4(col, 1.);',
    '}'
  ].join('\n');

  function hx(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  function toHex(c) {
    if (!c) return '#000000';
    c = c.trim();
    if (c[0] === '#') return c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
    var m = c.match(/\d+(\.\d+)?/g);
    if (!m) return '#000000';
    return '#' + m.slice(0, 3).map(function (v) { return Math.round(+v).toString(16).padStart(2, '0'); }).join('');
  }
  function rng(seed) {
    var a = seed;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* one bead, drawn once: red/green hold which way its surface faces,
     blue holds how thick it is, alpha holds its outline */
  function beadSprite() {
    var S = 64, c = document.createElement('canvas'); c.width = c.height = S;
    var g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    for (var y = 0; y < S; y++) {
      for (var x = 0; x < S; x++) {
        var qx = (x + 0.5 - S / 2) / (S / 2 - 1), qy = (y + 0.5 - S / 2) / (S / 2 - 1), r = Math.sqrt(qx * qx + qy * qy);
        var i = (y * S + x) * 4;
        if (r >= 1) { d[i + 3] = 0; continue; }
        // water beads are flatter than spheres, with a steeper edge
        var hgt = Math.pow(1 - r * r, 0.65);
        d[i] = (qx * 0.5 + 0.5) * 255;
        d[i + 1] = (qy * 0.5 + 0.5) * 255;
        d[i + 2] = hgt * 255;
        d[i + 3] = Math.min(1, (1 - r) * 14) * 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // a heavier drop that has started to sag: round at the bottom, drawn out at the top
  function dropSprite() {
    var Wd = 64, TOP = 1.7, Hd = Math.round(64 * (1 + TOP) / 2);
    var c = document.createElement('canvas'); c.width = Wd; c.height = Hd;
    var g = c.getContext('2d'), img = g.createImageData(Wd, Hd), d = img.data;
    for (var y = 0; y < Hd; y++) {
      for (var x = 0; x < Wd; x++) {
        var qx = (x + 0.5 - Wd / 2) / (Wd / 2 - 1);
        var qy = (y + 0.5) / Hd * (1 + TOP) - TOP;           // -TOP at the top, 1 at the bottom
        var sy = qy < 0 ? qy / TOP : qy;                       // stretched above the middle
        var narrow = qy < 0 ? 1 - 0.45 * (-qy / TOP) : 1;      // and narrower toward the top
        var ex = qx / narrow, r = Math.sqrt(ex * ex + sy * sy);
        var i = (y * Wd + x) * 4;
        if (r >= 1) { d[i + 3] = 0; continue; }
        var hgt = Math.pow(1 - r * r, 0.6) * (qy < 0 ? 0.7 + 0.3 * (1 + sy) : 1);
        d[i] = (ex * 0.5 + 0.5) * 255;
        d[i + 1] = (sy * 0.5 + 0.5) * 255;
        d[i + 2] = hgt * 255;
        d[i + 3] = Math.min(1, (1 - r) * 12) * 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // soft, wandering noise for the fog (tileable, so it can repeat)
  function noiseTexture() {
    var S = 256, out = document.createElement('canvas'); out.width = out.height = S;
    var o = out.getContext('2d'), r = rng(21);
    [[8, 0.6], [16, 0.3], [32, 0.15]].forEach(function (lv) {
      var n = lv[0], small = document.createElement('canvas'); small.width = small.height = n;
      var s = small.getContext('2d'), im = s.createImageData(n, n);
      for (var i = 0; i < n * n; i++) { var v = r() * 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
      s.putImageData(im, 0, 0);
      o.globalAlpha = lv[1]; o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
      // draw 3x3 so the edges wrap when the texture repeats
      for (var ty = -1; ty <= 1; ty++) for (var tx = -1; tx <= 1; tx++) o.drawImage(small, tx * S, ty * S, S, S);
    });
    o.globalAlpha = 1;
    return out;
  }

  function create(opts) {
    var hero = opts.hero;
    var canvas = document.createElement('canvas');
    canvas.className = 'sky-glass';
    canvas.setAttribute('aria-hidden', 'true');
    // positioned here rather than in the stylesheet, so an older site.css can't break it
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;';
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false }) ||
             canvas.getContext('experimental-webgl');
    if (!gl) return null;

    function shader(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var maxVec = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 16;
    var NDROPS = maxVec >= 64 ? 24 : 8;
    var hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    var frag = FRAG.replace(/NDROPS/g, String(NDROPS)).replace('PRECISION', hp && hp.precision > 0 ? 'highp' : 'mediump');
    var vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos'); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ['uScene', 'uBlur', 'uBeads', 'uMask', 'uNoise', 'uTrail', 'uLightPos', 'uRes', 'uFog', 'uLight', 'uAspect', 'uFogCol', 'uHi', 'uDrops'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });

    function texture(unit, repeat) {
      var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      return t;
    }
    var T = { scene: texture(0), blur: texture(1), beads: texture(2), mask: texture(3), noise: texture(4, true), trail: texture(5) };
    gl.uniform1i(U.uScene, 0); gl.uniform1i(U.uBlur, 1); gl.uniform1i(U.uBeads, 2); gl.uniform1i(U.uMask, 3); gl.uniform1i(U.uNoise, 4); gl.uniform1i(U.uTrail, 5);
    function upload(unit, tex, source) {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
    try { upload(4, T.noise, noiseTexture()); } catch (e) { return null; }

    var sprite = beadSprite(), teardrop = dropSprite();
    var W = 0, H = 0, dpr = 1, maskSmall = document.createElement('canvas'), msctx = maskSmall.getContext('2d');
    var trailC = document.createElement('canvas');
    var sceneC = document.createElement('canvas'), blurC = document.createElement('canvas'), tinyC = document.createElement('canvas');
    var light = 1, fogBase = 0.65, fogCol = [0.89, 0.91, 0.94], hi = [1, 1, 1];
    var raf = 0, maskSource = null, maskDirty = false, failed = false;

    /* ---------- the beads ---------- */
    function makeBeads() {
      var bs = Math.min(window.devicePixelRatio || 1, 2);
      var c = document.createElement('canvas'); c.width = Math.round(W * bs); c.height = Math.round(H * bs);
      var g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      var r = rng(5), area = W * H;
      function bead(x, y, rad) {
        var sx = 0.82 + r() * 0.36, sy = 0.82 + r() * 0.36, rot = r() * Math.PI;
        g.save(); g.translate(x * bs, y * bs); g.rotate(rot); g.scale(sx, sy);
        g.drawImage(sprite, -rad * bs, -rad * bs, rad * 2 * bs, rad * 2 * bs);
        g.restore();
      }
      // tiny beads first, then medium, then the big ones on top, as if they've swallowed their neighbours
      var nSmall = Math.round(area * 0.022), nMed = Math.round(area * 0.0026), nBig = Math.round(area * 0.00034), nDrip = Math.round(area * 0.000024);
      for (var i = 0; i < nSmall; i++) bead(r() * W, r() * H, 0.6 + r() * 1.1);
      for (i = 0; i < nMed; i++) bead(r() * W, Math.pow(r(), 0.8) * H, 1.6 + r() * 2.6);
      for (i = 0; i < nBig; i++) {
        var bx = r() * W, by = Math.pow(r(), 0.5) * H, br = 4.5 + r() * 5.5;
        bead(bx, by, br);
        if (r() < 0.5) bead(bx + (r() - 0.5) * br * 1.1, by + (r() - 0.3) * br * 0.9, br * (0.55 + r() * 0.3));
      }

      // drips: a heavy drop that has run partway down, leaving a clear track above it
      var tc = trailC; tc.width = c.width; tc.height = c.height;
      var tg = tc.getContext('2d'); tg.clearRect(0, 0, tc.width, tc.height);
      tg.lineCap = 'round'; tg.lineJoin = 'round';
      for (i = 0; i < nDrip; i++) {
        var dx = W * (0.03 + r() * 0.94), dr = 6 + r() * 7, dy = H * (0.3 + Math.pow(r(), 0.6) * 0.62);
        // a meandering path: drops wander a little as they find their way down
        var run = 30 + r() * 110, pts = [], wx = 0;
        for (var k = 0; k <= 14; k++) {
          var f = k / 14;
          wx += (r() - 0.5) * 3.2;
          pts.push([dx + wx * (1 - f * 0.6), dy - dr * 1.2 - run * (1 - f)]);
        }
        pts[pts.length - 1][0] = dx;
        // the track: clear of beads (and of fog, in the shader), narrowing toward where it started
        [['destination-out', g], ['source-over', tg]].forEach(function (pair) {
          var ctx2 = pair[1]; ctx2.save(); ctx2.globalCompositeOperation = pair[0];
          ctx2.strokeStyle = 'rgba(0,0,0,1)';
          for (var k2 = 1; k2 < pts.length; k2++) {
            var along = k2 / pts.length;
            // the track narrows and fades toward where the drop started
            if (ctx2 === tg) ctx2.globalAlpha = 0.15 + 0.85 * along;
            ctx2.lineWidth = Math.max(1.2, dr * (0.25 + 0.7 * along)) * bs;
            ctx2.beginPath(); ctx2.moveTo(pts[k2 - 1][0] * bs, pts[k2 - 1][1] * bs); ctx2.lineTo(pts[k2][0] * bs, pts[k2][1] * bs); ctx2.stroke();
          }
          ctx2.restore();
        });
        // a few droplets left stranded along the track
        for (var k3 = 0; k3 < 5; k3++) {
          var sp = pts[Math.floor(r() * (pts.length - 2))];
          bead(sp[0] + (r() - 0.5) * dr * 0.5, sp[1], 0.8 + r() * 1.6);
        }
        // and the drop itself, heavy at the bottom of its run
        g.save(); g.translate(dx * bs, dy * bs); g.rotate((r() - 0.5) * 0.12);
        var dw = dr * 2 * (0.9 + r() * 0.2) * bs, dh = dw * teardrop.height / teardrop.width;
        g.drawImage(teardrop, -dw / 2, -dh + dr * bs, dw, dh);
        g.restore();
      }
      try { upload(5, T.trail, tc); } catch (e) { failed = true; }
      try { upload(2, T.beads, c); } catch (e) { failed = true; }
    }

    /* ---------- the scene behind the glass, copied from the page ---------- */
    var svg = hero.querySelector('.sky-scene');
    var sceneTimer = 0, sceneBusy = false, sceneAgain = false;
    function inlineStyles(orig, clone) {
      var os = orig.querySelectorAll('*'), cs = clone.querySelectorAll('*');
      for (var i = 0; i < os.length; i++) {
        var o = os[i], c = cs[i], st = getComputedStyle(o), tag = o.tagName.toLowerCase();
        if (tag === 'stop') {
          c.setAttribute('stop-color', st.stopColor); c.setAttribute('stop-opacity', st.stopOpacity);
        } else if (/^(path|rect|circle|ellipse|line|polyline|polygon|g)$/.test(tag)) {
          ['fill', 'stroke'].forEach(function (p) {
            var v = st[p];
            if (/^url/.test(v)) { var id = v.match(/#([\w-]+)/); if (id) c.setAttribute(p, 'url(#' + id[1] + ')'); }
            else c.setAttribute(p, v);
          });
          c.setAttribute('stroke-width', st.strokeWidth);
          c.setAttribute('opacity', st.opacity);
          if (st.strokeLinecap) c.setAttribute('stroke-linecap', st.strokeLinecap);
        }
        c.removeAttribute('class'); c.removeAttribute('style');
      }
    }
    function drawGlow(g, x, y, r, inner, glowRGBA, glowR) {
      var gr = g.createRadialGradient(x, y, r * 0.6, x, y, glowR);
      gr.addColorStop(0, glowRGBA); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, glowR, 0, Math.PI * 2); g.fill();
      g.fillStyle = inner; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    function sceneNow() {
      if (sceneBusy) { sceneAgain = true; return; }
      if (!W) return;
      sceneBusy = true;
      var hs = hero.style;
      var top = toHex(hs.getPropertyValue('--sky-top')), bot = toHex(hs.getPropertyValue('--sky-bottom'));
      var g = sceneC.getContext('2d');
      sceneC.width = W; sceneC.height = H;
      var grad = g.createLinearGradient(0, 0, 0, H * 0.86);
      grad.addColorStop(0, top); grad.addColorStop(1, bot);
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      var night = hero.classList.contains('is-night-sky');
      if (night) {
        drawGlow(g, parseFloat(hs.getPropertyValue('--moon-x')) / 100 * W, parseFloat(hs.getPropertyValue('--moon-y')) / 100 * H, 20, '#E7EAF0', 'rgba(231,234,240,.16)', 70);
      } else {
        drawGlow(g, parseFloat(hs.getPropertyValue('--sun-x')) / 100 * W, parseFloat(hs.getPropertyValue('--sun-y')) / 100 * H, 30, toHex(hs.getPropertyValue('--sun-color')), 'rgba(255,232,196,.38)', 130);
      }
      var clone = svg.cloneNode(true);
      inlineStyles(svg, clone);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', W); clone.setAttribute('height', H);
      var img = new Image();
      img.onload = function () {
        g.drawImage(img, 0, 0, W, H);
        // a cheap, soft blur for the fog: shrink it down and stretch it back up
        var midW = Math.max(16, Math.round(W / 6)), midH = Math.max(16, Math.round(H / 6));
        var midC = document.createElement('canvas'); midC.width = midW; midC.height = midH;
        var m = midC.getContext('2d'); m.imageSmoothingQuality = 'high'; m.drawImage(sceneC, 0, 0, midW, midH);
        tinyC.width = Math.max(8, Math.round(W / 26)); tinyC.height = Math.max(8, Math.round(H / 26));
        var t = tinyC.getContext('2d'); t.imageSmoothingQuality = 'high'; t.drawImage(midC, 0, 0, tinyC.width, tinyC.height);
        blurC.width = W; blurC.height = H;
        var b = blurC.getContext('2d'); b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high';
        b.drawImage(tinyC, 0, 0, W, H);
        try { upload(0, T.scene, sceneC); upload(1, T.blur, blurC); } catch (e) { failed = true; if (opts.onFail) opts.onFail(); }
        sceneBusy = false;
        schedule();
        if (sceneAgain) { sceneAgain = false; sceneNow(); }
      };
      img.onerror = function () { sceneBusy = false; failed = true; if (opts.onFail) opts.onFail(); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    }
    function sceneChanged() {
      clearTimeout(sceneTimer);
      sceneTimer = setTimeout(sceneNow, 120);
    }

    /* ---------- beads that are alive ----------
       runners: drops heavy enough to run down the glass (from strokes, from nowhere, or a creeper that broke free)
       creepers: beads that mostly sit still, then every so often creep a little way down, stop, and grow,
                 each on its own random clock, the way real condensation does */
    var R = rng(Date.now() & 0xffff);
    var drops = [], creepers = [];
    var nextDrop = performance.now() + 2500 + Math.random() * 2500, nextCreeper = 0, creepTarget = 12;

    function fogged(x, y) { return !(opts.isClear && opts.isClear(x, y)); }
    function spawnDrop(now) {
      if (drops.length >= 5) return;
      var sx, sy, tries = 0;
      do { sx = W * (0.08 + R() * 0.84); sy = H * (0.08 + R() * 0.5); tries++; } while (!fogged(sx, sy) && tries < 8);
      if (tries >= 8) return;
      drops.push({ x: sx, y: sy, r: 0, rMax: 7 + R() * 5, born: now, grow: 1400 + R() * 1200,
        slide: 80 + R() * 140, dur: 2200 + R() * 2200, wob: (R() - 0.5) * 10, lastY: null, a: 1 });
    }
    // water pushed aside by a stroke gathers at its lower edge, then runs down
    function dripAt(x, y) {
      if (drops.length >= 10) drops.shift();
      drops.push({ x: x, y: y, r: 0, rMax: 5 + R() * 3.5, born: performance.now(),
        grow: 450 + R() * 600, slide: 70 + R() * 170, dur: 1500 + R() * 1800, wob: (R() - 0.5) * 8, lastY: null, a: 1 });
      schedule();
    }
    // a creeper that has grown heavy enough lets go and runs
    function breakFree(c) {
      if (drops.length >= 10) return false;
      drops.push({ x: c.x, y: c.y, r: c.r, rMax: c.r + 1 + R() * 2, born: performance.now(), grow: 160,
        slide: 50 + R() * 160, dur: 1300 + R() * 1700, wob: (R() - 0.5) * 7, lastY: null, a: 1 });
      return true;
    }
    function addCreeper(now) {
      var x, y, tries = 0;
      do { x = W * (0.03 + R() * 0.94); y = H * (0.05 + R() * 0.85); tries++; } while (!fogged(x, y) && tries < 8);
      if (tries >= 8) return;
      creepers.push({ x: x, y: y, r: 0, rT: 2.4 + R() * 3.4, a: 0, next: now + 600 + R() * 5000, move: null, check: now, stretch: 0 });
    }

    function updateRunners(now) {
      if (now > nextDrop && !document.hidden) { spawnDrop(now); nextDrop = now + 3000 + R() * 3500; }
      drops = drops.filter(function (d) {
        var t = now - d.born, x = d.x, y = d.y, r, st = 0;
        if (t < d.grow) {
          r = d.rMax * Math.pow(t / d.grow, 0.6);
        } else {
          var s2 = Math.min(1, (t - d.grow) / d.dur);
          // stick-slip: it hesitates, lurches, and slows as it runs out of water
          var e = s2 < 0.15 ? s2 * s2 * 3 : 1 - Math.pow(1 - s2, 2.4);
          y = d.y + d.slide * e;
          x = d.x + d.wob * Math.sin(e * 3.1);
          r = d.rMax * (1 - 0.35 * s2);
          st = s2 < 1 ? 0.45 + 0.45 * (1 - s2) : 0;
          if (d.lastY !== null && y - d.lastY > 0.5 && opts.clearAt) opts.clearAt(x, d.lastY, r * 0.85, x, y);
          d.lastY = y;
          if (s2 >= 1) d.a -= 0.02;
        }
        d.cx = x; d.cy = y; d.cr = r; d.st = st;
        return d.a > 0;
      });
      return drops.length > 0;
    }

    function updateCreepers(now) {
      var active = false;
      if (creepers.length < creepTarget && now > nextCreeper && !document.hidden) { addCreeper(now); nextCreeper = now + 300 + R() * 900; }
      creepers = creepers.filter(function (c) {
        // a new bead forms gradually
        if (!c.dying && c.a < 1) { c.a = Math.min(1, c.a + 0.035); c.r = c.rT * c.a; active = true; }
        // wiped away by a stroke
        if (now - c.check > 600) { c.check = now; if (!fogged(c.x, c.y)) c.dying = true; }
        if (c.dying) { c.a -= 0.09; c.r *= 0.96; active = true; return c.a > 0; }
        if (c.move) {
          var m = c.move, f = Math.min(1, (now - m.t0) / m.dur);
          var e = 1 - Math.pow(1 - f, 3);                  // a quick lurch that settles
          var nx = m.x0 + m.dx * e, ny = m.y0 + m.dy * e;
          if (opts.clearAt && ny - c.y > 0.35) opts.clearAt(c.x, c.y, c.r * 0.65, nx, ny);
          c.x = nx; c.y = ny; c.stretch = Math.min(0.75, (1 - f) * m.dy / 12);
          active = true;
          if (f >= 1) {
            c.move = null; c.stretch = 0;
            c.rT += R() * 0.4; c.r = c.rT;                // it picks up water as it goes
            c.next = now + 1400 + R() * 7000;               // then rests a while
          }
        } else if (now > c.next) {
          if (c.rT > 5.4 && R() < 0.4 && breakFree(c)) return false;
          c.move = { t0: now, dur: 240 + R() * 760, x0: c.x, y0: c.y, dy: (1.2 + R() * 8) * (c.rT / 4), dx: (R() - 0.5) * 2.2 };
          active = true;
        }
        return c.y < H - 6;
      });
      return active;
    }

    function updateDrops(now) {
      var running = updateRunners(now), creeping = updateCreepers(now);
      var data = new Float32Array(NDROPS * 4), i = 0;
      function put(x, y, r, a, st) {
        if (i >= NDROPS || r <= 0.2) return;
        data[i * 4] = x * dpr; data[i * 4 + 1] = y * dpr; data[i * 4 + 2] = r * dpr;
        data[i * 4 + 3] = Math.floor(Math.max(0, Math.min(0.99, st)) * 8) * 2 + Math.max(0, Math.min(1, a));
        i++;
      }
      drops.forEach(function (d) { put(d.cx, d.cy, d.cr, d.a, d.st); });
      creepers.forEach(function (c) { put(c.x, c.y, c.r, c.a, c.stretch); });
      gl.uniform4fv(U.uDrops, data);
      return running || creeping;
    }

    /* ---------- the light: follows the cursor, otherwise the sun or moon ---------- */
    var lightX = 0, lightY = 0, targetX = 0, targetY = 0, hovering = false, lightReady = false;
    function skyLight() {
      var hs = hero.style, night = hero.classList.contains('is-night-sky');
      var lx = parseFloat(hs.getPropertyValue(night ? '--moon-x' : '--sun-x')), ly = parseFloat(hs.getPropertyValue(night ? '--moon-y' : '--sun-y'));
      if (isNaN(lx)) { lx = 20; ly = 10; }
      return [lx / 100 * W, ly / 100 * H];
    }
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = hero.getBoundingClientRect();
      // the light sits a little above the cursor, like a lamp you're holding up to the glass
      hovering = true; targetX = e.clientX - r.left; targetY = e.clientY - r.top - 120;
      schedule();
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { hovering = false; schedule(); });
    function easeLight() {
      if (!hovering) { var sl = skyLight(); targetX = sl[0]; targetY = sl[1]; }
      if (!lightReady) { lightX = targetX; lightY = targetY; lightReady = true; }
      lightX += (targetX - lightX) * 0.12; lightY += (targetY - lightY) * 0.12;
      gl.uniform2f(U.uLightPos, lightX * dpr, lightY * dpr);
      return Math.abs(targetX - lightX) + Math.abs(targetY - lightY) > 0.5;
    }

    /* ---------- drawing ---------- */
    // if anything goes wrong while drawing, hand back to the flat fog rather than freezing
    function draw(now) {
      raf = 0;
      if (failed || !W) return;
      try { drawFrame(now); } catch (e) { failed = true; console.warn('Condensation stopped, using flat fog instead:', e); if (opts.onFail) opts.onFail(); }
    }
    function drawFrame(now) {
      if (maskDirty && maskSource) {
        msctx.clearRect(0, 0, maskSmall.width, maskSmall.height);
        msctx.drawImage(maskSource, 0, 0, maskSmall.width, maskSmall.height);
        upload(3, T.mask, maskSmall);
        maskDirty = false;
      }
      var moving = updateDrops(now || performance.now());
      if (easeLight()) moving = true;
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uAspect, W / H);
      gl.uniform1f(U.uFog, fogBase);
      gl.uniform1f(U.uLight, light);
      gl.uniform3fv(U.uFogCol, fogCol);
      gl.uniform3fv(U.uHi, hi);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (moving) schedule();
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(draw); }
    // check for new sliding drops a few times a second, even when nothing else is happening
    setInterval(function () { if (!document.hidden) schedule(); }, 400);

    return {
      canvas: canvas,
      resize: function (w, h) {
        W = Math.round(w); H = Math.round(h);
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        maskSmall.width = Math.max(16, Math.round(W / 3)); maskSmall.height = Math.max(16, Math.round(H / 3));
        drops = []; creepers = [];
        creepTarget = Math.round(Math.max(6, Math.min(18, W * H / 70000)));
        makeBeads();
        sceneNow();
        maskDirty = true; schedule();
      },
      maskChanged: function (src) { maskSource = src; maskDirty = true; schedule(); },
      drip: dripAt,
      lightChanged: function (L, fog, fogHex, sunHex) {
        light = L; fogBase = fog;
        fogCol = hx(fogHex);
        // bright white highlights at noon, warm near sunrise and sunset, a faint cool glint at night
        var warm = hx(sunHex), white = [1, 1, 1], moon = [0.55, 0.62, 0.78];
        var dayHi = warm.map(function (v, i) { return v + (white[i] - v) * Math.min(1, L * 1.4); });
        hi = L > 0.02 ? dayHi.map(function (v, i) { return moon[i] + (v - moon[i]) * Math.min(1, L * 2); }) : moon;
        sceneChanged();
      },
      failed: function () { return failed; }
    };
  }

  window.SPGlass = { create: create };
})();