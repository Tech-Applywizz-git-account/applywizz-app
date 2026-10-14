import api from "./client";
import { toList } from "../utils/billing";

export async function fetchExternalPaidRequests({ status = "pending", page = 1, pageSize = 50 } = {}) {
  const params = { page, page_size: pageSize };
  if (status && status !== "all") params.status = status;
  const { data } = await api.get("/billing/external-paid-requests/", { params, timeout: 30000 });
  return {
    ...data,
    results: toList(data?.results ?? data),
  };
}

export async function fetchExternalPaidAssociates() {
  const { data } = await api.get("/billing/external-paid-requests/associates/", { timeout: 30000 });
  return toList(data?.results ?? data);
}

export async function fetchExternalPaidCounts() {
  return (await api.get("/billing/external-paid-requests/summary-counts/", { timeout: 15000 })).data;
}

export async function createExternalPaidRequest(formData) {
  return (
    await api.post("/billing/external-paid-requests/", formData, {
      timeout: 120000,
      // Content-Type left unset — client interceptor strips it so RN sets the boundary.
    })
  ).data;
}

export async function approveExternalPaidRequest(id) {
  return (await api.post(`/billing/external-paid-requests/${id}/approve/`, {}, { timeout: 120000 })).data;
}

export async function rejectExternalPaidRequest(id, reason = "") {
  return (await api.post(`/billing/external-paid-requests/${id}/reject/`, { reason }, { timeout: 60000 })).data;
}

export async function cancelExternalPaidRequest(id) {
  return (await api.post(`/billing/external-paid-requests/${id}/cancel/`, {}, { timeout: 30000 })).data;
}
