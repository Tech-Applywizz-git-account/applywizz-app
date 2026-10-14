import React from "react";
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { Text, TextInput } from "./AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { BRAND, makeTheme, STATUS_COLORS } from "../theme";
import BrandLoader from "./BrandLoader";
import { useEventTheme } from "../themes/ThemeContext";

export function useTheme() {
  const { profile } = useAuth();
  const eventTheme = useEventTheme();
  // Prefer brand teal unless user set a custom accent in settings.
  const accent = profile?.accent_color && profile.accent_color !== "#4F46E5"
    ? profile.accent_color
    : BRAND.teal;
  return eventTheme?.theme || makeTheme(accent);
}

export function Screen({ children, style, scroll, ...props }) {
  const t = useTheme();
  const Wrapper = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <Wrapper
        style={[{ flex: scroll ? undefined : 1 }, style]}
        contentContainerStyle={scroll ? { padding: 16, paddingBottom: 40 } : undefined}
        keyboardShouldPersistTaps={scroll ? "handled" : undefined}
        {...props}
      >
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }) {
  const t = useTheme();
  const inner = (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>
      {children}
    </View>
  );
  return onPress ? <TouchableOpacity activeOpacity={0.75} onPress={onPress}>{inner}</TouchableOpacity> : inner;
}

export function Button({ title, onPress, variant = "primary", loading, icon, style, disabled }) {
  const t = useTheme();
  const isOutline = variant === "outline";
  const isGhost = variant === "ghost";
  const bg = variant === "primary"
    ? t.accent
    : variant === "danger"
      ? t.danger
      : "transparent";
  const color = isGhost || isOutline ? t.accent : "#fff";
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        {
          backgroundColor: bg,
          opacity: disabled ? 0.5 : 1,
          shadowColor: variant === "primary" ? t.accent : "transparent",
          shadowOpacity: variant === "primary" ? 0.25 : 0,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: variant === "primary" ? 3 : 0,
        },
        isOutline && { borderWidth: 1.5, borderColor: t.accent, backgroundColor: "#fff" },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {icon && <Ionicons name={icon} size={18} color={color} />}
          <Text style={{ color, fontWeight: "500", fontSize: 15 }}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function Field({ label, style, right, secureToggle, ...props }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text style={{ color: t.text, marginBottom: 8, fontWeight: "500", fontSize: 13 }}>{label}</Text>
      ) : null}
      <View style={{ position: "relative" }}>
        <TextInput
          placeholderTextColor={t.muted}
          style={[
            styles.input,
            {
              borderColor: t.border,
              color: t.text,
              backgroundColor: "#fff",
              paddingRight: right || secureToggle ? 44 : 14,
            },
            style,
          ]}
          {...props}
        />
        {right ? (
          <View style={{ position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" }}>
            {right}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function StatusPill({ status }) {
  const key = String(status || "").toLowerCase();
  const color = STATUS_COLORS[key] || "#64748B";
  return (
    <View style={[styles.pill, { backgroundColor: `${color}18`, borderColor: `${color}33`, borderWidth: 1 }]}>
      <Text style={{ color, fontWeight: "500", fontSize: 10, textTransform: "capitalize" }}>
        {(status || "").replace("_", " ")}
      </Text>
    </View>
  );
}

export function ActionTile({ icon, label, colors, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{ width: "31%", alignItems: "center", marginBottom: 16 }}
    >
      <View style={{
        width: 58,
        height: 58,
        borderRadius: 18,
        backgroundColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
      }}
      >
        <Ionicons name={icon} size={24} color={colors.fg} />
      </View>
      <Text style={{
        color: "#334155",
        fontSize: 11,
        fontWeight: "500",
        textAlign: "center",
        lineHeight: 14,
      }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function EmptyState({ icon = "document-outline", title, subtitle }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", padding: 40 }}>
      <Ionicons name={icon} size={54} color={t.muted} />
      <Text style={{ color: t.text, fontSize: 17, fontWeight: "500", marginTop: 12 }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: t.subtext, marginTop: 4, textAlign: "center", fontWeight: "300", fontSize: 14 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function Loader() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 140, height: 140, borderRadius: 20, overflow: "hidden", backgroundColor: "#000" }}>
        <BrandLoader size={140} />
      </View>
    </View>
  );
}

export function SectionTitle({ children, right }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 6 }}>
      <Text style={{ fontSize: 17, fontWeight: "500", color: t.text }}>{children}</Text>
      {right}
    </View>
  );
}

/** Soft pastel header backdrop (no extra gradient package). */
export function SoftHeader({ children, style }) {
  return (
    <View style={[{ overflow: "hidden", backgroundColor: BRAND.headerTo }, style]}>
      <View style={{
        position: "absolute", top: -40, left: -30, width: 180, height: 180,
        borderRadius: 90, backgroundColor: BRAND.headerFrom, opacity: 0.85,
      }}
      />
      <View style={{
        position: "absolute", top: -20, right: -40, width: 200, height: 200,
        borderRadius: 100, backgroundColor: BRAND.headerMid, opacity: 0.9,
      }}
      />
      <View style={{
        position: "absolute", bottom: -50, left: 40, width: 160, height: 160,
        borderRadius: 80, backgroundColor: "#BFDBFE", opacity: 0.55,
      }}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: "400",
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
});
