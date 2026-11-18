/* window.js: the window on the home page (index.html)
   - on arrival the shade is down and rolls up, then the cord sways once as it settles
   - pull the cord's weight down to lower the shade; click it to send the shade back up
   - the view behind the glass shifts a little as the cursor moves, like moving your head
     at a real window; the reflections of the room's lights move the other way
   Every control also works from the keyboard (arrow keys, Enter). */
(function () {
  'use strict';

  var room = document.querySelector('[data-room]');
  if (!room) return;
  var root = document.documentElement;
  var shade = room.querySelector('[data-shade]');
  var pane = room.querySelector('.pane');
  var weight = room.querySelector('[data-weight]');
  var reflection = room.querySelector('.reflection');
  var view = room.querySelector('.sky-view');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var drop = 0;

  function glassH() { return pane.getBoundingClientRect().height; }
  function maxDrop() { return glassH() + parseFloat(getComputedStyle(root).getPropertyValue('--frame')) || glassH(); }

  /* ---------- the shade ---------- */
  function setDrop(px, animate) {
    drop = Math.max(0, Math.min(maxDrop(), px));
    shade.classList.toggle('is-moving', !animate);
    room.style.setProperty('--drop', drop + 'px');
    var pct = Math.round(drop / maxDrop() * 100);
    weight.setAttribute('aria-valuenow', String(pct));
    weight.setAttribute('aria-valuetext', pct === 0 ? 'shade up' : pct >= 99 ? 'shade down' : 'shade ' + pct + '% down');
  }

  // arrival: the shade was drawn down by the class in the head; roll it up once the view is ready
  function arrive() {
    if (!root.classList.contains('win-arrive')) return;
    setTimeout(function () {
      root.classList.remove('win-arrive');
      try { sessionStorage.setItem('shade-up', '1'); } catch (e) {}
      setTimeout(sway, 900);
    }, 650);
  }
  function sway() {
    if (reduceMotion) return;
    room.classList.remove('is-swaying'); void room.offsetWidth; room.classList.add('is-swaying');
  }
  room.addEventListener('animationend', function () { room.classList.remove('is-swaying'); });
  if (document.readyState === 'complete') arrive(); else window.addEventListener('load', arrive);

  // pulling the cord: each pull lowers the shade by about twice the pull; the cord springs back after
  var pullStart = null, dropAtStart = 0, moved = false;
  weight.addEventListener('pointerdown', function (e) {
    pullStart = e.clientY; dropAtStart = drop; moved = false;
    weight.setPointerCapture(e.pointerId);
    room.classList.add('is-pulling');
    e.preventDefault();
  });
  weight.addEventListener('pointermove', function (e) {
    if (pullStart === null) return;
    var dy = Math.max(0, Math.min(150, e.clientY - pullStart));
    if (dy > 4) moved = true;
    room.style.setProperty('--pull', dy + 'px');
    setDrop(dropAtStart + dy * 2.4, false);
  });
  function release() {
    if (pullStart === null) return;
    pullStart = null;
    room.classList.remove('is-pulling');
    room.style.setProperty('--pull', '0px');
    if (!moved) setDrop(drop > 0 ? 0 : maxDrop() * 0.62, true);
    else sway();
  }
  weight.addEventListener('pointerup', release);
  weight.addEventListener('pointercancel', release);
  weight.addEventListener('click', function (e) { e.preventDefault(); });
  weight.addEventListener('keydown', function (e) {
    var step = maxDrop() / 10;
    if (e.key === 'ArrowDown') { setDrop(drop + step, true); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setDrop(drop - step, true); e.preventDefault(); }
    else if (e.key === 'Home') { setDrop(0, true); e.preventDefault(); }
    else if (e.key === 'End') { setDrop(maxDrop(), true); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { setDrop(drop > 0 ? 0 : maxDrop() * 0.62, true); e.preventDefault(); }
  });

  /* ---------- looking through the glass ---------- */
  // the view sits far behind the glass, so it moves a little against the cursor; the zoom keeps its edges out of sight
  var ZOOM = 0.96, SHIFT_X = 0.016, SHIFT_Y = 0.01;
  var target = [0, 0], cur = [0, 0], raf = 0;
  function pushView() {
    var g = window.SPGlass && window.SPGlass.live;
    if (g && g.setView && !(g.failed && g.failed())) {
      g.setView(cur[0], cur[1], reduceMotion ? 1 : ZOOM, 0);
    } else if (view && !reduceMotion) {
      var r = pane.getBoundingClientRect();
      view.style.transform = 'translate(' + (-cur[0] * r.width).toFixed(1) + 'px,' + (-cur[1] * r.height).toFixed(1) + 'px) scale(1.04)';
    }
    if (reflection) {
      var w = pane.getBoundingClientRect().width;
      reflection.style.setProperty('--rx', (cur[0] * w * 1.6).toFixed(1) + 'px');
      reflection.style.setProperty('--ry', (cur[1] * w * 0.6).toFixed(1) + 'px');
    }
  }
  function tick() {
    raf = 0;
    cur[0] += (target[0] - cur[0]) * 0.08;
    cur[1] += (target[1] - cur[1]) * 0.08;
    pushView();
    if (Math.abs(target[0] - cur[0]) > 1e-5 || Math.abs(target[1] - cur[1]) > 1e-5) raf = requestAnimationFrame(tick);
  }
  if (!reduceMotion) {
    room.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = pane.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      target = [Math.max(-.6, Math.min(.6, x)) * SHIFT_X, Math.max(-.6, Math.min(.6, y)) * SHIFT_Y];
      if (!raf) raf = requestAnimationFrame(tick);
    });
    room.addEventListener('pointerleave', function () { target = [0, 0]; if (!raf) raf = requestAnimationFrame(tick); });
  }
  // the glass is made by sky.js a moment after load; set the zoom as soon as it exists
  var tries = 0;
  (function waitForGlass() {
    if ((window.SPGlass && window.SPGlass.live) || tries++ > 40) { pushView(); return; }
    setTimeout(waitForGlass, 100);
  })();

  window.addEventListener('resize', function () {
    if (drop > maxDrop()) setDrop(maxDrop(), false);
  });
})();
