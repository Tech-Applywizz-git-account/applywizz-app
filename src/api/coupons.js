import api from "./client";
import { toList } from "../utils/billing";

export async function fetchCouponRequests({ status = "pending", page = 1, pageSize = 25 } = {}) {
  const params = { page, page_size: pageSize };
  if (status) params.status = status;
  const { data } = await api.get("/payments/coupon-requests/", { params, timeout: 30000 });
  return {
    ...data,
    results: toList(data?.results ?? data),
  };
}
