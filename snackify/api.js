import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { enqueuePendingOrder } from "./tokenCache";

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim(),
  );
}

export function newClientOrderId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch (_) { /* ignore */ }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DEFAULT_ORIGIN = "https://snackify-inventory-tool.onrender.com";

export function snackifyOrigin() {
  const forced =
    process.env.EXPO_PUBLIC_SNACKIFY_API_URL
    || Constants.expoConfig?.extra?.snackifyApiUrl
    || "";
  if (forced) return String(forced).trim().replace(/\/$/, "");
  return DEFAULT_ORIGIN;
}

export const SNACKIFY_ORIGIN = snackifyOrigin();

function supabaseConfig() {
  const url = (
    process.env.EXPO_PUBLIC_SNACKIFY_SUPABASE_URL
    || Constants.expoConfig?.extra?.snackifySupabaseUrl
    || ""
  ).trim().replace(/\/$/, "");
  const anon = (
    process.env.EXPO_PUBLIC_SNACKIFY_SUPABASE_ANON_KEY
    || Constants.expoConfig?.extra?.snackifySupabaseAnonKey
    || ""
  ).trim();
  return { url, anon };
}

const ACCESS = "snackify.access";
const REFRESH = "snackify.refresh";
const PROFILE = "snackify.profile";
const PREFS = "snackify.prefs";

export const PANTRY_UNAVAILABLE =
  "Pantry live data isn’t available on this device. You can still browse Snackify.";

const http = axios.create({
  baseURL: SNACKIFY_ORIGIN,
  timeout: 25000,
  headers: { "Content-Type": "application/json" },
});

let accessMem = null;
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

function jwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const pad = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const raw = typeof globalThis.atob === "function"
      ? globalThis.atob(pad)
      : null;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function supabaseUrlFromToken(access) {
  const iss = jwtPayload(access)?.iss;
  if (!iss || typeof iss !== "string") return "";
  return iss.replace(/\/auth\/v1\/?$/, "");
}

function isAuthPath(path) {
  return String(path || "").includes("/api/auth/");
}

function asToken(v) {
  return typeof v === "string" && v.length > 20 ? v : null;
}

export function extractSnackifyTokens(data) {
  const nested = data?.data && typeof data.data === "object" && !Array.isArray(data.data)
    ? data.data
    : {};
  const session = data?.session || nested.session || {};
  const tokens = data?.tokens || nested.tokens || {};
  const access =
    asToken(data?.access_token) || asToken(data?.accessToken) || asToken(data?.token) || asToken(data?.jwt)
    || asToken(data?.access)
    || asToken(nested.access_token) || asToken(nested.accessToken) || asToken(nested.token) || asToken(nested.jwt)
    || asToken(nested.access)
    || asToken(session.access_token) || asToken(session.accessToken)
    || asToken(tokens.access) || asToken(tokens.access_token);
  const refresh =
    asToken(data?.refresh_token) || asToken(data?.refreshToken)
    || asToken(nested.refresh_token) || asToken(nested.refreshToken)
    || asToken(session.refresh_token) || asToken(session.refreshToken)
    || asToken(tokens.refresh) || asToken(tokens.refresh_token);
  const profile =
    data?.profile || data?.user
    || nested.profile || nested.user
    || session.user || session.profile
    || null;
  return { access, refresh, profile };
}

let guestInflight = null;
let guestIdentity = { email: "", name: "" };

export function setSnackifyGuestIdentity({ email, name } = {}) {
  guestIdentity = {
    email: String(email || "").trim().toLowerCase(),
    name: String(name || "").trim(),
  };
}

function guestLoginPayload(emailOverride) {
  const email = String(emailOverride || guestIdentity.email || "").trim().toLowerCase();
  const name = guestIdentity.name || (email.includes("@") ? email.split("@")[0] : "");
  return { email, name };
}

/** Mint a pantry Bearer via guest-login if we do not already have one. */
export async function ensureSnackifyBearer(emailOverride) {
  const existing = asToken(accessMem) || asToken(await AsyncStorage.getItem(ACCESS));
  if (existing) {
    accessMem = existing;
    return existing;
  }
  if (!guestInflight) {
    guestInflight = (async () => {
      const body = guestLoginPayload(emailOverride);
      if (!body.email || !body.email.includes("@")) {
        throw new Error("Applywizz email is required for pantry access.");
      }
      const { data } = await http.post("/api/auth/guest-login", body);
      const next = extractSnackifyTokens(data);
      if (!next.access) {
        console.log("[snackify] guest-login payload keys:", data && typeof data === "object" ? Object.keys(data) : data);
        throw new Error("Pantry guest login returned no token");
      }
      await saveSnackifySession({
        access: next.access,
        refresh: next.refresh,
        profile: next.profile || { email: body.email, name: body.name },
      });
      return next.access;
    })().finally(() => {
      guestInflight = null;
    });
  }
  return guestInflight;
}

