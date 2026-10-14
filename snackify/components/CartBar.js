import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { useSnackCart } from "../CartContext";
import Coin from "./Coin";

const PAY_GREEN = "#1BA672";

export default function CartBar({ navigation }) {
  const cart = useSnackCart();
  if (!cart?.count) return null;
  return (
    <Pressable onPress={() => navigation.navigate("SnackifyCart")} style={styles.bar}>
      <View style={styles.left}>
        <Text style={styles.count}>
          {cart.count} item{cart.count === 1 ? "" : "s"}
        </Text>
        <View style={styles.price}>
          <Coin size={16} />
          <Text style={styles.amt}>{cart.totalCoins}</Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={styles.cta}>View cart</Text>
        <Ionicons name="chevron-forward" size={16} color="#fff" />
      </View>
    </Pressable>
  );
}

export { PAY_GREEN };

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: PAY_GREEN,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  count: { fontFamily: FONT.medium, color: "#fff", fontSize: 13 },
  price: { flexDirection: "row", alignItems: "center", gap: 4 },
  amt: { fontFamily: FONT.medium, color: "#fff", fontSize: 16 },
  right: { flexDirection: "row", alignItems: "center", gap: 2 },
  cta: { fontFamily: FONT.medium, color: "#fff", fontSize: 14 },
});
