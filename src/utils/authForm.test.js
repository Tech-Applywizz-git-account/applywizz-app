const assert = require("assert");

// Mirror of authForm.js for Node without a bundler (package is ESM-mixed).
const OTP_LEN = 6;
function normalizeOtpDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, OTP_LEN);
}
function isOtpComplete(value) {
  return normalizeOtpDigits(value).length === OTP_LEN;
}
function normalizeLoginEmail(value) {
  return String(value || "").trim().toLowerCase();
}
function looksLikeEmail(value) {
  const email = normalizeLoginEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

assert.strictEqual(OTP_LEN, 6);
assert.strictEqual(normalizeOtpDigits("12 34-56"), "123456");
assert.strictEqual(normalizeOtpDigits("abcdef"), "");
assert.strictEqual(normalizeOtpDigits("123456789"), "123456");
assert.strictEqual(isOtpComplete("123456"), true);
assert.strictEqual(isOtpComplete("12345"), false);
assert.strictEqual(normalizeLoginEmail("  User@ApplyWizz.AI "), "user@applywizz.ai");
assert.strictEqual(looksLikeEmail("user@applywizz.ai"), true);
assert.strictEqual(looksLikeEmail("not-an-email"), false);

console.log("auth form tests passed");
