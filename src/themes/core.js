const CATEGORIES = {
  colors: new Set(["primary", "secondary", "accent", "background", "surface", "text", "textMuted", "border", "success", "warning", "danger", "info", "focus", "overlay"]),
  typography: new Set(["fontFamily", "headingFontFamily", "fontSize", "headingScale", "fontWeight", "lineHeight", "letterSpacing"]),
  shapes: new Set(["borderRadius", "buttonRadius", "cardRadius", "borderWidth", "shadow"]),
  backgrounds: new Set(["color", "imageUrl", "assetKey", "position", "size", "repeat", "opacity"]),
  decorations: new Set(["enabled", "assetKey", "position", "density", "opacity", "items"]),
  animations: new Set(["enabled", "durationMs", "delayMs", "easing", "intensity", "reducedMotion"]),
  accessibility: new Set(["minContrast", "focusRingWidth", "reduceMotion", "highContrast"]),
  performance: new Set(["maxAssets", "maxAssetBytes", "animationBudgetMs", "preloadAssets"]),
};

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const ID = /^[a-z][a-z0-9_-]{0,63}$/;
const WORKSPACE_MODULES = new Set(["invoice", "snackify", "career"]);
const INCENTIVE_ROUTES = new Set([
  "IncentivesHub", "Incentives", "AmDashboard", "AmOverview", "IncentiveAdmin", "UnattributedPayments",
]);
// Payroll-adjacent modules stay visually quiet even when an event is active.
const RESTRAINED_MODULES = new Set(["incentives", "salary", "hrms"]);
const RESTRAINED_LIMITS = { density: 0.12, opacity: 0.25, intensity: 0.2 };
const DANGEROUS = /(<\s*(script|style)|javascript\s*:|data\s*:|vbscript\s*:|on[a-z]+\s*=|@import|expression\s*\(|url\s*\(|\b(function|eval)\s*\(|=>|\b(document|window)\s*\.)/i;
const MAX_JSON_BYTES = 120000;

function clamp(value, low, high, fallback) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(high, Math.max(low, value))
    : fallback;
}

function walk(value, depth = 0, count = { keys: 0 }) {
  if (depth > 8) throw new Error("Theme nesting is too deep.");
  if (Array.isArray(value)) {
    if (value.length > 50) throw new Error("Theme lists cannot exceed 50 items.");
    value.forEach((item) => walk(item, depth + 1, count));
  } else if (value && typeof value === "object") {
    const keys = Object.keys(value);
    count.keys += keys.length;
    if (count.keys > 300) throw new Error("Theme cannot exceed 300 keys.");
    keys.forEach((key) => {
      if (key.length > 80 || (/^on./i.test(key))) throw new Error(`Unsafe theme key: ${key}`);
      walk(value[key], depth + 1, count);
    });
  } else if (typeof value === "string") {
    if (value.length > 1000 || DANGEROUS.test(value)) throw new Error("Unsafe theme string.");
  } else if (value != null && !["boolean", "number"].includes(typeof value)) {
    throw new Error("Theme contains an unsupported value.");
  }
}

function validateToken(category, key, value) {
  if (category === "colors") return typeof value === "string" && HEX.test(value);
  if (["enabled", "reducedMotion", "reduceMotion", "highContrast"].includes(key)) return typeof value === "boolean";
  if (["durationMs", "delayMs", "animationBudgetMs"].includes(key)) return Number.isFinite(value) && value >= 0 && value <= 5000;
  if (["opacity", "density", "intensity"].includes(key)) return Number.isFinite(value) && value >= 0 && value <= 1;
  if (key === "minContrast") return Number.isFinite(value) && value >= 1 && value <= 21;
  if (key === "maxAssets") return Number.isInteger(value) && value >= 0 && value <= 30;
  if (key === "maxAssetBytes") return Number.isInteger(value) && value >= 0 && value <= 10000000;
  if (key === "fontSize") return Number.isFinite(value) && value >= 8 && value <= 72;
  if (key === "headingScale") return Number.isFinite(value) && value >= 1 && value <= 3;
  if (key === "fontWeight") return Number.isFinite(value) && value >= 100 && value <= 900;
  if (key === "lineHeight") return Number.isFinite(value) && value >= 0.8 && value <= 3;
  if (key === "letterSpacing") return Number.isFinite(value) && value >= -5 && value <= 20;
  if (["borderRadius", "buttonRadius", "cardRadius"].includes(key)) return Number.isFinite(value) && value >= 0 && value <= 64;
  if (["borderWidth", "focusRingWidth"].includes(key)) return Number.isFinite(value) && value >= 0 && value <= 10;
  if (key === "imageUrl") return typeof value === "string" && value.startsWith("https://");
  if (key === "shadow") return ["none", "sm", "md", "lg", "xl"].includes(value);
  if (key === "position") return ["center", "top", "bottom", "left", "right"].includes(value);
  if (key === "size") return ["auto", "cover", "contain"].includes(value);
  if (key === "repeat") return ["no-repeat", "repeat", "repeat-x", "repeat-y"].includes(value);
  if (key === "easing") return ["linear", "ease", "ease-in", "ease-out", "ease-in-out"].includes(value);
  if (key === "preloadAssets") return Array.isArray(value) && value.every((item) => typeof item === "string" && ID.test(item));
  if (key === "items") return Array.isArray(value) && value.every((item) => item && typeof item === "object" && !Array.isArray(item));
  return ["string", "number", "boolean"].includes(typeof value);
}

function sanitizeTokens(tokens) {
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) throw new Error("Theme tokens must be an object.");
  walk(tokens);
  const clean = {};
  for (const [category, values] of Object.entries(tokens)) {
    if (!CATEGORIES[category]) throw new Error(`Unknown token category: ${category}`);
    if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error(`${category} must be an object.`);
    clean[category] = {};
    for (const [key, value] of Object.entries(values)) {
      if (!CATEGORIES[category].has(key)) throw new Error(`Unknown ${category} token: ${key}`);
      if (!validateToken(category, key, value)) throw new Error(`Invalid ${category}.${key}`);
      clean[category][key] = value;
    }
  }
  return clean;
}

function sanitizeAssets(assets) {
  if (assets == null) return {};
  if (!assets || typeof assets !== "object" || Array.isArray(assets) || Object.keys(assets).length > 30) {
    throw new Error("Invalid theme assets.");
  }
  const clean = {};
  for (const [key, asset] of Object.entries(assets)) {
    if (!ID.test(key) || !asset || typeof asset !== "object") throw new Error("Invalid theme asset.");
    if (Object.keys(asset).some((field) => !["type", "url", "checksum", "altText"].includes(field))) throw new Error("Unknown theme asset field.");
    let parsedUrl;
    try { parsedUrl = new URL(asset.url); } catch (_) { throw new Error("Invalid theme asset URL."); }
    if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) throw new Error("Theme assets must use HTTPS.");
    if (!["image", "icon", "font"].includes(asset.type)) throw new Error("Unsupported theme asset type.");
    clean[key] = {
      type: asset.type,
      url: asset.url,
      checksum: String(asset.checksum || "").slice(0, 128),
      altText: String(asset.altText || "").slice(0, 240),
    };
  }
  return clean;
}

