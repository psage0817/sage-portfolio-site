# Sage Park portfolio

The site is a desktop of glossy media-player windows. Plain HTML, CSS and JavaScript on GitHub Pages, no build step.

```
index.html        home: the window in a full-screen player, selected work, let's say hi
invetty.html      invetty case study
softspot.html     softspot case study (the WashUX Designathon)
strike.html       strike magazine stl: the three covers, issues 12, 11 and 10, social graphics
about.html        simple shell, waiting for your about layout (uses css/site.css)
css/aero.css      everything the pages share: colours (the picks at the top of :root), windows,
                  notes, menu bar, start menu, paint window, record player, the scroll arrivals
css/case.css      what the case studies share, on top of aero.css
css/softspot.css  the softspot case study: the stopwatch, messages windows, the notepad, the screens
css/strike.css    strike: the covers on the table, the stop-motion issues, the instagram-style posts
css/site.css      the old styles, still used by about.html
js/glass.js       the window glass: condensation, the live San Diego ocean and the train
js/sky.js         coin-flip city, live time, photos, fog drawing, day/night page
js/home.js        the opening time-lapse, play/pause, city buttons, time slider, rotating words, filters
js/case.js        what the case studies share: side menu, floating bar, progress, the zoom lens
js/invetty.js     the two flow videos at the top, before/after wipes
js/softspot.js    the 36-hour stopwatch, the flow video, the message that types itself out
js/strike.js      strike: the covers dropping onto the table, each issue's stop-motion player
js/social.js      strike: the instagram-style posts (carousel, heart, bookmark, "more")
js/startmenu.js   the start menu and the sticky menu bar (each page lists its items above the script)
js/sayhi.js       the paint window and the "let's say hi" handwriting
js/aero.js        toast, day/night carried to other pages, sliding segment, things arriving on scroll
js/player.js      the Spotify playlist for the record player
img/ video/       screens, journey map, flow videos + poster frames
img/strike/       issue pages (12/, 11/, 10/: p01.webp is the cover), social/ for the posts
```

things to edit

- **Colours:** the picks at the top of `:root` in `css/aero.css` (`--tint`, `--accent`, `--seek`, `--notes`, `--ground-pick`, and `--night-top` / `--night-bot` for night). Everything else is mixed from them, by day and by night.
- **Case study sections:** each `<section class="sec">` sets its side-menu name and icon with `data-name` and `data-icon`.
- **Strike issues:** each player in `strike.html` is a `data-issue` window. `data-pages="10-25,44-47"` limits it to those spreads (leave it off for the whole issue). Story names and page numbers are in the `ISSUES` list at the top of `js/strike.js`; the story buttons under each player use `data-jump` with a page number.
- **Strike motion:** the `set` line near the top of `js/strike.js`: `style` ('flip', 'turn' or 'pile'), `fps`, `wobble`, `cam`, `table`. To try one in the browser first, open the console on `strike.html` and type `SPMag.set('style', 'turn')`.
- **Strike posts:** each `<article class="ig">` in `strike.html`. Slides are the `<img>`s in its `.post-track`; the caption is the `<p>` in `.ig-cap`.
- **Rotating words:** `js/home.js`, the `WORDS` lists.
- **Start menu items:** the `window.SPMenu` list just above `js/startmenu.js` in each page.
- **Fonts:** Apple devices show SF Pro (their system font); everything else gets Satoshi from Fontshare. The handwriting is `fonts/LeJardinDuBonheur.woff2`.
- **Force a city while testing:** add `?city=sd` or `?city=stl` to the URL.
- **See the train straight away:** add `&train` to the URL (`index.html?city=sd&train`). Otherwise the first one comes 6 to 14 seconds after the page loads, then every 25 to 70 seconds.
- **The live San Diego view** (waves and the Pacific Surfliner) is drawn in `js/glass.js`, in the shader's `oceanAt` and `trainAt`. Train size is `TS`, its speed is `TRAIN_SPEED`.
- **Other projects:** in `index.html`, give the project's `.mini-screen` an `<img>` instead of the `.soon` block, turn its `div.mini` into an `<a class="mini chrome" href="...">`, and move it out of the `.soon-row` if it should get a big player.
- **Playlist:** `js/player.js`: paste your Spotify playlist URI, name and song count at the top.
