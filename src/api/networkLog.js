/**
 * Ring-buffer network logger for mobile axios traffic.
 * Bodies truncated; Authorization / tokens redacted.
 */

const MAX_ENTRIES = 200;
const MAX_BODY = 4000;

const store = [];
const listeners = new Set();

function redactHeaders(headers) {
  if (!headers || typeof headers !== "object") return {};
  const out = {};
  Object.keys(headers).forEach((k) => {
    const key = String(k);
    const lower = key.toLowerCase();
    if (lower === "authorization" || lower === "cookie" || lower === "x-legacy-token") {
      out[key] = "[redacted]";
    } else {
      out[key] = headers[k];
    }
  });
  return out;
}

function safeBody(data) {
  if (data == null) return null;
  if (typeof FormData !== "undefined" && data instanceof FormData) return "[FormData]";
  try {
    const s = typeof data === "string" ? data : JSON.stringify(data);
    if (s.length > MAX_BODY) return `${s.slice(0, MAX_BODY)}…`;
    return s;
  } catch {
    return "[unserializable]";
  }
}

function emit() {
  listeners.forEach((fn) => {
    try { fn(store.slice()); } catch { /* ignore */ }
  });
}

export function subscribeNetworkLog(fn) {
  listeners.add(fn);
  fn(store.slice());
  return () => listeners.delete(fn);
}

export function getNetworkLog() {
  return store.slice();
}

export function clearNetworkLog() {
  store.length = 0;
  emit();
}

export function pushNetworkLog(entry) {
  const row = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    ...entry,
  };
  store.unshift(row);
  if (store.length > MAX_ENTRIES) store.length = MAX_ENTRIES;
  emit();
  return row;
}

export function attachAxiosNetworkLog(api) {
  api.interceptors.request.use((config) => {
    config.__netLogStarted = Date.now();
    config.__netLogId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return config;
  });

  api.interceptors.response.use(
    (response) => {
      const cfg = response.config || {};
      const started = cfg.__netLogStarted || Date.now();
      pushNetworkLog({
        method: String(cfg.method || "get").toUpperCase(),
        url: `${cfg.baseURL || ""}${cfg.url || ""}`,
        status: response.status,
        ok: true,
        ms: Date.now() - started,
        requestHeaders: redactHeaders(cfg.headers),
        requestBody: safeBody(cfg.data),
        responseBody: safeBody(response.data),
      });
      return response;
    },
    (error) => {
      const cfg = error.config || {};
      const started = cfg.__netLogStarted || Date.now();
      pushNetworkLog({
        method: String(cfg.method || "get").toUpperCase(),
        url: `${cfg.baseURL || ""}${cfg.url || ""}`,
        status: error.response?.status || 0,
        ok: false,
        ms: Date.now() - started,
        requestHeaders: redactHeaders(cfg.headers),
        requestBody: safeBody(cfg.data),
        responseBody: safeBody(error.response?.data || { message: error.message }),
        error: error.message,
      });
      return Promise.reject(error);
    },
  );
}
