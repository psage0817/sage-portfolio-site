# Sage Park portfolio

The site is a desktop of glossy media-player windows. Plain HTML, CSS and JavaScript on GitHub Pages, no build step.

```
index.html        home: the window in a full-screen player, selected work, let's say hi
invetty.html      invetty case study
softspot.html     softspot case study (the WashUX Designathon)
about.html        simple shell, waiting for your about layout (uses css/site.css)
css/aero.css      everything the pages share: colours (the picks at the top of :root), windows,
                  notes, menu bar, start menu, paint window, record player, the scroll arrivals
css/case.css      what the case studies share, on top of aero.css
css/softspot.css  the softspot case study: the stopwatch, messages windows, the notepad, the screens
css/site.css      the old styles, still used by about.html
js/glass.js       the window glass: condensation, the live San Diego ocean and the train
js/sky.js         coin-flip city, live time, photos, fog drawing, day/night page
js/home.js        the opening time-lapse, play/pause, city buttons, time slider, rotating words, filters
js/case.js        what the case studies share: side menu, floating bar, progress, the zoom lens
js/invetty.js     the two flow videos at the top, before/after wipes
js/softspot.js    the 36-hour stopwatch, the flow video, the message that types itself out
js/startmenu.js   the start menu and the sticky menu bar (each page lists its items above the script)
js/sayhi.js       the paint window and the "let's say hi" handwriting
js/aero.js        toast, day/night carried to other pages, sliding segment, things arriving on scroll
js/player.js      the Spotify playlist for the record player
img/ video/       screens, journey map, flow videos + poster frames
```

things to edit

- **Colours:** the picks at the top of `:root` in `css/aero.css` (`--tint`, `--accent`, `--seek`, `--notes`, `--ground-pick`, and `--night-top` / `--night-bot` for night). Everything else is mixed from them, by day and by night.
- **Case study sections:** each `<section class="sec">` sets its side-menu name and icon with `data-name` and `data-icon`.
- **Strike magazine:** when its case study is ready, turn the "up next" at the bottom of `softspot.html` into a link (the comment there says how).
- **Rotating words:** `js/home.js`, the `WORDS` lists.
- **Start menu items:** the `window.SPMenu` list just above `js/startmenu.js` in each page.
- **Fonts:** Apple devices show SF Pro (their system font); everything else gets Satoshi from Fontshare. The handwriting is `fonts/LeJardinDuBonheur.woff2`.
- **Force a city while testing:** add `?city=sd` or `?city=stl` to the URL.
- **See the train straight away:** add `&train` to the URL (`index.html?city=sd&train`). Otherwise the first one comes 6 to 14 seconds after the page loads, then every 25 to 70 seconds.
- **The live San Diego view** (waves and the Pacific Surfliner) is drawn in `js/glass.js`, in the shader's `oceanAt` and `trainAt`. Train size is `TS`, its speed is `TRAIN_SPEED`.
- **Other projects:** in `index.html`, give the project's `.mini-screen` an `<img>` instead of the `.soon` block, turn its `div.mini` into an `<a class="mini chrome" href="...">`, and move it out of the `.soon-row` if it should get a big player.
- **Playlist:** `js/player.js`: paste your Spotify playlist URI, name and song count at the top.
