# Sage Park portfolio

```
index.html      home: the window, selected work, contact + record player
invetty.html    invetty case study
about.html      simple shell, waiting for your about layout
css/site.css    shared styles + home (day/night colours, fonts at the top)
css/case.css    the case study, in invetty's Ubuntu + DM Sans and indigo/beige
js/sky.js       coin-flip city, live time, skyline, fog drawing, time slider, day/night page
js/home.js      rotating subtitle words (edit the lists at the top) + filters
js/invetty.js   before/after chat bubbles, process list, journey map zoom, video pause
js/player.js    your existing Spotify player (unchanged)
img/ video/     screens, journey map, flow videos + poster frames
```

things to edit

- **Rotating words:** `js/home.js`, the `WORDS` lists at the top. `HOLD` and `OFFSET` set the timing.
- **Fonts:** put Alte Haas Grotesk files in `fonts/` (file names are in `css/site.css`). If Ashton comes from Adobe Fonts, paste the web project `<link>` into each page's `<head>`.
- **Force a city while testing:** add `?city=sd` or `?city=stl` to the URL.
- **Other projects:** in `index.html`, swap each card's `.ph` placeholder for an `<img>`, set its `href`, and remove `aria-disabled="true"`.
- **Phase bar:** in `invetty.html`, set each `flex` value to the weeks each phase took.
- **Playlist:** `js/player.js`, as before.
