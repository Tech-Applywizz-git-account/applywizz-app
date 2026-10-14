import api from "./client";
import { toList } from "../utils/billing";

export async function fetchServices() {
  const { data } = await api.get("/services/");
  return toList(data);
}

export async function createService(payload) {
  return (await api.post("/services/", payload)).data;
}

export async function updateService(id, payload) {
  return (await api.patch(`/services/${id}/`, payload)).data;
}

export async function deleteService(id) {
  await api.delete(`/services/${id}/`);
  return true;
}

export async function fetchCoupons(params = {}) {
  const { data } = await api.get("/payments/coupons/", { params });
  return toList(data);
}

export async function createCoupon(payload) {
  return (await api.post("/payments/coupons/", payload)).data;
}

export async function updateCoupon(id, payload) {
  return (await api.patch(`/payments/coupons/${id}/`, payload)).data;
}

export async function deleteCoupon(id) {
  await api.delete(`/payments/coupons/${id}/`);
  return true;
}

export async function createCouponRequest(payload) {
  return (await api.post("/payments/coupon-requests/", payload)).data;
}

export async function fetchInvoiceSettings() {
  return (await api.get("/invoices/document-settings/")).data;
}

export async function saveInvoiceSettings(payload) {
  return (await api.put("/invoices/document-settings/", payload)).data;
}

export async function fetchUsers(params = {}) {
  const { data } = await api.get("/users/", { params });
  return toList(data);
}

export async function updateUser(id, payload) {
  return (await api.patch(`/users/${id}/`, payload)).data;
}

export async function fetchDepartments() {
  const { data } = await api.get("/users/departments/");
  return toList(data);
}

export async function updateDepartment(id, payload) {
  return (await api.patch(`/users/departments/${id}/`, payload)).data;
}

export async function fetchHierarchy() {
  const { data } = await api.get("/hierarchy/levels/");
  return toList(data);
}

export async function createHierarchyLevel(payload) {
  return (await api.post("/hierarchy/levels/", payload)).data;
}

export async function updateHierarchyLevel(id, payload) {
  return (await api.patch(`/hierarchy/levels/${id}/`, payload)).data;
}

export async function deleteHierarchyLevel(id) {
  await api.delete(`/hierarchy/levels/${id}/`);
  return true;
}

export async function fetchRoles() {
  const { data } = await api.get("/roles/");
  return toList(data);
}

export async function updateRole(id, payload) {
  return (await api.patch(`/roles/${id}/`, payload)).data;
}
