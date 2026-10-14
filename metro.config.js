const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes("webm")) {
  config.resolver.assetExts.push("webm");
}

module.exports = config;
