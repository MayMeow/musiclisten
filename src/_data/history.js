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
const CACHE_FILE = path.join(CACHE_DIR, "history.json");
const TRACKS_PER_PAGE = 200; // Last.fm API maximum
const DEFAULT_PAGE_LIMIT = 1;

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
    console.warn("Unable to read Last.fm history cache", error);
    return null;
  }
}

function writeCache(payload) {
  try {
    ensureCacheDir();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2));
  } catch (error) {
    console.warn("Unable to write Last.fm history cache", error);
  }
}

function cacheIsFresh(cache, ttlMinutes) {
  if (!cache?.cachedAt) {
    return false;
  }

  const ageMinutes = (Date.now() - cache.cachedAt) / (1000 * 60);
  return ageMinutes < ttlMinutes;
}

function dedupeTracks(tracks) {
  const seen = new Set();
  const filtered = [];

  tracks.forEach((track) => {
    const uts = track?.date?.uts;

    if (!uts) {
      return;
    }

    const key = `${uts}-${track?.name}-${track?.artist?.["#text"]}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    filtered.push(track);
  });

  return filtered;
}

async function collectHistory({ username, apiKey, pageLimit }) {
  let currentPage = 1;
  let totalPages = pageLimit;
  const aggregated = [];

  while (currentPage <= pageLimit && currentPage <= totalPages) {
    const response = await fetchRecentTracks({
      username,
      apiKey,
      limit: TRACKS_PER_PAGE,
      page: currentPage,
    });

    const tracks = response?.recenttracks?.track || [];
    aggregated.push(...tracks);

    const attrs = response?.recenttracks?.["@attr"];
    totalPages = Number(attrs?.totalPages) || totalPages;

    if (tracks.length === 0 || currentPage >= totalPages) {
      break;
    }

    currentPage += 1;
  }

  return aggregated;
}

function buildPayload({ tracks, username, ttlMinutes, pageLimit }) {
  const normalized = dedupeTracks(tracks)
    .map(normalizeTrack)
    .filter((track) => track.uts)
    .sort((a, b) => (b.uts || 0) - (a.uts || 0));

  const cachedAt = Date.now();
  const updated = DateTime.fromMillis(cachedAt).toISO();

  return {
    cachedAt,
    ttlMinutes,
    data: {
      username,
      total: normalized.length,
      pageLimit,
      tracksPerPage: TRACKS_PER_PAGE,
      updated,
      tracks: normalized,
    },
  };
}

module.exports = async function () {
  const ttlMinutes = Number(process.env.LASTFM_CACHE_MINUTES) || DEFAULT_TTL_MINUTES;
  const pageLimit = Math.max(
    1,
    Number(process.env.LASTFM_HISTORY_PAGES) || DEFAULT_PAGE_LIMIT
  );

  try {
    validateEnv();
  } catch (error) {
    return {
      error: error.message,
      username: process.env.LASTFM_USERNAME || "",
      tracks: [],
      total: 0,
      pageLimit,
      tracksPerPage: TRACKS_PER_PAGE,
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
    const tracks = await collectHistory({
      username: process.env.LASTFM_USERNAME,
      apiKey: process.env.LASTFM_API_KEY,
      pageLimit,
    });

    const payload = buildPayload({
      tracks,
      username: process.env.LASTFM_USERNAME,
      ttlMinutes,
      pageLimit,
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
    console.error("Failed to fetch Last.fm history", error);

    if (cache?.data) {
      return {
        ...cache.data,
        cache: {
          ttlMinutes,
          fresh: false,
          updated: cache.data.updated,
          warning: "Serving cached history due to fetch error.",
        },
        error: error.message,
      };
    }

    return {
      error: error.message,
      username: process.env.LASTFM_USERNAME,
      tracks: [],
      total: 0,
      pageLimit,
      tracksPerPage: TRACKS_PER_PAGE,
      cache: { ttlMinutes, fresh: false, updated: null },
    };
  }
};
