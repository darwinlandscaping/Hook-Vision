const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Follow pnpm symlinks so Metro can resolve packages installed via
// pnpm workspaces (e.g. @tensorflow/tfjs).
config.resolver.unstable_enableSymlinks = true;

// Give the resolver visibility into both the local and root node_modules
// (the pnpm virtual store lives under workspaceRoot/node_modules/.pnpm).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Watch the pnpm virtual store so Metro can find the actual package files
// that the symlinks in node_modules point into.
// Also watch lib/ so Metro follows symlinks into workspace packages like
// @workspace/api-client-react that live in lib/ rather than node_modules.
// NOTE: do NOT add the full workspaceRoot — it breaks babel-preset-expo resolution.
config.watchFolders = [
  path.resolve(workspaceRoot, "node_modules/.pnpm"),
  path.resolve(workspaceRoot, "lib"),
];

module.exports = config;
