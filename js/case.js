/* case.js: what every case study shares.
   - the side menu of sections (from each .sec's data-name and data-icon) and the floating bar on smaller screens
   - your place in the case study, as progress bars
   - the zoom lens on .journey pictures */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) { root.classList.add('opening'); setTimeout(function () { root.classList.remove('opening'); }, 2200); }

  /* ---------- the side menu ---------- */
  var ic = window.SPIcon || function () { return '<span class="sm-ico"></span>'; };
  // built from the page: each .sec gives its id, data-name and data-icon; the banner reads the side's data-title
  var side = document.querySelector('.side');
  var SIDE = Array.prototype.map.call(document.querySelectorAll('.sec[data-name]'), function (s) { return [s.id, s.getAttribute('data-name'), s.getAttribute('data-icon') || 'doc']; });
  side.innerHTML = '<nav class="side-panel" aria-label="Sections">' +
    '<div class="sm-banner" aria-hidden="true">' + (side.getAttribute('data-title') || '') + '<small>case study</small></div>' +
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
  var chapters = document.querySelectorAll('[data-chapter]'), counts = document.querySelectorAll('[data-count]'), bars = document.querySelectorAll('[data-progress]');
  function span() { var top = main.offsetTop - innerHeight * 0.6, end = main.offsetTop + main.offsetHeight - innerHeight; return [top, Math.max(top + 1, end)]; }
  function current() {
    var y = innerHeight * 0.4, idx = 0;
    secs.forEach(function (s, i) { if (s.getBoundingClientRect().top < y) idx = i; });
    return idx;
  }
  function update() {
    var sp = span(), p = Math.min(1, Math.max(0, (scrollY - sp[0]) / (sp[1] - sp[0])));
    var i = current();
    var clip = 'inset(0 ' + ((1 - p) * 100).toFixed(1) + '% 0 0 round 99px)';
    bars.forEach(function (b) { b.style.clipPath = clip; });
    chapters.forEach(function (c) { c.textContent = secs[i].getAttribute('data-name'); });
    counts.forEach(function (c) { c.textContent = (i + 1) + ' / ' + secs.length; });
    sideLinks.forEach(function (a, k) { if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    sideBar.style.clipPath = clip;
  }
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

  /* ---------- zoom lens: any .journey picture zooms under the cursor ---------- */
  document.querySelectorAll('.journey').forEach(function (map) {
    var img = map.querySelector('img'), lens = map.querySelector('.lens'), ZOOM = 2.6;
    lens.style.backgroundImage = 'url("' + img.getAttribute('src') + '")';
    map.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = img.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) { lens.hidden = true; return; }
      lens.hidden = false;
      var lw = lens.offsetWidth, lh = lens.offsetHeight;
      // moved with a transform, so following the pointer never causes a layout
      lens.style.transform = 'translate(' + Math.min(Math.max(x - lw / 2, 0), r.width - lw) + 'px, ' + Math.min(Math.max(y - lh / 2, 0), r.height - lh) + 'px)';
      lens.style.backgroundSize = (r.width * ZOOM) + 'px ' + (r.height * ZOOM) + 'px';
      lens.style.backgroundPosition = (-(x * ZOOM - lw / 2)) + 'px ' + (-(y * ZOOM - lh / 2)) + 'px';
    });
    map.addEventListener('pointerleave', function () { lens.hidden = true; });
  });

})();
