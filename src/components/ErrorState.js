import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Text } from "./AppText";

import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ui";

export function GatewayErrorState({ onRetry, message, statusCode }) {
  const t = useTheme();
  const title = statusCode === 404
    ? "Page not found"
    : statusCode >= 500
    ? "Server error"
    : "Something went wrong";
  const subtitle = message || (statusCode >= 500
    ? "Our servers are having trouble. Please try again in a moment."
    : "An unexpected error occurred.");
  const icon = statusCode === 404 ? "compass-outline" : "cloud-offline-outline";

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: t.danger + "18", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <Ionicons name={icon} size={40} color={t.danger} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: "500", color: t.text, marginBottom: 8 }}>{title}</Text>
      <Text style={{ color: t.subtext, textAlign: "center", marginBottom: 24, lineHeight: 20, fontWeight: "300"}}>{subtitle}</Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: t.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }}
        >
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "500" }}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function NotFoundState({ onBack }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <Text style={{ fontSize: 64, fontWeight: "500", color: t.muted, marginBottom: 8 }}>404</Text>
      <Text style={{ fontSize: 18, fontWeight: "500", color: t.text, marginBottom: 8 }}>Not found</Text>
      <Text style={{ color: t.subtext, textAlign: "center", marginBottom: 24, fontWeight: "300"}}>The page you're looking for doesn't exist.</Text>
      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          style={{ backgroundColor: t.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: "#fff", fontWeight: "500" }}>Go back</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function MaintenanceState({ eta }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: t.warning + "22", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <Ionicons name="construct-outline" size={40} color={t.warning} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: "500", color: t.text, marginBottom: 8 }}>Under maintenance</Text>
      <Text style={{ color: t.subtext, textAlign: "center", lineHeight: 20, fontWeight: "300"}}>We're performing scheduled maintenance. We'll be back shortly.</Text>
      {eta && <Text style={{ color: t.muted, marginTop: 12, fontSize: 13, fontWeight: "300"}}>ETA: {eta}</Text>}
    </View>
  );
}
