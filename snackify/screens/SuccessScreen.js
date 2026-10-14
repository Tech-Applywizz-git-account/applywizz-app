import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";
import BrownButton from "../components/BrownButton";
import { useSnackCart } from "../CartContext";

export default function SuccessScreen({ navigation }) {
  const { order } = useSnackCart();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SN.beige, padding: 24 }} edges={["top"]}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <View style={styles.badge}><Ionicons name="checkmark" size={48} color="#fff" /></View>
        <Text style={styles.h}>Order Placed!</Text>
        <Text style={styles.copy}>Your order has been placed successfully.</Text>
        <Text style={styles.meta}>Order ID  {order?.id || "AW-000000"}</Text>
        <Text style={styles.meta}>Estimated  {order?.eta || "25–35 min"}</Text>
      </View>
      <BrownButton title="Track Order" onPress={() => navigation.replace("SnackifyTrack")} />
      <BrownButton outline title="Back to Home" onPress={() => navigation.navigate("SnackifyTabs")} style={{ marginTop: 10 }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badge: { width: 88, height: 88, borderRadius: 44, backgroundColor: SN.green, alignItems: "center", justifyContent: "center" },
  h: { fontFamily: FONT.medium, fontSize: 28, color: SN.ink, marginTop: 18 },
  copy: { fontFamily: FONT.light, color: SN.muted, marginTop: 8, textAlign: "center" },
  meta: { fontFamily: FONT.medium, color: SN.brown, marginTop: 8 },
});
