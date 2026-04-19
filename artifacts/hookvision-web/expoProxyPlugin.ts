import type { Plugin } from "vite";
import http from "http";
import type { IncomingMessage, ServerResponse } from "http";

const APPS: Record<string, { port: number; name: string }> = {
  wa: { port: 25351, name: "HookVision WA" },
  nq: { port: 25352, name: "HookVision NQ" },
  nt: { port: 25353, name: "HookVision NT" },
};

function proxyRequest(
  targetPort: number,
  targetPath: string,
  req: IncomingMessage,
  res: ServerResponse,
  appKey: string,
  basePath: string
): void {
  const prefix = `${basePath}/proxy/${appKey}`;

  const options: http.RequestOptions = {
    hostname: "localhost",
    port: targetPort,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: `localhost:${targetPort}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const contentType = proxyRes.headers["content-type"] || "";

    if (contentType.includes("text/html")) {
      let body = "";
      proxyRes.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      proxyRes.on("end", () => {
        // Rewrite absolute paths in HTML to include proxy prefix
        body = body
          .replace(/src="\/(?!\/|proxy\/)/g, `src="${prefix}/`)
          .replace(/href="\/(?!\/|proxy\/)/g, `href="${prefix}/`)
          .replace(/url\("\/(?!\/|proxy\/)/g, `url("${prefix}/`);

        // Inject URL-rewriting monkey-patch before </head>
        const injection = `<script>
(function(){
  var PFX = '${prefix}';
  var BASE = '${basePath}';
  function fix(url){
    if(typeof url!=='string') return url;
    if(url.startsWith('/') && !url.startsWith(PFX) && !url.startsWith(BASE+'/__') && !url.startsWith('/__')){
      return PFX+url;
    }
    return url;
  }
  var oFetch=window.fetch;
  window.fetch=function(u,o){return oFetch(fix(u),o);};
  var oOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){
    var args=Array.from(arguments);
    args[1]=fix(u);
    return oOpen.apply(this,args);
  };
  var oWS=window.WebSocket;
  if(oWS){
    window.WebSocket=function(u,p){
      try{ return new oWS(fix(u),p); } catch(e){ return new oWS(u,p); }
    };
    Object.setPrototypeOf(window.WebSocket,oWS);
  }
})();
</script>`;
        body = body.replace("</head>", injection + "\n</head>");

        const respHeaders: http.OutgoingHttpHeaders = {
          ...proxyRes.headers,
          "content-type": "text/html; charset=utf-8",
          "content-length": Buffer.byteLength(body),
          "cache-control": "no-store",
        };
        delete respHeaders["content-encoding"];
        delete respHeaders["transfer-encoding"];

        res.writeHead(proxyRes.statusCode ?? 200, respHeaders);
        res.end(body);
      });
    } else {
      const respHeaders = { ...proxyRes.headers };
      delete respHeaders["content-encoding"];
      res.writeHead(proxyRes.statusCode ?? 200, respHeaders);
      proxyRes.pipe(res, { end: true });
    }
  });

  proxyReq.on("error", (err) => {
    console.warn(`[expo-proxy] ${appKey}:${targetPort} error:`, err.message);
    res.writeHead(502);
    res.end(`Cannot reach ${APPS[appKey]?.name ?? appKey} (port ${targetPort}). Is the Expo server running?`);
  });

  if (req.method !== "GET" && req.method !== "HEAD") {
    req.pipe(proxyReq, { end: true });
  } else {
    proxyReq.end();
  }
}

export function expoProxyPlugin(basePath: string): Plugin {
  return {
    name: "expo-app-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "/";

        for (const [appKey, app] of Object.entries(APPS)) {
          const mountPath = `${basePath}/proxy/${appKey}`;
          if (url === mountPath || url.startsWith(mountPath + "/") || url.startsWith(mountPath + "?")) {
            const targetPath = url.slice(mountPath.length) || "/";
            proxyRequest(app.port, targetPath || "/", req, res, appKey, basePath);
            return;
          }
        }

        next();
      });
    },
  };
}
