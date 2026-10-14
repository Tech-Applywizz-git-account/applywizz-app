import axios from "axios";
import api, { API_BASE } from "../api/client";

const ADMIN_ROOT = "/event-themes/themes/";

export async function fetchActiveTheme(moduleId, etag, signal) {
  const response = await axios.get(`${API_BASE}/event-themes/active/`, {
    params: { module: moduleId, screen: "generic", component: "generic" },
    headers: etag ? { "If-None-Match": etag } : undefined,
    timeout: 6500,
    signal,
    validateStatus: (status) => status === 200 || status === 304,
  });
  return {
    status: response.status,
    data: response.data,
    etag: String(response.headers?.etag || etag || "").replace(/^"|"$/g, ""),
  };
}

export const themeAdminApi = {
  list: () => api.get(ADMIN_ROOT),
  create: (body) => api.post(ADMIN_ROOT, body),
  update: (id, body) => api.patch(`${ADMIN_ROOT}${id}/`, body),
  duplicate: (id, body) => api.post(`${ADMIN_ROOT}${id}/duplicate/`, body),
  preview: (config) => api.post(`${ADMIN_ROOT}preview/`, { schema_version: 1, config }),
  versions: (id) => api.get(`${ADMIN_ROOT}${id}/versions/`),
  createVersion: (id, config, changelog = "") => api.post(`${ADMIN_ROOT}${id}/versions/`, { schema_version: 1, config, changelog }),
  publish: (id, body) => api.post(`${ADMIN_ROOT}${id}/publish/`, body),
  deactivate: (id, reason = "") => api.post(`${ADMIN_ROOT}${id}/deactivate/`, { reason }),
  rollback: (id, body = {}) => api.post(`${ADMIN_ROOT}${id}/rollback/`, body),
  schedules: (id) => api.get(`${ADMIN_ROOT}${id}/schedules/`),
  history: (id) => api.get(`${ADMIN_ROOT}${id}/history/`),
  assets: (id) => api.get(`${ADMIN_ROOT}${id}/assets/`),
  linkAsset: (id, body) => api.post(`${ADMIN_ROOT}${id}/assets/`, body),
  unlinkAsset: (id, assetId) => api.delete(`${ADMIN_ROOT}${id}/assets/${assetId}/`),
};
