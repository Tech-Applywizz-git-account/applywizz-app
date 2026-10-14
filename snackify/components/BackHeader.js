import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";

export default function BackHeader({ title, navigation, right }) {
  const canBack = navigation?.canGoBack?.();
  return (
    <View style={styles.bar}>
      {canBack ? (
        <Pressable onPress={() => navigation.goBack()} style={styles.btn}>
          <Ionicons name="arrow-back" size={20} color={SN.ink} />
        </Pressable>
      ) : <View style={{ width: 40 }} />}
      <Text style={styles.title}>{title}</Text>
      {right || <View style={{ width: 40 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: FONT.medium, fontSize: 20, color: SN.ink, marginLeft: 8 },
});