function sanitizeActivePayload(payload) {
  const encoded = JSON.stringify(payload);
  if (!payload || encoded.length > MAX_JSON_BYTES) throw new Error("Theme payload is empty or too large.");
  walk(payload);
  const unknown = Object.keys(payload).filter((key) => !["schemaVersion", "themes", "tokens", "assets"].includes(key));
  if (unknown.length) throw new Error(`Unknown theme payload field: ${unknown[0]}`);
  if (payload.schemaVersion !== 1) throw new Error("Unsupported theme schema.");
  if (!Array.isArray(payload.themes) || payload.themes.length > 20) throw new Error("Invalid active theme list.");
  payload.themes.forEach((theme) => {
    if (!theme || Object.keys(theme).some((key) => !["slug", "eventName", "priority", "version", "checksum"].includes(key))) {
      throw new Error("Invalid active theme metadata.");
    }
    if (!ID.test(theme.slug) || (theme.eventName && !ID.test(theme.eventName))) throw new Error("Invalid active theme identifier.");
    if (!Number.isFinite(theme.priority) || !Number.isFinite(theme.version)) throw new Error("Invalid active theme version.");
  });
  return {
    schemaVersion: 1,
    themes: payload.themes.map((theme) => ({
      slug: String(theme.slug || "").slice(0, 80),
      eventName: String(theme.eventName || "").slice(0, 80),
      priority: clamp(theme.priority, -1000, 1000, 0),
      version: clamp(theme.version, 0, 1000000, 0),
      checksum: String(theme.checksum || "").slice(0, 128),
    })),
    tokens: sanitizeTokens(payload.tokens || {}),
    assets: sanitizeAssets(payload.assets),
  };
}

