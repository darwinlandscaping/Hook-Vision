const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const BASE = "/hookvision";

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

// The Replit proxy routes /hookvision/* to WA's port ($PORT) and strips the prefix.
// Strategy:
//   - Root request "/" → rewrite to "/hookvision/" so Metro includes
//     transform.baseUrl=%2Fhookvision in the generated HTML bundle URL.
//   - Asset/bundle requests arrive without prefix (already stripped by proxy)
//     or with prefix (direct Metro access) → strip prefix so Metro serves them.
config.server.rewriteRequestUrl = (url) => {
  const [urlPath, query] = url.split("?");
  const qs = query ? "?" + query : "";
  // Navigation URLs (no extension = Expo Router deep link) → add BASE prefix so
  // Metro generates the HTML with transform.baseUrl=%2Fhookvision.
  if (urlPath === "/" || urlPath === "" || urlPath === BASE || urlPath === BASE + "/") {
    return BASE + "/" + qs;
  }
  // Deep-link routes (e.g. /some-screen) that the proxy forwards without prefix.
  // Exclude Metro internal paths: /assets/, /_expo/, /hot, /symbolicate — they
  // should reach Metro as-is (no BASE prefix) so Metro serves binary/JSON correctly.
  const isMetroInternalPath = urlPath.startsWith("/assets") || urlPath.startsWith("/_expo") ||
    urlPath === "/hot" || urlPath === "/symbolicate" || urlPath === "/open-stack-frame";
  if (!isMetroInternalPath && !urlPath.includes(".") && !urlPath.startsWith(BASE + "/")) {
    return BASE + urlPath + qs;
  }
  // Asset/bundle requests that still carry the BASE prefix → strip it.
  if (url.startsWith(BASE + "/")) {
    return url.slice(BASE.length);
  }
  // NQ/NT asset requests routed through WA's Metro — strip their prefix so
  // Metro looks in WA's own assets directory (where their files are mirrored).
  if ((urlPath.startsWith("/hookvision-nq/") || urlPath.startsWith("/hookvision-nt/")) && urlPath.includes(".")) {
    return url.replace(/^\/(hookvision-nq|hookvision-nt)/, "");
  }
  return url;
};

// Intercept Metro's HTML response: disable lazy bundling so the full
// app bundle loads synchronously (avoids a flash of the not-found screen
// while lazy route modules are still downloading).
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    const urlPath = (req.url || "").split("?")[0];
    // Exclude Metro internal paths (/assets/, /_expo/, /hot, /symbolicate etc.)
    // even though they have no dots — they serve binary/JSON, not HTML.
    const isMetroInternal = urlPath.startsWith("/assets") || urlPath.startsWith("/_expo") ||
      urlPath === "/hot" || urlPath === "/symbolicate" || urlPath === "/open-stack-frame";
    const isHtmlRequest = !isMetroInternal && (urlPath === BASE + "/" || urlPath === BASE ||
      urlPath === "/" || urlPath === "" || !urlPath.includes("."));

    if (!isHtmlRequest) {
      return middleware(req, res, next);
    }

    const originalEnd = res.end.bind(res);
    let buf = "";

    res.write = (chunk) => {
      buf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      return true;
    };

    res.end = (chunk, ...args) => {
      if (chunk) {
        buf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      }
      if (buf.includes("<html") || buf.includes("<!DOCTYPE")) {
        // 1. Add /hookvision prefix to root-relative asset URLs so the
        //    Replit proxy routes them to THIS Metro server.
        buf = buf
          .replace(/src="\/node_modules\//g, `src="${BASE}/node_modules/`)
          .replace(/href="\/node_modules\//g, `href="${BASE}/node_modules/`)
          .replace(/src="\/assets\//g, `src="${BASE}/assets/`)
          .replace(/href="\/assets\//g, `href="${BASE}/assets/`)
          .replace(/src="\/_expo\//g, `src="${BASE}/_expo/`)
          .replace(/href="\/_expo\//g, `href="${BASE}/_expo/`);
        // Force eager bundle loading — swap lazy=true → lazy=false so ALL route
        // modules are included in the initial download. This avoids the brief
        // not-found flash while lazy route modules are still downloading.
        buf = buf.replace(/\blazy=true\b/g, "lazy=false");
        res.setHeader("Content-Length", Buffer.byteLength(buf, "utf8"));
        return originalEnd(buf, "utf8");
      }
      return originalEnd(buf || chunk, ...args);
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
