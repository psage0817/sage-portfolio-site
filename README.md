# Sage Park portfolio

```
index.html      home: the window, selected work, contact + record player
invetty.html    invetty case study
about.html      simple shell, waiting for your about layout
css/site.css    shared styles + home (day/night colours, fonts at the top)
css/window.css  the window on the home page: frame, shade, cord, lamp-lit night
css/case.css    the case study, in invetty's Ubuntu + DM Sans and indigo/beige
js/sky.js       coin-flip city, live time, skyline, fog drawing, time slider, day/night page
js/window.js    the shade rolling up, pulling the cord, the view shifting with the cursor
js/home.js      rotating subtitle words (edit the lists at the top) + filters
js/invetty.js   before/after chat bubbles, process list, journey map zoom, video pause
js/player.js    your existing Spotify player (unchanged)
img/ video/     screens, journey map, flow videos + poster frames
```

things to edit

- **Rotating words:** `js/home.js`, the `WORDS` lists at the top. `HOLD` and `OFFSET` set the timing.
- **Fonts:** put Alte Haas Grotesk files in `fonts/` (file names are in `css/site.css`). If Ashton comes from Adobe Fonts, paste the web project `<link>` into each page's `<head>`.
- **Force a city while testing:** add `?city=sd` or `?city=stl` to the URL.
- **See the train straight away:** add `&train` to the URL (`index.html?city=sd&train`). Otherwise the first one comes by 6 to 14 seconds after the page loads, then every 25 to 70 seconds.
- **The live San Diego view** (waves and the Pacific Surfliner) is drawn in `js/glass.js`, in the shader's `oceanAt` and `trainAt`. Train size is `TS`, its speed is `TRAIN_SPEED`.
- **Other projects:** in `index.html`, swap each card's `.ph` placeholder for an `<img>`, set its `href`, and remove `aria-disabled="true"`.
- **Phase bar:** in `invetty.html`, set each `flex` value to the weeks each phase took.
- **Playlist:** `js/player.js`, as before.
