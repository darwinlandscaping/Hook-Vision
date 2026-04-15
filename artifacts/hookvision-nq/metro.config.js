const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const BASE = "/hookvision-nq";

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

// Strip the /hookvision-nq prefix from incoming URLs so Metro handles
// them at their normal root-relative paths.
config.server.rewriteRequestUrl = (url) => {
  if (url.startsWith(BASE + "/")) {
    return url.slice(BASE.length);
  }
  if (url.startsWith(BASE + "?")) {
    return "/" + url.slice(BASE.length);
  }
  return url;
};

// Intercept Metro's HTML response and prefix every root-relative asset
// src/href with /hookvision-nq so the Replit proxy routes asset fetches
// to this bundler (port 25352) instead of the NT bundler (port 25351).
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    let isHtml = false;
    let buf = "";

    const origSetHeader = res.setHeader.bind(res);
    res.setHeader = (name, value) => {
      if (name.toLowerCase() === "content-type" && String(value).includes("text/html")) {
        isHtml = true;
      }
      origSetHeader(name, value);
    };

    res.write = (chunk, ...args) => {
      if (isHtml) {
        buf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
        return true;
      }
      return originalWrite(chunk, ...args);
    };

    res.end = (chunk, ...args) => {
      if (isHtml) {
        if (chunk) {
          buf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
        }
        // Rewrite root-relative asset paths → /hookvision-nq/... so the
        // Replit proxy routes them back to this service (port 25352).
        buf = buf
          .replace(/src="\/node_modules\//g, `src="${BASE}/node_modules/`)
          .replace(/href="\/node_modules\//g, `href="${BASE}/node_modules/`)
          .replace(/src="\/assets\//g, `src="${BASE}/assets/`)
          .replace(/href="\/assets\//g, `href="${BASE}/assets/`)
          .replace(/src="\/_expo\//g, `src="${BASE}/_expo/`)
          .replace(/href="\/_expo\//g, `href="${BASE}/_expo/`);
        res.setHeader("Content-Length", Buffer.byteLength(buf, "utf8"));
        return originalEnd(buf, "utf8");
      }
      return originalEnd(chunk, ...args);
    };

    middleware(req, res, next);
  };
};

// Stub out react-native-fs — it is only referenced inside
// @tensorflow/tfjs-react-native's bundle_resource_io.js, which we never
// call (our CV pipeline runs server-side). Without this stub, Android
// bundling fails with "Unable to resolve react-native-fs".
const rnFsStub       = path.resolve(projectRoot, "stubs/react-native-fs.js");
const tfjsRNStub     = path.resolve(projectRoot, "stubs/tfjs-react-native.js");

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // react-native-fs — used by tfjs-react-native bundle_resource_io, never called
  if (moduleName === "react-native-fs") {
    return { filePath: rnFsStub, type: "sourceFile" };
  }
  // @tensorflow/tfjs-react-native — requires ExpoGL which Expo Go lacks;
  // stub it so vision.native.ts (and therefore index.tsx) can load at all.
  // quickScan falls back gracefully via try-catch when decodeJpeg returns null.
  if (moduleName === "@tensorflow/tfjs-react-native") {
    return { filePath: tfjsRNStub, type: "sourceFile" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
