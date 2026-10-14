/**
 * Lightweight parity tests (run: npm test from app/mobile).
 * Mirrors key helpers in incentives.js — keep in sync when changing routing logic.
 */
const assert = require("assert");

function hasPermission(user, code) {
  if (!user) return false;
  if (user.is_superuser || user.role === "Super Admin") return true;
  const perms = user.permissions || [];
  return perms.includes(code);
}

function resolveIncentiveRoles(user) {
  const code = (user?.incentive_role_code || "").toUpperCase();
  const hl = (user?.hierarchy_level_name || "").toLowerCase();
  const isBdm = code === "BDM" || hl.includes("business development manager") || /\bbdm\b/.test(hl);
  const isBda = code === "BDA" || hl.includes("business development associate") || (/\bbda\b/.test(hl) && !isBdm);
  const isAmm = code === "AMM" || hl.includes("accounts manager");
  const isAm = code === "AM" || hl.includes("accounts associate") || (/\bam\b/.test(hl) && !isAmm);
  return { isBda, isBdm, isAm, isAmm };
}

function isIncentiveAdmin(user) {
  return hasPermission(user, "view_incentives") || hasPermission(user, "manage_incentives");
}

function resolveIncentiveDashboardKind(user) {
  const { isBda, isBdm, isAm, isAmm } = resolveIncentiveRoles(user);
  if (isIncentiveAdmin(user)) return "admin";
  if (isBdm && !isBda) return "bdm";
  if (isAmm && !isAm && !isBda && !isBdm) return "csm";
  if (isAm && !isBda && !isBdm) return "am";
  if (isBda) return "bda";
  return "bda";
}

function paymentProvenanceBadges(row) {
  const badges = [];
  if (row?.is_projected) badges.push({ text: "Projected", tone: "indigo" });
  if (row?.is_crm_legacy) badges.push({ text: "Legacy CRM", tone: "violet" });
  if (row?.is_simulation_dual_credit) badges.push({ text: "Sim dual", tone: "cyan" });
  if (row?.is_prepaid_auto) badges.push({ text: "Prepaid", tone: "emerald" });
  return badges;
}

assert.strictEqual(resolveIncentiveDashboardKind({
  permissions: ["view_incentives"],
}), "admin");

assert.strictEqual(resolveIncentiveDashboardKind({
  permissions: ["view_own_incentives"],
  incentive_role_code: "AM",
  hierarchy_level_name: "Accounts Associate",
}), "am");

const badges = paymentProvenanceBadges({ is_projected: true, is_crm_legacy: true });
assert.ok(badges.some((b) => b.text === "Legacy CRM"));

console.log("incentives.test.js: OK");
