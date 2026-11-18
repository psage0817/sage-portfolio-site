/* case-concept.js: the invetty case study on the home page's wall (invetty-concept.html)
   - the affinity wall: the button sorts the loose notes into their groups, and back
   - iterate: each wireframe is a little shade over its final screen. Click the cord to roll
     it up (or drag the hem bar), and the testing chat plays once the final screen shows
   invetty.js still runs the process index, the journey map zoom and the videos. */
(function () {
  'use strict';

  /* ---------- the affinity wall ---------- */
  document.querySelectorAll('[data-affinity]').forEach(function (wall) {
    var btn = wall.querySelector('[data-sort]');
    btn.addEventListener('click', function () {
      var sorted = wall.getAttribute('data-state') !== 'sorted';
      wall.setAttribute('data-state', sorted ? 'sorted' : 'loose');
      btn.setAttribute('aria-pressed', String(sorted));
      btn.textContent = sorted ? 'scatter them again' : 'sort the notes into groups';
    });
  });

  /* ---------- the little shades ---------- */
  document.querySelectorAll('.shade-pair').forEach(function (pair) {
    var mini = pair.querySelector('[data-mini]');
    var cord = mini.querySelector('.mini-cord');
    var hem = mini.querySelector('.mini-hem');
    var glass = mini.querySelector('.mini-glass');
    var up = 0;

    function set(v, settle) {
      up = Math.max(0, Math.min(1, v));
      mini.style.setProperty('--up', up.toFixed(3));
      var open = up > 0.6;
      mini.classList.toggle('is-up', open);
      cord.setAttribute('aria-pressed', String(open));
      cord.setAttribute('aria-label', open ? 'Lower the before screen again' : 'Roll up the before screen to see the after');
      if (settle) pair.classList.toggle('is-talking', open);
    }

    cord.addEventListener('click', function () { set(up > 0.6 ? 0 : 1, true); });

    // drag the hem bar up: the wireframe follows, then settles open or shut
    var start = null, from = 0;
    hem.addEventListener('pointerdown', function (e) {
      start = e.clientY; from = up;
      hem.setPointerCapture(e.pointerId);
      mini.classList.add('is-dragging');
      e.preventDefault();
    });
    hem.addEventListener('pointermove', function (e) {
      if (start === null) return;
      set(from + (start - e.clientY) / glass.getBoundingClientRect().height, false);
    });
    function end() {
      if (start === null) return;
      start = null;
      mini.classList.remove('is-dragging');
      set(up > 0.3 ? 1 : 0, true);
    }
    hem.addEventListener('pointerup', end);
    hem.addEventListener('pointercancel', end);
  });
})();
