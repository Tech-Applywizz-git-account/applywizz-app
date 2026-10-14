import { BRAND } from "../theme";

const invoice = Object.freeze({
  colors: {
    primary: BRAND.teal, secondary: BRAND.tealDark, accent: BRAND.teal,
    background: "#F7F8FC", surface: "#FFFFFF", text: "#0F172A",
    textMuted: "#64748B", border: "#E8ECF1", success: BRAND.green,
    warning: BRAND.orange, danger: BRAND.red, info: BRAND.blue,
    focus: BRAND.teal, overlay: "#0F172A99",
  },
  typography: { fontSize: 15, headingScale: 1.2, lineHeight: 1.4, letterSpacing: 0 },
  shapes: { borderRadius: 16, buttonRadius: 14, cardRadius: 22, borderWidth: 1, shadow: "sm" },
  backgrounds: { color: "#F7F8FC", opacity: 1 },
  decorations: { enabled: false, density: 0, opacity: 0, items: [] },
  animations: { enabled: false, durationMs: 600, delayMs: 0, easing: "ease", intensity: 0.3, reducedMotion: true },
  accessibility: { minContrast: 4.5, focusRingWidth: 2, reduceMotion: false, highContrast: false },
  performance: { maxAssets: 4, maxAssetBytes: 1500000, animationBudgetMs: 16, preloadAssets: [] },
});

const snackify = Object.freeze({
  ...invoice,
  colors: {
    primary: "#3C2415", secondary: "#5C3A24", accent: "#3C2415",
    background: "#FAF4EC", surface: "#FFFFFF", text: "#2C1810",
    textMuted: "#8B735C", border: "#E8D9C8", success: "#22A35A",
    warning: "#C97716", danger: "#B91C1C", info: "#0F766E",
    focus: "#3C2415", overlay: "#2A181099",
  },
  decorations: { enabled: false, density: 0, opacity: 0, items: [] },
  animations: { ...invoice.animations, intensity: 0.45 },
});

const restrained = Object.freeze({
  ...invoice,
  colors: { ...invoice.colors, primary: "#475569", secondary: "#334155", accent: "#475569", focus: "#475569" },
  shapes: { ...invoice.shapes, borderRadius: 12, buttonRadius: 12, cardRadius: 14 },
  decorations: { enabled: false, density: 0, opacity: 0, items: [] },
});

const career = Object.freeze({
  ...restrained,
  colors: { ...restrained.colors, background: "#F8FAFC", border: "#E2E8F0" },
});

export const MODULE_PROFILES = Object.freeze({
  invoice,
  snackify,
  incentives: restrained,
  salary: restrained,
  hrms: restrained,
  career,
});

export function getModuleDefaults(moduleId) {
  return MODULE_PROFILES[moduleId] || invoice;
}

export function toLegacyTheme(tokens) {
  const c = tokens.colors;
  const accentSoft = c.background === "#F7F8FC"
    ? BRAND.tealSoft
    : (c.background === "#FAF4EC" ? "#F4EBE1" : `${(c.accent || c.primary).slice(0, 7)}18`);
  return {
    accent: c.accent || c.primary,
    accentSoft,
    bg: c.background,
    card: c.surface,
    text: c.text,
    subtext: c.textMuted,
    border: c.border,
    success: c.success,
    danger: c.danger,
    warning: c.warning,
    muted: c.textMuted,
    radius: tokens.shapes.borderRadius,
    radiusLg: tokens.shapes.cardRadius,
  };
}
