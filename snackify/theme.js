export const C = {
  teal: "#0F766E",
  tealDeep: "#115E59",
  mint: "#CCFBF1",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  ink: "#0F172A",
  muted: "#64748B",
  line: "#E2E8F0",
  danger: "#B91C1C",
  ok: "#15803D",
};

export const ROLES = {
  staff: "staff",
  office_boy: "office_boy",
  facility_manager: "facility_manager",
  finance: "finance",
  leadership: "leadership",
};

export const ROLE_LABEL = {
  staff: "Applywizzian",
  office_boy: "Office Boy",
  facility_manager: "Facility Manager",
  finance: "Accounts",
  leadership: "Admin",
};

export function isOpsRole(role) {
  return ["office_boy", "facility_manager", "finance", "leadership"].includes(role);
}

export function isQueueRole(role) {
  return ["office_boy", "facility_manager", "leadership"].includes(role);
}

export function isDashRole(role) {
  return ["facility_manager", "finance", "leadership"].includes(role);
}

export function homeForRole(role) {
  if (role === "office_boy") return "SnackifyQueueTab";
  if (isDashRole(role)) return "SnackifyDashTab";
  return "SnackifyOrderTab";
}

/** Dinesh-only Snackify overrides (manual qty, stock counts). */
export function isSnackifyOwner(userOrEmail) {
  const email = String(
    typeof userOrEmail === "string"
      ? userOrEmail
      : (userOrEmail?.email || ""),
  ).trim().toLowerCase();
  if (userOrEmail && typeof userOrEmail === "object" && userOrEmail.is_owner) return true;
  return email === "dinesh@applywizz.ai";
}
