# Musiclisten · Eleventy × Last.fm

A small Eleventy site that compiles a bespoke Bootstrap theme, fetches your recent Last.fm scrobbles at build time, and displays them in a responsive grid. Responses are cached locally so builds stay fast and API limits remain happy.

## Requirements
- Node.js 18+ (relies on the global `fetch` implementation)
- A Last.fm account and API key

## Getting started
1. Install dependencies
   ```sh
   npm install
   ```
2. Copy the environment template and fill in your secrets
   ```sh
   cp .env.example .env
   ```
3. Build once (or run the dev server) to generate the site
   ```sh
   npm run build
   # or
   npm run serve
   ```

## Environment variables
| Key | Description |
| --- | --- |
| `LASTFM_API_KEY` | API key you receive from the Last.fm developer console. |
| `LASTFM_USERNAME` | The Last.fm username (profile slug) whose listening history should be fetched. |
| `LASTFM_CACHE_MINUTES` | Optional override for the cache TTL. Defaults to 15 minutes. |
| `LASTFM_HISTORY_PAGES` | Number of Last.fm pages (200 tracks each) to fetch for the history archive. Defaults to 5. |

### Getting your Last.fm API key & username
1. Sign in (or register) at [Last.fm](https://www.last.fm/).
2. Go to the [API account page](https://www.last.fm/api/account/create) and create an application.
3. Once the app is approved instantly, copy the `API Key` value into `LASTFM_API_KEY` inside `.env`.
4. Your `LASTFM_USERNAME` is simply your profile URL slug — e.g. `https://www.last.fm/user/<username>`.

Keep the `.env` file out of version control (already covered via `.gitignore`).

## Scripts
| Command | Purpose |
| --- | --- |
| `npm run build:css` | Compile `src/styles/main.scss` (Bootstrap + theme overrides) to `src/assets/css/main.css`. |
| `npm run watch:css` | Watch Sass files for changes during local development. Run alongside `npm run serve`. |
| `npm run build:site` | Run Eleventy without rebuilding CSS. |
| `npm run build` | Compile CSS then run Eleventy to produce `dist/`. |
| `npm run serve` | Compile CSS once and start Eleventy’s dev server at `http://localhost:8080`. |
| `npm run clean` | Remove `dist/` and `.cache/`. |

## Data flow & caching
- `_data/lastfm.js` runs on every Eleventy build, loads `.env`, and checks `.cache/lastfm.json` for the last successful fetch.
- If the cache is fresher than `LASTFM_CACHE_MINUTES`, the cached payload is used to avoid another HTTP request.
- When the cache is stale (or missing) the build fetches `user.getrecenttracks` from the Last.fm REST API, normalizes the response, saves it to `.cache/lastfm.json`, and exposes it to templates.
- Any API failures fall back to the last good cache (if present) and emit a warning banner in the UI.
- `_data/history.js` performs a multi-page fetch (up to `LASTFM_HISTORY_PAGES` × 200 tracks) to build the `/history/` archive, storing the expanded payload in `.cache/history.json` with the same TTL behavior.
- `_data/history.js` performs a multi-page fetch (up to `LASTFM_HISTORY_PAGES` × 200 tracks) to build the `/history/` archive, storing the expanded payload in `.cache/history.json` with the same TTL behavior.
- `_data/topAlbums.js` hits `user.gettopalbums` with a `1month` period and caches the top 10 albums in `.cache/top-albums.json` so the leaderboard page stays responsive.

## History page
- `src/history.njk` renders a table-style archive that can include up to 1,000 tracks out of the box (5 pages × 200). Increase `LASTFM_HISTORY_PAGES` if you want to go deeper, keeping in mind the trade-off between build time and API rate limits.
- The navigation in `layouts/base.njk` now links to the new page so you can jump between the live dashboard and the archive.

## Top albums page
- `src/top-albums.njk` showcases the 10 most played albums from the previous month (per Last.fm’s `1month` window) with artwork, play counts, and profile links.
- You can tweak the TTL via `LASTFM_CACHE_MINUTES` if you’d like to refresh the leaderboard more or less frequently.

## Custom Bootstrap build
- `src/styles/main.scss` imports Bootstrap’s Sass entrypoint with custom color, typography, and layout tweaks.
- Output CSS lives in `src/assets/css/main.css` so Eleventy can pass it through directly to `dist/assets/css/main.css`.
- Feel free to extend the theme by editing the Sass file or adding additional partials. Run `npm run watch:css` to see changes instantly.

## Troubleshooting
- **“Missing Last.fm configuration” alert:** Ensure `.env` contains both `LASTFM_API_KEY` and `LASTFM_USERNAME`, then rebuild.
- **API errors or rate limiting:** Increase `LASTFM_CACHE_MINUTES` or delete `.cache/lastfm.json` to force a refetch after resolving issues.
- **Stale styling:** Delete `src/assets/css/main.css` and rerun `npm run build:css` if the compiled file falls out of sync.

## License
MIT © 2025
