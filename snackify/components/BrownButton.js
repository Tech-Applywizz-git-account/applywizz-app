import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";

export default function BrownButton({ title, onPress, outline, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.btn, outline && styles.outline, style]}
    >
      <Text style={[styles.txt, outline && styles.txtOut]}>{title}</Text>
    </Pressable>
  );
}

export function ScreenPad({ children, style }) {
  return <View style={[{ flex: 1, backgroundColor: SN.beige }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
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
  txt: { fontFamily: FONT.medium, color: "#fff", fontSize: 15 },
  txtOut: { color: SN.espresso },
});
