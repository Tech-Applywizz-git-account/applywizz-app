import api from "./client";
import { toList } from "../utils/billing";

export async function fetchInvoiceRequests({ status = "pending", page = 1, pageSize = 50 } = {}) {
  const params = { page, page_size: pageSize };
  if (status && status !== "all") params.status = status;
  const { data } = await api.get("/billing/invoice-requests/", { params, timeout: 30000 });
  return {
    ...data,
    results: toList(data?.results ?? data),
  };
}

export async function createInvoiceRequest(payload) {
  return (await api.post("/billing/invoice-requests/", payload, { timeout: 60000 })).data;
}

export async function approveInvoiceRequest(id, { sendEmailToClient = true } = {}) {
  return (
    await api.post(
      `/billing/invoice-requests/${id}/approve/`,
      { send_email_to_client: sendEmailToClient },
      { timeout: 60000 },
    )
  ).data;
}

export async function rejectInvoiceRequest(id, reason = "") {
  return (await api.post(`/billing/invoice-requests/${id}/reject/`, { reason }, { timeout: 60000 })).data;
}

export async function cancelInvoiceRequest(id) {
  return (await api.post(`/billing/invoice-requests/${id}/cancel/`, {}, { timeout: 30000 })).data;
}
