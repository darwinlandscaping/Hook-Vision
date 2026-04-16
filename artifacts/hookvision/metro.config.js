const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs   = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const BASE = "/hookvision";

const NQ_ROOT = path.resolve(projectRoot, "../hookvision-nq");
const NT_ROOT = path.resolve(projectRoot, "../hookvision-nt");

const MIME = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2",
  js: "application/javascript", json: "application/json",
};

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

config.server.rewriteRequestUrl = (url) => {
  const [urlPath, query] = url.split("?");
  const qs = query ? "?" + query : "";
  if (urlPath === "/" || urlPath === "" || urlPath === BASE || urlPath === BASE + "/") {
    return BASE + "/" + qs;
  }
  const isMetroInternalPath = urlPath.startsWith("/assets") || urlPath.startsWith("/_expo") ||
    urlPath === "/hot" || urlPath === "/symbolicate" || urlPath === "/open-stack-frame";
  if (!isMetroInternalPath && !urlPath.includes(".") && !urlPath.startsWith(BASE + "/")) {
    return BASE + urlPath + qs;
  }
  if (url.startsWith(BASE + "/")) {
    return url.slice(BASE.length);
  }
  // Strip NQ/NT prefix so asset path becomes /assets/...
  if ((urlPath.startsWith("/hookvision-nq/") || urlPath.startsWith("/hookvision-nt/")) && urlPath.includes(".")) {
    return url.replace(/^\/(hookvision-nq|hookvision-nt)/, "");
  }
  return url;
};

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    const urlPath = (req.url || "").split("?")[0];

    // ── Direct filesystem asset serving ────────────────────────────────────
    // Metro's registry only contains assets require()'d by WA's own bundle.
    // NQ/NT assets (e.g. splash-coral.png) are unknown to that registry.
    // Serve all /assets/ requests directly from disk, checking all 3 projects.
    if (urlPath.startsWith("/assets/") && urlPath.includes(".")) {
      const candidates = [
        path.join(projectRoot, urlPath),
        path.join(NQ_ROOT, urlPath),
        path.join(NT_ROOT, urlPath),
      ];
      for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath).slice(1).toLowerCase();
          res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          res.setHeader("Access-Control-Allow-Origin", "*");
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }
      // Not found in any project — fall through to Metro (returns 404 gracefully)
    }

    // ── HTML response injection ─────────────────────────────────────────────
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
      if (chunk) buf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      if (buf.includes("<html") || buf.includes("<!DOCTYPE")) {
        buf = buf
          .replace(/src="\/node_modules\//g, `src="${BASE}/node_modules/`)
          .replace(/href="\/node_modules\//g, `href="${BASE}/node_modules/`)
          .replace(/src="\/assets\//g, `src="${BASE}/assets/`)
          .replace(/href="\/assets\//g, `href="${BASE}/assets/`)
          .replace(/src="\/_expo\//g, `src="${BASE}/_expo/`)
          .replace(/href="\/_expo\//g, `href="${BASE}/_expo/`);
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
  if (moduleName === "react-native-fs") return { filePath: rnFsStub, type: "sourceFile" };
  if (moduleName === "@tensorflow/tfjs-react-native") return { filePath: tfjsRNStub, type: "sourceFile" };
  if (originalResolveRequest) return originalResolveRequest(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
