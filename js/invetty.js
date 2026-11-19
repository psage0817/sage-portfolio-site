/* invetty.js: the invetty case study (the side menu, progress and zoom lens are in case.js).
   - the two flow videos at the top: play, pause, restart and seek (nothing here moves the page)
   - before/after wipes (drag the bar, or hover the screen with a mouse) */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function toast(m) { if (window.SP) window.SP.toast(m); }
  /* ---------- before / after wipes ---------- */
  document.querySelectorAll('[data-wipe]').forEach(function (r) {
    var phone = r.closest('.pair-win').querySelector('.phone');
    function set() { phone.style.setProperty('--x', (100 - r.value) + '%'); r.style.setProperty('--p', r.value + '%'); }
    r.addEventListener('input', set); set();
    // with a mouse, the line follows the pointer across the screen; the bar stays the way to do it by touch or keyboard
    var screen = phone.parentNode;
    screen.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var pr = phone.getBoundingClientRect();
      r.value = Math.round(Math.min(100, Math.max(0, (pr.right - e.clientX) / pr.width * 100)));
      set();
    });
  });

  /* ---------- the two flow videos at the top ---------- */
  // the inviter flow is the longer one, so the bar and the times follow it; seeking moves both to the same point
  function mmss(t) { t = Math.max(0, t || 0); return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
  var duo = document.querySelector('[data-duo]');
  if (duo) {
    var vs = Array.prototype.slice.call(duo.querySelectorAll('video')), lead = vs[vs.length - 1];
    var dPlay = document.querySelector('[data-duo-play]'), dSeek = document.querySelector('[data-duo-seek]');
    var dCur = document.querySelector('[data-duo-cur]'), dDur = document.querySelector('[data-duo-dur]');
    if (reduce) vs.forEach(function (v) { v.removeAttribute('autoplay'); v.pause(); });
    function playing() { return vs.some(function (v) { return !v.paused; }); }
    function sync() { dPlay.setAttribute('aria-pressed', String(playing())); }
    function tick() {
      if (!lead.duration) return;
      if (document.activeElement !== dSeek) dSeek.value = Math.round(lead.currentTime / lead.duration * 1000);
      dSeek.style.setProperty('--p', (dSeek.value / 10) + '%');
      dCur.textContent = mmss(lead.currentTime); dDur.textContent = mmss(lead.duration);
    }
    function playAll() { vs.forEach(function (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }); }
    dPlay.addEventListener('click', function () { if (playing()) vs.forEach(function (v) { v.pause(); }); else playAll(); });
    document.querySelector('[data-duo-restart]').addEventListener('click', function () { vs.forEach(function (v) { v.currentTime = 0; }); playAll(); });
    dSeek.addEventListener('input', function () {
      var f = dSeek.value / 1000;
      vs.forEach(function (v) { if (v.duration) v.currentTime = Math.min(v.duration - .05, f * v.duration); });
      dSeek.style.setProperty('--p', (dSeek.value / 10) + '%');
    });
    vs.forEach(function (v) { v.addEventListener('play', sync); v.addEventListener('pause', sync); });
    lead.addEventListener('timeupdate', tick); lead.addEventListener('loadedmetadata', tick);
    sync(); tick();
  }

})();
