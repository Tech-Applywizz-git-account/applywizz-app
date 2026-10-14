import api, { API_ORIGIN } from "./client";
import { toList, isGatewayMethod, rewritePublicFrontendUrl } from "../utils/billing";

/** Django `/api/v1/billing/inbox/` — dual-DB search (Supabase + legacy payment_orders). */

export async function fetchBillingInbox({
  page = 1,
  pageSize = 50,
  search = "",
  status = "",
  method = "",
  type = "",
  dateRange = "all",
  startDate = "",
  endDate = "",
  monthYear = "",
  signal,
} = {}) {
  const params = {
    page,
    page_size: pageSize,
    date_range: dateRange,
    // Exact COUNT only on first page — keeps large inboxes responsive.
    include_summary: page <= 1 ? "1" : "0",
  };
  if (search?.trim()) params.search = search.trim();
  if (status && status !== "all") params.status = status;
  if (method) params.method = method;
  if (type) params.type = type;
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (monthYear) params.month_year = monthYear;

  const { data } = await api.get("/billing/inbox/", { params, timeout: 20000, signal });
  const results = toList(data?.results ?? data);
  const hasMore = Boolean(data?.has_more);
  const count =
    data?.count != null
      ? data.count
      : hasMore
        ? page * pageSize + 1
        : (page - 1) * pageSize + results.length;
  return {
    ...data,
    count,
    has_more: hasMore,
    results,
  };
}

export async function fetchBillingIntent(id) {
  return (await api.get(`/billing/intents/${id}/`, { timeout: 60000 })).data;
}

export async function sendBillingIntent(id) {
  return (await api.post(`/billing/intents/${id}/send/`, {}, { timeout: 60000 })).data;
}

export async function cancelBillingIntent(id) {
  return (await api.post(`/billing/intents/${id}/cancel/`, {}, { timeout: 60000 })).data;
}

export async function deleteBillingIntent(id) {
  await api.delete(`/billing/intents/${id}/`, { timeout: 60000 });
  return true;
}

/** Mark NAS/Zelle/UPI paid — screenshot required for Zelle/UPI (and recommended for NAS). */
export async function markBillingPaid(id, screenshot) {
  const form = new FormData();
  if (screenshot?.uri) {
    form.append("payment_screenshot", {
      uri: screenshot.uri,
      name: screenshot.name || "payment.jpg",
      type: screenshot.mimeType || screenshot.type || "image/jpeg",
    });
  }
  return (await api.post(`/billing/intents/${id}/mark-paid/`, form, {
    timeout: 120000,
  })).data;
}

export async function updateUnpaidBilling(id, payload) {
  return (await api.post(`/billing/intents/${id}/update-unpaid/`, payload, {
    timeout: 60000,
  })).data;
}

export async function restoreAndMarkPaid(id, screenshot, paidAt) {
  const form = new FormData();
  if (screenshot?.uri) {
    form.append("payment_screenshot", {
      uri: screenshot.uri,
      name: screenshot.name || "payment.jpg",
      type: screenshot.mimeType || screenshot.type || "image/jpeg",
    });
  }
  if (paidAt) form.append("paid_at", paidAt);
  return (await api.post(`/billing/intents/${id}/restore-and-mark-paid/`, form, {
    timeout: 120000,
  })).data;
}

export async function shiftBillingOwner(id, { created_by_id, reason }) {
  return (await api.post(`/billing/intents/${id}/shift-owner/`, {
    created_by_id,
    reason,
  }, { timeout: 60000 })).data;
}

export async function upsertLegacyOverride(payload) {
  return (await api.post("/billing/admin/legacy-overrides/", payload, {
    timeout: 60000,
  })).data;
}

/** Turn relative /media/... or path-only keys into openable URLs (Supabase or Django redirect). */
export function resolveMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `${API_ORIGIN}${raw}`;
  return `${API_ORIGIN}/media/${raw.replace(/^\/+/, "")}`;
}

export function rowInvoicePdfUrl(row) {
  const method = rowMethod(row);
  // Gateway rails: open hosted checkout / provider portal, never Supabase PDF.
  if (isGatewayMethod(method)) {
    return rewritePublicFrontendUrl(
      row?.attempt?.payment_url
      || row?.paymentUrl
      || row?.raw?.payment_url
      || row?.raw?.active_attempt?.payment_url
      || null
    );
  }
  return resolveMediaUrl(
    row?.invoicePdf
    || row?.invoice_pdf
    || row?.raw?.invoice_pdf
    || row?.raw?.invoicePdf
  );
}

export function rowPayUrl(row) {
  const attempt = row?.attempt;
  if (row?.source === "billing" && attempt) {
    if (attempt.nas_payment_url) return resolveMediaUrl(attempt.nas_payment_url) || attempt.nas_payment_url;
    if (attempt.payment_url) return rewritePublicFrontendUrl(attempt.payment_url);
    if (attempt.public_pay_path) {
      const p = attempt.public_pay_path;
      if (p.startsWith("http")) return rewritePublicFrontendUrl(p);
      return p;
    }
  }
  return rewritePublicFrontendUrl(
    row?.paymentUrl
    || row?.nasPaymentUrl
    || row?.shareUrl
    || row?.raw?.payment_url
    || null
  );
}

export function rowMethod(row) {
  return String(row?.method || row?.methodLabel || row?.attempt?.collection_method || "")
    .toLowerCase()
    .trim();
}

export function isOfflineCollectionMethod(method) {
  const m = String(method || "").toLowerCase();
  return m === "nas" || m === "zelle" || m === "upi";
}

export function isBillingManageable(row) {
  if (row?.source !== "billing") return false;
  const intentStatus = String(row?.raw?.status || row?.status || "").toLowerCase();
  const attemptStatus = String(
    row?.attemptStatus || row?.attempt?.status || row?.displayStatus || "",
  ).toLowerCase();
  if (intentStatus === "cancelled" || attemptStatus === "cancelled") return false;
  if (attemptStatus === "paid" || String(row?.displayStatus || "").toLowerCase() === "paid") return false;
  return intentStatus === "open" || !intentStatus;
}
