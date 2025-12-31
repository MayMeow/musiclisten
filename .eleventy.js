const { DateTime } = require("luxon");
require("dotenv").config();

module.exports = function (eleventyConfig) {
  eleventyConfig.addWatchTarget("./src/styles/");
  eleventyConfig.addWatchTarget("./src/assets/css/main.css");

  eleventyConfig.addPassthroughCopy({
    "src/assets": "assets",
    "node_modules/bootstrap/dist/js/bootstrap.bundle.min.js":
      "assets/js/bootstrap.bundle.min.js",
  });

  eleventyConfig.addFilter("formatTrackTime", function (uts, locale = "en") {
    if (!uts) {
      return "Unknown time";
    }

    return DateTime.fromSeconds(Number(uts), { zone: "utc" })
      .setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "local")
      .setLocale(locale)
      .toLocaleString(DateTime.DATETIME_MED);
  });

  eleventyConfig.addFilter("relativeTime", function (uts, locale = "en") {
    if (!uts) {
      return "";
    }

    const diff = DateTime.now().diff(
      DateTime.fromSeconds(Number(uts), { zone: "utc" }).setZone("utc")
    );

    const minutes = Math.floor(diff.as("minutes"));
    if (minutes < 1) {
      return "moments ago";
    }

    if (minutes < 60) {
      return `${minutes} min ago`;
    }

    const hours = Math.floor(diff.as("hours"));
    if (hours < 24) {
      return `${hours} hr${hours === 1 ? "" : "s"} ago`;
    }

    const days = Math.floor(diff.as("days"));
    return `${days} day${days === 1 ? "" : "s"} ago`;
  });

  eleventyConfig.addFilter("formatCacheTime", function (isoString, locale = "en") {
    if (!isoString) {
      return "";
    }

    return DateTime.fromISO(isoString)
      .setLocale(locale)
      .toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "dist",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"],
  };
};
