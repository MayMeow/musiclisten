const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");
require("dotenv").config();
const {
  DEFAULT_TTL_MINUTES,
  validateEnv,
  normalizeTrack,
  fetchRecentTracks,
} = require("../../lib/lastfm");

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "lastfm.json");

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
