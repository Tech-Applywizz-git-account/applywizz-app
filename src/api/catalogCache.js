/**
 * Shared catalog cache keys + TTL for Play Store / App Store builds.
 *
 * Mobile has no Redis invalidation push — catalogs are TTL-only (15m).
 * Never use CATALOG_TTL_MS for live money (inbox, team-tree, approval queues).
 */
import { getCached, setCached } from "./queryCache";
import { toList } from "../utils/billing";

/** Rarely-changing catalogs (services, countries, UPI/Zelle, org, …). */
export const CATALOG_TTL_MS = 15 * 60_000;
/** Admin user lists / short org picks. */
export const LIST_TTL_MS = 5 * 60_000;
/** Approval queues / ops lists — paint fast, stay near-live. */
export const QUEUE_TTL_MS = 60_000;

export const CATALOG_KEYS = {
  services: "catalog:services",
  servicesActive: "catalog:services-active",
  countries: "catalog:countries",
  upiAccounts: "catalog:upi-accounts",
  zelleAccounts: "catalog:zelle-accounts",
  subordinates: "catalog:subordinates",
  externalAssociates: "catalog:external-associates",
  departments: "catalog:departments",
  roles: "catalog:roles",
  hierarchy: "catalog:hierarchy-levels",
  expenseCategories: "catalog:expense-categories",
  priceBook: "catalog:price-book",
  invoiceSettings: "catalog:invoice-settings",
  whatsappTeams: "catalog:whatsapp-teams",
  usersActive: "catalog:users-active",
  gateways: "catalog:gateways-status",
};

/** Map AdminListShell title → shared catalog key (dual-write with admin_list:*). */
export const ADMIN_TITLE_CATALOG_KEY = {
  Services: CATALOG_KEYS.services,
  Departments: CATALOG_KEYS.departments,
  Roles: CATALOG_KEYS.roles,
  Hierarchy: CATALOG_KEYS.hierarchy,
};

/**
 * Return fresh cached data or null if missing/stale.
 * @param {string} key
 * @param {number} [ttlMs]
 */
export function readFreshCatalog(key, ttlMs = CATALOG_TTL_MS) {
  const hit = getCached(key, ttlMs);
  if (hit && !hit.stale) return hit.data;
  return null;
}

/** Write catalog payload (same shape screens expect). */
export function writeCatalog(key, data) {
  setCached(key, data);
  return data;
}

/**
 * Load a catalog: serve from memory when fresh, else fetch + cache.
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fetcher
 * @param {{ ttlMs?: number, map?: (raw: any) => T }} [opts]
 * @returns {Promise<T>}
 */
export async function loadCatalog(key, fetcher, opts = {}) {
  const ttlMs = opts.ttlMs ?? CATALOG_TTL_MS;
  const fresh = readFreshCatalog(key, ttlMs);
  if (fresh != null) return fresh;
  const raw = await fetcher();
  const data = opts.map ? opts.map(raw) : raw;
  writeCatalog(key, data);
  return data;
}

export function asList(data) {
  return toList(data);
}
