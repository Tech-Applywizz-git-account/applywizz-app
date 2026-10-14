import api from "./client";

/** Shared incentives API — same contract as web `/api/v1/incentives/`. */

export async function fetchAmDashboard({
  yearMonth,
  userId,
  page = 1,
  pageSize = 100,
  search,
} = {}) {
  // Never ?live=1 — that hangs; locked months come from day-lock SoT / Redis.
  // Admin list is server-paged (default 25, max 100); mobile asks for max page.
  const params = {
    year_month: yearMonth,
    page,
    page_size: pageSize,
  };
  if (userId) params.user_id = userId;
  if (search) params.search = search;
  return (await api.get("/incentives/am-dashboard/", { params })).data;
}

export async function fetchAmOverview({ yearMonth, includeProjected = true } = {}) {
  const params = {
    year_month: yearMonth,
    include_projected: includeProjected ? "true" : "false",
  };
  return (await api.get("/incentives/am-overview/", { params })).data;
}

export async function fetchAmMonthRunStatus(yearMonth) {
  return (await api.get("/incentives/am-month-runs/", {
    params: { year_month: yearMonth },
  })).data;
}

export async function calculateAmMonth(yearMonth, notes = "") {
  return (await api.post(`/incentives/am-month-runs/${yearMonth}/calculate/`, { notes })).data;
}

export async function lockAmMonth(yearMonth, notes = "") {
  return (await api.post(`/incentives/am-month-runs/${yearMonth}/lock/`, { notes })).data;
}

export async function unlockAmMonth(yearMonth, notes = "owner unlock") {
  return (await api.post(`/incentives/am-month-runs/${yearMonth}/unlock/`, { notes })).data;
}

export async function recalculateAmMonth(yearMonth, { relock = true, notes = "admin recalculate" } = {}) {
  return (await api.post(`/incentives/am-month-runs/${yearMonth}/recalculate/`, {
    relock,
    notes,
  })).data;
}

export async function fetchSalesTeamTree({
  scope = "month",
  yearMonth,
  startDate = "",
  endDate = "",
} = {}) {
  const params = { scope, year_month: yearMonth };
  if (scope === "custom") {
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
  }
  return (await api.get("/incentives/team-tree/", { params })).data;
}

export async function fetchAmTeamTree({ yearMonth } = {}) {
  return (await api.get("/incentives/am-team-tree/", {
    params: { year_month: yearMonth },
  })).data;
}

export async function fetchSalesPeriodLockStatus({
  scope = "month",
  yearMonth,
  startDate = "",
  endDate = "",
  halfCode,
} = {}) {
  const params = { scope, year_month: yearMonth };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (halfCode) params.half_code = halfCode;
  return (await api.get("/incentives/sales-period-locks/status/", { params })).data;
}

export async function lockSalesPeriod(body) {
  return (await api.post("/incentives/sales-period-locks/lock/", body)).data;
}

export async function unlockSalesPeriod(body) {
  return (await api.post("/incentives/sales-period-locks/unlock/", body)).data;
}

export async function recalculateSalesPeriod(body) {
  return (await api.post("/incentives/sales-period-locks/recalculate/", body)).data;
}

export async function fetchPolicySettings() {
  return (await api.get("/incentives/policy-settings/")).data;
}

export async function patchPolicySettings(body) {
  const id = body?.id || 1;
  return (await api.patch(`/incentives/policy-settings/${id}/`, body)).data;
}

export async function fetchEditorMe() {
  return (await api.get("/incentives/editors/me/")).data;
}

export async function fetchAmSlabs() {
  return (await api.get("/incentives/am-slabs/")).data;
}

export async function patchAmSlab(id, body) {
  return (await api.patch(`/incentives/am-slabs/${id}/`, body)).data;
}

export async function fetchAmRetentionRules() {
  return (await api.get("/incentives/am-retention-rules/")).data;
}

export async function patchAmRetentionRule(id, body) {
  return (await api.patch(`/incentives/am-retention-rules/${id}/`, body)).data;
}

export async function fetchIncentiveRuns() {
  return (await api.get("/incentives/runs/")).data;
}

export async function calculateAmRun(yearMonth) {
  return (await api.post("/incentives/runs/calculate/", {
    year_month: yearMonth,
    policy: "am_monthly",
  })).data;
}

export async function approveIncentiveRun(runId) {
  return (await api.post(`/incentives/runs/${runId}/approve/`)).data;
}

export async function markIncentiveRunPaid(runId) {
  return (await api.post(`/incentives/runs/${runId}/mark-paid/`)).data;
}

export async function fetchUnattributedPayments({ days = 90, page = 1, pageSize = 50 } = {}) {
  return (await api.get("/incentives/unattributed-payments/", {
    params: { days, page, page_size: pageSize },
  })).data;
}

export async function fetchRoleDashboard(kind, { scope, yearMonth, selectedUserId } = {}) {
  const params = kind === "am" || kind === "csm"
    ? { year_month: yearMonth }
    : { scope, year_month: yearMonth };
  if (selectedUserId) params.user_id = selectedUserId;
  if (kind === "am") {
    params.page = 1;
    params.page_size = 100;
  }

  const path = kind === "bdm"
    ? "/incentives/bdm-dashboard/"
    : kind === "am"
      ? "/incentives/am-dashboard/"
      : kind === "csm"
        ? "/incentives/csm-dashboard/"
        : "/incentives/dashboard/";

  return (await api.get(path, { params })).data;
}

export async function fetchIncentiveProgress() {
  try {
    return (await api.get("/incentives/progress/")).data;
  } catch {
    return null;
  }
}

export async function fetchBoostPeriods(audience) {
  const params = audience ? { audience } : undefined;
  return (await api.get("/incentives/boost-periods/", { params })).data;
}

export async function createBoostPeriod(body) {
  return (await api.post("/incentives/boost-periods/", body)).data;
}

export async function deleteBoostPeriod(id) {
  await api.delete(`/incentives/boost-periods/${id}/`);
  return true;
}

export async function approveBoostPeriod(id) {
  return (await api.post(`/incentives/boost-periods/${id}/approve/`)).data;
}

export async function rejectBoostPeriod(id, reason = "") {
  return (await api.post(`/incentives/boost-periods/${id}/reject/`, { reason })).data;
}