export async function loadSnackifyTokens() {
  const [access, refresh, profileRaw, prefsRaw] = await Promise.all([
    AsyncStorage.getItem(ACCESS),
    AsyncStorage.getItem(REFRESH),
    AsyncStorage.getItem(PROFILE),
    AsyncStorage.getItem(PREFS),
  ]);
  accessMem = access;
  let profile = null;
  let prefs = null;
  try { profile = profileRaw ? JSON.parse(profileRaw) : null; } catch (_) { profile = null; }
  try { prefs = prefsRaw ? JSON.parse(prefsRaw) : null; } catch (_) { prefs = null; }
  return { access, refresh, profile, prefs };
}

export async function saveSnackifySession({ access, refresh, profile, prefs }) {
  const ops = [];
  if (access !== undefined) {
    accessMem = access || null;
    if (access) ops.push(AsyncStorage.setItem(ACCESS, access));
    else ops.push(AsyncStorage.removeItem(ACCESS));
  }
  if (refresh !== undefined) {
    if (refresh) ops.push(AsyncStorage.setItem(REFRESH, refresh));
    else ops.push(AsyncStorage.removeItem(REFRESH));
  }
  if (profile) ops.push(AsyncStorage.setItem(PROFILE, JSON.stringify(profile)));
  if (prefs !== undefined) {
    if (prefs) ops.push(AsyncStorage.setItem(PREFS, JSON.stringify(prefs)));
    else ops.push(AsyncStorage.removeItem(PREFS));
  }
  if (ops.length) await Promise.all(ops);
}

export async function clearSnackifySession() {
  accessMem = null;
  await AsyncStorage.multiRemove([ACCESS, REFRESH, PROFILE, PREFS]);
}

/** Refresh Supabase access token using stored refresh token (same as web app). */
export async function refreshSnackifyAccessToken() {
  const refresh = await AsyncStorage.getItem(REFRESH);
  if (!refresh) {
    const err = new Error("No refresh token");
    err.status = 401;
    throw err;
  }

  const access = accessMem || await AsyncStorage.getItem(ACCESS);
  const cfg = supabaseConfig();
  const baseUrl = cfg.url || supabaseUrlFromToken(access);
  const anonKey = cfg.anon;

  if (!baseUrl || !anonKey) {
    const err = new Error(PANTRY_UNAVAILABLE);
    err.status = 401;
    throw err;
  }

  const { data } = await axios.post(
    `${baseUrl}/auth/v1/token?grant_type=refresh_token`,
    { refresh_token: refresh },
    {
      timeout: 20000,
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    },
  );

  const nextAccess = data?.access_token;
  const nextRefresh = data?.refresh_token || refresh;
  if (!nextAccess) {
    const err = new Error("Refresh failed");
    err.status = 401;
    throw err;
  }

  await saveSnackifySession({ access: nextAccess, refresh: nextRefresh });
  return { access: nextAccess, refresh: nextRefresh };
}

/** Proactively refresh if JWT is expired or expiring within 2 minutes. */
export async function ensureFreshSnackifyToken() {
  const access = accessMem || await AsyncStorage.getItem(ACCESS);
  const refresh = await AsyncStorage.getItem(REFRESH);
  if (!access || !refresh) return access;

  const exp = jwtPayload(access)?.exp;
  if (exp && Date.now() < (exp * 1000) - 120_000) return access;

  try {
    const next = await refreshSnackifyAccessToken();
    return next.access;
  } catch {
    return access;
  }
}

let retryAfterUntil = 0;

