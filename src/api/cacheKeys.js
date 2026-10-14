/** Stable query-cache keys shared by screens and the login bootstrap worker. */

export const DASHBOARD_HOME_KEY = "dashboard:billing-home";
export const CLIENTS_LIST_KEY = "clients:list";
export const INCENTIVES_PROGRESS_KEY = "incentives:progress";

export function inboxCacheKey(filter = "all", dateRange = "today", q = "") {
  return `invoices:inbox:${filter}:${dateRange}:${String(q || "").trim().toLowerCase()}`;
}

export function reportsCacheKey(range = "this_month") {
  return `reports:analytics:${range}`;
}

export function disputesCacheKey(status = "open", search = "") {
  return `disputes:${status || "all"}:${String(search || "").trim().toLowerCase()}`;
}

export function incentivesCacheKey(kind, scope = "half", yearMonth) {
  return `incentives:${kind}:${scope}:${yearMonth}`;
}
