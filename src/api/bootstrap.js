/**
 * Login / session bootstrap worker.
 * Prefetches the main tab routes into queryCache so screens paint from memory
 * (typically <100ms) while network refresh finishes in the background.
 */
import { AppState } from "react-native";
import api from "./client";
import { setCached } from "./queryCache";
import { warmBackend } from "./warmup";
import { fetchBillingInbox, rowInvoicePdfUrl } from "./billing";
import { fetchDisputes } from "./disputes";
import { fetchRoleDashboard, fetchIncentiveProgress } from "./incentives";
import { normalizeInboxHome } from "../utils/dashboardHome";
import {
  canCreateInvoice,
  canSendOnBehalfOf,
  canUseZelleUpi,
  canViewDisputes,
  canViewIncentives,
  resolveIncentiveRoles,
  toList,
} from "../utils/billing";
import {
  getIncentiveRoleMeta,
  isIncentiveAdmin,
} from "../utils/incentives";
import {
  CLIENTS_LIST_KEY,
  DASHBOARD_HOME_KEY,
  INCENTIVES_PROGRESS_KEY,
  disputesCacheKey,
  incentivesCacheKey,
  inboxCacheKey,
  reportsCacheKey,
} from "./cacheKeys";
import { CATALOG_KEYS, writeCatalog, asList } from "./catalogCache";

const REFRESH_MS = 45_000;

let inflight = null;
let refreshTimer = null;
let appStateSub = null;
let activeUser = null;

function resolveIncentiveFetchKind(user) {
  const admin = isIncentiveAdmin(user);
  const roles = resolveIncentiveRoles(user);
  const kind = getIncentiveRoleMeta(user).kind;
  if (!admin) {
    if (kind === "admin" && roles.isAm && !roles.isBda) return "am";
    return kind === "admin" ? "bda" : kind;
  }
  // Admin default hub tab is overview → BDM dashboard
  return "bdm";
}

async function prefetchDashboard() {
  // Home alone first so Home screen can paint; analytics fills cache afterward.
  const homePayload = await api.get("/billing/home/", {
    params: { date_range: "this_month" },
    timeout: 12000,
    _light: true,
  }).then((r) => r.data);

  const quick = normalizeInboxHome(
    { summary: {}, results: [] },
    null,
    homePayload,
    rowInvoicePdfUrl,
  );
  setCached(DASHBOARD_HOME_KEY, quick);

  const analytics = await api.get("/reports/analytics/", {
    params: { date_range: "this_month", granularity: "day", source: "all" },
    timeout: 20000,
  }).then((r) => r.data).catch(() => null);

  if (analytics) {
    setCached(reportsCacheKey("this_month"), analytics);
  }

  const homeHasRecent = Array.isArray(homePayload?.recent_documents)
    && homePayload.recent_documents.length > 0;
  const homeHasSummary = homePayload
    && (homePayload.outstanding != null || homePayload.paid_this_month != null);

  let inbox = { summary: {}, results: [] };
  if (!homeHasRecent && !homeHasSummary) {
    try {
      inbox = await fetchBillingInbox({
        page: 1,
        pageSize: 20,
        dateRange: "this_month",
      });
    } catch {
      /* keep quick home */
    }
  }

  setCached(
    DASHBOARD_HOME_KEY,
    normalizeInboxHome(inbox, analytics, homePayload, rowInvoicePdfUrl),
  );
}

async function prefetchInboxDefaults() {
  const data = await fetchBillingInbox({
    page: 1,
    pageSize: 50,
    dateRange: "today",
    status: "all",
  });
  setCached(inboxCacheKey("all", "today", ""), data.results || []);
}

async function prefetchClients() {
  const { data } = await api.get("/clients/", {
    params: { is_archived: false, ordering: "name" },
    timeout: 20000,
  });
  setCached(CLIENTS_LIST_KEY, data.results || data);
}

async function prefetchDisputes(user) {
  if (!canViewDisputes(user)) return;
  const data = await fetchDisputes({ status: "open", page: 1 });
  setCached(disputesCacheKey("open", ""), toList(data));
}

