# OSRS Tracker

A simple, mobile-friendly dashboard for your Old School RuneScape stats.
It pulls live data from the [Wise Old Man](https://wiseoldman.net) API — no
account, API key, or backend server needed.

Type in a RuneScape username and see:

- **Overview**: combat level, total level, total XP, EHP, EHB, last update time
- **Skills**: level, XP, and rank for every skill
- **Bosses**: kill count and rank for every boss you've killed
- **Gains**: XP and KC gained over the last day / week / month / year

It's a plain HTML/CSS/JS site — there's nothing to install or build.

## Try it locally

You don't need Node, npm, or any build tools. Just open `index.html` in a
browser:

- **Double-click `index.html`** in your file explorer, or
- From a terminal in this folder, run a tiny local server (needed for the
  "Add to Home Screen" / offline features to work correctly):
  ```
  python3 -m http.server 8000
  ```
  then visit `http://localhost:8000` on your computer, or
  `http://<your-computer's-ip>:8000` from your phone (same Wi-Fi network).

## Put it on your phone (recommended)

The easiest way to use this as a real "app" on your phone is to publish it
for free with **GitHub Pages**, since it's just static files:

1. Push this repo to GitHub (already done if you're reading this from your repo).
2. In the repo on GitHub: **Settings → Pages → Source**, choose the branch
   this code lives on and the root folder, then save.
3. GitHub gives you a URL like `https://<your-username>.github.io/<repo>/`.
4. Open that URL on your phone in Safari (iOS) or Chrome (Android).
5. Tap the browser's **Share → Add to Home Screen** button.

You'll get an app icon on your home screen that opens full-screen, remembers
your last-searched username, and keeps working offline for anything except
the live stats lookup (which always needs an internet connection).

## How it works (for the curious)

- `index.html` — the page structure (search box, stat cards, tabs)
- `style.css` — mobile-first styling, dark OSRS-inspired theme
- `app.js` — fetches data from the Wise Old Man API and renders it
- `manifest.json` + `sw.js` — make the site installable as a home-screen app
- `icons/icon.svg` — the app icon

The app talks directly to `https://api.wiseoldman.net/v2` from your browser:

- `GET /players/{username}` — profile, skills, boss KC
- `POST /players/{username}` — asks Wise Old Man to re-check your hiscores
  (used the first time you search a name, and by the "Refresh" button)
- `GET /players/{username}/gained?period=...` — XP/KC gained over
  a time window

If a username hasn't been searched on Wise Old Man before, the app offers to
add it for tracking automatically.

## Customizing

- Change the color theme in `style.css` (look for the `:root` variables at
  the top).
- Add more stats by extending `renderPlayer`, `renderSkills`, or
  `renderBosses` in `app.js` — the full shape of the Wise Old Man API
  response is documented at https://docs.wiseoldman.net.
