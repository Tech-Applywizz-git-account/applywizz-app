import React from "react";
import { TouchableOpacity, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BRAND } from "../theme";
import { FONT } from "../typography";

/**
 * Extended floating action button — icon + "Create invoice" label.
 */
export default function CreateInvoiceFab({ onPress, accent }) {
  const insets = useSafeAreaInsets();
  const color = accent || BRAND.teal;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[
        styles.fab,
        {
          backgroundColor: color,
          bottom: Math.max(insets.bottom, 12) + 56,
        },
      ]}
    >
      <Ionicons name="add" size={22} color="#fff" />
      <Text style={styles.label}>Invoice</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 28,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 50,
  },
  label: {
    color: "#fff",
    fontFamily: FONT.medium,
    fontSize: 14,
    marginLeft: 8,
  },
});
