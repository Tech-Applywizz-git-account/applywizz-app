function normalizeAppEnv(value) {
  return String(value || "development").trim().toLowerCase();
}

function allowSelfRegistration(appEnv, explicitFlag) {
  return normalizeAppEnv(appEnv) !== "production"
    && String(explicitFlag || "").trim().toLowerCase() === "true";
}

function validatedHttpsUrl(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" && parsed.hostname ? parsed.toString() : null;
  } catch (_) {
    return null;
  }
}

function storeDemoEnabled(env, appEnv) {
  // Never silently enable on production store binaries.
  const raw = String(env.EXPO_PUBLIC_STORE_DEMO || "").trim().toLowerCase();
  if (raw !== "true" && raw !== "1" && raw !== "yes") return false;
  if (normalizeAppEnv(appEnv) === "production") {
    // Explicit opt-in still allowed for a dedicated screenshot profile only.
    return String(env.EXPO_PUBLIC_STORE_DEMO_ALLOW_PRODUCTION || "")
      .trim()
      .toLowerCase() === "true";
  }
  return true;
}

function buildRuntimeExtra(env, appEnv) {
  return {
    appEnv: normalizeAppEnv(appEnv),
    allowSelfRegistration: allowSelfRegistration(
      appEnv,
      env.EXPO_PUBLIC_ALLOW_SELF_REGISTRATION,
    ),
    privacyPolicyUrl: validatedHttpsUrl(env.EXPO_PUBLIC_PRIVACY_POLICY_URL),
    supportUrl: validatedHttpsUrl(env.EXPO_PUBLIC_SUPPORT_URL),
    storeDemo: storeDemoEnabled(env, appEnv),
  };
}

function buildAuthScreens(baseScreens, registrationEnabled) {
  const screens = { ...baseScreens };
  if (registrationEnabled) screens.Register = "register";
  return screens;
}

module.exports = {
  allowSelfRegistration,
  buildAuthScreens,
  buildRuntimeExtra,
  normalizeAppEnv,
  storeDemoEnabled,
  validatedHttpsUrl,
};
