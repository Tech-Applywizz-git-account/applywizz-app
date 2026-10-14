import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { attachAxiosNetworkLog } from "./networkLog";
import { createMobileBalancedAdapter } from "./requestLanes";

// Hosted Applywizz API (used when apiMode is not "local").
const DEFAULT_API_ORIGIN = "https://invoice-ge4q.onrender.com";

export function resolveHost() {
  // Optional override: EXPO_PUBLIC_API_HOST=192.168.x.x for local Django on LAN
  const forced =
    process.env.EXPO_PUBLIC_API_HOST
    || Constants.expoConfig?.extra?.apiHost
    || "";
  if (forced) return String(forced).trim();

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    "";
  const ip = String(hostUri).split(":")[0].trim();
  // Prefer Metro's LAN IP (works for physical devices on same Wi‑Fi).
  if (ip && ip !== "127.0.0.1" && ip !== "localhost") return ip;
  // Android emulator loopback to host machine.
  if (Platform.OS === "android") return "10.0.2.2";
  return "127.0.0.1";
}

export function resolveApiOrigin() {
  // Always use hosted Render unless EXPO_PUBLIC_API_MODE=local is set in app.config extra.
  const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};
  // Ignore stale process.env MODE=local from older Metro transforms — only trust app.config.
  const mode = String(extra.apiMode || "production").trim().toLowerCase();

  if (mode === "local") {
    return `http://${resolveHost()}:8000`;
  }

  return String(extra.apiUrl || DEFAULT_API_ORIGIN).trim().replace(/\/$/, "")
    || DEFAULT_API_ORIGIN;
}

export const API_ORIGIN = resolveApiOrigin();
export const API_BASE = `${API_ORIGIN}/api/v1`;

if (__DEV__) {
  // Helps diagnose "Network Error" when phone can't reach Django.
  // eslint-disable-next-line no-console
  console.log("[api] baseURL =", API_BASE);
}

const defaultAdapter = axios.getAdapter(axios.defaults.adapter);

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
  adapter: createMobileBalancedAdapter(defaultAdapter),
});

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

let _tokenCache = { access: null, legacy: null, loaded: false };

/** Single-flight refresh so parallel 401s don't race and wipe the session. */
let isRefreshing = false;
let refreshWaiters = [];

function resolveRefreshWaiters(error, token = null) {
  const waiters = refreshWaiters;
  refreshWaiters = [];
  waiters.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
}

export async function warmTokenCache() {
  const [access, legacy] = await Promise.all([
    AsyncStorage.getItem("access"),
    AsyncStorage.getItem("legacy_access"),
  ]);
  _tokenCache = { access, legacy, loaded: true };
}

export function clearTokenCache() {
  _tokenCache = { access: null, legacy: null, loaded: false };
}

export async function setCachedTokens({ access, legacy } = {}) {
  if (access !== undefined) {
    _tokenCache.access = access;
    if (access) await AsyncStorage.setItem("access", access);
    else await AsyncStorage.removeItem("access");
  }
  if (legacy !== undefined) {
    _tokenCache.legacy = legacy;
    if (legacy) await AsyncStorage.setItem("legacy_access", legacy);
    else await AsyncStorage.removeItem("legacy_access");
  }
  _tokenCache.loaded = true;
}

function requestUrl(config) {
  return String(config?.url || "");
}

function isAuthLoginRequest(config) {
  const url = requestUrl(config);
  return url.includes("/auth/login/") && !url.includes("/auth/login/refresh/");
}

function isRefreshRequest(config) {
  return requestUrl(config).includes("/auth/login/refresh/");
}

function isAuthBootstrapRequest(config) {
  const url = requestUrl(config);
  // Never treat these as session-killing auth failures mid-flow.
  return (
    isAuthLoginRequest(config)
    || isRefreshRequest(config)
    || url.includes("/auth/register/")
  );
}

function shouldForceLogoutOnRefreshError(err) {
  const status = err?.response?.status;
  // Only clear the session when the refresh token itself is rejected.
  // Network / 5xx must NOT log the user out.
  return status === 401 || status === 403 || status === 400;
}

async function refreshAccessToken() {
  const refresh = await AsyncStorage.getItem("refresh");
  if (!refresh) {
    const err = new Error("No refresh token");
    err.response = { status: 401 };
    throw err;
  }
  const { data } = await axios.post(
    `${API_BASE}/auth/login/refresh/`,
    { refresh },
    { timeout: 20000 },
  );
  if (!data?.access) {
    const err = new Error("Refresh response missing access token");
    err.response = { status: 401 };
    throw err;
  }
  await setCachedTokens({ access: data.access });
  // SimpleJWT rotation returns a new refresh — keep AsyncStorage in sync.
  if (data.refresh) {
    await AsyncStorage.setItem("refresh", data.refresh);
  }
  return data.access;
}

api.interceptors.request.use(async (config) => {
  if (!_tokenCache.loaded) {
    await warmTokenCache();
  }
  // Never attach a stale Bearer token to login — it only confuses 401 handling.
  if (!isAuthLoginRequest(config)) {
    if (_tokenCache.access) config.headers.Authorization = `Bearer ${_tokenCache.access}`;
    if (_tokenCache.legacy) config.headers["X-Legacy-Token"] = _tokenCache.legacy;
  }
  // Let RN set multipart boundary for FormData uploads (dispute evidence PDFs).
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
    }
  }
  config.__netLogStarted = Date.now();
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (
      error?.code === "ERR_CANCELED"
      || error?.name === "CanceledError"
      || error?.message === "canceled"
    ) {
      return Promise.reject(error);
    }

    const original = error.config || {};
    const status = error.response?.status;

    if (__DEV__ && !error.response) {
      // eslint-disable-next-line no-console
      console.warn(
        "[api] network failure",
        original?.baseURL || API_BASE,
        original?.url,
        error.message,
      );
    }

    // Login / register / refresh 401s are handled by the caller — never force sign-out here.
    if (isAuthBootstrapRequest(original)) {
      return Promise.reject(error);
    }

    if (status === 401 && !original._retry) {
      // Queue behind an in-flight refresh
      if (isRefreshing) {
        try {
          const token = await new Promise((resolve, reject) => {
            refreshWaiters.push({ resolve, reject });
          });
          original._retry = true;
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        } catch (e) {
          return Promise.reject(e);
        }
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const access = await refreshAccessToken();
        resolveRefreshWaiters(null, access);
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch (refreshErr) {
        resolveRefreshWaiters(refreshErr, null);
        if (shouldForceLogoutOnRefreshError(refreshErr)) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn(
              "[api] refresh rejected — signing out",
              refreshErr?.response?.status,
              original?.url,
            );
          }
          clearTokenCache();
          try {
            await AsyncStorage.multiRemove(["access", "refresh", "legacy_access", "legacy_refresh"]);
          } catch {
            /* ignore */
          }
          if (onUnauthorized) onUnauthorized();
        } else if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn(
            "[api] refresh failed (network/server) — keeping session",
            refreshErr?.message || refreshErr,
          );
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

attachAxiosNetworkLog(api);

/** True when the request was aborted via AbortController / axios cancel. */
export function isRequestCanceled(error) {
  return (
    error?.code === "ERR_CANCELED"
    || error?.name === "CanceledError"
    || error?.message === "canceled"
    || axios.isCancel?.(error)
  );
}

export default api;
