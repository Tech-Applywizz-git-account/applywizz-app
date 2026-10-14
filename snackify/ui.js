import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../src/components/AppText";
import { FONT } from "../src/typography";
import AssistiveAppSwitch from "../src/components/AssistiveAppSwitch";
import { SN } from "./data";

export function PantryScreen({ children, edges = ["top"] }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SN.beige }} edges={edges}>
      {children}
      <AssistiveAppSwitch />
    </SafeAreaView>
  );
}

export function PrimaryBtn({ title, onPress, disabled, loading, outline, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.btn, outline && styles.outline, (disabled || loading) && { opacity: 0.55 }, style]}
    >
      {loading ? <ActivityIndicator color={outline ? SN.espresso : "#fff"} /> : (
        <Text style={[styles.btnTxt, outline && { color: SN.espresso }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Err({ text }) {
  if (!text) return null;
  return <Text style={styles.err}>{text}</Text>;
}

const styles = StyleSheet.create({
  btn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: SN.espresso,
    alignItems: "center",
    justifyContent: "center",
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: SN.espresso,
  },
  btnTxt: { fontFamily: FONT.medium, color: "#fff", fontSize: 15 },
  err: { fontFamily: FONT.regular, color: "#B42318", marginTop: 8, fontSize: 13, paddingHorizontal: 2 },
});
