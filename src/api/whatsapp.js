import api from "./client";

export async function fetchWhatsAppUsers({
  status = "open",
  search = "",
  unassigned = false,
  kind = "contact",
  page = 1,
  pageSize = 50,
  signal,
} = {}) {
  const params = { kind, page, page_size: pageSize };
  if (status) params.status = status;
  if (search?.trim()) params.search = search.trim();
  if (unassigned) params.unassigned = "1";
  return (await api.get("/whatsapp/users/", { params, signal })).data;
}

export async function fetchWhatsAppUser(id) {
  return (await api.get(`/whatsapp/users/${id}/`)).data;
}

export async function fetchWhatsAppChats(id) {
  return (await api.get(`/whatsapp/users/${id}/chats/`, { params: { page_size: 200 } })).data;
}

export async function sendWhatsAppChat(id, body, direction = "outbound") {
  return (await api.post(`/whatsapp/users/${id}/chats/`, { body, direction })).data;
}

export async function fetchWhatsAppCalls(id) {
  return (await api.get(`/whatsapp/users/${id}/calls/`, { params: { page_size: 50 } })).data;
}

export async function logWhatsAppCall(id, payload = {}) {
  return (await api.post(`/whatsapp/users/${id}/calls/`, payload)).data;
}

export async function assignWhatsAppUser(id, payload) {
  return (await api.post(`/whatsapp/users/${id}/assign/`, payload)).data;
}

export async function linkWhatsAppClient(id, clientId) {
  return (await api.post(`/whatsapp/users/${id}/link-client/`, { client_id: clientId })).data;
}

export async function createWhatsAppContact({ phone, name = "" } = {}) {
  return (await api.post("/whatsapp/users/", { kind: "contact", phone, name })).data;
}

export async function searchClients(q) {
  return (await api.get("/clients/", { params: { search: q, page_size: 8 } })).data;
}

export async function markWhatsAppRead(id) {
  return (await api.post(`/whatsapp/users/${id}/mark-read/`)).data;
}

export async function fetchWhatsAppUnread() {
  return (await api.get("/whatsapp/unread/")).data;
}

export async function fetchWhatsAppTeams() {
  return (await api.get("/whatsapp/teams/")).data;
}
