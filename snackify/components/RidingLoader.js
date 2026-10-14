import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { SN } from "../data";

const RIDER = require("../assets/riding-delivery.gif");

export default function RidingLoader() {
  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityLabel="Placing your order">
      <Image source={RIDER} style={styles.art} resizeMode="contain" pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    width: "100%",
    backgroundColor: SN.beige,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  art: {
    width: "92%",
    height: "70%",
    maxHeight: 280,
  },
});
