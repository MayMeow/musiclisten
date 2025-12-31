const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");
require("dotenv").config();

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "lastfm.json");
const DEFAULT_TTL_MINUTES = 15;

const REQUIRED_ENV = ["LASTFM_API_KEY", "LASTFM_USERNAME"];

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function readCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return null;
    }

    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Unable to read Last.fm cache", error);
    return null;
  }
}

function writeCache(payload) {
  try {
    ensureCacheDir();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2));
  } catch (error) {
    console.warn("Unable to write Last.fm cache", error);
  }
}

function cacheIsFresh(cache, ttlMinutes) {
  if (!cache || !cache.cachedAt) {
    return false;
  }

  const ageMinutes = (Date.now() - cache.cachedAt) / (1000 * 60);
  return ageMinutes < ttlMinutes;
}

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(
      `Missing Last.fm configuration: ${missing.join(", ")}. Check your .env file.`
    );
  }
}

function normalizeTrack(track) {
  const primaryImage = Array.isArray(track.image)
    ? [...track.image].reverse().find((img) => img?.["#text"])
    : null;

  return {
    name: track.name,
    artist: track.artist?.["#text"],
    album: track.album?.["#text"],
    url: track.url,
    image: primaryImage?.["#text"] || null,
    nowPlaying: track["@attr"]?.nowplaying === "true",
    uts: track.date?.uts ? Number(track.date.uts) : null,
    playedAt:
      track.date?.uts
        ? DateTime.fromSeconds(Number(track.date.uts), { zone: "utc" }).toISO()
        : null,
  };
}

async function fetchRecentTracks({ username, apiKey }) {
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "user.getrecenttracks");
  url.searchParams.set("user", username);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "20");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Last.fm request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function buildPayload({ tracks, username, ttlMinutes }) {
  const normalized = tracks.map(normalizeTrack);
  const cachedAt = Date.now();

  return {
    cachedAt,
    ttlMinutes,
    data: {
      username,
      tracks: normalized,
      updated: DateTime.fromMillis(cachedAt).toISO(),
    },
  };
}

module.exports = async function () {
  const ttlMinutes = Number(process.env.LASTFM_CACHE_MINUTES) || DEFAULT_TTL_MINUTES;

  try {
    validateEnv();
  } catch (error) {
    return {
      error: error.message,
      tracks: [],
      username: process.env.LASTFM_USERNAME || "",
      cache: { ttlMinutes, fresh: false, updated: null },
    };
  }

  const cache = readCache();
  if (cacheIsFresh(cache, ttlMinutes)) {
    return {
      ...cache.data,
      cache: {
        ttlMinutes,
        fresh: true,
        updated: cache.data.updated,
      },
    };
  }

  try {
    const apiResponse = await fetchRecentTracks({
      username: process.env.LASTFM_USERNAME,
      apiKey: process.env.LASTFM_API_KEY,
    });

    const tracks = apiResponse?.recenttracks?.track || [];
    const payload = buildPayload({ tracks, username: process.env.LASTFM_USERNAME, ttlMinutes });
    writeCache(payload);

    return {
      ...payload.data,
      cache: {
        ttlMinutes,
        fresh: false,
        updated: payload.data.updated,
      },
    };
  } catch (error) {
    console.error("Failed to fetch Last.fm data", error);

    if (cache?.data) {
      return {
        ...cache.data,
        cache: {
          ttlMinutes,
          fresh: false,
          updated: cache.data.updated,
          warning: "Serving cached data due to fetch error.",
        },
        error: error.message,
      };
    }

    return {
      error: error.message,
      tracks: [],
      username: process.env.LASTFM_USERNAME,
      cache: { ttlMinutes, fresh: false, updated: null },
    };
  }
};
