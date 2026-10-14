import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";
import { snackApi } from "../api";
import BrownButton from "../components/BrownButton";

function itemsSummary(row) {
  const items = row?.items || row?.order_items || [];
  if (Array.isArray(items) && items.length) {
    return items.map((i) => `${i.name || i.item_name || "Item"}${i.qty > 1 ? ` x${i.qty}` : ""}`).join(", ");
  }
  return row?.quick_item || "New pantry order";
}

export default function OfficeBoyAlertScreen({ navigation, route }) {
  const id = route.params?.id;
  const [row, setRow] = useState(null);

  useEffect(() => {
    if (!id) return;
    snackApi.getRequest(id).then((data) => setRow(data?.request || data)).catch(() => {});
  }, [id]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Ionicons name="notifications" size={18} color="#fff" />
        </View>
        <Text style={styles.title}>New pantry order</Text>
        <Text style={styles.sub}>
          {row?.delivery_mode === "self_pickup" ? "Pickup request is waiting." : "Delivery request is waiting."}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Order</Text>
        <Text style={styles.value}>#{row?.user_order_number || (id ? String(id).slice(0, 8) : "Pending")}</Text>
        <Text style={styles.items}>{itemsSummary(row)}</Text>
        <Text style={styles.meta}>
          {row?.delivery_mode === "self_pickup" ? "Pantry counter pickup" : (row?.location || "Desk delivery")}
        </Text>
      </View>

      <View style={styles.actions}>
        <BrownButton title="Open queue" onPress={() => navigation.navigate("SnackifyTabs", { screen: "SnackifyQueueTab" })} />
        <BrownButton
          outline
          title="Open order"
          onPress={() => navigation.navigate("SnackifyTabs", {
            screen: "SnackifyQueueTab",
            params: {
              screen: "SnackifyTrack",
              params: { id },
            },
          })}
          style={{ marginTop: 12 }}
        />
        <Pressable onPress={() => navigation.goBack()} style={styles.dismiss}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SN.beige, paddingHorizontal: 20, justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: 22 },
  badge: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: SN.espresso,
    alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  title: { fontFamily: FONT.medium, fontSize: 28, color: SN.ink },
  sub: { fontFamily: FONT.regular, fontSize: 14, color: SN.muted, marginTop: 8, textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 18 },
  label: { fontFamily: FONT.medium, color: SN.muted, fontSize: 12, textTransform: "uppercase" },
  value: { fontFamily: FONT.medium, color: SN.ink, fontSize: 20, marginTop: 8 },
  items: { fontFamily: FONT.medium, color: SN.ink, fontSize: 16, marginTop: 10, lineHeight: 22 },
  meta: { fontFamily: FONT.regular, color: SN.muted, fontSize: 13, marginTop: 10 },
  actions: { marginTop: 22 },
  dismiss: { alignItems: "center", marginTop: 16 },
  dismissText: { fontFamily: FONT.medium, color: SN.muted },
});
