const assert = require("assert");

/** Payment-screen URL/method helpers (mirrors src/utils/billing.js pure exports). */
const PUBLIC_FRONTEND = "https://invoice.applywizz.ai";
const LEGACY_FRONTENDS = [
  "https://invoice-pi-neon.vercel.app",
  "http://invoice-pi-neon.vercel.app",
];
const GATEWAY_METHODS = new Set(["paypal", "razorpay", "cashfree"]);

function rewritePublicFrontendUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  for (const old of LEGACY_FRONTENDS) {
    if (raw.startsWith(old)) return PUBLIC_FRONTEND + raw.slice(old.length);
  }
  return raw;
}

function isGatewayMethod(method) {
  return GATEWAY_METHODS.has(String(method || "").toLowerCase().trim());
}

function couponProviderForMethod(method) {
  const m = String(method || "").toLowerCase();
  if (m === "paypal" || m === "razorpay" || m === "cashfree") return m;
  return "razorpay";
}

assert.strictEqual(
  rewritePublicFrontendUrl("https://invoice-pi-neon.vercel.app/pay/abc"),
  "https://invoice.applywizz.ai/pay/abc",
);
assert.strictEqual(
  rewritePublicFrontendUrl("http://invoice-pi-neon.vercel.app/pay/x"),
  "https://invoice.applywizz.ai/pay/x",
);
assert.strictEqual(rewritePublicFrontendUrl("https://invoice.applywizz.ai/pay/y"), "https://invoice.applywizz.ai/pay/y");
assert.strictEqual(rewritePublicFrontendUrl(""), null);
assert.strictEqual(isGatewayMethod("PayPal"), true);
assert.strictEqual(isGatewayMethod("upi"), false);
assert.strictEqual(couponProviderForMethod("cashfree"), "cashfree");
assert.strictEqual(couponProviderForMethod("zelle"), "razorpay");

console.log("payment helper tests passed");
