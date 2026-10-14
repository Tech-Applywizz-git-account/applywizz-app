import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";

const LOGO = require("../../assets/icon.png");

export function formatCardNumber(raw) {
  const s = String(raw || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!s) return "";
  return s.replace(/(.{4})/g, "$1 ").trim();
}

export function maskCafeteriaCard(num) {
  return formatCardNumber(num) || "XXXX XXXX XXXX XXXX";
}

export default function CafeteriaCard({
  cardNumber,
  cardMasked,
  cardholder = "",
  onPress,
  compact,
}) {
  const raw = String(cardNumber || cardMasked || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const pan = formatCardNumber(raw) || "XXXX XXXX XXXX XXXX";
  const assigned = raw.length > 0;
  const holder = String(cardholder || "Applywizzian").slice(0, 24);

  const face = (
    <View style={styles.container}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 380 210"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient
            id="blueGlow"
            cx="0"
            cy="0"
            r="420"
            fx="0"
            fy="0"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#2F7BFF" stopOpacity="0.95" />
            <Stop offset="0.15" stopColor="#2F7BFF" stopOpacity="0.7" />
            <Stop offset="0.3" stopColor="#2F7BFF" stopOpacity="0.45" />
            <Stop offset="0.5" stopColor="#2F7BFF" stopOpacity="0.25" />
            <Stop offset="0.7" stopColor="#2F7BFF" stopOpacity="0.12" />
            <Stop offset="0.85" stopColor="#2F7BFF" stopOpacity="0.05" />
            <Stop offset="1" stopColor="#2F7BFF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id="greenGlow"
            cx="380"
            cy="210"
            r="420"
            fx="380"
            fy="210"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#B6F000" stopOpacity="0.95" />
            <Stop offset="0.15" stopColor="#B6F000" stopOpacity="0.7" />
            <Stop offset="0.3" stopColor="#B6F000" stopOpacity="0.45" />
            <Stop offset="0.5" stopColor="#B6F000" stopOpacity="0.25" />
            <Stop offset="0.7" stopColor="#B6F000" stopOpacity="0.12" />
            <Stop offset="0.85" stopColor="#B6F000" stopOpacity="0.05" />
            <Stop offset="1" stopColor="#B6F000" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id="centerBlend"
            cx="190"
            cy="105"
            r="220"
            fx="190"
            fy="105"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#1A4A6E" stopOpacity="0.35" />
            <Stop offset="0.5" stopColor="#1A3A4A" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#0B1220" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="380" height="210" fill="#0B1220" />
        <Rect x="0" y="0" width="380" height="210" fill="url(#blueGlow)" />
        <Rect x="0" y="0" width="380" height="210" fill="url(#greenGlow)" />
        <Rect x="0" y="0" width="380" height="210" fill="url(#centerBlend)" />
      </Svg>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Image source={LOGO} style={styles.logoImg} />
          <Text style={styles.company}>Enougher Applywizz PVT LTD</Text>
        </View>
      </View>
      <View style={styles.details}>
        <View style={styles.nameNumber}>
          <Text style={styles.label}>Card Number</Text>
          <Text style={styles.number} numberOfLines={1} adjustsFontSizeToFit>
            {pan}
          </Text>
          <Text style={styles.name} numberOfLines={1}>
            {holder}
          </Text>
        </View>
        <View style={styles.valid}>
          <Text style={styles.label}>Valid Thru</Text>
          <Text style={styles.validVal}>NO EXPIRY</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.wrap, compact && { marginHorizontal: 0 }]}>
      {onPress ? <Pressable onPress={onPress}>{face}</Pressable> : face}
      {!assigned ? <Text style={styles.hint}>Admin will assign your card number.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 18, marginTop: 12, marginBottom: 6 },
  container: {
    width: "100%",
    borderRadius: 28,
    padding: 25,
    overflow: "hidden",
    backgroundColor: "#0B1220",
    minHeight: 200,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  logoImg: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 10,
  },
  company: {
    fontFamily: FONT.regular,
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 16,
    flexShrink: 1,
  },
  details: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  nameNumber: { flex: 1, paddingRight: 12 },
  label: {
    fontFamily: FONT.regular,
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "400",
  },
  number: {
    fontFamily: FONT.regular,
    color: "#FFFFFF",
    fontSize: 18,
    letterSpacing: 1,
    marginTop: 4,
  },
  name: {
    fontFamily: FONT.regular,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "400",
    marginTop: 20,
  },
  valid: { alignItems: "flex-end" },
  validVal: {
    fontFamily: FONT.regular,
    color: "#FFFFFF",
    fontSize: 16,
    marginTop: 4,
  },
  hint: { fontFamily: FONT.light, color: "#9CA3AF", fontSize: 12, marginTop: 14, marginHorizontal: 4 },
});
