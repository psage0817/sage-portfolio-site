/* minidesk.js: the etc section as a small desktop (1000px and wider).
   Clicking a piece in the folder opens it as its own window on the desk instead of over the page.
   Drag any window by its title bar; whatever you touch comes to the front; the x closes a piece.
   A few pieces are already open, so the desk never starts empty: to change which, edit seed() at
   the bottom (the numbers are each piece's place in ART, in js/etc.js, counting from 0). */
(function () {
  'use strict';
  var desk = document.querySelector('[data-md]');
  if (!desk || !window.SPEtc) return;
  var ART = SPEtc.ART, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wide = function () { return innerWidth >= 1000; };
  var top = 5, opened = {}, count = 0;
  var X = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3 3 9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function front(w) { w.style.setProperty('--z', ++top); }

  // open a piece as a window; if it's already open, bring it forward
  function openArt(i, at, quiet) {
    if (opened[i]) { front(opened[i]); return; }
    var a = ART[i], ar = (a.w || 4) / (a.h || 5), h = ar > 1.2 ? 230 : 300;
    var w = Math.round(Math.max(230, Math.min(440, (h - 20) * ar + 40)));
    var dw = desk.clientWidth, dh = desk.clientHeight;
    var p = at || { x: 545 + (count % 6) * 34, y: 30 + (count % 6) * 34 };
    var el = document.createElement('section');
    el.className = 'art-win chrome' + (quiet || reduce ? '' : ' in');
    el.setAttribute('data-mwin', ''); el.setAttribute('aria-label', a.title);
    el.style.cssText = '--x:' + Math.max(0, Math.min(dw - w, p.x)) + ';--y:' + Math.max(0, Math.min(dh - h - 110, p.y)) + ';--h:' + h + 'px;width:' + w + 'px';
    el.innerHTML = '<div class="titlebar"><span class="app-orb" aria-hidden="true"></span><span class="t">' + esc(a.title) + '</span>' +
      '<span class="win-btns"><button class="win-btn" type="button" data-art-close aria-label="Close ' + esc(a.title) + '">' + X + '</button></span></div>' +
      '<div class="screen art-screen"><img src="img/etc/l/' + a.file + '.webp" alt="' + esc(a.alt) + '"></div>' +
      '<p class="art-cap"><b>' + esc(a.title) + '</b>' + esc(a.what) + '</p>';
    desk.appendChild(el); front(el);
    opened[i] = el; el._i = i; count++;
  }
  function closeArt(el) {
    delete opened[el._i];
    if (reduce) { el.remove(); return; }
    el.classList.remove('in'); el.classList.add('out');
    setTimeout(function () { el.remove(); }, 150);
  }

  // the folder's tiles open here instead of over the page
  desk.addEventListener('click', function (e) {
    var t = e.target.closest('[data-etc-open]');
    if (t && wide()) { e.stopPropagation(); openArt(Number(t.dataset.etcOpen)); return; }
    var c = e.target.closest('[data-art-close]');
    if (c) closeArt(c.closest('.art-win'));
  }, true);

  // drag by the title bar, 1:1, kept on the desk
  var drag = null;
  desk.addEventListener('pointerdown', function (e) {
    var w = e.target.closest('[data-mwin]'); if (w) front(w);
    if (!wide() || drag || e.button !== 0 || !w || e.target.closest('button, a')) return;
    var bar = e.target.closest('.titlebar'); if (!bar) return;
    drag = { w: w, id: e.pointerId, sx: e.clientX, sy: e.clientY, x: +w.style.getPropertyValue('--x'), y: +w.style.getPropertyValue('--y') };
    bar.setPointerCapture(e.pointerId); w.classList.add('dragging'); e.preventDefault();
  });
  desk.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var w = drag.w, ww = w.offsetWidth;
    var x = Math.max(-ww * .6, Math.min(desk.clientWidth - ww * .4, drag.x + e.clientX - drag.sx));
    var y = Math.max(0, Math.min(desk.clientHeight - 44, drag.y + e.clientY - drag.sy));
    w.style.setProperty('--x', Math.round(x)); w.style.setProperty('--y', Math.round(y));
  });
  function drop(e) { if (!drag || e.pointerId !== drag.id) return; drag.w.classList.remove('dragging'); drag = null; }
  desk.addEventListener('pointerup', drop); desk.addEventListener('pointercancel', drop);

  var hint = document.createElement('p'); hint.className = 'md-hint'; hint.textContent = 'drag the windows by their title bars';
  desk.appendChild(hint);

  // start with three pieces out on the desk (once their shapes are known)
  function seed() {
    if (!wide() || count) return;
    var dw = desk.clientWidth;
    openArt(0, { x: 545, y: 34 }, true);
    openArt(6, { x: Math.min(dw - 420, 800), y: 170 }, true);
    openArt(5, { x: Math.min(dw - 260, 990), y: 44 }, true);
  }
  var tries = 0;
  (function wait() { if (ART.every(function (a) { return a.ready; }) || tries++ > 40) seed(); else setTimeout(wait, 100); })();
  addEventListener('resize', function () { if (wide()) seed(); });
})();
