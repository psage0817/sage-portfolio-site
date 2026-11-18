/* home.js: the home page.
   - the opening: the window opens, its screen switches on and the day plays up to now
   - the transport: play/pause holds the waves and the train, previous/next swap the city,
     the seek bar is the time of day; the clock in the menu bar opens the same slider
   - minimize and full screen in the title bar, the rotating words, the work filters */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function toast(m) { if (window.SP) window.SP.toast(m); }

  /* the seek bar is the time of day: fill it up to the thumb */
  var range = document.getElementById('sky-time');
  function fill() { range.style.setProperty('--p', (range.value / 1439 * 100).toFixed(2) + '%'); }
  range.addEventListener('input', fill);
  setInterval(fill, 500); fill();

  /* previous / next: the other city */
  var picks = { sd: document.querySelector('[data-pick-city="sd"]'), stl: document.querySelector('[data-pick-city="stl"]') };
  function city() { return document.querySelector('[data-sky]').getAttribute('data-city'); }
  document.querySelectorAll('[data-city-step]').forEach(function (b) {
    b.addEventListener('click', function () { (city() === 'sd' ? picks.stl : picks.sd).click();  });
  });

  /* play / pause the waves and the train */
  var play = document.querySelector('[data-play]');
  play.addEventListener('click', function () {
    var on = play.getAttribute('aria-pressed') !== 'true';
    play.setAttribute('aria-pressed', String(on));
    window.SPGlassPaused = !on;
  });

  /* minimize / widen */
  var desk = document.querySelector('.desk'), heroP = document.querySelector('.hero-player');
  document.querySelector('.win-min').addEventListener('click', function () {
    var on = heroP.classList.toggle('is-min'); this.setAttribute('aria-pressed', String(on));
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 480);
  });
  document.querySelector('.win-max').addEventListener('click', function () {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else heroP.requestFullscreen().catch(function () { toast('full screen isn’t available here'); });
    } catch (e) { toast('full screen isn’t available here'); }
  });

  /* the opening: the window opens, its screen switches on and the day plays from nine hours ago up to now.
     Grab the seek bar or draw on the glass to take over. */
  var h1 = document.querySelector('.hero-copy h1');
  h1.innerHTML = h1.textContent.split(' ').map(function (w, i) { return '<span class="w" style="--i:' + i + '">' + w + '</span>'; }).join(' ');
  var nowBtn = document.querySelector('[data-now]'), lapseOn = false;
  function lapse(dur) {
    nowBtn.click();
    var target = Number(range.value), start = target - 540, t0 = 0;
    lapseOn = true; heroP.classList.add('lapsing');
    function step(now) {
      if (!lapseOn) return;
      if (!t0) t0 = now;
      var k = Math.min(1, (now - t0) / dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      var v = Math.round(start + (target - start) * e);
      range.value = ((v % 1440) + 1440) % 1440;
      range.dispatchEvent(new Event('input')); fill();
      if (k < 1) requestAnimationFrame(step); else endLapse(true);
    }
    requestAnimationFrame(step);
  }
  function endLapse(toNow) { if (!lapseOn) return; lapseOn = false; heroP.classList.remove('lapsing'); if (toNow) nowBtn.click(); }
  range.addEventListener('pointerdown', function () { endLapse(false); });
  range.addEventListener('keydown', function () { endLapse(false); });
  document.querySelector('[data-sky]').addEventListener('pointerdown', function () { endLapse(true); });
  function intro() {
    if (reduce) return;
    endLapse(false);
    root.classList.remove('opening'); void heroP.offsetWidth;
    root.classList.add('opening', 'screen-off');
    clearTimeout(window.__openT); window.__openT = setTimeout(function () { root.classList.remove('opening'); }, 2600);
    var t0 = performance.now(), c = document.querySelector('[data-sky]').getAttribute('data-city') || 'sd';
    // the screen stays off until this city's photos are in, so the day never plays over a half-loaded view
    function load(src) { return new Promise(function (ok) { var im = new Image(); im.onload = im.onerror = function () { ok(); }; im.src = src; }); }
    var ready = Promise.all(['day', 'sunset', 'night'].map(function (k) { return load('img/sky/' + c + '-' + k + '.jpg'); }));
    var cap = new Promise(function (ok) { setTimeout(ok, 5000); });
    Promise.race([ready, cap]).then(function () {
      setTimeout(function () { root.classList.remove('screen-off'); lapse(3600); }, Math.max(350, 900 - (performance.now() - t0)));
    });
  }
  window.SPIntro = function () { window.scrollTo(0, 0); intro(); };

  /* the time slider in the menu bar: the same time as the big seek bar */
  var clockBtn = document.querySelector('.clock'), pop = document.getElementById('clock-pop'), mini = document.getElementById('mini-time');
  function syncMini() {
    if (document.activeElement !== mini) mini.value = range.value;
    mini.style.setProperty('--p', (mini.value / 1439 * 100).toFixed(2) + '%');
    pop.querySelectorAll('[data-go-city]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-go-city') === city())); });
  }
  function setPop(on) { pop.hidden = !on; clockBtn.setAttribute('aria-expanded', String(on)); if (on) syncMini(); }
  clockBtn.addEventListener('click', function () { setPop(pop.hidden); });
  document.addEventListener('pointerdown', function (e) { if (!pop.hidden && !e.target.closest('.clock-wrap')) setPop(false); });
  pop.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setPop(false); clockBtn.focus(); } });
  mini.addEventListener('input', function () { endLapse(false); range.value = mini.value; range.dispatchEvent(new Event('input')); fill(); syncMini(); });
  pop.querySelector('[data-now-proxy]').addEventListener('click', function () { nowBtn.click(); syncMini(); });
  pop.querySelectorAll('[data-go-city]').forEach(function (b) { b.addEventListener('click', function () { picks[b.getAttribute('data-go-city')].click(); syncMini();  }); });
  setInterval(function () { if (!pop.hidden) syncMini(); }, 400);
  range.addEventListener('input', function () { if (!pop.hidden) syncMini(); });
  intro();

  /* the rotating words, one slot at a time */
  var WORDS = {
    adj: ['human centered', 'coffee addicted', 'animal loving', 'music obsessed'],
    tail: ['is based in st. louis and san diego', 'has too many tabs open', 'loooves to sing', 'always takes the scenic route']
  };
  var idx = { adj: 0, tail: 0 }, turn = 0;
  if (!reduce) setInterval(function () {
    var key = turn++ % 2 ? 'tail' : 'adj', el = document.querySelector('[data-rotate="' + key + '"]');
    el.classList.add('out');
    setTimeout(function () { idx[key] = (idx[key] + 1) % WORDS[key].length; el.textContent = WORDS[key][idx[key]]; el.classList.remove('out'); }, 360);
  }, 3200);

  /* filters */
  var projs = document.querySelectorAll('.proj');
  document.querySelectorAll('[data-filter]').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-filter');
      document.querySelectorAll('[data-filter]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      projs.forEach(function (p) { p.hidden = f !== 'all' && p.getAttribute('data-cat') !== f; });
    });
  });

})();
