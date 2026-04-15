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

config.server.rewriteRequestUrl = (url) => {
  if (url.startsWith(BASE + "/")) {
    return url.slice(BASE.length);
  }
  if (url.startsWith(BASE + "?")) {
    return "/" + url.slice(BASE.length);
  }
  return url;
};

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
