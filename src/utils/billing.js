/** Turn API errors into short, friendly messages. */
export function formatApiError(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback;
  if (err.message === "Network Error" || err.code === "ERR_NETWORK") {
    try {
      const { API_ORIGIN } = require("../api/client");
      return `Cannot reach ${API_ORIGIN}. Use same Wi‑Fi; Django must listen on 0.0.0.0:8000.`;
    } catch {
      return "Cannot reach server. Keep Django on 0.0.0.0:8000 and same Wi‑Fi.";
    }
  }
  if (err.code === "ECONNABORTED" || /timeout/i.test(err.message || "")) {
    return "Server took too long. Pull to refresh.";
  }
  const data = err.response?.data;
  if (!data) return err.message || fallback;
  if (typeof data.error === "string") return data.error;
  if (typeof data.detail === "string") return data.detail;
  if (typeof data.message === "string") return data.message;
  if (data.error?.message) return data.error.message;
  // App-server billing proxy wraps legacy errors as { error, details }
  if (typeof data.details?.message === "string") return data.details.message;
  if (typeof data.details?.detail === "string") return data.details.detail;
  return fallback;
}

export const PAYMENT_METHODS = [
  { id: "paypal", label: "PayPal" },
  { id: "razorpay", label: "Razorpay" },
  { id: "cashfree", label: "Cashfree" },
  { id: "nas", label: "NAS" },
  { id: "zelle", label: "Zelle" },
  { id: "upi", label: "UPI" },
];

export const METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, m.label]));

export const GATEWAY_METHODS = new Set(["paypal", "razorpay", "cashfree"]);
export const EDITABLE_UNPAID_METHODS = new Set(["zelle", "nas", "upi", "paypal", "razorpay", "cashfree"]);

const PUBLIC_FRONTEND = "https://invoice.applywizz.ai";
const LEGACY_FRONTENDS = [
  "https://invoice-pi-neon.vercel.app",
  "http://invoice-pi-neon.vercel.app",
];

/** Map old Vercel checkout/pay URLs onto the live custom domain. */
export function rewritePublicFrontendUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  for (const old of LEGACY_FRONTENDS) {
    if (raw.startsWith(old)) return PUBLIC_FRONTEND + raw.slice(old.length);
  }
  return raw;
}

export function isGatewayMethod(method) {
  return GATEWAY_METHODS.has(String(method || "").toLowerCase().trim());
}

export function couponProviderForMethod(method) {
  const m = String(method || "").toLowerCase();
  if (m === "paypal" || m === "razorpay" || m === "cashfree") return m;
  return "razorpay";
}

export const PAYMENT_KINDS = [
  { id: "first", label: "First" },
  { id: "renewal", label: "Renewal" },
  { id: "addon", label: "Add-on" },
];

export const fmtUsd = (n) =>
  "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtInr = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const toList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

/** Normalize UPI accounts — API returns a raw array; older clients expected `{ accounts }`. */
export function normalizeUpiAccounts(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.accounts)) return data.accounts;
  return [];
}

/** Normalize Zelle accounts — API returns `{ emails, phones }`. */
export function normalizeZelleAccounts(data) {
  return {
    emails: Array.isArray(data?.emails) ? data.emails : [],
    phones: Array.isArray(data?.phones) ? data.phones : [],
  };
}

/** Resolve incentive roles from API profile (mirrors web `incentiveRole.js`). */
export function resolveIncentiveRoles(user) {
  const code = (user?.incentive_role_code || "").toUpperCase();
  const hl = (user?.hierarchy_level_name || "").toLowerCase();

  const isBdm = code === "BDM"
    || hl.includes("sales manager")
    || hl.includes("business development manager")
    || /\bbdm\b/.test(hl);

  const isBdta = code === "BDTA"
    || hl.includes("trainee")
    || hl.includes("training associate")
    || /\bbdta\b/.test(hl);

  const isBda = !isBdta && (
    code === "BDA"
    || hl.includes("sales associate")
    || hl.includes("business development associate")
    || (/\bbda\b/.test(hl) && !isBdm)
  );

  const isAmm = code === "AMM"
    || hl.includes("account manager head")
    || hl.includes("accounts manager");

  const isAm = code === "AM"
    || hl.includes("accounts associate")
    || (/\bam\b/.test(hl) && !isAmm);

  return { isBda, isBdm, isBdta, isAm, isAmm };
}

export function isPlatformAdmin(user) {
  return user?.role === "Super Admin" || user?.role === "Admin";
}

/** Unrestricted Admin / Super Admin may create below-min invoices directly. */
export function canBypassMinAmount(user) {
  if (!user) return false;
  if (user.is_platform_admin || user.is_superuser || user.role === "Super Admin") return true;
  const custom = user.custom_permissions || [];
  return user.role === "Admin" && (!custom.length || custom.includes("manage_invoices"));
}

export function isSalesHead(user) {
  if (user?.role === "Sales Head") return true;
  const hl = (user?.hierarchy_level_name || "").toLowerCase();
  return hl.includes("sales head");
}

export function isAssociate(user) {
  const { isBda, isAm } = resolveIncentiveRoles(user);
  return isBda || isAm || user?.incentive_role_code === "AM";
}

