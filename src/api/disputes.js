import api from "./client";

/** Django `/api/v1/disputes/` — role-scoped list/detail/resolve/fail. */

export async function fetchDisputes({ status = "open", search = "", page = 1, signal } = {}) {
  const params = { page };
  if (status) params.status = status;
  if (search?.trim()) params.search = search.trim();
  return (await api.get("/disputes/", { params, signal })).data;
}

export async function fetchDispute(id) {
  return (await api.get(`/disputes/${id}/`)).data;
}

export async function resolveDispute(id, {
  uri,
  name = "dispute_evidence.pdf",
  mimeType = "application/pdf",
  note = "",
  confirmRefusalReason = true,
  confirmServiceProof = true,
  confirmBillingProof = true,
} = {}) {
  const form = new FormData();
  form.append("evidence_pdf", {
    uri,
    name: name.endsWith(".pdf") ? name : `${name}.pdf`,
    type: mimeType || "application/pdf",
  });
  form.append("resolution_note", note || "");
  form.append("confirm_refusal_reason", confirmRefusalReason ? "true" : "false");
  form.append("confirm_service_proof", confirmServiceProof ? "true" : "false");
  form.append("confirm_billing_proof", confirmBillingProof ? "true" : "false");

  return (await api.post(`/disputes/${id}/resolve/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000,
  })).data;
}

export async function failDispute(id, { note = "" } = {}) {
  return (await api.post(`/disputes/${id}/fail/`, { resolution_note: note || "" })).data;
}
