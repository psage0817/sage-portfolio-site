/* aero.js: small things every page shares.
   - the toast (window.SP.toast)
   - remembers day or night from the home page's window, for the other pages
   - segmented controls get one thumb that slides to the chosen option, like iOS
   - things below the first screen arrive as you scroll to them: windows rise and their screens
     switch on, notes slide out from behind their player, notifications drop in, bubbles pop */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- toast ---------- */
  var toastEl = document.querySelector('.toast'), toastT = 0;
  function toast(m) {
    if (!toastEl) return;
    toastEl.textContent = m; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 2200);
  }
  window.SP = window.SP || {};
  window.SP.toast = toast;

  /* ---------- day or night, for pages without the window ---------- */
  if (document.querySelector('[data-sky]') && 'MutationObserver' in window) {
    new MutationObserver(function () {
      try { localStorage.setItem('sp-theme', JSON.stringify({ v: root.getAttribute('data-theme'), t: Date.now() })); } catch (e) {}
    }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* ---------- segmented controls ---------- */
  document.querySelectorAll('.seg').forEach(function (seg) {
    var thumb = document.createElement('span');
    thumb.className = 'seg-thumb'; thumb.setAttribute('aria-hidden', 'true');
    seg.insertBefore(thumb, seg.firstChild);
    seg.classList.add('has-thumb');
    function place(animate) {
      var b = seg.querySelector('button[aria-pressed="true"]');
      if (!b || !b.offsetWidth) { thumb.style.opacity = '0'; return; }
      if (!animate || reduce) thumb.style.transition = 'none';
      thumb.style.opacity = '1';
      thumb.style.left = b.offsetLeft + 'px'; thumb.style.top = b.offsetTop + 'px';
      thumb.style.width = b.offsetWidth + 'px'; thumb.style.height = b.offsetHeight + 'px';
      if (!animate || reduce) { void thumb.offsetWidth; thumb.style.transition = ''; }
    }
    if ('MutationObserver' in window) new MutationObserver(function () { place(true); }).observe(seg, { attributes: true, subtree: true, attributeFilter: ['aria-pressed'] });
    if ('ResizeObserver' in window) new ResizeObserver(function () { place(false); }).observe(seg);
    window.addEventListener('resize', function () { place(false); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(false); });
    place(false);
  });

  /* ---------- arriving as you scroll ---------- */
  if (reduce || !('IntersectionObserver' in window)) return;
  // [what, how it arrives, the group it staggers within, gap between each one in ms]
  var KINDS = [
    ['.projects > .proj > .mini', '', null, 0],
    ['.projects > .proj > .memo', 'rv-side', null, 0],
    ['.soon-row > .proj', '', '.soon-row', 90],
    ['.hi-grid .paint, .hi-grid .hi-memo, .hi-grid .np', '', '.hi-grid', 110],
    ['.viewer, .pair-win, .persona, .findings, .next, .upnext, .notepad, .ss-research > .memo', '', null, 0],
    ['.ss-overview > .memo, .ss-overview > .imsg', '', '.ss-overview', 120],
    ['.ss-why > .photo, .ss-why > .memo, .ss-why > .imsg', '', '.ss-why', 120],
    ['.ss-people > .contact', '', '.ss-people', 120],
    ['.made-row .made-t', '', null, 0],
    ['.screens img', '', '.screens', 90],
    ['.flows > .flow', '', '.flows', 110],
    ['.reflect > .memo', '', '.reflect', 110],
    ['.lock .notif', 'rv-drop', '.lock', 140],
    ['.voices .bubble, .chat .bubble, .imsg-thread .bubble', 'rv-pop', '.voices, .chat, .imsg-thread', 220]
  ];
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      io.unobserve(el);
      el.classList.add('in');
      // once it has arrived, hand the element back to its own hover transitions
      setTimeout(function () { el.classList.remove('rv', 'rv-side', 'rv-drop', 'rv-pop', 'from-right', 'in'); el.style.removeProperty('--d'); }, 1400);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  KINDS.forEach(function (k) {
    document.querySelectorAll(k[0]).forEach(function (el) {
      // things already on screen when the page opens stay put
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      el.classList.add('rv');
      if (k[1]) el.classList.add(k[1]);
      // a note on the left of its player slides out to the left, one on the right to the right
      if (k[1] === 'rv-side') {
        var mini = el.parentNode.querySelector('.mini');
        if (mini && mini.getBoundingClientRect().left > el.getBoundingClientRect().left) el.classList.add('from-right');
      }
      if (k[2]) {
        var group = el.closest(k[2]);
        var mates = group ? Array.prototype.slice.call(group.querySelectorAll(k[0])) : [el];
        el.style.setProperty('--d', (mates.indexOf(el) * k[3]) + 'ms');
      }
      io.observe(el);
    });
  });
})();
