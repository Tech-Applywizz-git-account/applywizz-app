/**
 * Stale-while-revalidate cache for mobile screens.
 * Memory-first; optionally hydrated/persisted via AsyncStorage so cold
 * Render wakes still show last Home/inbox instantly.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const store = new Map();
const PERSIST_PREFIX = "qc:";
const PERSIST_KEYS = new Set([
  "dashboard:billing-home",
  "clients:list",
  "incentives:progress",
]);
const MAX_PERSIST_BYTES = 220_000;

let hydratePromise = null;

function shouldPersist(key) {
  if (PERSIST_KEYS.has(key)) return true;
  const k = String(key);
  return (
    k.startsWith("invoices:inbox:")
    || k.startsWith("reports:analytics:")
    || k.startsWith("disputes:")
    || k.startsWith("incentives:")
  );
}

/**
 * Return cached payload even if stale (for instant paint + background revalidate).
 */
export function peekCached(key) {
  const entry = store.get(key);
  if (!entry) return null;
  return { data: entry.data, at: entry.at };
}

export function setCached(key, data) {
  store.set(key, { data, at: Date.now() });
  if (shouldPersist(key)) {
    persistKey(key, data).catch(() => {});
  }
}

export function invalidatePrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  if (prefix === "") {
    return AsyncStorage.getAllKeys()
      .then((keys) => {
        const drop = keys.filter((k) => k.startsWith(PERSIST_PREFIX));
        if (drop.length) return AsyncStorage.multiRemove(drop);
        return null;
      })
      .catch(() => {});
  }
  return Promise.resolve();
}

async function persistKey(key, data) {
  try {
    const payload = JSON.stringify({ data, at: Date.now() });
    if (payload.length > MAX_PERSIST_BYTES) return;
    await AsyncStorage.setItem(PERSIST_PREFIX + key, payload);
  } catch {
    /* ignore quota */
  }
}

/** Load last dashboard/inbox snapshots into memory before first paint. */
export function hydrateQueryCache() {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const ours = keys.filter((k) => k.startsWith(PERSIST_PREFIX));
      if (!ours.length) return;
      const pairs = await AsyncStorage.multiGet(ours);
      for (const [rawKey, raw] of pairs) {
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          const key = rawKey.slice(PERSIST_PREFIX.length);
          if (parsed?.data != null && !store.has(key)) {
            store.set(key, { data: parsed.data, at: Number(parsed.at) || 0 });
          }
        } catch {
          /* ignore bad entry */
        }
      }
    } catch {
      /* ignore */
    }
  })();
  return hydratePromise;
}