async function prefetchIncentives(user) {
  if (!canViewIncentives(user)) return;
  const fetchKind = resolveIncentiveFetchKind(user);
  if (!fetchKind) return;
  const yearMonth = new Date().toISOString().slice(0, 7);
  const scope = "half";
  const [dash, prog] = await Promise.all([
    fetchRoleDashboard(fetchKind, { scope, yearMonth }),
    fetchIncentiveProgress(),
  ]);
  setCached(incentivesCacheKey(fetchKind, scope, yearMonth), dash);
  if (prog) setCached(INCENTIVES_PROGRESS_KEY, prog);
}

/** Warm create-invoice catalogs first so billing forms open from memory. */
async function prefetchCatalogs(user) {
  if (!canCreateInvoice(user)) return;
  const tasks = [
    api.get("/services/", { params: { page_size: 200, is_active: true }, timeout: 15000 })
      .then((r) => {
        const list = asList(r.data).filter((s) => s.is_active !== false);
        writeCatalog(CATALOG_KEYS.services, list);
        writeCatalog(CATALOG_KEYS.servicesActive, list);
      })
      .catch(() => {}),
    api.get("/services/countries/", { timeout: 15000 })
      .then((r) => {
        writeCatalog(
          CATALOG_KEYS.countries,
          asList(r.data).filter((c) => c.is_active !== false),
        );
      })
      .catch(() => {}),
  ];
  if (canUseZelleUpi(user)) {
    tasks.push(
      api.get("/billing/upi-accounts/", { timeout: 15000 })
        .then((r) => writeCatalog(CATALOG_KEYS.upiAccounts, r.data))
        .catch(() => {}),
      api.get("/billing/zelle-accounts/", { timeout: 15000 })
        .then((r) => writeCatalog(CATALOG_KEYS.zelleAccounts, r.data))
        .catch(() => {}),
    );
  }
  if (canSendOnBehalfOf(user)) {
    tasks.push(
      api.get("/users/subordinates/", { timeout: 15000 })
        .then((r) => writeCatalog(CATALOG_KEYS.subordinates, asList(r.data)))
        .catch(() => {}),
    );
  }
  await Promise.allSettled(tasks);
}

/**
 * Parallel prefetch of primary mobile routes into memory (+ AsyncStorage).
 * Safe to call often; concurrent callers share one in-flight run.
 */
export async function runBootstrap(user, { force = false } = {}) {
  if (!user) return { ok: false, skipped: true };
  if (inflight && !force) return inflight;

  const started = Date.now();
  const work = (async () => {
    await warmBackend({ force: false }).catch(() => {});
    // Home first for instant paint; catalogs in parallel; rest after.
    await Promise.allSettled([
      prefetchDashboard().catch(() => {}),
      prefetchCatalogs(user).catch(() => {}),
    ]);
    const tasks = [
      prefetchInboxDefaults().catch(() => {}),
      prefetchClients().catch(() => {}),
      prefetchDisputes(user).catch(() => {}),
      prefetchIncentives(user).catch(() => {}),
    ];
    await Promise.allSettled(tasks);
    return { ok: true, ms: Date.now() - started };
  })();

  inflight = work.finally(() => {
    if (inflight === work) inflight = null;
  });
  return inflight;
}

/** Start periodic + foreground refresh while a session is active. */
export function startBootstrapWorker(user) {
  if (!user) return;
  activeUser = user;
  runBootstrap(user).catch(() => {});

  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (AppState.currentState === "active" && activeUser) {
      runBootstrap(activeUser).catch(() => {});
    }
  }, REFRESH_MS);

  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
  appStateSub = AppState.addEventListener("change", (state) => {
    if (state === "active" && activeUser) {
      runBootstrap(activeUser).catch(() => {});
    }
  });
}

export function stopBootstrapWorker() {
  activeUser = null;
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}

export function getBootstrapMeta() {
  return {
    running: Boolean(inflight),
    hasUser: Boolean(activeUser),
  };
}
