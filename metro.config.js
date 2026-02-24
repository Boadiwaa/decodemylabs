// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude the large GGUF model file from Metro bundler.
// The model is copied into the iOS bundle by the withModelAsset config plugin,
// not by Metro. Without this exclusion, Metro tries to read the 2.8 GB file
// and crashes with ERR_FS_FILE_TOO_LARGE.
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  /models\/.*\.gguf$/,
];

// Also exclude from watcher to avoid unnecessary file-system overhead
config.watcher = {
  ...config.watcher,
  additionalExts: config.watcher?.additionalExts || [],
};

module.exports = config;
