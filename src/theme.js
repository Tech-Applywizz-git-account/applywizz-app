// Brand UI — teal primary + soft pastel accents (Invoice Jet–style).
export const BRAND = {
  teal: "#149E81",
  tealDark: "#0F7A64",
  tealSoft: "#E6F7F2",
  yellow: "#F5C542",
  yellowSoft: "#FFF6D9",
  blue: "#3B82F6",
  blueSoft: "#DBEAFE",
  orange: "#F97316",
  orangeSoft: "#FFEDD5",
  red: "#EF4444",
  redSoft: "#FEE2E2",
  green: "#22C55E",
  greenSoft: "#DCFCE7",
  pink: "#EC4899",
  purple: "#A78BFA",
  headerFrom: "#FCE7F3",
  headerMid: "#EDE9FE",
  headerTo: "#DBEAFE",
};

export const THEMES = {
  ivy: BRAND.teal,
  slate: "#475569",
  indigo: BRAND.teal,
  brick: "#B4432E",
  ochre: "#C08A2D",
  stone: "#78716C",
  midnight: "#0B1220",
};

export const makeTheme = (accent = BRAND.teal) => ({
  accent: accent || BRAND.teal,
  accentSoft: BRAND.tealSoft,
  bg: "#F7F8FC",
  card: "#FFFFFF",
  text: "#0F172A",
  subtext: "#64748B",
  border: "#E8ECF1",
  success: BRAND.green,
  danger: BRAND.red,
  warning: BRAND.orange,
  muted: "#94A3B8",
  radius: 16,
  radiusLg: 22,
});

export const STATUS_COLORS = {
  draft: "#64748B",
  sent: BRAND.blue,
  viewed: "#7C3AED",
  partial: BRAND.orange,
  paid: BRAND.green,
  overdue: BRAND.red,
  unpaid: BRAND.orange,
  due: BRAND.red,
  accepted: BRAND.green,
  declined: BRAND.red,
  cancelled: "#94A3B8",
  created: BRAND.blue,
};

export const ACTION_COLORS = {
  create: { bg: BRAND.tealSoft, fg: BRAND.teal },
  advance: { bg: BRAND.yellowSoft, fg: "#B45309" },
  customers: { bg: BRAND.blueSoft, fg: BRAND.blue },
  services: { bg: BRAND.orangeSoft, fg: BRAND.orange },
  expenses: { bg: BRAND.redSoft, fg: BRAND.red },
  income: { bg: BRAND.greenSoft, fg: BRAND.green },
  incentives: { bg: "#F3E8FF", fg: "#7C3AED" },
  reports: { bg: "#EEF2FF", fg: "#4F46E5" },
};

export const spacing = (n) => n * 4;

export { FONT, type, fontForWeight, withPoppins } from "./typography";

export const CURRENCY_SYMBOLS = {
  USD: "$", EUR: "€", GBP: "£", INR: "₹", AUD: "A$", CAD: "C$",
};

export const money = (amount, currency = "USD") => {
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `;
  const n = Number(amount || 0);
  return sym + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
