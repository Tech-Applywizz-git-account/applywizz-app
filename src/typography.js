import { StyleSheet } from "react-native";

/** Loaded via @expo-google-fonts/poppins — use only these three weights. */
export const FONT = {
  light: "Poppins_300Light",
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
};

/**
 * Map a numeric/CSS weight onto Light (300) / Regular (400) / Medium (500).
 * Anything ≥500 (including legacy bold 600–900) → Medium.
 */
export function fontForWeight(weight) {
  if (weight == null || weight === "normal" || weight === "400") return FONT.regular;
  if (weight === "bold") return FONT.medium;
  if (weight === "light" || weight === "300") return FONT.light;
  if (weight === "medium" || weight === "500") return FONT.medium;

  const n = typeof weight === "number" ? weight : parseInt(String(weight), 10);
  if (!Number.isFinite(n) || n <= 300) return FONT.light;
  if (n <= 400) return FONT.regular;
  return FONT.medium;
}

const KEEP_FAMILY = /mono|Menlo|Courier|consolas/i;

/**
 * Flatten styles and replace fontWeight with the matching Poppins family.
 * Keeps monospace families used for codes/IDs.
 */
export function withPoppins(style) {
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily && KEEP_FAMILY.test(flat.fontFamily)) {
    return flat;
  }
  const { fontWeight, fontFamily, ...rest } = flat;
  return {
    ...rest,
    fontFamily: fontForWeight(fontWeight ?? 400),
  };
}

/** Convenience style helpers */
export const type = {
  light: { fontFamily: FONT.light },
  regular: { fontFamily: FONT.regular },
  medium: { fontFamily: FONT.medium },
};
