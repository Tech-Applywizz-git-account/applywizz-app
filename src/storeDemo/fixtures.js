/**
 * Synthetic store-listing / review fixtures ONLY.
 *
 * HARD RULES:
 * - Never read, mutate, sync, or overwrite production / live user data.
 * - Used only when EXPO_PUBLIC_STORE_DEMO=true (screenshot capture builds).
 * - Names, emails, AWL IDs, amounts below are fictional placeholders.
 */

const DEMO_ORG = Object.freeze({
  name: "Demo Organization",
  timezoneLabel: "8 PM–8 PM IST · demo team scope",
});

/** Fictional invoice inbox rows shaped like billing inbox API results. */
const DEMO_INVOICE_INBOX = Object.freeze([
  Object.freeze({
    id: "demo-inv-1001",
    source: "billing",
    reference: "BILL-DEMO1001",
    secondaryReference: null,
    clientName: "Alex Rivera",
    clientEmail: "alex.rivera@example.com",
    awlId: "AWL-10001",
    amount: 120,
    currency: "USD",
    displayStatus: "paid",
    status: "paid",
    method: "gateway",
    methodLabel: "Card",
    invoicePdfUrl: null,
    payUrl: null,
  }),
  Object.freeze({
    id: "demo-inv-1002",
    source: "billing",
    reference: "BILL-DEMO1002",
    secondaryReference: null,
    clientName: "Jordan Lee",
    clientEmail: "jordan.lee@example.com",
    awlId: "AWL-10002",
    amount: 249,
    currency: "USD",
    displayStatus: "paid",
    status: "paid",
    method: "gateway",
    methodLabel: "Card",
    invoicePdfUrl: null,
    payUrl: null,
  }),
  Object.freeze({
    id: "demo-inv-1003",
    source: "billing",
    reference: "BILL-DEMO1003",
    secondaryReference: null,
    clientName: "Sam Patel",
    clientEmail: "sam.patel@example.com",
    awlId: "AWL-10003",
    amount: 89.5,
    currency: "USD",
    displayStatus: "sent",
    status: "sent",
    method: "gateway",
    methodLabel: "Card",
    invoicePdfUrl: null,
    payUrl: "https://example.com/pay/demo-1003",
  }),
  Object.freeze({
    id: "demo-inv-1004",
    source: "billing",
    reference: "BILL-DEMO1004",
    secondaryReference: null,
    clientName: "Casey Nguyen",
    clientEmail: "casey.nguyen@example.com",
    awlId: "AWL-10004",
    amount: 310,
    currency: "USD",
    displayStatus: "created",
    status: "created",
    method: "offline",
    methodLabel: "Offline",
    invoicePdfUrl: null,
    payUrl: null,
  }),
]);

const DEMO_SNACKIFY_HOME = Object.freeze({
  balanceCoins: 450,
  banner: "2 fresh teas brewing today (demo)",
  categories: Object.freeze(["Coffee & Tea", "Tea & Snacks"]),
  items: Object.freeze([
    Object.freeze({ id: "demo-item-1", name: "Chili Cheese Blend", priceCoins: 30 }),
    Object.freeze({ id: "demo-item-2", name: "Latte", priceCoins: 20 }),
    Object.freeze({ id: "demo-item-3", name: "Fresh Sandwich", priceCoins: 45 }),
  ]),
  cabins: Object.freeze([
    "Basic Cabin",
    "HR Cabin",
    "Finance Cabin",
    "Tech Team",
    "Conference room",
  ]),
});

const DEMO_LOGIN_COPY = Object.freeze({
  headline: "Welcome back",
  subtitle:
    "Sign in to workspaces your organization assigned — invoices, office pantry (Snackify), career tools, and incentives. Switch apps in-app when you have access.",
});

module.exports = {
  DEMO_ORG,
  DEMO_INVOICE_INBOX,
  DEMO_SNACKIFY_HOME,
  DEMO_LOGIN_COPY,
};
