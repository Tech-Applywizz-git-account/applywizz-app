/**
 * Tiny client-side request lanes for mobile (Play Store + App Store).
 * Prefer catalog/auth GETs so create-billing does not wait behind analytics.
 */

const MAX_CONCURRENT = 4;
const HEAVY_MAX = 2;
const LIGHT_RESERVED = 1;

const BYPASS_RE = /\/(auth\/login\/refresh)\b/i;
const LIGHT_RE = new RegExp(
  String.raw`\/(auth\/me|billing\/home|incentives\/progress|incentives\/sales-slabs|incentives\/am-slabs|incentives\/policy-settings|incentives\/editors\/me|billing\/gateways\/status|billing\/upi-accounts|billing\/zelle-accounts|services\/countries|services(?=\/?(?:\?|$))|users\/subordinates|users\/departments|hierarchy\/levels|roles(?=\/?(?:\?|$))|expense-categories|price-book|whatsapp\/unread)\b`,
  "i",
);

let interactiveActive = 0;
let heavyActive = 0;
const lightQueue = [];
const heavyQueue = [];

export function isLightUrl(url) {
  return LIGHT_RE.test(String(url || ""));
}

export function shouldBypassQueue(url) {
  return BYPASS_RE.test(String(url || ""));
}

function pump() {
  while (interactiveActive < MAX_CONCURRENT && lightQueue.length) {
    const job = lightQueue.shift();
    if (!job) break;
    interactiveActive += 1;
    Promise.resolve()
      .then(job.run)
      .then(job.resolve, job.reject)
      .finally(() => {
        interactiveActive = Math.max(0, interactiveActive - 1);
        pump();
      });
  }

  const heavyRoom = lightQueue.length > 0
    ? Math.max(0, MAX_CONCURRENT - LIGHT_RESERVED - interactiveActive)
    : MAX_CONCURRENT - interactiveActive;

  while (
    heavyRoom > 0
    && interactiveActive < MAX_CONCURRENT
    && heavyActive < HEAVY_MAX
    && heavyQueue.length
  ) {
    const job = heavyQueue.shift();
    if (!job) break;
    interactiveActive += 1;
    heavyActive += 1;
    Promise.resolve()
      .then(job.run)
      .then(job.resolve, job.reject)
      .finally(() => {
        interactiveActive = Math.max(0, interactiveActive - 1);
        heavyActive = Math.max(0, heavyActive - 1);
        pump();
      });
    if (lightQueue.length > 0 && interactiveActive >= MAX_CONCURRENT - LIGHT_RESERVED) break;
  }
}

export function enqueueRequest(run, { light = false } = {}) {
  return new Promise((resolve, reject) => {
    const job = { run, resolve, reject };
    if (light) lightQueue.push(job);
    else heavyQueue.push(job);
    pump();
  });
}

/** Axios adapter wrapper — catalogs prefer the light lane. */
export function createMobileBalancedAdapter(baseAdapter) {
  if (typeof baseAdapter !== "function") {
    throw new TypeError("createMobileBalancedAdapter requires a base adapter");
  }
  return function mobileBalancedAdapter(config) {
    const url = String(config?.url || "");
    if (config?._skipBalancer || shouldBypassQueue(url)) {
      return baseAdapter(config);
    }
    const light = Boolean(config?._light) || isLightUrl(url);
    return enqueueRequest(() => baseAdapter(config), { light });
  };
}

/** Test-only reset. */
export function resetMobileBalancerForTests() {
  interactiveActive = 0;
  heavyActive = 0;
  lightQueue.length = 0;
  heavyQueue.length = 0;
}
