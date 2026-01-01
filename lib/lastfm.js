const { DateTime } = require("luxon");
require("dotenv").config();

const REQUIRED_ENV = ["LASTFM_API_KEY", "LASTFM_USERNAME"];
const DEFAULT_TTL_MINUTES = 15;

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(
      `Missing Last.fm configuration: ${missing.join(", ")}. Check your .env file.`
    );
  }
}

function pickImage(entity) {
  const images = Array.isArray(entity?.image) ? [...entity.image].reverse() : [];
  const chosen = images.find((img) => img?.["#text"]);
  return chosen?.["#text"] || null;
}

function normalizeTrack(track) {
  return {
    name: track?.name,
    artist: track?.artist?.["#text"],
    album: track?.album?.["#text"],
    url: track?.url,
    image: pickImage(track),
    nowPlaying: track?.["@attr"]?.nowplaying === "true",
    uts: track?.date?.uts ? Number(track.date.uts) : null,
    playedAt:
      track?.date?.uts
        ? DateTime.fromSeconds(Number(track.date.uts), { zone: "utc" }).toISO()
        : null,
  };
}

function normalizeAlbum(album) {
  return {
    name: album?.name,
    artist: album?.artist?.name || album?.artist?.["#text"],
    playcount: Number(album?.playcount) || 0,
    url: album?.url,
    image: pickImage(album),
  };
}

async function fetchRecentTracks({ username, apiKey, limit = 20, page = 1 }) {
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "user.getrecenttracks");
  url.searchParams.set("user", username);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", `${limit}`);
  url.searchParams.set("page", `${page}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Last.fm request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchTopAlbums({ username, apiKey, period = "1month", limit = 10 }) {
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "user.gettopalbums");
  url.searchParams.set("user", username);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("period", period);
  url.searchParams.set("limit", `${limit}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Last.fm request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

module.exports = {
  REQUIRED_ENV,
  DEFAULT_TTL_MINUTES,
  validateEnv,
  normalizeTrack,
  normalizeAlbum,
  fetchRecentTracks,
  fetchTopAlbums,
};
