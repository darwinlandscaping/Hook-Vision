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

// Stub out react-native-fs — it is only referenced inside
// @tensorflow/tfjs-react-native's bundle_resource_io.js, which we never
// call (our CV pipeline runs server-side). Without this stub, Android
// bundling fails with "Unable to resolve react-native-fs".
const rnFsStub = path.resolve(projectRoot, "stubs/react-native-fs.js");
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-fs") {
    return { filePath: rnFsStub, type: "sourceFile" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
