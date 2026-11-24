/* about.js: the about page.
   - the clock in the menu bar (san diego time)
   - the intro's words arrive one after another as the page opens
   - currently...: the camera roll. The photos drift past on their own; the arrows at either end
     glide it a step, a finger or mouse can drag and fling it, and the button pauses it.
   - the s.park record in the transport is played by player.js, like on every other page

   YOUR PHOTOS (currently...)
   Each line in ROLL below is one photo, in the order they scroll past:
   - file:  the picture, img/about/roll/<file>.webp
   - name:  the caption in the photo's little title bar (right now, the file name from my phone)
   - alt:   what the photo shows, for people using screen readers
   To add a photo, save it as a .webp in img/about/roll/ and add a line. To take one out, delete its line. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ROLL = [
    { file: 'strike-poster', name: 'IMG_1309', alt: 'Holding a printed Strike poster with the word strike repeated down it' },
    { file: 'alphabet-sketch', name: 'IMG_0920', alt: 'Pencil sketches of a modular alphabet on graph paper' },
    { file: 'group', name: 'fqs_2026-11-13', alt: 'A group photo in front of a stone wall' },
    { file: 'sticky-notes', name: 'IMG_1906', alt: 'Sticky notes on a board under the headings celiac and gluten, I like, I wish, what if' },
    { file: 'singing', name: 'IMG_2094', alt: 'Singing into a microphone on stage in a long blue dress' },
    { file: 'handwritten-alphabet', name: 'IMG_1979', alt: 'A hand-drawn alphabet and numbers open in Illustrator' },
    { file: 'student-leaders', name: 'IMG_8697', alt: 'Five student leaders on a stage in front of a screen reading serve, inspire, change' },
    { file: 'haze-code', name: 'IMG_5581', alt: 'Blackout poetry spreads for the haze code, on a desk' },
    { file: 'speaking', name: 'IMG_9087', alt: 'Asking a question into a microphone at a conference' },
    { file: 'storyboard', name: 'IMG_1239', alt: 'A hand-drawn storyboard in eight panels' },
    { file: 'tv-interview', name: 'IMG_9817', alt: 'A Fox 5 San Diego interview, captioned Sage Park, Bank of America Student Leader' },
    { file: 'type-laptop', name: 'IMG_1312', alt: 'A modular typeface on a laptop screen in a studio' },
    { file: 'dinner', name: 'IMG_1793', alt: 'A selfie with friends at a dinner table with laptops out' }
  ];
  var SPEED = 40;   // how fast the photos drift, in pixels a second

  /* ---------- the clock ---------- */
  function tick() {
    var d = new Date();
    var t = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(d).toLowerCase();
    var h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23' }).format(d)) % 24;
    document.querySelectorAll('[data-clock-time]').forEach(function (e) { e.textContent = t; });
    document.querySelectorAll('.chip-sun').forEach(function (s) { s.hidden = !(h >= 6 && h < 19); });
    document.querySelectorAll('.chip-moon').forEach(function (s) { s.hidden = h >= 6 && h < 19; });
  }
  tick(); setInterval(tick, 15000);

  /* ---------- the intro arrives line by line ---------- */
  document.querySelectorAll('.about-copy > *').forEach(function (c, i) { c.style.setProperty('--i', i); });

  /* ---------- the camera roll ---------- */
  var roll = document.querySelector('[data-roll]');
  if (!roll) return;
  var view = roll.querySelector('.roll-view');
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function shot(p, copy) {
    return '<figure class="shot"' + (copy ? ' aria-hidden="true"' : '') + '><span class="bar"><span class="app-orb" aria-hidden="true"></span>' + esc(p.name) + '</span>' +
      '<img src="img/about/roll/' + p.file + '.webp" alt="' + (copy ? '' : esc(p.alt)) + '" decoding="async"></figure>';
  }
  // the photos, then a copy of them, so the strip can loop forever without a gap
  function buildRoll() {
    view.innerHTML = '<div class="roll-row">' + ROLL.map(function (p) { return shot(p); }).join('') + ROLL.map(function (p) { return shot(p, true); }).join('') + '</div>';
    tracks = [{ el: view.firstChild, x: 0, dir: -1, period: 1 }];
    measure();
    view.querySelectorAll('img').forEach(function (i) { i.addEventListener('load', measure, { once: true }); });
    wake();
  }
  // one lap is one set of photos plus the gap before its copy
  function measure() {
    tracks.forEach(function (t) {
      var gap = parseFloat(getComputedStyle(t.el).columnGap) || 0;
      t.period = Math.max(1, (t.el.scrollWidth + gap) / 2);
    });
  }

  /* ---------- how it moves ----------
     drift: linear, it's ambient. glide (the arrows): eases out, it answers a press.
     drag: follows the finger 1:1, and a flick keeps going and slows down on its own. */
  var tracks = [], paused = false, offscreen = true, hidden = false, drag = null, glide = null, fling = 0, raf = 0, last = 0;
  function moving() { return !!(glide || drag || Math.abs(fling) > .01 || (!paused && !offscreen && !hidden && !reduce)); }
  function wake() { if (!raf && moving()) { last = 0; raf = requestAnimationFrame(frame); } }
  function frame(t) {
    raf = 0;
    var dt = last ? Math.min(.05, (t - last) / 1000) : 0; last = t;
    var dx = 0;
    if (!paused && !offscreen && !hidden && !drag && !reduce) dx = SPEED * dt;
    if (!drag && Math.abs(fling) > .01) { tracks.forEach(function (tr) { tr.x += fling * dt * 1000; }); fling *= Math.pow(.94, dt * 60); }
    else if (!drag) fling = 0;
    tracks.forEach(function (tr) { tr.x += tr.dir * dx; });
    if (glide) {
      var p = Math.min(1, (t - glide.t0) / glide.ms), e = 1 - Math.pow(1 - p, 3);
      tracks.forEach(function (tr) { tr.x += (e - glide.e) * glide.by; });
      glide.e = e; if (p >= 1) glide = null;
    }
    tracks.forEach(function (tr) {
      tr.x = ((tr.x % tr.period) - tr.period) % tr.period;   // stay inside one lap, so it never runs out
      tr.el.style.transform = 'translate3d(' + tr.x.toFixed(2) + 'px,0,0)';
    });
    if (moving()) raf = requestAnimationFrame(frame);
  }
  function step(dir, fromKeys) {
    var by = -dir * Math.min(view.clientWidth * .55, 420);
    // pressed again mid-glide: carry on from where it is, adding what was left to go, so it never jumps
    if (glide) by += (1 - glide.e) * glide.by;
    fling = 0;
    glide = { t0: performance.now(), ms: reduce ? 1 : (fromKeys ? 260 : 480), by: by, e: 0 };
    wake();
  }
  roll.querySelectorAll('[data-roll-step]').forEach(function (b) { b.addEventListener('click', function (e) { step(Number(b.dataset.rollStep), e.detail === 0); }); });
  roll.addEventListener('keydown', function (e) {
    if (!e.target.closest('[data-roll-step]') && e.target !== view) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1, true); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1, true); }
  });
  view.addEventListener('pointerdown', function (e) {
    if (drag || e.button !== 0) return;   // one finger at a time
    drag = { id: e.pointerId, x: e.clientX, t: e.timeStamp, v: 0 };
    glide = null; fling = 0;
    view.setPointerCapture(e.pointerId); view.classList.add('dragging');
    wake();
  });
  view.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dt = Math.max(1, e.timeStamp - drag.t);
    drag.v = drag.v * .6 + (dx / dt) * .4;   // px per ms, smoothed
    drag.x = e.clientX; drag.t = e.timeStamp;
    tracks.forEach(function (tr) { tr.x += dx; });
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    // a flick keeps going: only if the finger was still moving when it let go
    fling = e.timeStamp - drag.t < 80 && Math.abs(drag.v) > .11 ? Math.max(-3, Math.min(3, drag.v)) : 0;
    drag = null; view.classList.remove('dragging'); wake();
  }
  view.addEventListener('pointerup', endDrag); view.addEventListener('pointercancel', endDrag);
  var pauseBtn = document.querySelector('[data-roll-pause]');
  function paintPause() { pauseBtn.setAttribute('aria-pressed', String(!paused)); pauseBtn.setAttribute('aria-label', paused ? 'Play the photos' : 'Pause the photos'); }
  pauseBtn.addEventListener('click', function () { paused = !paused; paintPause(); wake(); });
  paintPause();
  // nothing runs while it's off screen or the tab is hidden
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (e) { offscreen = !e.isIntersecting; wake(); }); }).observe(roll);
  else offscreen = false;
  document.addEventListener('visibilitychange', function () { hidden = document.hidden; wake(); });
  buildRoll();
})();
