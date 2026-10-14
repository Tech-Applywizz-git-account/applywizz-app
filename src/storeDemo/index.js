import Constants from "expo-constants";
import { DEMO_INVOICE_INBOX, DEMO_ORG } from "./fixtures";

function extra() {
  return Constants.expoConfig?.extra || Constants.manifest?.extra || {};
}

/**
 * Screenshot / review capture mode.
 * Must stay false on Play Store and App Store production binaries.
 * Never fetches or writes live org data while enabled.
 */
export function isStoreDemoEnabled() {
  const flag = extra().storeDemo;
  return flag === true || String(flag || "").trim().toLowerCase() === "true";
}

export function filterDemoInbox({ status = "all", search = "" } = {}) {
  const q = String(search || "").trim().toLowerCase();
  return DEMO_INVOICE_INBOX.filter((row) => {
    const st = String(row.displayStatus || row.status || "").toLowerCase();
    if (status && status !== "all") {
      const want = String(status).toLowerCase();
      // UI filter "created" maps to Open
      if (want === "created" && st !== "created" && st !== "open") return false;
      if (want !== "created" && st !== want) return false;
    }
    if (!q) return true;
    const hay = [
      row.reference,
      row.clientName,
      row.clientEmail,
      row.awlId,
      row.methodLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export async function fetchDemoBillingInbox({ status, search } = {}) {
  // Artificial tick so UI loading paths still exercise; no network / no DB.
  await Promise.resolve();
  return {
    results: filterDemoInbox({ status, search }),
    count: filterDemoInbox({ status, search }).length,
    demo: true,
    orgLabel: DEMO_ORG.timezoneLabel,
  };
}

export { DEMO_INVOICE_INBOX, DEMO_ORG };
