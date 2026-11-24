# sage park portfolio

My design portfolio: [psage0817.github.io/sage-portfolio-site](https://psage0817.github.io/sage-portfolio-site/)

The site is built around an old desktop media player. Every page is a window, the home page opens on a live view of San Diego or St. Louis, and there's a playlist in the corner. It's plain HTML, CSS and JavaScript with no framework or build step, hosted on GitHub Pages.

## Pages

| Page | What's on it |
| --- | --- |
| `index.html` | The home window, selected work, contact |
| `invetty.html` | invetty, an app for event guests to share dietary needs privately (case study) |
| `softspot.html` | softspot, a pet journal made at the WashUX Designathon (case study) |
| `strike.html` | Strike Magazine STL, issues 10 to 12 and social graphics |
| `about.html` | About me, experience and education, photos, fine arts |

## Running it locally

Any static server works. From the repo folder:

```
python3 -m http.server
```

Then open http://localhost:8000.

## How it's organised

`css/aero.css` and the shared scripts (`startmenu.js`, `aero.js`, `player.js`) are used on every page, and `sayhi.js` on every page with the drawing window. Most pages also have their own stylesheet and script, for example `strike.html` uses `css/strike.css` and `js/strike.js`, and the home page uses `js/home.js`. The two case studies share `css/case.css` and `js/case.js`. `css/site.css` is left over from an older version and isn't used.

```
css/       aero.css (shared), case.css, softspot.css, strike.css, about.css
js/        shared: startmenu, aero, player, sayhi (the drawing window)
           home: glass (the window view), sky, home
           case studies: case, invetty, softspot
           strike: strike, social
           about: about, etc, minidesk
img/       images for each page, in folders by page
video/     screen recordings for the case studies
fonts/     the handwriting font
```

## Editing content

**Colours.** The few colours at the top of `:root` in `css/aero.css` (`--tint`, `--accent`, `--seek`, `--notes`, `--ground-pick`, `--night-top`, `--night-bot`). Everything else on the site is mixed from these, for both day and night.

**Start menu.** Each page lists its own menu items in `window.SPMenu`, just above where it loads `js/startmenu.js`.

**Playlist.** The Spotify playlist link, its name and the song count are at the top of `js/player.js`.

**Home.** The rotating words under the headline are the `WORDS` lists in `js/home.js`. To add a project to the work section, copy one of the `<article class="proj">` blocks in `index.html`.

**Case studies.** Each `<section class="sec">` sets its name and icon in the side menu with `data-name` and `data-icon`.

**Strike.** Story names and page numbers for each issue are in the `ISSUES` list at the top of `js/strike.js`. In `strike.html`, `data-pages` on an issue limits it to certain spreads, for example `data-pages="10-25,44-47"`. The look of the page flips is set by the `set` line in `js/strike.js`.

**About.**
- The intro is in `about.html`. Wrap a word in `<mark class="hl">` to highlight it.
- Each role in experience is an `<li><details>` in `about.html`. The `<summary>` is the line you see; the list under it is what opens.
- The photos in "currently..." are the `ROLL` list at the top of `js/about.js`. `name` is the caption and `alt` describes the photo for screen readers. Photos go in `img/about/roll/`.
- The fine arts pieces are the `ART` list at the top of `js/etc.js`, with images in `img/etc/` (`m/` small, `l/` large). The three pieces that start open are set in `seed()` in `js/minidesk.js`.

## Testing the home page

- `?city=sd` or `?city=stl` on the URL picks the city.
- `&train` sends a train past straight away, for example `index.html?city=sd&train`.

## Credits

- Type: Satoshi from [Fontshare](https://www.fontshare.com/fonts/satoshi), and SF Pro on Apple devices. The handwriting font is Le Jardin Du Bonheur.
- The playlist plays through Spotify's embed.