http.interceptors.request.use(async (config) => {
  if (Date.now() < retryAfterUntil && !isAuthPath(config.url)) {
    const err = new Error("Rate limited — wait a moment");
    err.status = 429;
    throw err;
  }
  if (!isAuthPath(config.url)) {
    try {
      await ensureSnackifyBearer();
    } catch (e) {
      console.log("[snackify] pantry bearer:", e.message);
    }
    await ensureFreshSnackifyToken();
    const token = accessMem || await AsyncStorage.getItem(ACCESS);
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let onAuthError = null;
export function setAuthErrorHandler(fn) { onAuthError = fn; }

http.interceptors.response.use(undefined, async (error) => {
  const original = error.config || {};
  const status = error.response?.status;

  if (status === 429) {
    const wait = Number(error.response.headers?.["retry-after"]) || 30;
    retryAfterUntil = Date.now() + wait * 1000;
  }

  if (isAuthPath(original.url)) {
    return Promise.reject(error);
  }

  if (status === 401 && !original._retry) {
    original._retry = true;
    const refresh = await AsyncStorage.getItem(REFRESH);
    if (!refresh) {
      try {
        accessMem = null;
        await AsyncStorage.removeItem(ACCESS);
        const token = await ensureSnackifyBearer();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return http(original);
      } catch (guestErr) {
        const err = new Error(errMsg(guestErr, errMsg(error, "Missing pantry session")));
        err.status = 401;
        return Promise.reject(err);
      }
    }
    if (isRefreshing) {
      try {
        const token = await new Promise((resolve, reject) => {
          refreshWaiters.push({ resolve, reject });
        });
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return http(original);
      } catch (e) {
        return Promise.reject(e);
      }
    }

    isRefreshing = true;

    try {
      const next = await refreshSnackifyAccessToken();
      resolveRefreshWaiters(null, next.access);
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${next.access}`;
      return http(original);
    } catch (refreshErr) {
      console.log("[snackify] refresh failed:", refreshErr.message);
      try {
        accessMem = null;
        await AsyncStorage.removeItem(ACCESS);
        await AsyncStorage.removeItem(REFRESH);
        const token = await ensureSnackifyBearer();
        resolveRefreshWaiters(null, token);
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return http(original);
      } catch (guestErr) {
        resolveRefreshWaiters(guestErr, null);
        const err = new Error(errMsg(guestErr, PANTRY_UNAVAILABLE));
        err.status = 401;
        return Promise.reject(err);
      }
    } finally {
      isRefreshing = false;
    }
  }

  if (status === 401) {
    console.log("[snackify] 401:", error?.response?.data?.error || error?.response?.data?.message);
  }

  return Promise.reject(error);
});

function errMsg(e, fallback) {
  const d = e?.response?.data;
  const raw = d?.error || d?.message || d?.detail || e?.message || fallback;
  let text = String(raw || "");
  const fieldErrors = d?.details?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") {
    const bits = Object.entries(fieldErrors)
      .flatMap(([key, msgs]) => {
        const list = Array.isArray(msgs) ? msgs : [msgs];
        return list.filter(Boolean).map((m) => `${key}: ${m}`);
      });
    if (bits.length) {
      text = text && text !== "Validation failed"
        ? `${text} (${bits.join("; ")})`
        : bits.join("; ");
    }
  }
  if (/session expired|sign in again|no refresh token|auth config missing/i.test(text)) {
    return PANTRY_UNAVAILABLE;
  }
  return text || fallback;
}

async function req(method, path, body, extra) {
  try {
    const { data } = await http.request({ method, url: path, data: body, ...extra });
    return data;
  } catch (e) {
    const err = new Error(errMsg(e, "Request failed"));
    err.status = e?.response?.status;
    err.body = e?.response?.data;
    throw err;
  }
}

export const snackApi = {
  // Auth
  startLogin: (email) => req("post", "/api/auth/start-login", { email }),
  verifyTotpLogin: (transactionId, code) => req("post", "/api/auth/verify-totp-login", { transactionId, code }),
  startEnrollment: (email) => req("post", "/api/auth/start-enrollment", { email }),
  verifyEnrollmentOtp: (enrollmentTransactionId, code) =>
    req("post", "/api/auth/verify-enrollment-otp", { enrollmentTransactionId, code }),
  verifyTotpEnrollment: (enrollmentTransactionId, code) =>
    req("post", "/api/auth/verify-totp-enrollment", { enrollmentTransactionId, code }),
  startReauth: () => req("post", "/api/auth/start-reauth"),
  verifyReauth: (code) => req("post", "/api/auth/verify-reauth", { code }),
  guestLogin: (email, name) => req("post", "/api/auth/guest-login", guestLoginPayload(email)),

  // Cafeteria
  items: () => req("get", "/api/cafeteria/items"),
  selfPickupStatus: () => req("get", "/api/cafeteria/self-pickup-status"),

  // Requests (orders)
  placeRequest: async (payload, opts = {}) => {
    const body = {
      ...payload,
      client_order_id:
        (isUuid(payload.client_order_id) && payload.client_order_id)
        || newClientOrderId(),
    };
    try {
      return await req("post", "/api/requests", body);
    } catch (e) {
      const offline = !e.status;
      if (opts.enqueue !== false && offline) {
        await enqueuePendingOrder(body);
        return {
          queued: true,
          request: {
            id: null,
            status: "confirming",
            client_order_id: body.client_order_id,
          },
        };
      }
      throw e;
    }
  },
  confirmRequest: (id) => {
    if (!isUuid(id)) return Promise.reject(Object.assign(new Error("Order not found"), { status: 404 }));
    return req("post", `/api/requests/${id}/confirm`);
  },
  cancelRequest: (id) => {
    if (!isUuid(id)) return Promise.reject(Object.assign(new Error("Order not found"), { status: 404 }));
    return req("post", `/api/requests/${id}/cancel`);
  },
  getRequest: (id) => {
    if (!isUuid(id)) return Promise.reject(Object.assign(new Error("Order not found"), { status: 404 }));
    return req("get", `/api/requests/${id}`);
  },
  listRequests: () => req("get", "/api/requests"),
  queueCount: () => req("get", "/api/requests/queue-count"),
  patchStatus: (id, body) => req("patch", `/api/requests/${id}/status`, body),
  rateRequest: (id, rating) => req("post", `/api/requests/${id}/rate`, { rating }),

  // Meals
  mealOptions: (date) => req("get", `/api/meals/options?date=${encodeURIComponent(date)}`),
  bookMeal: (payload) => req("post", "/api/meals/book", payload),
  myBookings: (month) => req("get", `/api/meals/my-bookings${month ? `?month=${month}` : ""}`),
  mealSummary: () => req("get", "/api/meals/summary"),
  mealSettings: () => req("get", "/api/meals/settings"),
  rateMeal: (date, rating) => req("post", `/api/meals/${date}/rate`, { rating }),

  // Meal print
  myToken: (date) => req("get", `/api/meal-print/my-token${date ? `?date=${date}` : ""}`),
  printStatus: (date) => req("get", `/api/meal-print/status${date ? `?date=${date}` : ""}`),
  triggerCabin: (cabin) => req("post", "/api/meal-print/trigger-cabin", cabin ? { cabin } : undefined),
  reprintToken: (id) => req("post", "/api/meal-print/reprint-token", { id }),
  cabinBookings: (date, cabin) => req("get", `/api/meal-print/cabin-bookings?date=${date}&cabin=${encodeURIComponent(cabin)}`),

  tokensBootstrap: () => req("get", "/api/tokens/bootstrap"),
  tokensMe: () => req("get", "/api/tokens/me"),
  tokensCatalog: () => req("get", "/api/tokens/catalog"),
  tokensPrintQueue: () => req("get", "/api/tokens/print-queue"),
  updateCardStyle: (body) => req("patch", "/api/tokens/card-style", body),
  updateProfile: (body) => req("patch", "/api/tokens/profile", body),
  supportTicket: (body) => req("post", "/api/support/ticket", body),
  // Monthly coin grant (1st of month → 4000). Backend may auto-run; these are explicit triggers.
  ensureMonthlyWallet: (body) => req("post", "/api/tokens/ensure-monthly", body || { amount: 4000 }),
  resetMonthlyWallets: (body) => req("post", "/api/admin/wallets/monthly-reset", body || { amount: 4000 }),

  // Guest meal
  bookGuestMeal: (payload) => req("post", "/api/guest-meal/book", payload),

  // Ops
  dashboard: () => req("get", "/api/reports/dashboard"),
  spending: () => req("get", "/api/reports/spending"),
  inventory: () => req("get", "/api/inventory"),
  alerts: () => req("get", "/api/inventory/alerts"),
  // Web client posts { updates: [{ product_id, current_stock, unit_cost? }] }
  dailyUpdate: (updates) => req("post", "/api/inventory/daily-update", {
    updates: Array.isArray(updates) ? updates : updates?.updates || [],
  }),
  patchCafeteriaItem: (id, body) => req("patch", `/api/cafeteria/items/${id}`, body),
  bills: () => req("get", "/api/bills"),
  patchBillStatus: (id, body) => req("patch", `/api/bills/${id}/status`, body),
  users: () => req("get", "/api/admin/users"),
};
