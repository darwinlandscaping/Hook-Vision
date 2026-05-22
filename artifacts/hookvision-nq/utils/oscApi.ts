/**
 * Insta360 Open Platform — OSC network transport layer.
 *
 * Races XMLHttpRequest vs fetch() on every call so that on Android,
 * whichever network stack actually routes through the camera WiFi wins.
 * This is the core fix for Samsung Smart Network Switch / Adaptive WiFi.
 */

const DEFAULT_TIMEOUT_MS = 8000;

function xhrPost(url: string, body: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = timeoutMs;
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.onerror   = () => reject(new Error("network_error"));
    xhr.onload    = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
      else reject(new Error(`http_${xhr.status}`));
    };
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(body);
  });
}

async function fetchPost(url: string, body: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body,
      signal:  ctrl.signal,
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return res.text();
  } finally {
    clearTimeout(timer);
  }
}

function xhrGet(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = timeoutMs;
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.onerror   = () => reject(new Error("network_error"));
    xhr.onload    = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
      else reject(new Error(`http_${xhr.status}`));
    };
    xhr.open("GET", url, true);
    xhr.setRequestHeader("Cache-Control", "no-store");
    xhr.send();
  });
}

async function fetchGet(url: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "Cache-Control": "no-store" },
      signal:  ctrl.signal,
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return res.text();
  } finally {
    clearTimeout(timer);
  }
}

function race(
  a: Promise<string>,
  b: Promise<string>,
): Promise<any> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let errCount = 0;
    const errors: string[] = [];
    const done = (text: string) => {
      if (!settled) { settled = true; resolve(JSON.parse(text)); }
    };
    const fail = (e: Error) => {
      errors.push(e.message);
      if (++errCount === 2 && !settled) {
        settled = true;
        reject(new Error(errors.includes("timeout") ? "timeout" : errors[0]));
      }
    };
    a.then(done).catch(fail);
    b.then(done).catch(fail);
  });
}

/**
 * Execute an OSC command via POST /osc/commands/execute
 */
export async function oscCommand(
  baseUrl: string,
  name: string,
  parameters: Record<string, unknown> = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<any> {
  const url  = `${baseUrl}/osc/commands/execute`;
  const body = JSON.stringify({ name, parameters });
  return race(xhrPost(url, body, timeoutMs), fetchPost(url, body, timeoutMs));
}

/**
 * GET any OSC endpoint (state, info, status poll)
 */
export async function oscGet(
  baseUrl: string,
  path: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<any> {
  const url = `${baseUrl}${path}`;
  return race(xhrGet(url, timeoutMs), fetchGet(url, timeoutMs));
}

/**
 * Poll an in-progress command until state === "done" or error.
 */
export async function oscPoll(
  baseUrl: string,
  commandId: string,
  timeoutMs: number,
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 800));
    try {
      const data = await oscGet(
        baseUrl,
        `/osc/commands/status?id=${encodeURIComponent(commandId)}`,
        5000,
      );
      if (data.state === "done")  return data;
      if (data.state === "error") throw new Error(data.error?.message ?? "command_error");
    } catch (e: any) {
      if (e?.message === "timeout" || e?.message === "network_error") continue;
      throw e;
    }
  }
  throw new Error("osc_timeout");
}

/**
 * Execute a command + auto-poll if it returns inProgress.
 */
export async function oscRun(
  baseUrl: string,
  name: string,
  parameters: Record<string, unknown> = {},
  pollTimeoutMs = 20000,
): Promise<any> {
  const result = await oscCommand(baseUrl, name, parameters, 10000);
  if (result.state === "inProgress" && result.id) {
    return oscPoll(baseUrl, result.id, pollTimeoutMs);
  }
  return result;
}
