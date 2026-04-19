const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Required for @sentry/react-native v8+ — enables ESM package exports resolution
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
