import React from "react";
import { View, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { useAuth } from "../context/AuthContext";
import { FONT } from "../typography";

export default function ImpersonationBanner() {
  const { impersonation, stopImpersonation } = useAuth();
  const insets = useSafeAreaInsets();
  if (!impersonation?.active) return null;

  return (
    <View
      style={{
        backgroundColor: "#f59e0b",
        paddingTop: Math.max(insets.top, Platform.OS === "android" ? 8 : 0),
        paddingBottom: 10,
        paddingHorizontal: 12,
        zIndex: 1000,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="eye-outline" size={18} color="#451a03" />
        <Text
          style={{
            flex: 1,
            color: "#451a03",
            fontFamily: FONT.medium,
            fontSize: 13,
          }}
          numberOfLines={2}
        >
          Viewing as {impersonation.targetName}
          {impersonation.targetEmail ? ` (${impersonation.targetEmail})` : ""}
        </Text>
        <TouchableOpacity
          onPress={() => stopImpersonation()}
          style={{
            backgroundColor: "#451a03",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#fffbeb", fontFamily: FONT.medium, fontSize: 12 }}>
            Exit
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
