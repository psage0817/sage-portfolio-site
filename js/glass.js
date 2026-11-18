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
    'uniform sampler2D uScene, uBlur, uScene2, uBlur2, uBeads, uMask, uNoise, uTrail, uWater;',
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
    // the live san diego view: time, where the photo sits in the window, and the train
    'uniform float uTime, uLive, uTrainU, uTrainOn, uTrainDir;',
    'uniform vec4 uPhoto;',
    'varying vec2 vUv;',
    // the scene behind the glass, colour-graded for the time of day; with a night photo it crossfades to that
    // smooth noise worked out on the spot, so it never repeats or shows seams
    'float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);',
    '  return mix(mix(hash2(i), hash2(i + vec2(1., 0.)), f.x), mix(hash2(i + vec2(0., 1.)), hash2(i + vec2(1., 1.)), f.x), f.y); }',
    'vec3 grade(vec3 c, vec3 mul, float sat) { float l = dot(c, vec3(.299, .587, .114)); return mix(vec3(l), c, sat) * mul; }',
    'vec2 view(vec2 p) { return (p - .5) * uZoom + .5 + uShift; }',
    // ---------- the live view (san diego photos only) ----------
    // photo coordinates run 0..1 across the 3200 x 1800 photo; the shoreline is traced from it
    // the water's edge, traced off the san diego photos: where the wet sand starts (photo coordinates)
    'float shoreY(float x) {',
    '  if (x < 0.12500) return mix(0.9444, 0.9111, (x - 0.00000) / 0.12500);',
    '  if (x < 0.21875) return mix(0.9111, 0.8611, (x - 0.12500) / 0.09375);',
    '  if (x < 0.28125) return mix(0.8611, 0.8417, (x - 0.21875) / 0.06250);',
    '  if (x < 0.34375) return mix(0.8417, 0.8111, (x - 0.28125) / 0.06250);',
    '  if (x < 0.43750) return mix(0.8111, 0.7667, (x - 0.34375) / 0.09375);',
    '  if (x < 0.50000) return mix(0.7667, 0.7361, (x - 0.43750) / 0.06250);',
    '  if (x < 0.58437) return mix(0.7361, 0.6861, (x - 0.50000) / 0.08437);',
    '  if (x < 0.67188) return mix(0.6861, 0.6528, (x - 0.58437) / 0.08750);',
    '  if (x < 0.75000) return mix(0.6528, 0.6222, (x - 0.67188) / 0.07812);',
    '  if (x < 0.81250) return mix(0.6222, 0.5944, (x - 0.75000) / 0.06250);',
    '  if (x < 1.00000) return mix(0.5944, 0.5833, (x - 0.81250) / 0.18750);',
    '  return 0.5833;',
    '}',
    // the train: a Pacific Surfliner on the real rails, in perspective. Lengths are in metres, s runs back from the north end.
    // from the north end: cab car, three coaches, a champagne coach, then the Charger locomotive at the south end
    'const float CAR = 25.9;',
    'const float LEN = 151.4;',
    'const float TS = .74;',
    'vec4 gTr; float gGlow; bool gUse;',
    'float bnd(float x, float a, float b, float e) { return smoothstep(a - e, a + e, x) * (1. - smoothstep(b - e, b + e, x)); }',
    // the rails, measured off the photo (photo pixels): the gap between them straight down the screen, and the train's near side at rail height
    'float vgAt(float x) { return 144.08 - .0306 * x; }',
    'float baseAt(float x) { float vg = vgAt(x); return (1800. - .3584 * (x - 1275.) + 1790. - .3278 * (x - 985.)) * .5 + 1.5 * .657 * TS * vg * .922; }',
    'float uAt(float x) { return 36.8 * log(114.1 / vgAt(x)); }',
    'float xAtU(float u) { return (144.08 - 114.1 * exp(-u / 36.8)) / .0306; }',
    // how tall the body is at s: bi-levels 4.85 m, the locomotive 4.25 m with its nose sloping down
    'float topAt(float s) {',
    '  if (s > 5. * CAR) { float t = 4.25; if (s > LEN - 3.4) t = mix(4.25, 3.05, smoothstep(LEN - 3.4, LEN - .6, s)); return t; }',
    '  if (s < 2.6) return mix(3.9, 4.85, smoothstep(.2, 2.6, s));',
    '  return 4.85;',
    '}',
    // glass: dark, with the sky reflected in its top half (and lit from inside after dark)
    'vec3 glassCol(float k) { return mix(vec3(.04, .055, .08), vec3(.34, .4, .5), smoothstep(.3, 1., k)); }',
    // the near side of the train at (s, h); e is how big a screen pixel is in metres, for soft edges
    'vec3 sideCol(float s, float h, float e, out float glow) {',
    '  glow = 0.;',
    '  float es = e * 1.2;',
    '  if (s > 5. * CAR) {',
    // the Charger: navy at the coupled end, a champagne panel with the round logo, a silver cab, a navy stripe low down
    '    float x = s - 5. * CAR;',
    '    vec3 c = vec3(.66, .69, .73) * (.86 + .2 * smoothstep(1.4, 4., h));',
    '    c = mix(c, vec3(.1, .15, .36), 1. - smoothstep(4.6, 5.2, x));',
    '    float pan = bnd(x, 6.2, 15.4, es) * bnd(h, 1.75, 3.75, e);',
    '    c = mix(c, vec3(.69, .63, .52) * (.9 + .12 * smoothstep(1.8, 3.7, h)), pan);',
    '    float rd = length(vec2((x - 10.9) * .9, h - 2.75));',
    '    c = mix(c, vec3(.12, .18, .42), (1. - smoothstep(.62 - e, .62 + e, rd)) * smoothstep(.46 - e, .46 + e, rd) * pan);',
    '    c = mix(c, vec3(.1, .14, .33), bnd(h, 1., 1.6, e));',
    '    c = mix(c, vec3(.12, .17, .4), smoothstep(LEN - 2.2, LEN - 1.4, s) * step(2.2, h));',
    '    float win = bnd(x, 18.9, 20.4, es) * bnd(h, 2.95, 3.6, e);',
    '    c = mix(c, glassCol((h - 2.95) / .65), win);',
    // louvres along the engine room
    '    c *= 1. - .12 * bnd(h, 3.85, 4.15, e) * step(mod(x, .35), .18) * bnd(x, 5.4, 17.5, es);',
    '    return c;',
    '  }',
    '  float ci = floor(s / CAR), x = s - ci * CAR;',
    '  bool tanCar = ci > 3.5;',
    '  vec3 champ = vec3(.67, .61, .5), blue = vec3(.11, .19, .55);',
    // painted metal: darker low down, brighter where it reflects the sky, a pale line where the horizon reflects
    '  vec3 c = champ * (.84 + .2 * smoothstep(1.3, 4.6, h));',
    '  c *= 1. + .07 * bnd(h, 2.9, 3.0, e);',
    '  if (!tanCar) c = mix(c, blue * (.88 + .22 * smoothstep(3.1, 4.5, h)), bnd(h, 3.05, 4.55, e));',
    '  c = mix(c, vec3(.5, .52, .55), smoothstep(4.55 - e, 4.55 + e, h));',
    '  c = mix(c, vec3(.4, .4, .4), bnd(h, 1., 1.32, e));',
    '  c *= 1. - .25 * bnd(h, 2.96, 3.0, e * .5);',
    // two decks of windows, with pillars between them; the doors are on the lower deck, in the middle
    '  float wx = mod(x - .9, 1.95);',
    '  float body = bnd(x, 1.1, CAR - 1.1, es);',
    '  float lower = bnd(h, 1.95, 2.72, e) * bnd(wx, .28, 1.75, es) * body * (1. - bnd(x, 11.2, 14.4, es));',
    '  float upper = bnd(h, 3.32, 4.18, e) * bnd(wx, .28, 1.75, es) * body;',
    '  float door = bnd(x, 11.4, 14.2, es) * bnd(h, 1.05, 3.02, e);',
    '  c = mix(c, c * .82, door);',
    '  c *= 1. - .35 * bnd(x, 12.78, 12.82, es) * door;',
    '  float dw = door * bnd(h, 2.05, 2.8, e) * (bnd(x, 11.7, 12.6, es) + bnd(x, 13., 13.9, es));',
    '  c = mix(c, glassCol((h - 3.32) / .86), upper);',
    '  c = mix(c, glassCol((h - 1.95) / .77), max(lower, dw));',
    '  glow = max(max(upper, lower), dw) * .9;',
    // the cab car's front windows at the north end
    '  if (s < 3.) { float cw = bnd(s, .5, 2.4, es) * bnd(h, 3.2, 3.85, e); c = mix(c, glassCol((h - 3.2) / .65), cw); glow *= 1. - cw; }',
    // the ends of each car: a dark gap and a rounded corner
    '  c *= .8 + .2 * bnd(x, .5, CAR - .5, es);',
    '  return c;',
    '}',
    // the roof at (s, w): w runs 0 at the near edge to 1 at the far edge
    'vec3 roofCol(float s, float w, float e) {',
    '  vec3 c = vec3(.4, .42, .45);',
    '  c *= mix(1.16, .78, smoothstep(.05, 1., w));      // lit near edge, rounded away from the light',
    '  c *= 1. - .14 * smoothstep(.35, .5, fract(w * 9.)) * smoothstep(.75, .6, fract(w * 9.));           // ribs along its length',
    '  c *= 1. + .12 * bnd(w, .0, .06, .02);',
    '  if (s > 5. * CAR) {',
    '    float x = s - 5. * CAR;',
    '    c = mix(c, vec3(.12, .17, .39) * mix(1.15, .8, w), smoothstep(LEN - 4.6, LEN - 4.2, s));',
    '    float gr = bnd(x, 5.5, 16.5, e) * bnd(w, .22, .78, .03);',
    '    c = mix(c, vec3(.2, .21, .23) * (1. - .3 * step(.5, fract(x * 2.6))), gr);',
    '  } else {',
    '    float x = mod(s, CAR);',
    '    float ac = (bnd(x, 3., 6.2, e) + bnd(x, 19.7, 22.9, e)) * bnd(w, .2, .8, .03);',
    '    c = mix(c, vec3(.38, .4, .43) * mix(1.2, .85, w), ac);',
    '    c *= .75 + .25 * bnd(x, .4, CAR - .4, e);',
    '  }',
    '  return c;',
    '}',
    // the locomotive's nose, facing south (down to the left): a in 0..1 across it, h in metres
    'vec3 noseCol(float a, float h, float e, out float glow) {',
    '  glow = 0.;',
    '  vec3 c = vec3(.1, .15, .36) * (.85 + .25 * smoothstep(.8, 3., h));',
    '  c = mix(c, vec3(.62, .65, .7), bnd(h, 1.55, 2.25, e) * (1. - bnd(a, .3, .7, .02)) * .8);',
    '  float ws = bnd(h, 2.45, 3.0, e) * bnd(a, .08, .92, .03) * (1. - bnd(a, .48, .52, .02));',
    '  c = mix(c, glassCol((h - 2.45) / .55), ws);',
    '  float hl = (1. - smoothstep(.06, .09, length(vec2((a - .22) * 2.6, h - 1.2) * vec2(1., 1.8)))) + (1. - smoothstep(.06, .09, length(vec2((a - .78) * 2.6, h - 1.2) * vec2(1., 1.8))));',
    '  c = mix(c, vec3(1., .98, .9), hl); glow = hl;',
    '  c = mix(c, vec3(.08, .08, .09), 1. - smoothstep(.6, .8, h));',
    '  return c;',
    '}',
    // one look at the train from this pixel. q is in photo coordinates; uTrainU is where its north end is
    'vec4 trainAt1(vec2 q, float U, float epx, out float glow) {',
    '  glow = 0.;',
    '  vec2 P = q * vec2(3200., 1800.);',
    '  if (P.x < 250. || P.x > 3320.) return vec4(0.);',
    '  float vg = vgAt(P.x);',
    '  float m = .657 * TS * vg, v = .8 * TS * vg;                  // one metre across the track, and straight up, in photo pixels',
    '  float base = baseAt(P.x);',
    '  float e = epx / v;                                 // one screen pixel, in metres',
    '  float s = U - uAt(P.x);',
    '  float h = (base - P.y) / v;',
    '  vec3 col = vec3(0.); float a = 0.;',
    // the near side
    '  if (s > -.2 && s < LEN + .2) {',
    '    float top = topAt(clamp(s, 0., LEN));',
    '    float ends = bnd(s, 0., LEN, e * 1.5);',
    '    float gap = 0.;',
    '    float x = mod(s, CAR);',
    '    if (s < 5. * CAR) gap = 1. - bnd(x, .3, CAR - .3, e * 1.5);',
    '    if (s > 5. * CAR - .3 && s < 5. * CAR + .3) gap = 1.;',
    '    float side = bnd(h, 0., top, e) * ends;',
    '    if (side > 0.) {',
    '      float g;',
    '      vec3 c = sideCol(s, h, e, g);',
    // running gear under the body: dark, the bogies a little lighter, wheels at the bogies
    '      float under = 1. - smoothstep(1. - e, 1. + e, h);',
    '      float bx = s > 5. * CAR ? s - 5. * CAR : x;',
    '      float bog = bnd(bx, 2.2, 5.1, e) + bnd(bx, s > 5. * CAR ? 15.6 : 20.8, s > 5. * CAR ? 18.6 : 23.7, e);',
    '      vec3 gear = mix(vec3(.08, .08, .09), vec3(.16, .16, .17), bog);',
    '      float ga = mix(smoothstep(.25, .5, h), 1., bog);',
    '      c = mix(c, gear, under);',
    '      float av = side * mix(1., ga, under);',
    // the gap between cars: a dark bellows, lower than the bodies
    '      c = mix(c, vec3(.06, .065, .075), gap);',
    '      av *= mix(1., bnd(h, .9, 4.3, e), gap);',
    // soft shade where the side meets the roof and the ground
    '      c *= .9 + .1 * smoothstep(.0, .5, top - h);',
    '      glow = g * (1. - gap) * (1. - under);',
    '      col = c; a = av;',
    '    }',
    '  }',
    // the roof, tilted away from us: solve for the point of the roof edge this pixel looks onto
    '  if (a < .99) {',
    '    float w = 0.;',
    '    float xr = P.x;',
    '    for (int i = 0; i < 2; i++) {',
    '      float vgr = vgAt(xr);',
    '      float yTop = baseAt(xr) - topAt(clamp(U - uAt(xr), 0., LEN)) * .8 * TS * vgr;',
    '      w = (yTop - P.y) / (.922 * .657 * TS * vgr * 3.);',
    '      xr = P.x + .387 * .657 * TS * vgr * 3. * w;',
    '    }',
    '    float sr = U - uAt(xr);',
    '    float ra = bnd(w, 0., 1., e * .5) * bnd(sr, 0., LEN, e * 1.5);',
    '    if (ra > 0.) {',
    '      float x = mod(sr, CAR);',
    '      if (sr < 5. * CAR) ra *= bnd(x, .25, CAR - .25, e * 1.5);',
    '      vec3 rc = roofCol(sr, w, e);',
    '      col = mix(rc, col, a); a = a + ra * (1. - a);',
    '    }',
    '  }',
    // the locomotive's nose, at the south end
    '  if (a < .99) {',
    '    float xe = xAtU(U - LEN);',
    '    float vge = vgAt(xe);',
    '    float Ax = -.387 * .657 * TS * vge * 3., Ay = -.922 * .657 * TS * vge * 3.;',
    '    float an = (P.x - xe) / Ax;',
    '    float hn = (baseAt(xe) + an * Ay - P.y) / (.8 * TS * vge);',
    '    float na = bnd(an, 0., 1., .02) * bnd(hn, 0., 3.05 - .25 * abs(an - .5), e);',
    '    if (na > 0.) {',
    '      float g;',
    '      vec3 nc = noseCol(an, hn, e, g);',
    '      col = mix(nc, col, a); a = a + na * (1. - a);',
    '      glow = max(glow, g * na);',
    '    }',
    '  }',
    // its shadow on the ballast, on the side away from the afternoon sun
    '  if (a < .99 && s > 0. && s < LEN && h < 0. && h > -1.7 * m / v) {',
    '    float sa = .3 * smoothstep(-1.7 * m / v, -.1, h);',
    '    col = mix(vec3(0.), col, a / max(a + sa * (1. - a), 1e-4)); a = a + sa * (1. - a);',
    '  }',
    '  return vec4(col, a);',
    '}',
    // three looks a fraction of a frame apart, so the moving train blurs a little like it would in a video
    'vec4 trainAt(vec2 q, out float glow) {',
    '  glow = 0.;',
    '  if (uTrainOn < .5) return vec4(0.);',
    '  vec2 P = q * vec2(3200., 1800.);',
    '  if (P.x < 250. || P.x > 3320. || P.y < 700.) return vec4(0.);',
    '  float epx = 3200. / (uPhoto.z * uRes.x);',
    '  float g1, g2, g3;',
    '  float d = .8 * uTrainDir;',
    '  vec4 t1 = trainAt1(q, uTrainU - d, epx, g1), t2 = trainAt1(q, uTrainU, epx, g2), t3 = trainAt1(q, uTrainU + d, epx, g3);',
    '  vec4 t = (vec4(t1.rgb * t1.a, t1.a) + vec4(t2.rgb * t2.a, t2.a) + vec4(t3.rgb * t3.a, t3.a)) / 3.;',
    '  glow = (g1 + g2 + g3) / 3.;',
    '  vec3 col = t.a > 0. ? t.rgb / t.a : vec3(0.);',
    // match the photo: a touch of its cool afternoon haze; after dark the bodies sink into the night, the windows stay lit
    '  col = mix(col, col * vec3(.95, .98, 1.03) + vec3(.01, .015, .02), .3);',
    '  col *= mix(.16, 1., clamp(uLight * 1.6, 0., 1.));',
    '  glow *= 1. - clamp(uLight * 2.2, 0., 1.);',
    '  return vec4(col, t.a);',
    '}',
    // ---------- the ocean: a real wave surface in perspective, replacing the still water in the photo ----------
    // the camera sits on the bluff OH metres up; OF is its focal length in photo widths; the horizon is at OHZ in photo coordinates
    'const float OH = 22.;',
    'const float OF = .85;',
    'const float OHZ = .428;',
    'float gTone, gW, gF, gRy, gGl, gFoam, gSheet, gWet, gBody, gShade, gSandFoam, gF0, gRy0; bool gOcean;',
    'float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);',
    '  return mix(mix(hash1(i), hash1(i + vec2(1., 0.)), f.x), mix(hash1(i + vec2(0., 1.)), hash1(i + vec2(1., 1.)), f.x), f.y); }',
    'float fbm(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < NOCT; i++) { s += a * noise2(p); p = p * 2.03 + 17.1; a *= .5; } return s; }',
    // metres along the beach (X) and out from the camera (Z) for a point in the photo
    'vec2 toWorld(vec2 q) { float z = OH * OF / max((q.y - OHZ) * .5625, 1e-4); return vec2((q.x - .5) * z / OF, z); }',
    // the swell: crest at ph = 0, the steep face on the beach side (ph near 1), a long gentle back
    'float swellH(float ph) { return max(smoothstep(.84, 1., ph) * (1. - smoothstep(.995, 1., ph) * 0.), 1. - smoothstep(.0, .55, ph)); }',
    'void oceanAt(vec2 q) {',
    '  gOcean = false; gTone = 1.; gF0 = .02; gRy0 = 0.; gW = 0.; gFoam = 0.; gSheet = 0.; gWet = 0.; gGl = 0.; gF = .02; gRy = 0.; gBody = 0.; gShade = 1.; gSandFoam = 0.;',
    '  float sy = shoreY(q.x);',
    // the water, plus a strip of beach the waves run up onto
    '  if (q.y < OHZ + .002 || q.y > sy + .09) return;',
    '  float wm = texture2D(uWater, q).r;',
    '  if (wm < .004) return;',
    '  gOcean = true;',
    '  float t = uTime;',
    '  vec2 w = toWorld(q);',
    '  float Z = w.y, X = w.x;',
    '  float Zs = OH * OF / max((sy - OHZ) * .5625, 1e-4);',
    '  float d = Z - Zs;                                   // metres out from the water\'s edge (negative on the sand)',
    '  float fp = Z * Z / (OH * OF * uRes.x * uPhoto.z);   // how many metres one screen pixel covers, out here',
    // ---- the swell: sets of waves, each one bending a little along the beach ----
    '  float T = 7.;                                        // seconds between waves',
    '  float lam = mix(34., 62., smoothstep(0., 160., d));  // they bunch up as the water gets shallow',
    '  float bend = .22 * (fbm(vec2(X * .012, t * .03)) - .5) + .05 * sin(X * .02);',
    '  float phw = d / lam + t / T + bend;',
    '  float ph = fract(phw);',
    // every wave is different: its own size, where it breaks, how much of it breaks, how thick its foam is
    '  float wid = floor(phw);',
    '  float r1 = hash1(vec2(wid, 1.3)), r2 = hash1(vec2(wid, 7.7)), r3 = hash1(vec2(wid, 4.2)), r4 = hash1(vec2(wid, 2.9));',
    '  float set = .35 + 1.15 * pow(r1, 1.4);',
    '  float amp = 1.6 * set * smoothstep(320., 140., d) * smoothstep(-2., 18., d) * smoothstep(lam * .25, lam * .08, fp * 6.);',
    '  float dd = .6;',
    '  float slope = (swellH(fract((d + dd) / lam + t / T + bend)) - swellH(ph)) / dd * amp;',
    // ---- wind ripples: a few travelling waves in different directions, faded out where they'd be smaller than a pixel ----
    '  vec2 g = vec2(0.);',
    '  for (int i = 0; i < NRIP; i++) {',
    '    float fi = float(i);',
    '    float wl = .55 * pow(1.32, fi);',                                     // 0.55 m up to about 12 m
    '    float an = -1.57 + (hash1(vec2(fi, 3.7)) - .5) * 3.;',              // mostly coming in from the sea
    '    vec2 dir = vec2(cos(an), sin(an));',
    '    float k = 6.2832 / wl;',
    '    float fade = smoothstep(2. * fp, 7. * fp, wl);',
    '    float ph2 = k * dot(dir, vec2(X, Z)) + t * sqrt(9.8 * k) + hash1(vec2(fi, 9.1)) * 6.2832;',
    '    g += dir * (.07 * cos(ph2) * fade);',
    '  }',
    // the surface normal: ripples plus the swell's slope (which faces the beach on the front of each wave)
    '  vec3 n = normalize(vec3(-g.x * .9, 1., -g.y * .9 - slope));',
    // ---- light: the sky reflected (Fresnel), the water's own colour, a glitter path towards the sun or moon ----
    '  vec3 eye = normalize(vec3(X, -OH, Z));',
    '  vec3 R = reflect(eye, n);',
    '  float cosi = clamp(dot(-eye, n), 0., 1.);',
    '  gF = .02 + .98 * pow(1. - cosi, 5.);',
    '  vec3 R0 = reflect(eye, vec3(0., 1., 0.)); float c0 = clamp(-eye.y, 0., 1.); gF0 = .02 + .98 * pow(1. - c0, 5.); gRy0 = clamp(R0.y * 2.2, 0., 1.);',
    '  gRy = clamp(R.y * 2.2, 0., 1.);',
    '  vec3 L = normalize(vec3(-.094, .1 + .3 * uLight, 1.));',
    '  gGl = pow(max(dot(R, L), 0.), 420.) * 5. + pow(max(dot(R, L), 0.), 60.) * .06;',
    '  gBody = smoothstep(260., 20., d);',
    // the front of an unbroken wave shows the water's body, darker and a little green; troughs a touch darker
    '  gShade = 1. - .4 * smoothstep(.0, .45, slope) * smoothstep(-.1, .4, -slope * 0. + 1.);',
    // ---- breaking: the wave turns to whitewater as it reaches the sandbar, then rolls in as a band of foam ----
    '  float brkD = 55. + 95. * set + 30. * sin(X * .006 + r2 * 6.28) * r4;',
    '  float brk = smoothstep(brkD + 25., brkD - 15., d);',
    '  float sect = smoothstep(.38, .62, fbm(vec2(X * .012 + wid * 3.1, wid * .73)));',
    '  brk *= mix(sect, 1., step(.62, r3)) * smoothstep(.38, .6, set);',
    '  float kl = mix(16., 6., set), kt = mix(9., 3.5, set * r2);',
    '  float lead = smoothstep(.0, .01, ph) * exp(-ph * kl);',
    '  float trail = smoothstep(.0, .02, ph) * exp(-ph * kt) * (.12 + .28 * r4);',
    '  float burst = exp(-abs(d - brkD) / (3. + 4. * set)) * exp(-ph * 7.) * smoothstep(.0, .01, ph) * set * brk;',
    '  float r1n = hash1(vec2(wid + 1., 1.3)); float setn = .35 + 1.15 * pow(r1n, 1.4);',
    '  float brkDn = 55. + 95. * setn;',
    '  float lip = smoothstep(.9, .995, ph) * (1. - smoothstep(.995, 1., ph)) * smoothstep(brkDn + 45., brkDn + 10., d) * smoothstep(brkDn - 25., brkDn, d) * smoothstep(.45, .8, setn);',
    '  vec2 fq = vec2(X * .22, (d + t * lam / T) * .32);',
    '  fq += vec2(wid * 13.7, 0.);',
    '  float lace = fbm(fq) * .65 + fbm(fq * 3.1 + vec2(t * .05, 0.)) * .35;',
    '  lace = mix(lace, lace * lace * 1.6, .4 * set);',
    '  float shoreBrk = smoothstep(26., 12., d) * smoothstep(-1., 3., d);',
    '  float cover = clamp((lead * (1. + .6 * set) + trail) * max(brk, shoreBrk * (.5 + .5 * set)) + burst * .8 + lip * .7, 0., 1.) * .82;',
    '  gTone = .72 + .38 * lace;',
    // the inner surf: everything inside the break stays streaked with old foam
    '  float inner = smoothstep(45., 6., d) * smoothstep(-1., 4., d) * .07;',
    '  cover = max(cover, inner * (.5 + .5 * fbm(vec2(X * .15, d * .4 - t * .2))));',
    '  gFoam = smoothstep(.1, .42, cover - (1. - lace) * .7) * smoothstep(1e-3, .05, cover) * (1. - smoothstep(.8, 3., fp));',
    // fade the surface into the photo near the horizon, where it's too far away to make out waves
    '  gW = smoothstep(OHZ + .004, OHZ + .045, q.y);',
    // ---- the swash: each wave runs up the sand as a thin sheet and slides back ----
    '  float ph0 = fract(t / T + bend + Zs * 0. );',
    '  float up = smoothstep(.0, .18, ph0) * (1. - smoothstep(.22, .75, ph0));',
    '  float w0 = floor(t / T + bend);',
    '  float run = mix(2.5, 11., pow(hash1(vec2(w0, 5.5)), 1.3)) * up;',
    '  float onSand = 1. - smoothstep(-.5, .5, d);',
    '  float sheet = smoothstep(-run - .4, -run + .6, d) * onSand;',
    '  gSheet = sheet * (1. - smoothstep(1.5, 3., -d) * .2);',
    '  float edge = (1. - smoothstep(.0, .55, abs(d + run))) * onSand * smoothstep(.0, .3, up);',
    '  gSandFoam = edge * (.6 + .4 * fbm(vec2(X * .5, t * .3)));',
    '  gWet = smoothstep(-11.5, -1., d) * onSand * (1. - sheet);',
    // in the sand strip, only the swash and the wet sand change the photo
    '  if (d < 0.) { gW = 0.; }',
    // nothing is drawn over the cliff, the bushes or the people: they stay in front of the water
    '  gW *= wm; gSheet *= wm; gWet *= wm; gSandFoam *= wm;',
    '  gW *= 1. - smoothstep(-.4, .4, -d) * 0.;',
    '}',
    'vec3 photo(sampler2D t, sampler2D tb, vec2 p, out float glow) {',
    '  glow = 0.;',
    '  vec3 c = texture2D(t, p).rgb;',
    '  if (uLive < .5) return c;',
    '  if (gUse && gOcean) {',
    // the ocean's colours come from this photo, so it matches by day, at sunset and at night
    '    vec3 deep = texture2D(tb, vec2(.3, .53) * uPhoto.zw + uPhoto.xy).rgb;',
    '    vec3 shallow = texture2D(tb, vec2(.18, .78) * uPhoto.zw + uPhoto.xy).rgb;',
    '    vec3 skyH = texture2D(tb, vec2(.5, .385) * uPhoto.zw + uPhoto.xy).rgb;',
    '    vec3 skyZ = texture2D(tb, vec2(.5, .18) * uPhoto.zw + uPhoto.xy).rgb;',
    '    vec3 body = mix(deep * vec3(.55, .66, .72), shallow * vec3(.62, .78, .8), gBody) * gShade;',
    '    vec3 refl = mix(skyH * 1.04, skyZ, gRy);',
    '    vec3 wcol = mix(body, refl, clamp(gF * 1.15, 0., 1.)) + skyH * gGl;',
    '    vec3 flat0 = mix(body / max(gShade, .01), mix(skyH * 1.04, skyZ, gRy0), clamp(gF0 * 1.15, 0., 1.));',
    '    vec3 here = texture2D(tb, p).rgb;',
    '    wcol *= mix(vec3(1.), here / max(flat0, vec3(.02)), .8);',
    '    float lum = dot(skyH, vec3(.3, .59, .11));',
    '    vec3 foamC = vec3(.93, .96, 1.) * (.62 + .5 * lum) * mix(.5, 1., clamp(uLight * 1.5, 0., 1.));',
    '    wcol = mix(wcol, foamC * gTone, gFoam);',
    '    c = mix(c, wcol, gW);',
    // on the sand: wet sand darkens and shines, the swash is a thin sheet of sky-coloured water with a foam edge
    '    c *= 1. - .22 * gWet;',
    '    c = mix(c, mix(c * .8, refl * .95, .55), gSheet * .85);',
    '    c = mix(c, foamC, gSandFoam * .85);',
    '  }',
    '  if (gUse && gTr.a > 0.) { glow = gGlow; c = mix(c, gTr.rgb, gTr.a); }',
    '  return c;',
    '}',
    // the train's lit windows and headlights are added after the grading, so they glow at night
    'vec3 sceneSharp(vec2 p) { p = view(p); float g1, g2; vec3 a = photo(uScene, uBlur, p, g1), b = photo(uScene2, uBlur2, p, g2);',
    '  return mix(grade(a, uGradeA, uSatA), grade(b, uGradeB, uSatB), uNightMix) + vec3(1., .82, .55) * g1 * .9; }',
    'vec3 sceneSoft(vec2 p) { p = view(p); float g1, g2; vec3 a = photo(uBlur, uBlur, p, g1), b = photo(uBlur2, uBlur2, p, g2);',
    '  return mix(grade(a, uGradeA, uSatA), grade(b, uGradeB, uSatB), uNightMix) + vec3(1., .82, .55) * g1 * .6; }',
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
    '  gTr = vec4(0.); gGlow = 0.; gUse = false;',
    '  gOcean = false;',
    '  if (uLive > .5) { vec2 tq = (view(uv) - uPhoto.xy) / uPhoto.zw; gTr = trainAt(tq, gGlow); oceanAt(tq); gUse = true; }',
    '  vec3 sharp = sceneSharp(uv);',
    '  vec3 soft = sceneSoft(uv);',
    '  float grain = texture2D(uNoise, uv * vec2(uAspect, 1.) * 38.).r - .5;',
    '  vec3 fogged = mix(soft, uFogCol, uFogMix + .08 * mott) * (1. + grain * .025);',
    '  vec3 glass = mix(sharp, fogged, fogAmt);',
    // each bead is a tiny lens: through it you see a sharp, upside-down miniature of the scene around it,
    // squeezed more toward its edge, like a fisheye
    '  float fish = 1. + .55 * dd * dd;',
    '  vec2 look = (px - off * (1. + uMagnify * fish)) / uRes;',
    '  bool keepUse = gUse; gUse = false;',
    '  vec3 through = mix(sceneSharp(look), sceneSoft(look), .12);',
    '  gUse = keepUse;',
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
    // phones (a touch screen as the main pointer) get a lighter ocean: fewer ripple layers and less foam detail
    var PHONE = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var frag = FRAG.replace(/NDROPS/g, String(NDROPS)).replace('PRECISION', hp && hp.precision > 0 ? 'highp' : 'mediump')
      .replace(/NRIP/g, PHONE ? '6' : '12').replace(/NOCT/g, PHONE ? '3' : '4');
    var vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos'); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ['uScene', 'uBlur', 'uScene2', 'uBlur2', 'uBeadR', 'uMagnify', 'uNightMix', 'uSatA', 'uSatB', 'uGradeA', 'uGradeB', 'uFogMix', 'uCalm', 'uBeads', 'uMask', 'uNoise', 'uTrail', 'uLightPos', 'uRes', 'uFog', 'uLight', 'uAspect', 'uFogCol', 'uHi', 'uDrops', 'uShift', 'uZoom', 'uOpen', 'uTime', 'uLive', 'uTrainU', 'uTrainOn', 'uTrainDir', 'uPhoto', 'uWater'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });

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
    // the live view's water mask needs a ninth texture; nearly every device has 16, but without one the photo just stays still
    var canLive = (gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) || 8) > 8;
    T.water = canLive ? texture(8) : null;
    if (canLive) gl.uniform1i(U.uWater, 8);
    // until a photo or a time of day says otherwise: no grading, no night photo
    gl.uniform3f(U.uGradeA, 1, 1, 1); gl.uniform3f(U.uGradeB, 1, 1, 1);
    gl.uniform1f(U.uSatA, 1); gl.uniform1f(U.uSatB, 1); gl.uniform1f(U.uNightMix, 0); gl.uniform1f(U.uFogMix, 0.8);
    // how wide a view each bead takes in, as a multiple of its size: bigger shows a smaller, more distant world
    gl.uniform1f(U.uMagnify, 3.4);
    gl.uniform2f(U.uShift, 0, 0); gl.uniform1f(U.uZoom, 1); gl.uniform1f(U.uOpen, 0);
    gl.uniform1f(U.uTime, 0); gl.uniform1f(U.uLive, 0); gl.uniform1f(U.uTrainU, 0); gl.uniform1f(U.uTrainOn, 0); gl.uniform1f(U.uTrainDir, 1); gl.uniform4f(U.uPhoto, 0, 0, 1, 1);
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
    /* ---------- the live view: waves always, a Pacific Surfliner now and then ---------- */
    var live = false;
    var TRAIN_SPEED = 40, TRAIN_LEN = 151.4;   // metres a second (about 90 mph, its top speed), metres
    // add ?train to the address to have one come by straight away (for testing)
    var trainQ = new URLSearchParams(location.search).has('train');
    var train = { on: false, dir: 1, t0: 0, next: null };
    function trainStep(t) {
      if (train.next === null) train.next = t + (trainQ ? 1500 : 6000 + Math.random() * 8000);
      if (!train.on && t >= train.next) {
        train.on = true; train.t0 = t;
        train.dir = 1;   // always northbound: the cab car leads and the locomotive pushes from the back
      }
      var u = 0;
      if (train.on) {
        var d = (t - train.t0) / 1000 * TRAIN_SPEED;
        u = train.dir > 0 ? -16 + d : 37 + TRAIN_LEN - d;
        if ((train.dir > 0 && u - TRAIN_LEN > 37) || (train.dir < 0 && u < -16)) {
          train.on = false;
          // the next one comes along in 25 to 70 seconds
          train.next = t + 25000 + Math.random() * 45000;
        }
      }
      gl.uniform1f(U.uTrainOn, train.on ? 1 : 0);
      gl.uniform1f(U.uTrainU, u);
      gl.uniform1f(U.uTrainDir, train.dir);
    }
    // where the photo sits in the window (it's drawn like background-size: cover)
    function photoRect() {
      if (!photos || !photos.day || !W) return;
      var iw = photos.day.naturalWidth || photos.day.width, ih = photos.day.naturalHeight || photos.day.height;
      var sc = Math.max(W / iw, H / ih), dw = iw * sc, dh = ih * sc;
      gl.uniform4f(U.uPhoto, (W - dw) * photos.fx / W, (H - dh) * photos.fy / H, dw / W, dh / H);
    }

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
    var lastLive = 0;
    function draw(now) {
      raf = 0;
      if (failed || !W) return;
      if (live && now - lastLive < 30) { raf = requestAnimationFrame(draw); return; }
      lastLive = now;
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
      if (live && photoDrawn) {
        gl.uniform1f(U.uTime, (tnow / 1000) % 3600);
        trainStep(tnow);
        // keep the waves going while the window is on screen
        if (onScreen) moving = true;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (moving) schedule();
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(draw); }
    // the live view stops drawing while the window is scrolled out of sight, and picks up again when it's back
    var onScreen = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; if (onScreen) schedule(); }).observe(canvas);
    }
    // check for new sliding drops a few times a second, even when nothing else is happening
    setInterval(function () { if (!document.hidden) schedule(); }, 400);

    function dprFor() { return PHONE && live ? 1 : Math.min(window.devicePixelRatio || 1, 2); }
    return {
      canvas: canvas,
      resize: function (w, h) {
        W = Math.round(w); H = Math.round(h);
        dpr = dprFor();
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        maskSmall.width = Math.max(16, Math.round(W / 3)); maskSmall.height = Math.max(16, Math.round(H / 3));
        drops = []; creepers = [];
        creepTarget = Math.round(Math.max(6, Math.min(18, W * H / 70000)));
        makeBeads();
        photoDrawn = false;
        sceneNow();
        photoRect();
        maskDirty = true; schedule();
      },
      maskChanged: function (src) { maskSource = src; maskDirty = true; schedule(); },
      drip: dripAt,
      // photos: { day: Image, night: Image or null, fx, fy } or null for the illustration
      setPhotos: function (p) {
        photos = p; photoDrawn = false;
        live = !!(p && p.live && p.water && T.water);
        if (live) upload(8, T.water, p.water);
        // the live view on a phone draws at 1x: a quarter of the pixels, so drawing on the glass keeps up with a finger
        if (W && dprFor() !== dpr) this.resize(W, H);
        gl.uniform1f(U.uLive, live ? 1 : 0);
        if (p) { drawPhotos(); photoRect(); } else { sceneNow(); }
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