const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const BASE = "/hookvision-nt";

const config = getDefaultConfig(projectRoot);


config.resolver.unstable_enableSymlinks = true;

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.watchFolders = [
  path.resolve(workspaceRoot, "node_modules/.pnpm"),
  path.resolve(workspaceRoot, "lib"),
];

// The Replit proxy routes /hookvision-nt/* to port 25353 and strips the prefix.
// Strategy:
//   - Root request "/" → rewrite to "/hookvision-nt/" so Metro includes
//     transform.baseUrl=%2Fhookvision-nt in the generated HTML bundle URL.
//   - Asset/bundle requests arrive without prefix (already stripped by proxy)
//     or with prefix (direct Metro access) → strip prefix so Metro serves them.
config.server.rewriteRequestUrl = (url) => {
  const [urlPath, query] = url.split("?");
  const qs = query ? "?" + query : "";
  // Navigation URLs (no extension = Expo Router deep link) → add BASE prefix so
  // Metro generates the HTML with transform.baseUrl=%2Fhookvision-nt.
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
  return url;
};

// Intercept Metro's HTML response: disable lazy bundling so the full
// app bundle loads synchronously (avoids a flash of the not-found screen
// while lazy route modules are still downloading).
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    // Strip explicit port from the Host header so Expo's CorsMiddleware
    // accepts requests routed via the Replit proxy.
    if (req.headers && req.headers.host && req.headers.host.includes(":")) {
      req.headers.host = req.headers.host.replace(/:\d+$/, "");
    }
    // Normalize the Origin header: the Replit iframe sends an origin with the
    // .expo. subdomain (e.g. abc.expo.spock.replit.dev) but the Host header
    // (after port-stripping) has no .expo. — so CorsMiddleware rejects it.
    // Strip .expo. from the origin so it matches the host.
    if (req.headers && req.headers.origin) {
      req.headers.origin = req.headers.origin.replace(/\.expo\./g, ".");
    }

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
        // 1. Add /hookvision-nt prefix to root-relative asset URLs so the
        //    Replit proxy routes them to THIS Metro server (port 25353).
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

const rnFsStub   = path.resolve(projectRoot, "stubs/react-native-fs.js");
const tfjsRNStub = path.resolve(projectRoot, "stubs/tfjs-react-native.js");

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-fs") {
    return { filePath: rnFsStub, type: "sourceFile" };
  }
  if (moduleName === "@tensorflow/tfjs-react-native") {
    return { filePath: tfjsRNStub, type: "sourceFile" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
