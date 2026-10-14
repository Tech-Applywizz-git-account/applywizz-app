import React, { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";
import { snackApi } from "../api";
import AssistiveAppSwitch from "../../src/components/AssistiveAppSwitch";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.getDate();
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${day} ${mon}, ${h % 12 || 12}:${m} ${ampm}`;
}

function itemsSummary(row) {
  const items = row?.items || row?.order_items || [];
  if (Array.isArray(items) && items.length) {
    return items.map((i) => `${i.name || i.item_name || "Item"}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ");
  }
  if (row?.quick_item) return row.quick_item;
  return "Pantry order";
}

function statusColor(s) {
  const st = String(s).toLowerCase();
  if (st === "done") return "#16A34A";
  if (st === "cancelled") return "#B42318";
  if (st === "preparing" || st === "in_progress") return "#D97706";
  return SN.espresso;
}

function statusIcon(s) {
  const st = String(s).toLowerCase();
  if (st === "done") return "checkmark-circle";
  if (st === "cancelled") return "close-circle";
  if (st === "preparing" || st === "in_progress") return "cafe";
  if (st === "on_the_way") return "bicycle";
  if (st === "ready_for_pickup") return "walk";
  return "time-outline";
}

export default function OrdersScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    snackApi.listRequests().then((d) => {
      const list = d?.requests || d?.queue || d?.data || d || [];
      setRows(Array.isArray(list) ? list : []);
      setErr("");
    }).catch((e) => setErr(e.message));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SN.beige }} edges={["top"]}>
      <View style={styles.topBar}>
        {navigation.canGoBack?.() ? (
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={SN.ink} />
          </Pressable>
        ) : null}
        <Text style={styles.h}>Orders</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {err ? <Text style={styles.err}>{err}</Text> : null}
        {rows.map((r) => {
          const st = String(r.live_status || r.status || "placed").toLowerCase();
          const color = statusColor(st);
          return (
            <Pressable key={r.id} style={styles.card} onPress={() => navigation.navigate("SnackifyTrack", { id: r.id })}>
              <View style={styles.cardTop}>
                <View style={[styles.statusDot, { backgroundColor: color }]}>
                  <Ionicons name={statusIcon(st)} size={14} color="#fff" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.itemsText} numberOfLines={2}>{itemsSummary(r)}</Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.statusText, { color }]}>{st.replace(/_/g, " ")}</Text>
                    <Text style={styles.dot}> · </Text>
                    <Text style={styles.mode}>{r.delivery_mode === "self_pickup" ? "Pickup" : (r.location || "Desk")}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={SN.muted} />
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.orderNum}>#{r.user_order_number || (r.id ? r.id.slice(0, 8) : "")}</Text>
                <Text style={styles.time}>{formatDate(r.created_at)}</Text>
              </View>
            </Pressable>
          );
        })}
        {!rows.length && !err ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="bag-outline" size={48} color={SN.line} />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySub}>Add a drink or snack from Home, confirm in Cart — that prints the office-boy slip.</Text>
          </View>
        ) : null}
      </ScrollView>
      <AssistiveAppSwitch />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  h: { fontFamily: FONT.medium, fontSize: 22, color: SN.ink, marginLeft: 10 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 14, marginBottom: 12, elevation: 1 },
  cardTop: { flexDirection: "row", alignItems: "center" },
  statusDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  itemsText: { fontFamily: FONT.medium, color: SN.ink, fontSize: 14, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  statusText: { fontFamily: FONT.medium, fontSize: 12, textTransform: "capitalize" },
  dot: { color: SN.muted, fontSize: 12 },
  mode: { fontFamily: FONT.light, color: SN.muted, fontSize: 12, textTransform: "capitalize" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F5F0EB" },
  orderNum: { fontFamily: FONT.light, color: SN.muted, fontSize: 12 },
  time: { fontFamily: FONT.light, color: SN.muted, fontSize: 12 },
  emptyWrap: { alignItems: "center", marginTop: 60 },
  emptyTitle: { fontFamily: FONT.medium, color: SN.ink, fontSize: 18, marginTop: 14 },
  emptySub: { fontFamily: FONT.light, color: SN.muted, textAlign: "center", marginTop: 8, lineHeight: 20, maxWidth: 260 },
  err: { fontFamily: FONT.regular, color: "#B42318", marginBottom: 10 },
});
