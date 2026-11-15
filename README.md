# Sage Park portfolio


```
index.html      home page
invetty.html    invetty case study
about.html      blank on purpose, waiting for your Figma layout
css/            site.css (shared + home), case.css (case study)
js/             fog.js (sky, frost, drawing, title, smooth scroll), ui.js (hover effects),
                home.js, invetty.js, player.js (vinyl player)
img/ video/     the screens, journey map, logo and the two videos
```
things to edit
- **Playlist:** `js/player.js`, top of the file. Paste your Spotify playlist URI into `PLAYLIST_URI`
  (and fill `PLAYLIST_NAME`, `SONG_COUNT`, plus `TRACKS` if you want the skip buttons to work).
  Change the "[playlist name]" text in `index.html` and `invetty.html` too.
- **LinkedIn / Instagram:** `index.html`, the two `[linkedin]` / `[instagram]` buttons (`href="#"`).
- **Other projects:** in `index.html` each card except invetty has `data-soon`, which shows a.
- **A new case study:** copy `invetty.html`, change the text and images, and link a card to it.
