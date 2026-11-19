/* softspot.js: the softspot case study (the side menu, progress and zoom lens are in case.js).
   - on arrival a stopwatch runs through the 36 hours of the designathon, then the app's flow plays
   - the hero's controls play, pause, restart and seek the video; nothing here moves the page
   - the message i never sent to my mom types itself out when the thread comes into view */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function mmss(t) { t = Math.max(0, t || 0); return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }

  /* ---------- the hero: the stopwatch, then the flow video ---------- */
  var hero = document.querySelector('[data-flowhero]');
  if (hero) {
    var v = hero.querySelector('video'), timer = hero.querySelector('[data-timer]'), clock = hero.querySelector('[data-clock]');
    var phases = Array.prototype.slice.call(timer.querySelectorAll('[data-at]'));
    var play = document.querySelector('[data-vplay]'), seek = document.querySelector('[data-vseek]');
    var cur = document.querySelector('[data-cur]'), dur = document.querySelector('[data-dur]');
    var running = false, raf = 0;

    function playVid() { var r = v.play(); if (r && r.catch) r.catch(function () {}); }
    function sync() { play.setAttribute('aria-pressed', String(running || !v.paused)); }
    function tick() {
      if (!v.duration) return;
      if (document.activeElement !== seek) seek.value = Math.round(v.currentTime / v.duration * 1000);
      seek.style.setProperty('--p', (seek.value / 10) + '%');
      cur.textContent = mmss(v.currentTime); dur.textContent = mmss(v.duration);
    }
    function two(n) { return String(n).padStart(2, '0'); }
    function showTime(f) {
      var s = Math.round(f * 36 * 3600);
      clock.textContent = two(Math.floor(s / 3600)) + ':' + two(Math.floor(s / 60) % 60) + ':' + two(s % 60);
      phases.forEach(function (p, i) {
        var on = f >= Number(p.getAttribute('data-at')) - 1e-3 && (i === phases.length - 1 || f < Number(phases[i + 1].getAttribute('data-at')) - 1e-3);
        p.classList.toggle('on', on);
        p.classList.toggle('done', f >= Number(p.getAttribute('data-at')) - 1e-3 && !on);
      });
    }
    function endTimer() {
      running = false; cancelAnimationFrame(raf);
      showTime(1); hero.classList.add('timed');
      v.currentTime = 0; playVid(); sync();
    }
    // the 36 hours in about three seconds: quick through the middle, settling on 36:00:00
    function runTimer() {
      cancelAnimationFrame(raf);
      v.pause(); hero.classList.remove('timed'); running = true; sync();
      var t0 = 0, D = 3200;
      (function step(now) {
        if (!running) return;
        if (!t0) t0 = now;
        var k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
        showTime(e);
        if (k < 1) raf = requestAnimationFrame(step);
        else setTimeout(function () { if (running) endTimer(); }, 650);
      })(performance.now());
    }

    play.addEventListener('click', function () {
      if (running) { endTimer(); return; }
      if (v.paused) playVid(); else v.pause();
    });
    document.querySelector('[data-vrestart]').addEventListener('click', function () {
      if (running) endTimer(); v.currentTime = 0; playVid();
    });
    seek.addEventListener('input', function () {
      if (running) endTimer();
      if (v.duration) v.currentTime = seek.value / 1000 * v.duration;
      seek.style.setProperty('--p', (seek.value / 10) + '%');
    });
    // tapping the screen while the stopwatch runs skips straight to the app
    timer.addEventListener('click', function () { if (running) endTimer(); });
    v.addEventListener('play', sync); v.addEventListener('pause', sync);
    v.addEventListener('timeupdate', tick); v.addEventListener('loadedmetadata', tick);

    if (reduce) { showTime(1); hero.classList.add('timed'); sync(); }
    else setTimeout(runTimer, 450);
    window.SPHours = function () { window.scrollTo(0, 0); runTimer(); };
  }

  /* ---------- the unsent message, typed out ---------- */
  var box = document.querySelector('[data-typing]');
  if (box) {
    var typed = box.querySelector('.typed'), full = typed.textContent;
    if (reduce || !('IntersectionObserver' in window)) return;
    typed.textContent = '';
    box.classList.add('empty');
    // a person typing: quick runs of letters, little pauses after commas, one slip that gets fixed
    var script = [], slip = full.indexOf('sorry');
    for (var i = 0; i < full.length; i++) {
      if (i === slip + 2) { script.push({ add: 'o' }, { wait: 260 }, { del: 1 }, { wait: 120 }); }
      script.push({ add: full[i] });
      if (full[i] === ',') script.push({ wait: 420 });
      if (full[i] === '.') script.push({ wait: 200 });
    }
    function type(k) {
      if (k >= script.length) { box.classList.add('done'); return; }
      var s = script[k], d;
      if (s.add) { typed.textContent += s.add; d = 38 + Math.random() * 70; }
      else if (s.del) { typed.textContent = typed.textContent.slice(0, -s.del); d = 90; }
      else d = s.wait;
      box.classList.toggle('empty', !typed.textContent);
      setTimeout(function () { type(k + 1); }, d);
    }
    var io = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      io.disconnect();
      // wait for the bubbles above it to arrive first
      setTimeout(function () { type(0); }, 1500);
    }, { threshold: 0.6 });
    io.observe(box);
  }
})();
