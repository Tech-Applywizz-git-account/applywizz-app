const assert = require("assert");
const {
  sanitizeActivePayload, resolveTheme, serializeCache, deserializeCache, deepMerge,
  moduleForRoute, moduleForWorkspace, clampModuleTokens,
} = require("./core");

const payload = {
  schemaVersion: 1,
  themes: [{ slug: "spring", eventName: "spring", priority: 10, version: 2, checksum: "abc" }],
  tokens: {
    colors: { primary: "#149E81", background: "#FFFFFF", text: "#0F172A" },
    decorations: { enabled: true, density: 0.2, opacity: 0.3, items: [{ preset: "sparkle" }] },
    animations: { enabled: true, durationMs: 500, intensity: 0.4 },
  },
  assets: {
    flower: { type: "image", url: "https://cdn.example.com/flower.png", checksum: "def", altText: "Flower" },
  },
};

assert.deepStrictEqual(sanitizeActivePayload(payload).tokens.colors, payload.tokens.colors);
assert.throws(() => sanitizeActivePayload({ ...payload, schemaVersion: 2 }), /schema/);
assert.throws(() => sanitizeActivePayload({
  ...payload, tokens: { colors: { primary: "red" } },
}), /Invalid/);
assert.throws(() => sanitizeActivePayload({
  ...payload, assets: { bad: { type: "image", url: "http://example.com/x.png" } },
}), /HTTPS/);
assert.throws(() => sanitizeActivePayload({
  ...payload, tokens: { colors: {}, executable: { code: "eval('x')" } },
}), /Unsafe|Unknown/);

const defaults = {
  colors: { background: "#FFFFFF", text: "#0F172A", primary: "#149E81" },
  decorations: { density: 0, opacity: 0 },
  animations: { enabled: false, durationMs: 600, intensity: 0.2 },
  accessibility: { minContrast: 4.5 },
};
const merged = resolveTheme(defaults, { colors: { primary: "#3C2415" } });
assert.strictEqual(merged.colors.primary, "#3C2415");
assert.strictEqual(merged.colors.background, "#FFFFFF");
assert.notStrictEqual(deepMerge(defaults, {}).colors, undefined);

assert.strictEqual(moduleForWorkspace("snackify"), "snackify");
assert.strictEqual(moduleForWorkspace("career"), "career");
assert.strictEqual(moduleForWorkspace(null), "invoice");
assert.strictEqual(moduleForWorkspace("payroll"), "invoice");
assert.strictEqual(moduleForRoute("Tabs", "invoice"), "invoice");
assert.strictEqual(moduleForRoute("SnackifyHome", "snackify"), "snackify");
assert.strictEqual(moduleForRoute(null, "career"), "career");
["IncentivesHub", "Incentives", "AmDashboard", "AmOverview", "IncentiveAdmin", "UnattributedPayments"]
  .forEach((route) => assert.strictEqual(moduleForRoute(route, "invoice"), "incentives"));

const loud = {
  decorations: { enabled: true, density: 0.5, opacity: 0.7 },
  animations: { enabled: true, intensity: 0.7 },
};
assert.deepStrictEqual(clampModuleTokens("invoice", loud), loud);
["incentives", "salary", "hrms"].forEach((module) => {
  const quiet = clampModuleTokens(module, loud);
  assert.strictEqual(quiet.decorations.density, 0.12);
  assert.strictEqual(quiet.decorations.opacity, 0.25);
  assert.strictEqual(quiet.animations.intensity, 0.2);
  assert.strictEqual(quiet.decorations.enabled, true);
});

// Restrained defaults must stay inert unless the remote payload enables them.
const restrainedDefaults = {
  colors: { background: "#FFFFFF", text: "#0F172A", primary: "#475569" },
  decorations: { enabled: false, density: 0, opacity: 0 },
  animations: { enabled: false, durationMs: 600, intensity: 0.2 },
  accessibility: { minContrast: 4.5 },
};
const inert = resolveTheme(restrainedDefaults, {}, { moduleId: "incentives" });
assert.strictEqual(inert.decorations.enabled, false);
assert.strictEqual(inert.decorations.opacity, 0);
const remoteLoud = resolveTheme(
  restrainedDefaults,
  { decorations: { enabled: true, density: 0.4, opacity: 0.6 }, animations: { enabled: true, intensity: 0.6 } },
  { moduleId: "incentives" },
);
assert.strictEqual(remoteLoud.decorations.enabled, true);
assert.strictEqual(remoteLoud.decorations.density, 0.12);
assert.strictEqual(remoteLoud.animations.intensity, 0.2);
assert.strictEqual(
  resolveTheme(restrainedDefaults, { animations: { enabled: true, intensity: 0.6 } }, { moduleId: "incentives", reducedMotion: true }).animations.enabled,
  false,
);

const raw = serializeCache({ payload, etag: "etag-1", checksum: "abc", fetchedAt: 1000 });
const hydrated = deserializeCache(raw, 2000, 5000);
assert.strictEqual(hydrated.etag, "etag-1");
assert.strictEqual(hydrated.payload.themes[0].slug, "spring");
assert.strictEqual(deserializeCache(raw, 10000, 5000), null);
assert.strictEqual(deserializeCache("{corrupt"), null);
assert.strictEqual(deserializeCache("x".repeat(140001)), null);

console.log("themes.test.js: OK");
