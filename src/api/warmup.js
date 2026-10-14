import axios from "axios";
import { AppState } from "react-native";
import { API_ORIGIN } from "./client";

/** Render free/sleeping instances often need one wake hop before APIs are fast. */
const PING_URL = `${API_ORIGIN}/api/v1/ping/`;
const KEEP_ALIVE_MS = 3 * 60 * 1000; // every 3 min while app is foregrounded
const COLD_MS = 2500;

let warmPromise = null;
let lastOkAt = 0;
let keepAliveTimer = null;
let appStateSub = null;
const listeners = new Set();

function emit(status) {
  listeners.forEach((fn) => {
    try { fn(status); } catch { /* ignore */ }
  });
}

export function subscribeWarmStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getWarmMeta() {
  return {
    lastOkAt,
    warming: Boolean(warmPromise),
    origin: API_ORIGIN,
  };
}

/**
 * Hit the cheapest backend route to wake Render / confirm connectivity.
 * Dedupes concurrent callers. Safe to call often.
 */
export async function warmBackend({ force = false } = {}) {
  const fresh = Date.now() - lastOkAt < 45_000;
  if (!force && fresh) return { ok: true, ms: 0, cached: true };
  if (warmPromise) return warmPromise;

  const started = Date.now();
  emit({ state: "warming", startedAt: started });

  warmPromise = (async () => {
    try {
      const res = await axios.get(PING_URL, {
        timeout: 25000,
        headers: { Accept: "application/json" },
        validateStatus: (s) => s >= 200 && s < 500,
      });
      const ms = Date.now() - started;
      if (res.status >= 200 && res.status < 400) {
        lastOkAt = Date.now();
        emit({ state: ms >= COLD_MS ? "cold" : "ready", ms, at: lastOkAt });
        return { ok: true, ms, cold: ms >= COLD_MS };
      }
      emit({ state: "error", ms, status: res.status });
      return { ok: false, ms, status: res.status };
    } catch (e) {
      const ms = Date.now() - started;
      emit({ state: "error", ms, message: e?.message });
      return { ok: false, ms, error: e };
    } finally {
      warmPromise = null;
    }
  })();

  return warmPromise;
}

/** Keep the Render instance warm while the app is open. */
export function startBackendKeepAlive() {
  stopBackendKeepAlive();
  warmBackend({ force: false }).catch(() => {});

  keepAliveTimer = setInterval(() => {
    if (AppState.currentState === "active") {
      warmBackend({ force: true }).catch(() => {});
    }
  }, KEEP_ALIVE_MS);

  appStateSub = AppState.addEventListener("change", (state) => {
    if (state === "active") warmBackend({ force: false }).catch(() => {});
  });
}

export function stopBackendKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}
