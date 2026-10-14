/** Pure helpers shared by LoginScreen (auth) — unit-tested without RN mocks. */

export const OTP_LEN = 6;

export function normalizeOtpDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, OTP_LEN);
}

export function isOtpComplete(value) {
  return normalizeOtpDigits(value).length === OTP_LEN;
}

export function normalizeLoginEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function looksLikeEmail(value) {
  const email = normalizeLoginEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
