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
    'uniform sampler2D uScene, uBlur, uScene2, uBlur2, uBeads, uMask, uNoise, uTrail;',
    'uniform vec2 uRes;',
    'uniform float uFog, uLight, uAspect, uBeadR, uMagnify, uNightMix, uSatA, uSatB, uFogMix;',
    'uniform vec3 uFogCol, uHi, uGradeA, uGradeB;',
    'uniform vec4 uDrops[NDROPS];',
    'uniform vec2 uLightPos;',
    // a calm patch of glass behind the headline: (left, top, right, bottom) in pixels
    'uniform vec4 uCalm;',
    // the home page: the view shifts a little as the cursor moves (uShift, uZoom), and an open sash has no glass (uOpen, from the bottom)
    'uniform vec2 uShift;',
    'uniform float uZoom, uOpen;',
    'varying vec2 vUv;',
    // the scene behind the glass, colour-graded for the time of day; with a night photo it crossfades to that
    // smooth noise worked out on the spot, so it never repeats or shows seams
    'float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);',
    '  return mix(mix(hash2(i), hash2(i + vec2(1., 0.)), f.x), mix(hash2(i + vec2(0., 1.)), hash2(i + vec2(1., 1.)), f.x), f.y); }',
    'vec3 grade(vec3 c, vec3 mul, float sat) { float l = dot(c, vec3(.299, .587, .114)); return mix(vec3(l), c, sat) * mul; }',
    'vec2 view(vec2 p) { return (p - .5) * uZoom + .5 + uShift; }',
    'vec3 sceneSharp(vec2 p) { p = view(p); return mix(grade(texture2D(uScene, p).rgb, uGradeA, uSatA), grade(texture2D(uScene2, p).rgb, uGradeB, uSatB), uNightMix); }',
    'vec3 sceneSoft(vec2 p) { p = view(p); return mix(grade(texture2D(uBlur, p).rgb, uGradeA, uSatA), grade(texture2D(uBlur2, p).rgb, uGradeB, uSatB), uNightMix); }',
    'void main(){',
    '  vec2 uv = vUv;',
    '  vec2 px = uv * uRes;',
    '  float raw = texture2D(uMask, uv).a;',
    // a wipe that's mostly clear counts as fully clear
    '  float clear = smoothstep(.02, .55, raw);',
    // each bead pixel knows how far it sits from its bead's centre (red/green), how thick the water is (blue) and its outline (alpha)
    '  vec4 b = texture2D(uBeads, uv);',
    '  vec2 off = (b.rg * 2. - 1.) * uBeadR;',
    '  float h = b.b;',
    '  float cov = b.a;',
    // beads hang on along the edges of a wipe
    '  float edge = smoothstep(.04, .2, raw) * (1. - smoothstep(.26, .46, raw));',
    '  float keep = clamp(1. - clear + edge * .95, 0., 1.);',
    '  cov *= keep;',
    // behind the headline the condensation has settled more evenly: fewer, smaller beads and a smoother fog
    // a rounded, soft-edged area whose outline wanders like the rest of the fog, so it never reads as a shape
    '  float kc = uRes.y / 800.;',
    '  vec2 cIn = min(px - uCalm.xy, uCalm.zw - px);',
    '  float sd = min(cIn.x, cIn.y) >= 0. ? min(cIn.x, cIn.y) : -length(max(-cIn, 0.));',
    '  float wander = (vnoise(px / (230. * kc)) * .65 + vnoise(px / (85. * kc) + 7.3) * .35 - .5) * 150. * kc;',
    '  float calm = smoothstep(-230. * kc, 70. * kc, sd + wander) * step(1., uCalm.z - uCalm.x);',
    '  cov *= 1. - calm * .55;',
    // beads that are alive: creeping, growing, running. w holds stretch (whole part) and opacity (fraction)
    '  for (int i = 0; i < NDROPS; i++) {',
    '    vec4 d = uDrops[i];',
    '    if (d.w > 0.) {',
    '      float st = floor(d.w / 2.) / 8.;',
    '      float da = d.w - floor(d.w / 2.) * 2.;',
    '      vec2 rel = px - d.xy;',
    '      vec2 q = rel / vec2(d.z, d.z * 1.06);',
    // a moving bead is drawn out above, like water running down glass
    '      if (q.y < 0.) q.y /= 1. + st * 1.7;',
    '      float r2 = dot(q, q);',
    '      if (r2 < 1.) {',
    '        float a = (1. - smoothstep(.8, 1., r2)) * da;',
    '        off = mix(off, q * d.z, a); h = mix(h, pow(1. - r2, .62), a); cov = max(cov, a);',
    '      }',
    '    }',
    '  }',
    // how far across its bead this pixel is (0 centre, 1 edge), and which way the surface faces
    '  float dd = sqrt(clamp(1. - pow(max(h, 1e-4), 1.613), 0., 1.));',
    '  vec2 dir = length(off) > 1e-3 ? normalize(off) : vec2(0.);',
    '  vec2 n = dir * dd;',
    // the glass: in focus where it is clear, soft milky fog elsewhere
    '  float mott = texture2D(uNoise, uv * vec2(uAspect, 1.) * 1.3).r;',
    '  float mott2 = texture2D(uNoise, uv * vec2(uAspect, 1.) * 5.1 + .37).r;',
    // the look map: each drop's character (red = how dark its rim is, green = how wide) and the drip trails (blue)
    '  vec4 lk = texture2D(uTrail, uv);',
    '  float trail = lk.b;',
    '  float has = step(.02, lk.r + lk.g);',
    '  float rimDark = mix(.55, lk.r, has);',
    '  float rimWide = mix(.5, lk.g, has);',
    '  float fogAmt = clamp(uFog * (1. - clear) * (1. - trail * .6) * (.94 + .14 * mott + .06 * mott2), 0., 1.);',
    '  fogAmt = max(fogAmt, calm * .72 * (1. - clear));',
    '  vec3 sharp = sceneSharp(uv);',
    '  vec3 soft = sceneSoft(uv);',
    '  float grain = texture2D(uNoise, uv * vec2(uAspect, 1.) * 38.).r - .5;',
    '  vec3 fogged = mix(soft, uFogCol, uFogMix + .08 * mott) * (1. + grain * .025);',
    '  vec3 glass = mix(sharp, fogged, fogAmt);',
    // each bead is a tiny lens: through it you see a sharp, upside-down miniature of the scene around it,
    // squeezed more toward its edge, like a fisheye
    '  float fish = 1. + .55 * dd * dd;',
    '  vec2 look = (px - off * (1. + uMagnify * fish)) / uRes;',
    '  vec3 through = mix(sceneSharp(look), sceneSoft(look), .12);',
    '  vec3 drop = through * (1.04 - .08 * dd);',
    // water bends light away near the rim, so a bead has a dark ring with a thin brighter lip inside it
    // every drop has its own character: some clear and thin-rimmed, some with a heavy, dark, wide rim
    '  float ringStart = mix(.82, .4, rimWide);',
    '  float ring = smoothstep(ringStart, .98, dd);',
    '  float lip = smoothstep(ringStart - .14, ringStart + .04, dd) * (1. - smoothstep(ringStart + .06, ringStart + .2, dd));',
    '  drop = mix(drop, drop * mix(.62, .16, rimDark) + uFogCol * .04, ring * mix(.35, 1., rimDark));',
    '  drop += lip * mix(.02, .08, rimDark) * (.4 + uLight);',
    // light from the sky (or the cursor): one crisp highlight and a soft sheen
    '  vec3 N = normalize(vec3(n * 1.2, sqrt(max(1. - dd * dd, 0.)) + .05));',
    '  vec2 toLight = (uLightPos - px) / uRes.y;',
    '  vec3 L = normalize(vec3(toLight * 1.6, .55));',
    '  vec3 Hv = normalize(L + vec3(0., 0., 1.));',
    '  float ndh = max(dot(N, Hv), 0.);',
    '  float spec = pow(ndh, 160.) * (.45 + 1.1 * uLight) * mix(.6, 1.35, rimDark);',
    '  float sheen = pow(ndh, 10.) * .05;',
    // light gathered by the bead and focused on the side away from the light
    "  float caustic = smoothstep(.55, .95, dd) * smoothstep(.3, .9, dot(dir, -normalize(toLight + 1e-4))) * .14 * (.25 + uLight);",
    '  drop += uHi * (spec + sheen + caustic);',
    '  vec3 col = mix(glass, drop, cov);',
    // a faint shadow under each bead on the fog
    '  float under = texture2D(uBeads, uv - vec2(0., 2.5) / uRes).a * keep;',
    '  col *= 1. - under * (1. - cov) * .1 * fogAmt;',
    '  if (px.y > uRes.y - uOpen) col = sceneSharp(uv);',
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

  /* Bead sprites. Every pixel stores how far it is from its bead's centre, in CSS pixels
     (red = across, green = down, scaled by RMAX), how thick the water is there (blue) and the
     bead's outline (alpha). Because the distance is real, the shader can turn each bead into a
     lens that shows an upside-down miniature of the scene, sized to the bead. One sprite per size. */
  var RMAX = 24;
  function beadSpriteFor(rad, bs, cache) {
    var key = 'b' + rad + '@' + bs;
    if (cache[key]) return cache[key];
    var R2 = rad * bs, S = Math.ceil(R2 * 2) + 2;
    var c = document.createElement('canvas'); c.width = c.height = S;
    var g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    for (var y = 0; y < S; y++) {
      for (var x = 0; x < S; x++) {
        var qx = (x + 0.5 - S / 2) / R2, qy = (y + 0.5 - S / 2) / R2, r = Math.sqrt(qx * qx + qy * qy);
        var i = (y * S + x) * 4;
        if (r >= 1) { d[i + 3] = 0; continue; }
        // water beads are flatter than spheres, with a steeper edge
        d[i] = (qx * rad / RMAX * 0.5 + 0.5) * 255;
        d[i + 1] = (qy * rad / RMAX * 0.5 + 0.5) * 255;
        d[i + 2] = Math.pow(1 - r * r, 0.62) * 255;
        d[i + 3] = Math.min(1, (1 - r) * R2 * 1.3) * 255;
      }
    }
    g.putImageData(img, 0, 0);
    return (cache[key] = c);
  }
  // a heavier drop that has started to sag: round at the bottom, drawn out and narrower at the top
  var TOP = 1.7;
  function dropSpriteFor(rad, bs, cache) {
    var key = 'd' + rad + '@' + bs;
    if (cache[key]) return cache[key];
    var R2 = rad * bs, Wd = Math.ceil(R2 * 2) + 2, Hd = Math.ceil(R2 * (1 + TOP)) + 2, cy = TOP * R2 + 1;
    var c = document.createElement('canvas'); c.width = Wd; c.height = Hd;
    var g = c.getContext('2d'), img = g.createImageData(Wd, Hd), d = img.data;
    for (var y = 0; y < Hd; y++) {
      for (var x = 0; x < Wd; x++) {
        var qx = (x + 0.5 - Wd / 2) / R2, qy = (y + 0.5 - cy) / R2;
        var sy = qy < 0 ? qy / TOP : qy;
        var narrow = qy < 0 ? 1 - 0.45 * (-qy / TOP) : 1;
        var ex = qx / narrow, r = Math.sqrt(ex * ex + sy * sy);
        var i = (y * Wd + x) * 4;
        if (r >= 1) { d[i + 3] = 0; continue; }
        d[i] = (Math.max(-1, Math.min(1, qx * rad / RMAX)) * 0.5 + 0.5) * 255;
        d[i + 1] = (Math.max(-1, Math.min(1, qy * rad / RMAX)) * 0.5 + 0.5) * 255;
        d[i + 2] = Math.pow(1 - r * r, 0.62) * (qy < 0 ? 0.7 + 0.3 * (1 + sy) : 1) * 255;
        d[i + 3] = Math.min(1, (1 - r) * R2 * 1.1) * 255;
      }
    }
    g.putImageData(img, 0, 0);
    c.cy = cy;
    return (cache[key] = c);
  }
  function bucket(rad) { return Math.max(0.5, Math.round(rad * 2) / 2); }

  /* A one-off bead with its own wobbly outline and its own flatness. parts is one or more
     overlapping circles [x, y, r] (in CSS px, relative to the bead) that melt into a single
     drop, the way neighbouring drops join on real glass. Each pixel stores its offset from the
     nearest part's centre, so the refraction still works for merged shapes. */
  function blobSprite(parts, bs, rnd, flat) {
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    var waves = parts.map(function (p) {
      minX = Math.min(minX, p[0] - p[2] * 1.3); maxX = Math.max(maxX, p[0] + p[2] * 1.3);
      minY = Math.min(minY, p[1] - p[2] * 1.3); maxY = Math.max(maxY, p[1] + p[2] * 1.3);
      // an outline that wobbles a little, differently for every part
      var a = 0.03 + rnd() * 0.11;
      return [a, rnd() * 6.28, a * (0.3 + rnd() * 0.6), rnd() * 6.28, a * rnd() * 0.5, rnd() * 6.28];
    });
    var ox = Math.floor(minX * bs) - 1, oy = Math.floor(minY * bs) - 1;
    var Wd = Math.ceil(maxX * bs) - ox + 2, Hd = Math.ceil(maxY * bs) - oy + 2;
    var c = document.createElement('canvas'); c.width = Wd; c.height = Hd;
    var g = c.getContext('2d'), img = g.createImageData(Wd, Hd), d = img.data;
    for (var y = 0; y < Hd; y++) {
      for (var x = 0; x < Wd; x++) {
        var px = (x + ox + 0.5) / bs, py = (y + oy + 0.5) / bs, f = 0, best = 0, bi = 0;
        for (var k = 0; k < parts.length; k++) {
          var p = parts[k], dx = px - p[0], dy = py - p[1], d2 = dx * dx + dy * dy + 1e-6;
          var th = Math.atan2(dy, dx), w = waves[k];
          var rr = p[2] * (1 + w[0] * Math.sin(2 * th + w[1]) + w[2] * Math.sin(3 * th + w[3]) + w[4] * Math.sin(5 * th + w[5]));
          var contrib = rr * rr / d2;
          f += contrib;
          if (contrib > best) { best = contrib; bi = k; }
        }
        var i = (y * Wd + x) * 4;
        if (f <= 1) { d[i + 3] = 0; continue; }
        var q = parts[bi], ex = px - q[0], ey = py - q[1], rad = q[2];
        d[i] = (Math.max(-1, Math.min(1, ex / RMAX)) * 0.5 + 0.5) * 255;
        d[i + 1] = (Math.max(-1, Math.min(1, ey / RMAX)) * 0.5 + 0.5) * 255;
        d[i + 2] = Math.pow(1 - 1 / f, flat) * 255;
        d[i + 3] = Math.min(1, (1 - 1 / Math.sqrt(f)) * rad * bs * 1.4) * 255;
      }
    }
    g.putImageData(img, 0, 0);
    c.ox = ox; c.oy = oy;
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
    ['uScene', 'uBlur', 'uScene2', 'uBlur2', 'uBeadR', 'uMagnify', 'uNightMix', 'uSatA', 'uSatB', 'uGradeA', 'uGradeB', 'uFogMix', 'uCalm', 'uBeads', 'uMask', 'uNoise', 'uTrail', 'uLightPos', 'uRes', 'uFog', 'uLight', 'uAspect', 'uFogCol', 'uHi', 'uDrops', 'uShift', 'uZoom', 'uOpen'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });

    function texture(unit, repeat) {
      var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      return t;
    }
    var T = { scene: texture(0), blur: texture(1), beads: texture(2), mask: texture(3), noise: texture(4, true), trail: texture(5), scene2: texture(6), blur2: texture(7) };
    gl.uniform1i(U.uScene, 0); gl.uniform1i(U.uBlur, 1); gl.uniform1i(U.uBeads, 2); gl.uniform1i(U.uMask, 3); gl.uniform1i(U.uNoise, 4); gl.uniform1i(U.uTrail, 5);
    gl.uniform1i(U.uScene2, 6); gl.uniform1i(U.uBlur2, 7);
    // until a photo or a time of day says otherwise: no grading, no night photo
    gl.uniform3f(U.uGradeA, 1, 1, 1); gl.uniform3f(U.uGradeB, 1, 1, 1);
    gl.uniform1f(U.uSatA, 1); gl.uniform1f(U.uSatB, 1); gl.uniform1f(U.uNightMix, 0); gl.uniform1f(U.uFogMix, 0.8);
    // how wide a view each bead takes in, as a multiple of its size: bigger shows a smaller, more distant world
    gl.uniform1f(U.uMagnify, 3.4);
    gl.uniform2f(U.uShift, 0, 0); gl.uniform1f(U.uZoom, 1); gl.uniform1f(U.uOpen, 0);
    var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    function upload(unit, tex, source) {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
    try { upload(4, T.noise, noiseTexture()); } catch (e) { return null; }

    var spriteCache = {};
    var W = 0, H = 0, dpr = 1, maskSmall = document.createElement('canvas'), msctx = maskSmall.getContext('2d');
    var trailC = document.createElement('canvas');
    var sceneC = document.createElement('canvas'), blurC = document.createElement('canvas'), tinyC = document.createElement('canvas');
    var light = 1, fogBase = 0.65, fogCol = [0.89, 0.91, 0.94], hi = [1, 1, 1];
    var raf = 0, maskSource = null, maskDirty = false, failed = false;

    /* ---------- the beads ---------- */
    function makeBeads() {
      // 1.5x is sharp on retina screens and makes the beads in well under half the time of 2x
      var bs = Math.min(window.devicePixelRatio || 1, 1.5);
      var c = document.createElement('canvas'); c.width = Math.round(W * bs); c.height = Math.round(H * bs);
      var g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      var r = rng(5), area = W * H;
      function bead(x, y, rad) {
        // the tiniest mist beads share a few ready-made sprites; anything bigger gets its own shape
        if (rad < 1.2) {
          var spr = beadSpriteFor(bucket(rad), bs, spriteCache);
          var sx = 0.85 + r() * 0.3, sy = 0.85 + r() * 0.3;
          g.save(); g.translate(x * bs, y * bs); g.rotate(r() * Math.PI); g.scale(sx, sy);
          g.drawImage(spr, -spr.width / 2, -spr.height / 2);
          g.restore();
          return;
        }
        // small and medium beads come from a pool: eight different shapes for every half-pixel of size
        var b = Math.round(rad * 2) / 2, v = Math.floor(r() * 8), key = 'p' + b + '_' + v + '@' + bs;
        if (!spriteCache[key]) {
          var sr = rng(Math.round(b * 200) * 13 + v * 977 + 7);
          spriteCache[key] = blobSprite([[0, 0, b]], bs, sr, 0.45 + sr() * 0.45);
        }
        var ps = spriteCache[key], ch = character();
        var px = Math.round(x * bs) + ps.ox, py = Math.round(y * bs) + ps.oy;
        g.drawImage(ps, px, py);
        tg.drawImage(silhouette(ps, ch, key + '#' + ch.join()), px, py);
      }
      function blob(x, y, parts) {
        // big and merged drops are one of a kind; some sit flat on the glass, some stand up taller
        var spr = blobSprite(parts, bs, r, 0.45 + r() * 0.45);
        var px = Math.round(x * bs) + spr.ox, py = Math.round(y * bs) + spr.oy;
        g.drawImage(spr, px, py);
        // big drops lean toward the heavier characters
        var ch = character(); if (parts[0][2] > 6 && ch[0] < 0.4 && r() < 0.6) ch = CHARACTERS[4];
        tg.drawImage(silhouette(spr, ch), px, py);
      }
      // two or three drops that have touched and joined
      function merged(x, y, rad) {
        var parts = [[0, 0, rad]], n = r() < 0.65 ? 1 : 2;
        for (var m = 0; m < n; m++) {
          var ang = r() * 6.28, dist = rad * (0.75 + r() * 0.55);
          parts.push([Math.cos(ang) * dist, Math.sin(ang) * dist * 0.85, rad * (0.4 + r() * 0.45)]);
        }
        blob(x, y, parts);
      }

      // the look map starts black ("no particular character"); drip trails are added in blue later
      var tc = trailC; tc.width = c.width; tc.height = c.height;
      var tg = tc.getContext('2d'); tg.globalCompositeOperation = 'source-over';
      tg.fillStyle = '#000'; tg.fillRect(0, 0, tc.width, tc.height);
      tg.lineCap = 'round'; tg.lineJoin = 'round';
      // a drop's character: [how dark its rim is, how wide it is], from clear and glassy to heavy and dark
      var CHARACTERS = [[0.18, 0.2], [0.35, 0.3], [0.5, 0.45], [0.62, 0.55], [0.78, 0.68], [0.95, 0.85], [0.85, 0.4], [0.3, 0.7]];
      function character() {
        // most drops sit in the middle; a few are very clear or very heavy
        var u = r(), idx = u < 0.12 ? 0 : u < 0.3 ? 1 : u < 0.5 ? 2 : u < 0.68 ? 3 : u < 0.82 ? 4 : u < 0.9 ? 5 : u < 0.96 ? 6 : 7;
        return CHARACTERS[idx];
      }
      function silhouette(spr, ch, key) {
        if (key && spriteCache[key]) return spriteCache[key];
        var sc = document.createElement('canvas'); sc.width = spr.width; sc.height = spr.height;
        var sg = sc.getContext('2d');
        sg.drawImage(spr, 0, 0);
        sg.globalCompositeOperation = 'source-in';
        sg.fillStyle = 'rgb(' + Math.round(ch[0] * 255) + ',' + Math.round(ch[1] * 255) + ',0)';
        sg.fillRect(0, 0, sc.width, sc.height);
        if (key) spriteCache[key] = sc;
        return sc;
      }

      // a soft random pattern so some patches of glass are busier than others
      var GX = 9, GY = 6, grid = [];
      for (var gi = 0; gi < (GX + 1) * (GY + 1); gi++) grid.push(r());
      function density(x, y) {
        var fx = x / W * GX, fy = y / H * GY, ix = Math.min(GX - 1, Math.floor(fx)), iy = Math.min(GY - 1, Math.floor(fy));
        var tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        var a = grid[iy * (GX + 1) + ix], b2 = grid[iy * (GX + 1) + ix + 1], c2 = grid[(iy + 1) * (GX + 1) + ix], d2 = grid[(iy + 1) * (GX + 1) + ix + 1];
        return (a * (1 - tx) + b2 * tx) * (1 - ty) + (c2 * (1 - tx) + d2 * tx) * ty;
      }
      function spot(lowBias) {
        for (var t2 = 0; t2 < 6; t2++) {
          var x = r() * W, y = Math.pow(r(), lowBias) * H;
          if (r() < 0.25 + 0.95 * density(x, y)) return [x, y];
        }
        return [r() * W, r() * H];
      }

      // smallest first, biggest last, so big drops sit on top as if they've swallowed their neighbours
      var nMist = Math.round(area * 0.02), nSmall = Math.round(area * 0.0042), nMed = Math.round(area * 0.0009),
          nBig = Math.round(area * 0.00011), nDrip = Math.round(area * 0.000024);
      var i, pt;
      for (i = 0; i < nMist; i++) { pt = spot(1); bead(pt[0], pt[1], 0.45 + r() * 0.75); }
      for (i = 0; i < nSmall; i++) { pt = spot(0.9); bead(pt[0], pt[1], 1.2 + 2.3 * Math.pow(r(), 1.5)); }
      for (i = 0; i < nMed; i++) {
        pt = spot(0.75);
        var mr = 3 + 4.2 * Math.pow(r(), 1.3);
        if (r() < 0.22) merged(pt[0], pt[1], mr * 0.8); else bead(pt[0], pt[1], mr);
      }
      for (i = 0; i < nBig; i++) {
        pt = spot(0.5);
        var br = 7 + 8 * Math.pow(r(), 1.6);
        if (r() < 0.4) merged(pt[0], pt[1], br * 0.75); else blob(pt[0], pt[1], [[0, 0, br]]);
      }

      // drips: a heavy drop that has run partway down, leaving a clear track above it
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
          ctx2.strokeStyle = ctx2 === tg ? '#0000ff' : 'rgba(0,0,0,1)';
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
        var tdr = dropSpriteFor(bucket(dr), bs, spriteCache);
        var rot = (r() - 0.5) * 0.12;
        g.save(); g.translate(dx * bs, dy * bs); g.rotate(rot);
        g.drawImage(tdr, -tdr.width / 2, -tdr.cy);
        g.restore();
        // a drop heavy enough to run is one of the darker, thicker ones
        tg.save(); tg.translate(dx * bs, dy * bs); tg.rotate(rot);
        tg.drawImage(silhouette(tdr, CHARACTERS[5 - Math.floor(r() * 2)]), -tdr.width / 2, -tdr.cy);
        tg.restore();
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
    /* ---------- photos behind the glass ---------- */
    // up to three photos per city (day, sunset, night); the shader blends two at a time,
    // so each is prepared once and the pair being blended is swapped in as the evening goes on
    var photos = null, photoDrawn = false, prepared = {}, pairNow = '', wantPair = ['day', 'night'];
    var scene2C = document.createElement('canvas'), blur2C = document.createElement('canvas');
    // fill w x h like background-size: cover, keeping the focus point in view
    function cover(ctx2, img, w, h, fx, fy) {
      var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      var sc = Math.max(w / iw, h / ih), dw = iw * sc, dh = ih * sc;
      ctx2.drawImage(img, (w - dw) * fx, (h - dh) * fy, dw, dh);
    }
    // an in-focus copy at up to twice screen resolution (seen through the beads), and a soft one for the fog
    function photoTextures(img, sharpC, softC, fx, fy) {
      var ps = Math.min(dpr, 2);
      var w = Math.min(maxTex, Math.round(W * ps)), h = Math.min(maxTex, Math.round(H * ps));
      sharpC.width = w; sharpC.height = h;
      var g = sharpC.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      cover(g, img, w, h, fx, fy);
      var midC = document.createElement('canvas'); midC.width = Math.max(16, Math.round(W / 6)); midC.height = Math.max(16, Math.round(H / 6));
      var m = midC.getContext('2d'); m.imageSmoothingQuality = 'high'; m.drawImage(sharpC, 0, 0, midC.width, midC.height);
      var tiny = document.createElement('canvas'); tiny.width = Math.max(8, Math.round(W / 26)); tiny.height = Math.max(8, Math.round(H / 26));
      var t = tiny.getContext('2d'); t.imageSmoothingQuality = 'high'; t.drawImage(midC, 0, 0, tiny.width, tiny.height);
      softC.width = Math.round(W / 2); softC.height = Math.round(H / 2);
      var b = softC.getContext('2d'); b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high'; b.drawImage(tiny, 0, 0, softC.width, softC.height);
    }
    function usePair(a, b) {
      var A = prepared[a] || prepared.day, B = prepared[b] || A, key = a + '|' + b;
      if (!A || key === pairNow) return;
      upload(0, T.scene, A.sharp); upload(1, T.blur, A.soft);
      upload(6, T.scene2, B.sharp); upload(7, T.blur2, B.soft);
      pairNow = key;
    }
    function drawPhotos() {
      if (!photos || !W) return false;
      try {
        prepared = {}; pairNow = '';
        ['day', 'sunset', 'night'].forEach(function (k) {
          if (!photos[k]) return;
          var sc = document.createElement('canvas'), sf = document.createElement('canvas');
          photoTextures(photos[k], sc, sf, photos.fx, photos.fy);
          prepared[k] = { sharp: sc, soft: sf };
        });
        usePair(wantPair[0], wantPair[1]);
        photoDrawn = true;
        schedule();
        return true;
      } catch (e) {
        // usually a browser refusing the image (for example, opening the file directly instead of through a server)
        console.warn('Photo could not be used behind the glass; keeping the illustration.', e);
        photos = null; photoDrawn = false;
        // the browser now treats these canvases as off-limits, so the illustration gets fresh ones
        sceneC = document.createElement('canvas'); blurC = document.createElement('canvas');
        scene2C = document.createElement('canvas'); blur2C = document.createElement('canvas');
        sceneNow();
        return false;
      }
    }

    function sceneNow() {
      if (photos) { if (!photoDrawn) drawPhotos(); if (photos) return; }
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
      creepers.push({ x: x, y: y, r: 0, rT: 1.8 + 6.5 * Math.pow(R(), 1.4), a: 0, next: now + 600 + R() * 5000, move: null, check: now, stretch: 0 });
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
          // a real drop finds its own way down: small random sideways steps, not a smooth curve
          if (d.px === undefined) { d.px = d.x; d.vx = 0; }
          d.vx = d.vx * 0.85 + (R() - 0.5) * 0.5;
          d.px += d.vx * 0.35;
          x = d.px;
          // it picks up water from the glass it runs over, and swallows any bead in its path
          d.gain = (d.gain || 0) + Math.max(0, y - (d.cy || y)) * 0.012;
          creepers.forEach(function (c) {
            if (!c.dying && Math.hypot(c.x - x, c.y - y) < (d.cr || d.rMax) + c.r * 0.6) { c.dying = true; c.swallowed = true; d.gain += c.r * 0.35; }
          });
          r = Math.min(d.rMax * 1.6, d.rMax * (1 - 0.3 * s2) + d.gain);
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
      // two beads that touch become one, with the water of both
      for (var i = 0; i < creepers.length; i++) {
        var a = creepers[i]; if (a.dying || a.a < 1) continue;
        for (var j = i + 1; j < creepers.length; j++) {
          var b = creepers[j]; if (b.dying || b.a < 1) continue;
          if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * 0.9) {
            var big = a.r >= b.r ? a : b, small = big === a ? b : a;
            big.rT = Math.sqrt(big.rT * big.rT + small.rT * small.rT); big.r = big.rT;
            // the merged bead settles where the heavier one was, nudged toward the other
            big.x += (small.x - big.x) * 0.25; big.y += (small.y - big.y) * 0.25;
            small.dying = true; small.swallowed = true; active = true;
          }
        }
      }
      if (creepers.length < creepTarget && now > nextCreeper && !document.hidden) { addCreeper(now); nextCreeper = now + 300 + R() * 900; }
      creepers = creepers.filter(function (c) {
        // a new bead forms gradually
        if (!c.dying && c.a < 1) { c.a = Math.min(1, c.a + 0.035); c.r = c.rT * c.a; active = true; }
        // wiped away by a stroke
        if (now - c.check > 600) { c.check = now; if (!fogged(c.x, c.y)) c.dying = true; }
        if (c.dying) { if (c.swallowed) return false; c.a -= 0.09; c.r *= 0.96; active = true; return c.a > 0; }
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

    /* ---------- the calm patch behind the headline ---------- */
    var calmBox = [0, 0, 0, 0], lastCalm = 0;
    function measureCalm() {
      var h1 = hero.querySelector('.hero-text h1'), sub2 = hero.querySelector('.hero-text .sub');
      if (!h1) { calmBox = [0, 0, 0, 0]; return; }
      // measure the words themselves, not their boxes: the headline's box runs the full width of the window
      function textRect(el) { var rg = document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect(); }
      var hr = hero.getBoundingClientRect(), a = textRect(h1), b = sub2 ? textRect(sub2) : a;
      calmBox = [Math.min(a.left, b.left) - hr.left - 24, Math.min(a.top, b.top) - hr.top - 18,
                 Math.max(a.right, b.right) - hr.left + 40, Math.max(a.bottom, b.bottom) - hr.top + 18];
    }
    window.addEventListener('resize', function () { lastCalm = 0; });

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
      gl.uniform1f(U.uBeadR, RMAX * dpr);
      // re-measure now and then: the rotating words change the line's width
      var tnow = now || performance.now();
      if (tnow - lastCalm > 1500) { measureCalm(); lastCalm = tnow; }
      gl.uniform4f(U.uCalm, calmBox[0] * dpr, calmBox[1] * dpr, calmBox[2] * dpr, calmBox[3] * dpr);
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
        photoDrawn = false;
        sceneNow();
        maskDirty = true; schedule();
      },
      maskChanged: function (src) { maskSource = src; maskDirty = true; schedule(); },
      drip: dripAt,
      // photos: { day: Image, night: Image or null, fx, fy } or null for the illustration
      setPhotos: function (p) {
        photos = p; photoDrawn = false;
        if (p) { drawPhotos(); } else { sceneNow(); }
        return !!photos;
      },
      hasPhotos: function () { return !!photos; },
      lightChanged: function (L, fog, fogHex, sunHex, grade) {
        if (grade && photos) {
          // which two photos are being blended right now (day/night, day/sunset or sunset/night)
          wantPair = grade.pair || ['day', 'night'];
          if (photoDrawn) { try { usePair(wantPair[0], wantPair[1]); } catch (e) { /* keep the current pair */ } }
          gl.uniform3fv(U.uGradeA, grade.a); gl.uniform1f(U.uSatA, grade.sa);
          gl.uniform3fv(U.uGradeB, grade.b); gl.uniform1f(U.uSatB, grade.sb);
          gl.uniform1f(U.uNightMix, grade.n);
        } else {
          gl.uniform3f(U.uGradeA, 1, 1, 1); gl.uniform1f(U.uSatA, 1); gl.uniform1f(U.uNightMix, 0);
        }
        light = L; fogBase = fog;
        fogCol = hx(fogHex);
        if (grade && photos) {
          // with a photo, the frost takes its colour from the photo's light: warm at sunset, moonlit at night
          var n = grade.n;
          fogCol = [0, 1, 2].map(function (i) { return (grade.a[i] * 0.86 + 0.05) * (1 - n) + (grade.b[i] * 0.3 + 0.04) * n; });
          gl.uniform1f(U.uFogMix, 0.55);
        } else {
          gl.uniform1f(U.uFogMix, 0.8);
        }
        // bright white highlights at noon, warm near sunrise and sunset, a faint cool glint at night
        var warm = hx(sunHex), white = [1, 1, 1], moon = [0.55, 0.62, 0.78];
        var dayHi = warm.map(function (v, i) { return v + (white[i] - v) * Math.min(1, L * 1.4); });
        hi = L > 0.02 ? dayHi.map(function (v, i) { return moon[i] + (v - moon[i]) * Math.min(1, L * 2); }) : moon;
        sceneChanged();
        schedule();
      },
      failed: function () { return failed; },
      // the home page: shift the view behind the glass (in parts of the window), zoom it, and open the lower sash (css px)
      setView: function (sx, sy, zoom, openPx) {
        gl.uniform2f(U.uShift, sx, sy); gl.uniform1f(U.uZoom, zoom); gl.uniform1f(U.uOpen, openPx * dpr);
        schedule();
      }
    };
  }

  window.SPGlass = { create: function (o) { var g = create(o); if (g) window.SPGlass.live = g; return g; } };
})();