function deepMerge(base, overlay) {
  const result = { ...base };
  Object.entries(overlay || {}).forEach(([key, value]) => {
    result[key] = value && typeof value === "object" && !Array.isArray(value)
      ? deepMerge(base?.[key] || {}, value)
      : value;
  });
  return result;
}

function luminance(hex) {
  const rgb = hex.slice(1, 7).match(/.{2}/g).map((part) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2]);
}

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

function moduleForWorkspace(workspaceId) {
  return WORKSPACE_MODULES.has(workspaceId) ? workspaceId : "invoice";
}

function moduleForRoute(routeName, workspaceId) {
  return INCENTIVE_ROUTES.has(routeName) ? "incentives" : moduleForWorkspace(workspaceId);
}

function clampModuleTokens(moduleId, tokens) {
  if (!RESTRAINED_MODULES.has(moduleId)) return tokens;
  const decorations = tokens.decorations || {};
  const animations = tokens.animations || {};
  return {
    ...tokens,
    decorations: {
      ...decorations,
      density: Math.min(clamp(decorations.density, 0, 1, 0), RESTRAINED_LIMITS.density),
      opacity: Math.min(clamp(decorations.opacity, 0, 1, 0), RESTRAINED_LIMITS.opacity),
    },
    animations: {
      ...animations,
      intensity: Math.min(clamp(animations.intensity, 0, 1, 0), RESTRAINED_LIMITS.intensity),
    },
  };
}

function resolveTheme(defaults, remoteTokens, options = {}) {
  const tokens = deepMerge(defaults, remoteTokens || {});
  const colors = tokens.colors || {};
  const minimum = clamp(tokens.accessibility?.minContrast, 3, 7, 4.5);
  if (HEX.test(colors.text || "") && HEX.test(colors.background || "") && contrast(colors.text, colors.background) < minimum) {
    colors.text = contrast("#0F172A", colors.background) >= minimum ? "#0F172A" : "#FFFFFF";
  }
  tokens.decorations = {
    ...(tokens.decorations || {}),
    density: clamp(tokens.decorations?.density, 0, 0.5, 0),
    opacity: clamp(tokens.decorations?.opacity, 0, 0.7, 0),
  };
  tokens.animations = {
    ...(tokens.animations || {}),
    intensity: clamp(tokens.animations?.intensity, 0, 0.7, 0),
    durationMs: clamp(tokens.animations?.durationMs, 100, 3000, 600),
    enabled: Boolean(tokens.animations?.enabled) && !options.reducedMotion,
  };
  if (options.lowPerformance) tokens.animations.enabled = false;
  return clampModuleTokens(options.moduleId, tokens);
}

function serializeCache(entry) {
  return JSON.stringify({
    version: 1,
    etag: String(entry.etag || "").slice(0, 256),
    checksum: String(entry.checksum || "").slice(0, 128),
    fetchedAt: Number(entry.fetchedAt) || Date.now(),
    payload: sanitizeActivePayload(entry.payload),
  });
}

function deserializeCache(raw, now = Date.now(), maxAgeMs = 7 * 86400000) {
  if (!raw || raw.length > 140000) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || now - parsed.fetchedAt > maxAgeMs || parsed.fetchedAt > now + 300000) return null;
    return { ...parsed, payload: sanitizeActivePayload(parsed.payload) };
  } catch (_) {
    return null;
  }
}

module.exports = {
  CATEGORIES,
  INCENTIVE_ROUTES,
  RESTRAINED_MODULES,
  RESTRAINED_LIMITS,
  sanitizeActivePayload,
  sanitizeTokens,
  deepMerge,
  moduleForWorkspace,
  moduleForRoute,
  clampModuleTokens,
  resolveTheme,
  serializeCache,
  deserializeCache,
  contrast,
};
