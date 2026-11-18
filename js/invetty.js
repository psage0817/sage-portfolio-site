/* invetty.js: the invetty case study.
   - the side menu of sections, the seek bar and the floating bar: your place in the case study
   - before/after wipes (drag the bar, or hover the screen with a mouse)
   - the journey map zooms under your cursor; the flow videos play, pause and seek */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function toast(m) { if (window.SP) window.SP.toast(m); }
  if (!reduce) { root.classList.add('opening'); setTimeout(function () { root.classList.remove('opening'); }, 2200); }

  /* ---------- the side menu ---------- */
  var ic = window.SPIcon || function () { return '<span class="sm-ico"></span>'; };
  var SIDE = [['s-intro', 'overview', 'doc'], ['s-research', 'research', 'chat'], ['s-define', 'define', 'person'], ['s-ideate', 'ideate', 'bulb'], ['s-iterate', 'iterate', 'phones'], ['s-outcome', 'outcome', 'star']];
  var side = document.querySelector('.side');
  side.innerHTML = '<nav class="side-panel" aria-label="Sections">' +
    '<div class="sm-banner" aria-hidden="true">invetty<small>case study</small></div>' +
    '<div class="side-body"><ul class="sm-list">' +
    SIDE.map(function (x, k) { return '<li><a class="sm-row" href="#' + x[0] + '">' + ic(x[2]) + '<span>' + x[1] + '</span><span class="sm-note">' + (k + 1) + '</span></a></li>'; }).join('') +
    '</ul><div class="sm-sep" role="separator"></div>' +
    '<div class="side-progress"><span data-count>1 / 6</span><div class="pl-bar" aria-hidden="true"><i data-side-bar></i></div></div>' +
    '<div class="sm-sep" role="separator"></div><ul class="sm-list">' +
    '<li><a class="sm-row" href="index.html#work">' + ic('folder') + '<span>all work</span><span></span></a></li>' +
    '<li><a class="sm-row" href="#top">' + ic('up') + '<span>back to the top</span><span></span></a></li>' +
    '</ul></div></nav>';
  var sideLinks = side.querySelectorAll('a[href^="#s-"]'), sideBar = side.querySelector('[data-side-bar]');

  /* ---------- your place in the case study ---------- */
  var secs = Array.prototype.slice.call(document.querySelectorAll('.sec[data-name]'));
  var main = document.querySelector('.case');
  var seeks = document.querySelectorAll('[data-seek]'), chapters = document.querySelectorAll('[data-chapter]');
  var counts = document.querySelectorAll('[data-count]');
  var dragging = false;
  function span() { var top = main.offsetTop - innerHeight * 0.6, end = main.offsetTop + main.offsetHeight - innerHeight; return [top, Math.max(top + 1, end)]; }
  function current() {
    var y = innerHeight * 0.4, idx = 0;
    secs.forEach(function (s, i) { if (s.getBoundingClientRect().top < y) idx = i; });
    return idx;
  }
  function update() {
    var sp = span(), p = Math.min(1, Math.max(0, (scrollY - sp[0]) / (sp[1] - sp[0])));
    var i = current();
    seeks.forEach(function (r) { if (!(dragging && r === document.activeElement)) r.value = Math.round(p * 1000); r.style.setProperty('--p', (r.value / 10) + '%'); });
    chapters.forEach(function (c) { c.textContent = secs[i].getAttribute('data-name'); });
    counts.forEach(function (c) { c.textContent = (i + 1) + ' / ' + secs.length; });
    sideLinks.forEach(function (a, k) { if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    sideBar.style.width = (p * 100).toFixed(1) + '%';
  }
  seeks.forEach(function (r) {
    r.addEventListener('pointerdown', function () { dragging = true; });
    r.addEventListener('pointerup', function () { dragging = false; });
    r.addEventListener('input', function () {
      var sp = span(); window.scrollTo({ top: sp[0] + (sp[1] - sp[0]) * r.value / 1000, behavior: 'auto' });
      r.style.setProperty('--p', (r.value / 10) + '%');
    });
  });
  document.querySelectorAll('[data-step]').forEach(function (b) {
    b.addEventListener('click', function () {
      var i = current(), atTop = scrollY < main.offsetTop - innerHeight * 0.6;
      var to = atTop ? 0 : Math.min(secs.length - 1, Math.max(0, i + Number(b.getAttribute('data-step'))));
      if (atTop && Number(b.getAttribute('data-step')) < 0) return;
      secs[to].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  });
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();

  /* the dock comes up once the big player has scrolled away */
  var dock = document.querySelector('.dock'), heroT = document.querySelector('.case-player .transport'), lobby = document.getElementById('contact');
  if ('IntersectionObserver' in window) {
    var heroGone = false, atEnd = false;
    function setDock() { var on = heroGone && !atEnd; dock.classList.toggle('on', on); root.classList.toggle('has-dock', on); }
    new IntersectionObserver(function (en) { heroGone = !en[0].isIntersecting && en[0].boundingClientRect.top < 0; setDock(); }).observe(heroT);
    new IntersectionObserver(function (en) { atEnd = en[0].isIntersecting; setDock(); }, { rootMargin: '0px 0px -30% 0px' }).observe(lobby);
  }

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

  /* ---------- journey map zoom ---------- */
  var map = document.querySelector('.journey');
  if (map) {
    var img = map.querySelector('img'), lens = map.querySelector('.lens'), ZOOM = 2.6;
    lens.style.backgroundImage = 'url("' + img.getAttribute('src') + '")';
    map.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = img.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) { lens.hidden = true; return; }
      lens.hidden = false;
      var lw = lens.offsetWidth, lh = lens.offsetHeight;
      lens.style.left = Math.min(Math.max(x - lw / 2, 0), r.width - lw) + 'px';
      lens.style.top = Math.min(Math.max(y - lh / 2, 0), r.height - lh) + 'px';
      lens.style.backgroundSize = (r.width * ZOOM) + 'px ' + (r.height * ZOOM) + 'px';
      lens.style.backgroundPosition = (-(x * ZOOM - lw / 2)) + 'px ' + (-(y * ZOOM - lh / 2)) + 'px';
    });
    map.addEventListener('pointerleave', function () { lens.hidden = true; });
  }

  /* ---------- the flow videos: real play, pause and seek ---------- */
  function mmss(t) { t = Math.max(0, t || 0); return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
  document.querySelectorAll('.flow').forEach(function (f) {
    var v = f.querySelector('video'), b = f.querySelector('[data-vplay]'), r = f.querySelector('[data-vseek]'), cur = f.querySelector('[data-cur]'), dur = f.querySelector('[data-dur]');
    if (reduce) { v.removeAttribute('autoplay'); v.pause(); }
    function sync() { b.setAttribute('aria-pressed', String(!v.paused)); }
    function tick() { if (v.duration) { r.value = Math.round(v.currentTime / v.duration * 1000); r.style.setProperty('--p', (r.value / 10) + '%'); cur.textContent = mmss(v.currentTime); dur.textContent = mmss(v.duration); } }
    b.addEventListener('click', function () { if (v.paused) v.play(); else v.pause(); });
    r.addEventListener('input', function () { if (v.duration) v.currentTime = r.value / 1000 * v.duration; r.style.setProperty('--p', (r.value / 10) + '%'); });
    v.addEventListener('play', sync); v.addEventListener('pause', sync); v.addEventListener('timeupdate', tick); v.addEventListener('loadedmetadata', tick);
    sync();
  });

})();
