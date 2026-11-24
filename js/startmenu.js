/* startmenu.js: the start menu and the sticky menu bar, shared by every page.
   Each page sets window.SPMenu (its items) before loading this file.
   An item: { label, key (the underlined letter), icon, href, external, action, note, disabled, current, sub: [...] }, or 'sep'. */
(function () {
  'use strict';
  var root = document.documentElement;
  var bar = document.querySelector('.menubar');
  var items = window.SPMenu || [];
  if (!bar) return;

  /* ---------- icons: small glossy drawings in one family ---------- */
  var gloss = '<path d="M5 4.5h14a2 2 0 0 1 2 2V9c-5 1.6-11 1.6-18 0V6.5a2 2 0 0 1 2-2z" fill="#fff" opacity=".35"/>';
  var ICONS = {
    folder: '<svg viewBox="0 0 24 24"><defs><linearGradient id="i-fo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE59A"/><stop offset="1" stop-color="#F3B21E"/></linearGradient></defs><path d="M2.5 7A1.5 1.5 0 0 1 4 5.5h5l2 2h9A1.5 1.5 0 0 1 21.5 9v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18z" fill="url(#i-fo)" stroke="#C88A0E" stroke-width=".8"/><path d="M3.2 10h17.6" stroke="#fff" stroke-opacity=".75" stroke-width="1.1"/></svg>',
    'folder-dim': '<svg viewBox="0 0 24 24"><path d="M2.5 7A1.5 1.5 0 0 1 4 5.5h5l2 2h9A1.5 1.5 0 0 1 21.5 9v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18z" fill="#D9DEE4" stroke="#A9B2BC" stroke-width=".8"/><path d="M3.2 10h17.6" stroke="#fff" stroke-opacity=".8" stroke-width="1.1"/></svg>',
    person: '<svg viewBox="0 0 24 24"><defs><linearGradient id="i-pe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FDCFA"/><stop offset="1" stop-color="#1688CC"/></linearGradient></defs><circle cx="12" cy="8" r="4.2" fill="url(#i-pe)" stroke="#0E6AA6" stroke-width=".7"/><path d="M3.8 20.5c.8-4.3 4.2-6.8 8.2-6.8s7.4 2.5 8.2 6.8z" fill="url(#i-pe)" stroke="#0E6AA6" stroke-width=".7"/><ellipse cx="11" cy="6.4" rx="2.2" ry="1.2" fill="#fff" opacity=".55"/></svg>',
    view: '<svg viewBox="0 0 24 24"><defs><linearGradient id="i-vi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7CCBF5"/><stop offset=".62" stop-color="#CDEBFA"/><stop offset=".62" stop-color="#E8D6B4"/><stop offset="1" stop-color="#C8AE84"/></linearGradient></defs><rect x="2.5" y="4" width="19" height="16" rx="2.5" fill="url(#i-vi)" stroke="#4B6E8C" stroke-width=".9"/><circle cx="16.5" cy="8.5" r="2" fill="#FFF3C4"/><path d="M2.6 15.5c3-2 6-2.5 9-1.2s6 1.2 9.8-.6" stroke="#4E8FB8" stroke-width="1.2" fill="none"/>' + gloss + '</svg>',
    music: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#15181D" stroke="#000" stroke-width=".6"/><circle cx="12" cy="12" r="7" fill="none" stroke="#2A2F37" stroke-width=".8"/><circle cx="12" cy="12" r="5" fill="none" stroke="#2A2F37" stroke-width=".8"/><circle cx="12" cy="12" r="3" fill="var(--accent, #1A9FDB)"/><circle cx="12" cy="12" r=".9" fill="#15181D"/><path d="M6 6.5a8 8 0 0 1 6-2.5" stroke="#fff" stroke-opacity=".35" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><defs><linearGradient id="i-ma" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE7F1"/></linearGradient></defs><rect x="2.5" y="5.5" width="19" height="13" rx="2" fill="url(#i-ma)" stroke="#5E7C98" stroke-width=".9"/><path d="M3.2 6.6l8.8 6.6 8.8-6.6" fill="none" stroke="#1A88CC" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    up: '<svg viewBox="0 0 24 24"><defs><radialGradient id="i-up" cx=".5" cy=".85" r=".8"><stop offset="0" stop-color="#B9F09A"/><stop offset="1" stop-color="#3E9E2A"/></radialGradient></defs><circle cx="12" cy="12" r="9.5" fill="url(#i-up)" stroke="#2C7A1C" stroke-width=".8"/><path d="M12 16.5V8M8.2 11.5 12 7.7l3.8 3.8" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="12" cy="7" rx="6" ry="3" fill="#fff" opacity=".3"/></svg>',
    play: '<svg viewBox="0 0 24 24"><defs><radialGradient id="i-pl" cx=".5" cy=".85" r=".8"><stop offset="0" stop-color="#9FE3FF"/><stop offset="1" stop-color="#127FC2"/></radialGradient></defs><circle cx="12" cy="12" r="9.5" fill="url(#i-pl)" stroke="#0C5F94" stroke-width=".8"/><path d="M10 8.2v7.6l6-3.8z" fill="#fff"/><ellipse cx="12" cy="7" rx="6" ry="3" fill="#fff" opacity=".3"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#fff" stroke="#5E7C98" stroke-width="1"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#DCE7F1" stroke-width="1.2"/><path d="M12 7v5l3.4 2" stroke="#14283D" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="12" cy="12" r="1" fill="#E0412F"/></svg>',
    doc: '<svg viewBox="0 0 24 24"><defs><linearGradient id="i-do" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E2EAF2"/></linearGradient></defs><path d="M6 2.8h8l4.2 4.2V20a1.2 1.2 0 0 1-1.2 1.2H6A1.2 1.2 0 0 1 4.8 20V4A1.2 1.2 0 0 1 6 2.8z" fill="url(#i-do)" stroke="#5E7C98" stroke-width=".9"/><path d="M14 2.8V7h4.2" fill="#C9D6E3" stroke="#5E7C98" stroke-width=".9" stroke-linejoin="round"/><path d="M7.5 11h8M7.5 14h8M7.5 17h5" stroke="#1A88CC" stroke-width="1.2" stroke-linecap="round"/></svg>',
    home: '<svg viewBox="0 0 24 24"><defs><linearGradient id="i-ho" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE7F1"/></linearGradient></defs><path d="M3.5 11 12 3.8 20.5 11" fill="none" stroke="#C0392B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10v9.5h13V10" fill="url(#i-ho)" stroke="#5E7C98" stroke-width=".9"/><rect x="10" y="13.5" width="4" height="6" rx=".6" fill="#1A88CC"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8" y="7.5" width="12" height="13.5" rx="2" fill="#fff" stroke="#5E7C98" stroke-width=".9"/><path d="M15.5 4.5V4A1.5 1.5 0 0 0 14 2.5H5.5A1.5 1.5 0 0 0 4 4v11A1.5 1.5 0 0 0 5.5 16.5H6" fill="none" stroke="#5E7C98" stroke-width=".9"/><path d="M11 12h6M11 15h6M11 18h4" stroke="#1A88CC" stroke-width="1.2" stroke-linecap="round"/></svg>',
    case: '<svg viewBox="0 0 24 24"><defs><linearGradient id="i-ca" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C79A6A"/><stop offset="1" stop-color="#8A5E34"/></linearGradient></defs><rect x="2.5" y="7" width="19" height="12.5" rx="2" fill="url(#i-ca)" stroke="#5E3D1E" stroke-width=".8"/><path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7" fill="none" stroke="#5E3D1E" stroke-width="1.2"/><path d="M2.6 12.5h18.8" stroke="#5E3D1E" stroke-width=".8"/><rect x="10.5" y="11.3" width="3" height="2.4" rx=".5" fill="#F3D27A"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><defs><linearGradient id="i-cm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3F5F8"/><stop offset="1" stop-color="#B8C2CD"/></linearGradient></defs><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.8l1.5-2h6.4l1.5 2h2.8A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" fill="url(#i-cm)" stroke="#5E6B78" stroke-width=".9"/><circle cx="12" cy="13" r="4" fill="#1D2733" stroke="#5E6B78" stroke-width=".8"/><circle cx="12" cy="13" r="2" fill="#2F6E9E"/><circle cx="11.2" cy="12.2" r=".7" fill="#fff" opacity=".8"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><defs><linearGradient id="i-ch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FDCFA"/><stop offset="1" stop-color="#1688CC"/></linearGradient></defs><path d="M3 5.5A2 2 0 0 1 5 3.5h9a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H8.5L5 15.5v-3A2 2 0 0 1 3 10.5z" fill="#fff" stroke="#5E7C98" stroke-width=".9"/><path d="M9.5 11.5a2 2 0 0 1 2-2H19a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2v2.8L15.6 18h-4.1a2 2 0 0 1-2-2z" fill="url(#i-ch)" stroke="#0E6AA6" stroke-width=".8"/><ellipse cx="15" cy="11.2" rx="4" ry="1.1" fill="#fff" opacity=".45"/></svg>',
    bulb: '<svg viewBox="0 0 24 24"><defs><radialGradient id="i-bu" cx=".42" cy=".35" r=".7"><stop offset="0" stop-color="#FFF6C8"/><stop offset="1" stop-color="#F4B21C"/></radialGradient></defs><path d="M12 2.8a6.6 6.6 0 0 0-3.9 11.9c.6.5.9 1.1.9 1.8v.8h6v-.8c0-.7.3-1.3.9-1.8A6.6 6.6 0 0 0 12 2.8z" fill="url(#i-bu)" stroke="#B9800C" stroke-width=".8"/><rect x="9" y="17.3" width="6" height="3.2" rx="1" fill="#C6CFD8" stroke="#6F7C88" stroke-width=".7"/><path d="M9.3 18.9h5.4" stroke="#6F7C88" stroke-width=".6"/><ellipse cx="10.4" cy="6.6" rx="1.8" ry="1.1" fill="#fff" opacity=".7"/></svg>',
    phones: '<svg viewBox="0 0 24 24"><defs><linearGradient id="i-ph" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5D5A9A"/><stop offset="1" stop-color="#25234A"/></linearGradient></defs><rect x="2.8" y="4" width="8.2" height="15.5" rx="1.8" fill="#E3E7EC" stroke="#7D8894" stroke-width=".9"/><rect x="4" y="6.2" width="5.8" height="10.6" rx=".6" fill="#B9C2CC"/><rect x="13" y="4" width="8.2" height="15.5" rx="1.8" fill="url(#i-ph)" stroke="#1B1A38" stroke-width=".9"/><rect x="14.4" y="13.6" width="5.4" height="2.2" rx="1.1" fill="#9DA8F5"/><path d="M14.4 7.5h5.4M14.4 9.6h3.6" stroke="#fff" stroke-opacity=".7" stroke-width="1" stroke-linecap="round"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><defs><linearGradient id="i-he" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF9AB0"/><stop offset="1" stop-color="#E0415F"/></linearGradient></defs><path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 5.7-8 10.6-8 10.6z" fill="url(#i-he)" stroke="#A82745" stroke-width=".8" stroke-linejoin="round"/><ellipse cx="8.6" cy="9.2" rx="2" ry="1.1" fill="#fff" opacity=".55" transform="rotate(-25 8.6 9.2)"/></svg>',
    paw: '<svg viewBox="0 0 24 24"><defs><linearGradient id="i-pa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C08A62"/><stop offset="1" stop-color="#8A5A3A"/></linearGradient></defs><g fill="url(#i-pa)" stroke="#5E3A22" stroke-width=".7"><ellipse cx="7" cy="9.5" rx="2" ry="2.6"/><ellipse cx="17" cy="9.5" rx="2" ry="2.6"/><ellipse cx="10" cy="5.6" rx="2" ry="2.6"/><ellipse cx="14" cy="5.6" rx="2" ry="2.6"/><path d="M12 11.5c3 0 5.6 3.4 5.6 5.9 0 1.8-1.4 2.6-2.8 2.6-1.1 0-1.8-.6-2.8-.6s-1.7.6-2.8.6c-1.4 0-2.8-.8-2.8-2.6 0-2.5 2.6-5.9 5.6-5.9z"/></g></svg>',
    star: '<svg viewBox="0 0 24 24"><defs><linearGradient id="i-st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE48A"/><stop offset="1" stop-color="#F09B12"/></linearGradient></defs><path d="m12 2.8 2.75 5.6 6.15.9-4.45 4.34 1.05 6.12L12 16.87l-5.5 2.89 1.05-6.12L3.1 9.3l6.15-.9z" fill="url(#i-st)" stroke="#B8720A" stroke-width=".8" stroke-linejoin="round"/><path d="M8.6 9.4 12 4.9l1.7 3.5" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1" stroke-linecap="round"/></svg>'
  };
  function icon(name) {
    if (!name) return '<span class="sm-ico"></span>';
    // lazy: the menu is closed when the page loads, so its pictures wait until it opens
    if (name.indexOf('img:') === 0) return '<span class="sm-ico sm-thumb"><img src="' + name.slice(4) + '" alt="" loading="lazy" decoding="async" width="24" height="24"></span>';
    return '<span class="sm-ico" aria-hidden="true">' + (ICONS[name] || '') + '</span>';
  }
  window.SPIcon = icon;
  var chev = '<svg class="sm-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- styles ---------- */

  /* ---------- the start button joins the menu bar ---------- */
  var nav = bar.querySelector('nav');
  var left = document.createElement('div'); left.className = 'mb-left';
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'start-btn'; btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span class="app-orb" aria-hidden="true"></span><span class="sm-word">s.park</span><span class="sr-only">menu</span>';
  bar.insertBefore(left, nav); left.appendChild(btn); left.appendChild(nav);

  /* ---------- build the menu ---------- */
  var menu = document.createElement('div');
  menu.className = 'sm'; menu.hidden = true; menu.id = 'start-menu'; menu.tabIndex = -1; menu.style.outline = 'none';
  btn.setAttribute('aria-controls', menu.id);
  function label(it) {
    if (!it.key) return it.label;
    var i = it.label.toLowerCase().indexOf(it.key);
    return i < 0 ? it.label : it.label.slice(0, i) + '<u>' + it.label.charAt(i) + '</u>' + it.label.slice(i + 1);
  }
  function list(arr, sub) {
    var ul = document.createElement('ul');
    ul.className = sub ? 'sm-sub' : 'sm-list'; ul.setAttribute('role', 'menu');
    arr.forEach(function (it) {
      var li = document.createElement('li');
      if (it === 'sep') { li.className = 'sm-sep'; li.setAttribute('role', 'separator'); ul.appendChild(li); return; }
      li.setAttribute('role', 'none');
      var tag = it.href && !it.disabled && !it.sub ? 'a' : 'button';
      var row = document.createElement(tag);
      row.className = 'sm-row'; row.setAttribute('role', 'menuitem'); row.tabIndex = -1;
      if (tag === 'a') { row.href = it.href; if (it.external) { row.target = '_blank'; row.rel = 'noopener'; } }
      else row.type = 'button';
      if (it.disabled) row.setAttribute('aria-disabled', 'true');
      if (it.key) row.dataset.key = it.key;
      var end = it.sub ? chev : it.current ? '<span class="sm-cur" aria-label="you are here"></span>' : it.note ? '<span class="sm-note">' + it.note + '</span>' : '<span></span>';
      row.innerHTML = icon(it.icon) + '<span>' + label(it) + '</span>' + end;
      li.appendChild(row);
      if (it.sub) { row.setAttribute('aria-haspopup', 'menu'); row.setAttribute('aria-expanded', 'false'); li.appendChild(list(it.sub, true)); }
      row._item = it;
      ul.appendChild(li);
    });
    return ul;
  }
  menu.innerHTML = '<div class="sm-banner" aria-hidden="true">s.park<small>media player</small></div>';
  menu.appendChild(list(items, false));
  document.body.appendChild(menu);

  function rows(ul) { return Array.prototype.filter.call(ul.children, function (li) { return li.firstChild && li.firstChild.classList && li.firstChild.classList.contains('sm-row'); }).map(function (li) { return li.firstChild; }); }
  function closeSubs(except) {
    menu.querySelectorAll('li.open').forEach(function (li) { if (!except || !li.contains(except)) { li.classList.remove('open'); li.firstChild.setAttribute('aria-expanded', 'false'); } });
  }
  function openSub(li) {
    closeSubs(li);
    li.classList.add('open'); li.firstChild.setAttribute('aria-expanded', 'true');
  }
  function place() {
    var r = btn.getBoundingClientRect();
    menu.style.left = Math.max(12, Math.min(r.left, innerWidth - menu.offsetWidth - 12)) + 'px';
    menu.style.top = (r.bottom + 10) + 'px';
    menu.style.maxHeight = (innerHeight - r.bottom - 22) + 'px';
    // flyouts open to the left when there's no room on the right
    menu.classList.toggle('flip', r.left + menu.offsetWidth + 340 > innerWidth);
  }
  function setOpen(on, focusFirst) {
    menu.hidden = !on; btn.setAttribute('aria-expanded', String(on));
    menu.classList.toggle('kb', !!focusFirst);
    if (on) { place(); if (focusFirst) rows(menu.querySelector('.sm-list'))[0].focus(); else menu.focus({ preventScroll: true }); }
    else closeSubs();
  }
  btn.addEventListener('click', function (e) { setOpen(menu.hidden, e.detail === 0); });
  document.addEventListener('pointerdown', function (e) { if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) setOpen(false); });
  addEventListener('resize', function () { if (!menu.hidden) place(); });
  addEventListener('scroll', function () { if (!menu.hidden) place(); }, { passive: true });

  var hoverT = 0;
  menu.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;
    var row = e.target.closest('.sm-row'); if (!row) return;
    var li = row.parentNode;
    clearTimeout(hoverT);
    hoverT = setTimeout(function () { if (row._item.sub) openSub(li); else closeSubs(li); }, 110);
  });

  function run(row) {
    var it = row._item;
    if (it.disabled) return;
    if (it.sub) { var li = row.parentNode; if (li.classList.contains('open')) closeSubs(); else { openSub(li); } return; }
    if (it.action && window.SPMenuActions && window.SPMenuActions[it.action]) window.SPMenuActions[it.action](it);
    setOpen(false);
  }
  menu.addEventListener('click', function (e) {
    var row = e.target.closest('.sm-row'); if (!row) return;
    if (row._item.sub || row._item.disabled || row._item.action) e.preventDefault();
    run(row);
  });
  menu.addEventListener('keydown', function (e) {
    var row = document.activeElement.closest && document.activeElement.closest('.sm-row');
    if (!row) {
      // the menu itself has focus (opened with the mouse): arrows and letters start from the top list
      var top = rows(menu.querySelector('.sm-list'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); top[e.key === 'ArrowDown' ? 0 : top.length - 1].focus(); return; }
      if (e.key === 'Escape') { setOpen(false); btn.focus(); return; }
      if (e.key.length !== 1) return;
      row = top[0];
    }
    var ul = row.parentNode.parentNode, rs = rows(ul), i = rs.indexOf(row);
    if (e.key === 'ArrowDown') { e.preventDefault(); rs[(i + 1) % rs.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); rs[(i - 1 + rs.length) % rs.length].focus(); }
    else if (e.key === 'ArrowRight' && row._item.sub) { e.preventDefault(); openSub(row.parentNode); rows(row.parentNode.querySelector('.sm-sub'))[0].focus(); }
    else if (e.key === 'ArrowLeft' && ul.classList.contains('sm-sub')) { e.preventDefault(); var p = ul.parentNode; p.classList.remove('open'); p.firstChild.setAttribute('aria-expanded', 'false'); p.firstChild.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); btn.focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { if (row.tagName === 'BUTTON' || row._item.action) { e.preventDefault(); run(row); if (row._item.sub && row.parentNode.classList.contains('open')) rows(row.parentNode.querySelector('.sm-sub'))[0].focus(); } }
    else if (e.key.length === 1) {
      // the underlined letters work like they did on the old start menu
      var hit = rs.filter(function (r) { return r.dataset.key === e.key.toLowerCase(); })[0];
      if (hit) { e.preventDefault(); hit.focus(); run(hit); if (hit._item.sub && hit.parentNode.classList.contains('open')) rows(hit.parentNode.querySelector('.sm-sub'))[0].focus(); }
    }
  });
  menu.addEventListener('focusin', function (e) { var row = e.target.closest('.sm-row'); if (row) closeSubs(row.parentNode); });

  /* ---------- the menu bar stays at the top once you scroll ---------- */
  var slot = document.createElement('div'); slot.className = 'menubar-slot';
  bar.parentNode.insertBefore(slot, bar); slot.appendChild(bar);
  var raf = 0;
  function stick() {
    raf = 0;
    var r = slot.getBoundingClientRect(), top = 8;
    var on = r.top < top && slot.offsetParent !== null;
    if (on) { root.style.setProperty('--mb-left', r.left + 'px'); root.style.setProperty('--mb-w', r.width + 'px'); }
    if (on !== bar.classList.contains('stuck')) bar.classList.toggle('stuck', on);
  }
  function req() { if (!raf) raf = requestAnimationFrame(stick); }
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  stick();
})();
