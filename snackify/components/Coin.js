import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";

/** Gold Snackify coin from the pricing card: yellow disc + white $. */
export default function Coin({ size = 18, style }) {
  const font = Math.round(size * 0.62);
  const border = Math.max(1, size * 0.055);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#F5C518",
          borderWidth: border,
          borderColor: "#E8B400",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: font,
          fontFamily: FONT.medium,
          lineHeight: font + 1,
          includeFontPadding: false,
          marginTop: Platform.OS === "android" ? -1 : 0,
        }}
      >
        $
      </Text>
    </View>
  );
}

export function CoinPrice({ amount, size = 16, color = "#1A1A1A", muted = false, suffix }) {
  const n = Number(amount) || 0;
  return (
    <View style={styles.row}>
      <Coin size={Math.max(14, size)} />
      <Text
        style={{
          fontFamily: FONT.medium,
          color: muted ? "#6B7280" : color,
          fontSize: size,
          marginLeft: 5,
        }}
      >
        {n}{suffix ? ` ${suffix}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});
