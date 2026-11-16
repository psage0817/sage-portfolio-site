/* home.js
   - the rotating words in the subtitle
   - the project filters
*/
(function () {
  'use strict';

  /* ---------- rotating words ----------
     Edit the lists here. The first word in each list is what shows on load
     and what screen readers hear (see the .sr-only sentence in index.html).

     Feedback was that the old rotation was hard to read, so:
     - each phrase now stays up for 5 seconds (HOLD)
     - the two slots never change together: the second one changes
       2.5 seconds after the first (OFFSET), so your eye only has to
       follow one change at a time
     - the change itself is a slow 0.7 s slide, and the slot's width
       eases to the new phrase instead of jumping
     - hovering the line pauses it, and nothing moves for people who
       ask their system for reduced motion */
  var WORDS = {
    adj: ['human-centered', 'research-led', 'type-loving'],
    tail: ['based in st. louis and san diego', 'working across ux, web and type', 'leading teams from research to final design']
  };
  var HOLD = 5000;
  var OFFSET = 2500;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var line = document.querySelector('.sub-rotate');
  var paused = false;

  function Slot(el, words) {
    this.el = el; this.words = words; this.i = 0;
    this.cur = el.querySelector('.w');
    this.el.style.width = this.cur.offsetWidth + 'px';
    this.el.classList.add('is-live');
  }
  Slot.prototype.next = function () {
    if (paused || document.hidden) return;
    this.i = (this.i + 1) % this.words.length;
    var old = this.cur;
    var nw = document.createElement('span');
    nw.className = 'w is-entering';
    nw.textContent = this.words[this.i];
    this.el.appendChild(nw);
    var width = nw.offsetWidth;
    this.el.style.width = width + 'px';
    // next frame: slide the old phrase up and the new one in from below
    requestAnimationFrame(function () {
      old.classList.add('is-leaving');
      nw.classList.remove('is-entering');
    });
    setTimeout(function () { old.remove(); }, 800);
    this.cur = nw;
  };

  if (line && !reduce) {
    var a = new Slot(line.querySelector('[data-rotate="adj"]'), WORDS.adj);
    var b = new Slot(line.querySelector('[data-rotate="tail"]'), WORDS.tail);
    setInterval(function () { a.next(); }, HOLD);
    setTimeout(function () { setInterval(function () { b.next(); }, HOLD); }, OFFSET);
    line.addEventListener('pointerenter', function () { paused = true; });
    line.addEventListener('pointerleave', function () { paused = false; });
    window.addEventListener('resize', function () {
      a.el.style.width = a.cur.offsetWidth + 'px';
      b.el.style.width = b.cur.offsetWidth + 'px';
    });
  }

  /* ---------- filters ---------- */
  var buttons = document.querySelectorAll('[data-filter]');
  var cards = document.querySelectorAll('.work-grid > [data-cat]');

  // counts next to each filter
  buttons.forEach(function (btn) {
    var f = btn.getAttribute('data-filter');
    var n = f === 'all' ? cards.length : document.querySelectorAll('.work-grid > [data-cat="' + f + '"]').length;
    var sup = btn.querySelector('sup');
    if (sup) sup.textContent = n;
  });

  // projects that aren't ready yet don't navigate anywhere
  document.querySelectorAll('.card[aria-disabled="true"]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  function apply(f) {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === f)); });
    cards.forEach(function (c) { c.hidden = !(f === 'all' || c.getAttribute('data-cat') === f); });
  }
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var f = btn.getAttribute('data-filter');
      // the grid glides into its new arrangement where the browser supports it
      if (document.startViewTransition && !reduce) document.startViewTransition(function () { apply(f); });
      else apply(f);
    });
  });
})();