export function isManager(user) {
  const { isBdm, isAmm } = resolveIncentiveRoles(user);
  return isBdm || isAmm || user?.incentive_role_code === "AMM";
}

/** Zelle/UPI + on-behalf: managers, sales heads, platform admins. */
export function canUseZelleUpi(user) {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  if (isManager(user)) return true;
  if (isSalesHead(user)) return true;
  return false;
}

export function canSendOnBehalfOf(user) {
  return canUseZelleUpi(user);
}

/** Managers / sales heads must pick an associate; platform admins do not. */
export function requiresOnBehalf(user) {
  if (!canSendOnBehalfOf(user)) return false;
  if (isPlatformAdmin(user)) return false;
  return isManager(user) || isSalesHead(user);
}

export function allowedMethods(user) {
  if (isAssociate(user) || !canUseZelleUpi(user)) {
    return PAYMENT_METHODS.filter((m) => m.id !== "zelle" && m.id !== "upi");
  }
  return PAYMENT_METHODS;
}

export function parseQuantityInput(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return 1;
  return Math.max(1, parseInt(digits, 10));
}

export function parsePriceInput(raw) {
  const cleaned = String(raw).replace(/[^\d.]/g, "");
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

/** Whether the logged-in user may create billing invoices (mirrors web route perms). */
export function canCreateInvoice(user) {
  if (!user) return false;
  if (user.is_superuser) return true;
  if (user.role === "Super Admin" || user.role === "Admin" || user.role === "Sales Head") return true;
  const perms = user.permissions || [];
  const needed = ["create_nas_payment", "create_payment_link", "create_paylink", "create_billing"];
  if (Array.isArray(perms) && perms.some((p) => needed.includes(p) || needed.includes(p?.codename))) {
    return true;
  }
  // Staff with an incentive role can create (same portal expectation)
  if (user.incentive_role_code) return true;
  return false;
}

export function hasPermission(user, code) {
  if (!user) return false;
  if (user.is_superuser || user.role === "Super Admin") return true;
  const perms = user.permissions || [];
  return perms.includes(code) || perms.some((p) => p === code || p?.codename === code);
}

export function canManageServices(user) {
  return hasPermission(user, "manage_services");
}

export function canManageCoupons(user) {
  return hasPermission(user, "manage_coupons") || canCreateInvoice(user);
}

export function canManageInvoiceSettings(user) {
  return hasPermission(user, "manage_invoice_settings");
}

export function canManageUsers(user) {
  return hasPermission(user, "manage_users");
}

export function canManageDepartments(user) {
  return hasPermission(user, "manage_departments") || hasPermission(user, "manage_hierarchy");
}

export function canManageHierarchy(user) {
  return hasPermission(user, "manage_hierarchy");
}

export function canManageRoles(user) {
  return hasPermission(user, "manage_roles");
}

export function canManageEventThemes(user) {
  return hasPermission(user, "manage_event_themes");
}

export function canViewNetworkLog(user) {
  return Boolean(__DEV__) || hasPermission(user, "manage_users") || user?.is_superuser;
}

export function canViewWhatsApp(user) {
  if (!user) return false;
  if (user.is_superuser || user.role === "Super Admin" || user.role === "Admin") return true;
  return [
    "view_own_whatsapp",
    "view_team_whatsapp",
    "view_all_whatsapp",
  ].some((code) => hasPermission(user, code));
}

/** Same gate as web Disputes route (billing view permissions). */
export function canViewDisputes(user) {
  if (!user) return false;
  if (user.is_superuser || user.role === "Super Admin" || user.role === "Admin") return true;
  return [
    "view_own_payments",
    "view_all_payments",
    "view_own_nas_payments",
    "view_all_nas_payments",
    "view_own_paylinks",
    "view_all_paylinks",
    "view_own_invoices",
    "view_all_invoices",
  ].some((code) => hasPermission(user, code));
}

/** Same gate as web `/incentives` route. */
export function canViewIncentives(user) {
  if (!user) return false;
  if (
    hasPermission(user, "view_own_incentives")
    || hasPermission(user, "view_incentives")
    || hasPermission(user, "manage_incentives")
  ) {
    return true;
  }
  // Fallback: tagged incentive role still sees personal dashboard
  const { isBda, isBdm, isAm, isAmm } = resolveIncentiveRoles(user);
  return isBda || isBdm || isAm || isAmm;
}

export function canManageBilling(user) {
  if (!user) return false;
  if (canCreateInvoice(user) || canViewDisputes(user)) return true;
  return [
    "manage_nas_payments",
    "view_own_nas_payments",
    "view_all_nas_payments",
    "view_own_payments",
    "view_all_payments",
    "view_own_invoices",
    "view_all_invoices",
  ].some((code) => hasPermission(user, code));
}

export function canHardDeleteBilling(user) {
  if (!user) return false;
  if (user.allow_hard_delete || user.is_owner) return true;
  const email = String(user.email || "").toLowerCase();
  return email === "dinesh@applywizz.ai";
}

export function isOwnerUser(user) {
  if (!user) return false;
  if (user.is_owner) return true;
  const email = String(user.email || "").toLowerCase();
  return email === "dinesh@applywizz.ai";
}

export {
  resolveIncentiveDashboardKind,
  getIncentiveRoleMeta,
  isIncentiveAdmin,
  canManageIncentives,
} from "./incentives";

