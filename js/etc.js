/* etc.js: the fine arts folder on the about page.

   YOUR ART
   Each line in ART below is one piece, in the order they sit in the folder:
   - file:  the picture: img/etc/m/<file>.webp (small, for the folder) and img/etc/l/<file>.webp (big)
   - title: its name, under the thumbnail and on its window
   - what:  medium · size · year, under the piece when it's open
   - alt:   what it shows, for people using screen readers

   The folder is drawn here. On a wide screen, js/minidesk.js opens each piece as its own window on
   the small desktop; on a phone (or a narrow window) it opens in the viewer over the page, made here. */
(function () {
  'use strict';
  var ART = [
    { file: 'find-the-yellow-paint', title: 'find the yellow paint', what: 'oil paint on canvas · 46 × 31.6 in · 2024', alt: 'A painting of a girl in a purple room lighting a small birthday cake on a box' },
    { file: 'the-pond', title: 'the pond', what: 'watercolor and ink on mulberry paper · 28.6 × 20 in · 2024', alt: 'A painting of a girl in a yellow shirt among koi fish, lilies and a small dog' },
    { file: 'alien', title: 'alien', what: 'charcoal on paper · 23.4 × 16.5 in · 2024', alt: 'A charcoal drawing of hands reaching across folded bodies' },
    { file: 'lifeline', title: 'lifeline', what: 'acrylic paint, yarn and mirror paper · 13 × 20 × 30 in · 2024', alt: 'Three generations, a child, a mother and a grandmother, painted on cut-out panels standing on a black base' },
    { file: 'the-river-of-time', title: 'the river of time', what: 'acrylic on canvas · 39 × 28 in · 2024', alt: 'A painting of an hourglass, butterflies and a waterfall pouring from a tipped paint can into a pink landscape' },
    { file: 'the-hive', title: 'the hive', what: 'acrylic on canvas · 16 × 12 in · 2024', alt: 'A painting of figures curled up inside green cells, like a honeycomb' },
    { file: 'anatomy-of-a-hug', title: 'anatomy of a hug', what: 'screenprinting on curtains, acrylic paint on plastic sheet · 39 × 46 × 18 in · 2024', alt: 'Two sheer curtain panels screenprinted with blue figures, hanging in an empty room' },
    { file: 'fish-out-of-water', title: 'fish out of water', what: 'watercolor on paper · 16.5 × 23.4 in · 2024', alt: 'A painting of Korean street signs, lanterns, goldfish and a harbour at night' },
    { file: 'labor', title: 'labor', what: 'copic multiliner pen on paper · 23.4 × 16.5 in · 2024', alt: 'A detailed pen drawing of a wrapped figure among carnations, pill packs and a pregnancy test' },
    { file: 'safe-haven', title: 'safe haven', what: 'desk, sandbag and school supplies · 64 × 18 × 18 in · 2024', alt: 'An installation of a school desk with papers and school supplies suspended in the air above a sandbag' },
    { file: 'homesick', title: 'homesick', what: 'acrylic and yarn on canvas · 12 × 24 in · 2024', alt: 'An abstract painting in bright blue, purple and pink with fine vertical lines of yarn' },
    { file: 'connected', title: 'connected', what: 'wood, acrylic boards, yarn and newspaper · 70 × 46 × 46 in · 2024', alt: 'An installation of a paper lantern strung with yarn over newspaper and red wooden poles' }
  ];
  var stage = document.querySelector('[data-etc]');
  if (!stage) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cur = 0;
  function sm(a) { return 'img/etc/m/' + a.file + '.webp'; }
  function lg(a) { return 'img/etc/l/' + a.file + '.webp'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  var ORB = {
    prev: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h2.4v14H6zM20 5v14L9.5 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.6 5H18v14h-2.4zM4 5l10.5 7L4 19z"/></svg>',
    x: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3 3 9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
  };

  /* ---------- the viewer: a player window ---------- */
  function playerHTML() {
    return '<div class="etc-win chrome">' +
      '<div class="titlebar"><span class="app-orb" aria-hidden="true"></span><span class="t" data-etc-t></span>' +
        '<span class="win-btns"><button class="win-btn" type="button" data-etc-close aria-label="Close">' + ORB.x + '</button></span></div>' +
      '<div class="screen etc-screen"><img data-etc-img alt=""></div>' +
      '<div class="etc-bar">' +
        '<div class="btns"><button class="orb" type="button" data-etc-step="-1" aria-label="Previous piece">' + ORB.prev + '</button><button class="orb" type="button" data-etc-step="1" aria-label="Next piece">' + ORB.next + '</button></div>' +
        '<div class="etc-cap"><b data-etc-title></b><span data-etc-what></span></div>' +
        '<span class="etc-count" data-etc-n></span>' +
      '</div>' +
      '</div>';
  }
  function show(win, i, fromStep) {
    cur = (i + ART.length) % ART.length;
    var a = ART[cur], img = win.querySelector('[data-etc-img]');
    var swap = function () { img.src = lg(a); img.alt = a.alt; };
    clearTimeout(img._t);
    if (fromStep && !reduce && img.getAttribute('src')) {
      // a short dip with a touch of blur, so the two pieces never sit on top of each other
      img.classList.add('out');
      img._t = setTimeout(function () { img.onload = img.onerror = function () { img.classList.remove('out'); }; swap(); }, 120);
    } else { img.onload = null; img.classList.remove('out'); swap(); }
    win.querySelector('[data-etc-t]').textContent = a.title + ' · s.park media player';
    win.querySelector('[data-etc-title]').textContent = a.title;
    win.querySelector('[data-etc-what]').textContent = a.what;
    win.querySelector('[data-etc-n]').textContent = (cur + 1) + ' / ' + ART.length;
    win.querySelectorAll('[data-etc-go]').forEach(function (b, j) {
      b.setAttribute('aria-current', String(j === cur));
      if (j === cur && fromStep) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
    });
    // the next one is ready before it's asked for
    var n = new Image(); n.src = lg(ART[(cur + 1) % ART.length]);
  }

  /* ---------- the viewer over the page ---------- */
  var dlg = document.createElement('dialog');
  dlg.className = 'etc-dialog'; dlg.setAttribute('aria-label', 'Artwork');
  dlg.innerHTML = playerHTML();
  document.body.appendChild(dlg);
  var vwin = dlg.querySelector('.etc-win');
  function open(i) { show(vwin, i); dlg.classList.remove('closing'); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
  // closing is quicker than opening, and Esc closes the same way
  function close() {
    if (reduce || !dlg.open) { dlg.close(); return; }
    dlg.classList.add('closing');
    setTimeout(function () { dlg.classList.remove('closing'); dlg.close(); }, 150);
  }
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
  dlg.addEventListener('click', function (e) {
    if (e.target === dlg || e.target.closest('[data-etc-close]')) { close(); return; }
    var s = e.target.closest('[data-etc-step]'); if (s) show(vwin, cur + Number(s.dataset.etcStep), e.detail !== 0);
  });
  // arrow keys step at once: keyboard actions don't animate
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(vwin, cur + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(vwin, cur - 1); }
  });
  // on a phone, swipe the piece left or right; a quick flick is enough
  var sw = null, scr = vwin.querySelector('.etc-screen');
  scr.addEventListener('pointerdown', function (e) { if (!sw && e.pointerType !== 'mouse') sw = { id: e.pointerId, x: e.clientX, t: e.timeStamp }; });
  scr.addEventListener('pointerup', function (e) {
    if (!sw || e.pointerId !== sw.id) return;
    var dx = e.clientX - sw.x, v = Math.abs(dx) / Math.max(1, e.timeStamp - sw.t); sw = null;
    if (Math.abs(dx) > 50 || (Math.abs(dx) > 12 && v > .11)) show(vwin, cur + (dx < 0 ? 1 : -1), true);
  });
  scr.addEventListener('pointercancel', function () { sw = null; });

  /* ---------- the folder ---------- */
  function render() {
    stage.innerHTML = '<div class="etc-files chrome"><div class="titlebar"><span class="app-orb" aria-hidden="true"></span><span class="t">etc · s.park files</span><span class="etc-meta">' + ART.length + ' items</span></div>' +
      '<div class="etc-files-in">' + ART.map(function (a, i) {
        return '<button type="button" class="etc-tile" data-etc-open="' + i + '" aria-label="' + esc(a.title) + ', open it larger">' +
          '<span class="etc-icon"><img src="' + sm(a) + '" alt="' + esc(a.alt) + '" loading="lazy"></span><span class="etc-name">' + esc(a.title) + '</span></button>';
      }).join('') + '</div></div>';
  }
  stage.addEventListener('click', function (e) {
    var o = e.target.closest('[data-etc-open]'); if (o) open(Number(o.dataset.etcOpen));
  });
  render();

  // each piece's shape, for the windows minidesk.js opens
  ART.forEach(function (a) {
    a.w = 4; a.h = 5;
    var i = new Image();
    i.onload = function () { a.w = i.naturalWidth; a.h = i.naturalHeight; a.ready = true; };
    i.onerror = function () { a.ready = true; };
    i.src = sm(a);
  });

  window.SPEtc = { ART: ART };
})();
