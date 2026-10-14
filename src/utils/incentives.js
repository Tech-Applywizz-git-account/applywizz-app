import { fmtUsd, fmtInr, hasPermission, resolveIncentiveRoles } from "./billing";

export { fmtUsd, fmtInr, hasPermission, resolveIncentiveRoles };

export function isIncentiveAdmin(user) {
  return hasPermission(user, "view_incentives") || hasPermission(user, "manage_incentives");
}

export function canManageIncentives(user) {
  return hasPermission(user, "manage_incentives");
}

/** Mirrors web IncentivesPage routing — admins get admin hub, not forced BDA. */
export function resolveIncentiveDashboardKind(user) {
  const { isBda, isBdm, isAm, isAmm } = resolveIncentiveRoles(user);
  const admin = isIncentiveAdmin(user);

  if (admin) return "admin";
  if (isBdm && !isBda) return "bdm";
  if (isAmm && !isAm && !isBda && !isBdm) return "csm";
  if (isAm && !isBda && !isBdm) return "am";
  if (isBda) return "bda";
  return "bda";
}

export function buildMonthOptions(past = 12, future = 0) {
  const out = [];
  const now = new Date();
  for (let i = -past; i <= future; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ id: ym, label: ym });
  }
  return out.reverse();
}

export function paymentKindBadge(kind) {
  const k = (kind || "").toLowerCase();
  if (k === "renewal") return { text: "Renewal", tone: "teal" };
  if (k === "addon") return { text: "Add-on", tone: "amber" };
  if (k === "first") return { text: "First sale", tone: "slate" };
  return kind ? { text: kind, tone: "slate" } : null;
}

export function paymentProvenanceBadges(row) {
  const badges = [];
  if (row?.is_projected) badges.push({ text: "Projected", tone: "indigo" });
  if (row?.is_crm_legacy) badges.push({ text: "Legacy CRM", tone: "violet" });
  if (row?.is_simulation_dual_credit) badges.push({ text: "Sim dual", tone: "cyan" });
  if (row?.is_prepaid_auto) badges.push({ text: "Prepaid", tone: "emerald" });
  return badges;
}

export function amDisplayInr(summary) {
  if (!summary) return fmtInr(0);
  const earned = summary.gate_passed
    ? summary.total_inr
    : (summary.projected_inr ?? summary.base_inr);
  return fmtInr(earned);
}

export function amPayableNote(summary) {
  if (!summary) return null;
  if (!summary.gate_passed && !summary.gate_provisional) {
    return `Payable ₹0 — renewal gate failed (earned slab shown)`;
  }
  if (summary.gate_provisional && Number(summary.renewal_rate_pct) < 50) {
    return `Renewal rate ${summary.renewal_rate_pct}% is provisional — gate applies after month closes`;
  }
  if (!summary.qualified && summary.gate_passed) {
    return "Below $3,500 monthly credited minimum — no base slab this month";
  }
  return null;
}

export function getIncentiveRoleMeta(user) {
  const kind = resolveIncentiveDashboardKind(user);
  const roles = resolveIncentiveRoles(user);
  const labels = {
    admin: {
      code: "ADMIN",
      title: "Incentive administration",
      formula: "Org-wide AM/BDA/BDM/CSM dashboards, policy editors, runs, and unattributed review.",
      steps: [
        "Switch tabs for chartered, AM overview, role dashboards",
        "Drill into any AM with live recalculation",
        "Edit slabs, retention, and simulation dual-credit policy",
        "Review unattributed payments and AM payroll runs",
      ],
    },
    bda: {
      code: "BDA",
      title: "Business Development Associate",
      formula: "Half-period paid revenue → slab ladder → incentive (INR). Daily target paces your streak.",
      steps: [
        "Collect paid first / renewal / add-on revenue in USD",
        "Match half revenue to the active slab ladder",
        "Projected payout = slab incentive in INR",
        "Hit daily USD target to stay on pace",
      ],
    },
    bdm: {
      code: "BDM",
      title: "Business Development Manager",
      formula: "Team half revenue → biweekly slab + daily team-target bonus.",
      steps: [
        "Sum paid revenue across your BDA team",
        "Biweekly incentive from team half slab",
        "Daily bonus when team hits the combined daily target",
        "Projected total = biweekly + daily bonuses",
      ],
    },
    am: {
      code: "AM",
      title: "Account Manager",
      formula: "Monthly credited revenue → slab + performance bonus − clawback (gate: renewal ≥ 50%).",
      steps: [
        "Credited renewal revenue for the month (USD)",
        "Renewal-rate gate (≥ 50%) must pass for payable INR",
        "Base slab if monthly renewals meet $3,500 minimum",
        "Apply retention, clawback, and performance bonus → INR",
      ],
    },
    csm: {
      code: "CSM",
      title: "CSM / Account Manager Head",
      formula: "12% of your AM team's monthly incentive pool (if qualified).",
      steps: [
        "Aggregate each AM's monthly incentive",
        "Build the AM pool (INR)",
        "CSM payout = 12% of the pool when qualified",
        "Disqualify rules can zero the payout",
      ],
    },
  };
  const meta = labels[kind] || labels.bda;
  return {
    kind,
    ...meta,
    roles,
    roleName: user?.role || "Staff",
    hierarchy: user?.hierarchy_level_name || "",
    incentiveCode: user?.incentive_role_code || meta.code,
    department: user?.department || "",
  };
}
