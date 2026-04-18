const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const BASE = "/crocguard";

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
  return url;
};

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    if (req.headers && req.headers.host && req.headers.host.includes(":")) {
      req.headers.host = req.headers.host.replace(/:\d+$/, "");
    }

    const urlPath = (req.url || "").split("?")[0];
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

module.exports = config;
