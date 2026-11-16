/* invetty.js
   - before/after pairs: hover (or tap) the screens and the testing chat plays
   - the process list on the left follows where you are
   - the journey map zooms under your cursor
   - the flow videos can be paused
*/
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- chat pairs ---------- */
  document.querySelectorAll('.pair').forEach(function (pair) {
    var shots = pair.querySelector('.pair-shots');
    var pinned = false;
    function show(on) { pair.classList.toggle('is-talking', on); shots.setAttribute('aria-expanded', String(on)); }
    shots.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') show(true); });
    shots.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !pinned) show(false); });
    shots.addEventListener('focus', function () { show(true); });
    shots.addEventListener('blur', function () { if (!pinned) show(false); });
    shots.addEventListener('click', function () { pinned = !pinned; show(pinned || shots.matches(':hover')); });
  });

  /* ---------- process rail ---------- */
  var links = document.querySelectorAll('.rail a[href^="#"]');
  var sections = Array.prototype.map.call(links, function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + en.target.id;
          if (on) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ---------- journey map zoom ---------- */
  var map = document.querySelector('.journey');
  if (map) {
    var img = map.querySelector('img');
    var lens = map.querySelector('.lens');
    var ZOOM = 2.6;
    function place(e) {
      var r = img.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) { lens.hidden = true; return; }
      lens.hidden = false;
      var lw = lens.offsetWidth, lh = lens.offsetHeight;
      lens.style.left = Math.min(Math.max(x - lw / 2, 0), r.width - lw) + 'px';
      lens.style.top = Math.min(Math.max(y - lh / 2, 0), r.height - lh) + 'px';
      lens.style.backgroundSize = (r.width * ZOOM) + 'px ' + (r.height * ZOOM) + 'px';
      lens.style.backgroundPosition = (-(x * ZOOM - lw / 2)) + 'px ' + (-(y * ZOOM - lh / 2)) + 'px';
    }
    lens.style.backgroundImage = 'url("' + (img.currentSrc || img.src) + '")';
    map.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') place(e); });
    map.addEventListener('pointerleave', function () { lens.hidden = true; });
  }

  /* ---------- videos ---------- */
  document.querySelectorAll('.flow').forEach(function (fig) {
    var v = fig.querySelector('video');
    var btn = fig.querySelector('.flow-toggle');
    function sync() {
      var playing = !v.paused;
      btn.setAttribute('aria-label', (playing ? 'Pause ' : 'Play ') + fig.getAttribute('data-name'));
      btn.classList.toggle('is-paused', !playing);
    }
    if (reduce) { v.removeAttribute('autoplay'); v.pause(); }
    btn.addEventListener('click', function () { if (v.paused) v.play(); else v.pause(); });
    v.addEventListener('play', sync);
    v.addEventListener('pause', sync);
    sync();
  });
})();
