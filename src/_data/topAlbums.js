const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");
require("dotenv").config();
const {
  DEFAULT_TTL_MINUTES,
  validateEnv,
  normalizeAlbum,
  fetchTopAlbums,
} = require("../../lib/lastfm");

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "top-albums.json");
const DEFAULT_LIMIT = 10;
const PERIOD = "1month";

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

    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  } catch (error) {
    console.warn("Unable to read top albums cache", error);
    return null;
  }
}

function writeCache(payload) {
  try {
    ensureCacheDir();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2));
  } catch (error) {
    console.warn("Unable to write top albums cache", error);
  }
}

function cacheIsFresh(cache, ttlMinutes) {
  if (!cache?.cachedAt) {
    return false;
  }

  const ageMinutes = (Date.now() - cache.cachedAt) / (1000 * 60);
  return ageMinutes < ttlMinutes;
}

function buildPayload({ albums, username, ttlMinutes }) {
  const normalized = albums.map(normalizeAlbum);
  const cachedAt = Date.now();
  const updated = DateTime.fromMillis(cachedAt).toISO();

  return {
    cachedAt,
    ttlMinutes,
    data: {
      username,
      period: PERIOD,
      limit: DEFAULT_LIMIT,
      updated,
      albums: normalized,
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
      albums: [],
      username: process.env.LASTFM_USERNAME || "",
      period: PERIOD,
      limit: DEFAULT_LIMIT,
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
    const apiResponse = await fetchTopAlbums({
      username: process.env.LASTFM_USERNAME,
      apiKey: process.env.LASTFM_API_KEY,
      period: PERIOD,
      limit: DEFAULT_LIMIT,
    });

    const albums = apiResponse?.topalbums?.album || [];
    const payload = buildPayload({
      albums,
      username: process.env.LASTFM_USERNAME,
      ttlMinutes,
    });

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
    console.error("Failed to fetch top albums", error);

    if (cache?.data) {
      return {
        ...cache.data,
        cache: {
          ttlMinutes,
          fresh: false,
          updated: cache.data.updated,
          warning: "Serving cached albums due to fetch error.",
        },
        error: error.message,
      };
    }

    return {
      error: error.message,
      albums: [],
      username: process.env.LASTFM_USERNAME || "",
      period: PERIOD,
      limit: DEFAULT_LIMIT,
      cache: { ttlMinutes, fresh: false, updated: null },
    };
  }
};
