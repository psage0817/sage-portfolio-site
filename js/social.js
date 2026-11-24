/* social.js: the Instagram-style posts.
   - carousels: the arrows, the arrow keys, or a swipe that follows your finger (a quick flick is enough);
     the count on the picture and the dots under it follow along, like on Instagram
   - the heart and the bookmark toggle; comment and share open the post on Instagram */
(function () {
  'use strict';
  document.querySelectorAll('[data-post]').forEach(function (post) {
    // a long caption shows two lines, then "more" opens the rest
    var cap = post.querySelector('.ig-cap'), more = cap && cap.querySelector('.ig-more-btn');
    if (cap && more) {
      cap.classList.add('clamp');
      var p = cap.querySelector('p');
      if (p.scrollHeight > p.clientHeight + 2) { more.hidden = false; more.addEventListener('click', function () { cap.classList.remove('clamp'); more.hidden = true; }); }
      else cap.classList.remove('clamp');
    }
    post.querySelectorAll('.ig-like, .ig-save').forEach(function (b) {
      b.addEventListener('click', function () { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });
    });
    var screen = post.querySelector('.post-screen'), track = post.querySelector('.post-track'), n = track.children.length;
    if (n < 2) return;
    var i = 0, prev = post.querySelector('[data-pprev]'), next = post.querySelector('[data-pnext]');
    var count = post.querySelector('[data-pcount]'), dots = post.querySelectorAll('.ig-dots i');
    function show(k) {
      i = Math.max(0, Math.min(n - 1, k));
      track.style.transform = 'translateX(' + (-i * 100) + '%)';
      count.textContent = (i + 1) + '/' + n;
      dots.forEach(function (d, j) { d.classList.toggle('on', j === i); });
      prev.hidden = i === 0; next.hidden = i === n - 1;
      var nx = track.children[i + 1]; if (nx) nx.loading = 'eager';
    }
    prev.addEventListener('click', function () { show(i - 1); });
    next.addEventListener('click', function () { show(i + 1); });
    screen.tabIndex = 0;
    screen.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); } if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); } });

    // drag: 1:1 with the finger, softer past the first and last slide, a flick counts
    var x0 = 0, y0 = 0, t0 = 0, dx = 0, w = 1, down = false, horiz = null;
    screen.addEventListener('pointerdown', function (e) {
      if (e.button || e.target.closest('button')) return;
      down = true; horiz = null; x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); dx = 0; w = screen.offsetWidth;
    });
    screen.addEventListener('pointermove', function (e) {
      if (!down) return;
      var mx = e.clientX - x0, my = e.clientY - y0;
      if (horiz === null) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; horiz = Math.abs(mx) > Math.abs(my); if (horiz) { screen.setPointerCapture(e.pointerId); screen.classList.add('dragging'); } }
      if (!horiz) return;
      dx = mx;
      var d = (i === 0 && dx > 0) || (i === n - 1 && dx < 0) ? dx * 0.35 : dx;
      track.style.transform = 'translateX(calc(' + (-i * 100) + '% + ' + d + 'px))';
    });
    function end() {
      if (!down) return; down = false;
      if (!horiz) return;
      screen.classList.remove('dragging');
      var v = Math.abs(dx) / Math.max(1, performance.now() - t0);
      show(Math.abs(dx) > w * 0.22 || v > 0.11 ? i + (dx < 0 ? 1 : -1) : i);
    }
    screen.addEventListener('pointerup', end);
    screen.addEventListener('pointercancel', end);
    show(0);
  });
})();
