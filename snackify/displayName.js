export function firstNameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  const first = local.split(/[._\-+]/)[0] || local;
  if (!first) return "Applywizzian";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function displayFirstName(profile) {
  const pref = String(profile?.preferred_name || "").trim();
  if (pref) return pref.split(/\s+/)[0];
  const named = String(profile?.name || "").trim();
  if (named && !named.includes("@")) return named.split(/\s+/)[0];
  return firstNameFromEmail(profile?.email);
}

export function nameFontSize(name, max = 18, min = 13) {
  const n = String(name || "").length;
  if (n <= 6) return max;
  if (n >= 16) return min;
  return Math.round(max - ((n - 6) / 10) * (max - min));
}
