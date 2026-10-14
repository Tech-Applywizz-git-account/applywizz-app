import AsyncStorage from "@react-native-async-storage/async-storage";

const BOOT_KEY = "snackify.bootstrap.v1";
const QUEUE_KEY = "snackify.pendingOrders.v1";

let mem = null;
let hydratePromise = null;

export function getSnackBootstrapMem() {
  return mem;
}

export async function hydrateSnackCache() {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(BOOT_KEY);
      if (raw) mem = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return mem;
  })();
  return hydratePromise;
}

export async function writeSnackBootstrap(data) {
  mem = data;
  try {
    await AsyncStorage.setItem(BOOT_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export async function readPendingOrders() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function writePendingOrders(rows) {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(rows || []));
  } catch {
    /* ignore */
  }
}

export async function enqueuePendingOrder(payload) {
  const rows = await readPendingOrders();
  const next = [
    ...rows.filter((r) => r.client_order_id !== payload.client_order_id),
    { ...payload, queued_at: Date.now() },
  ];
  await writePendingOrders(next);
  return next;
}

export async function dequeuePendingOrder(clientOrderId) {
  const rows = await readPendingOrders();
  await writePendingOrders(rows.filter((r) => r.client_order_id !== clientOrderId));
}
