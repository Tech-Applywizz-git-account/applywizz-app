import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { snackApi } from "../api";
import { SN } from "../data";
import { PantryScreen, PrimaryBtn, Err } from "../ui";
import BackHeader from "../components/BackHeader";

function nextAction(row) {
  const s = String(row?.live_status || row?.status || "").toLowerCase();
  const pickup = row?.delivery_mode === "self_pickup";
  if (s === "pending" || s === "placed") return { status: "in_progress", live_status: "accepted", label: "Accept" };
  if (s === "accepted") return { status: "in_progress", live_status: "preparing", label: "Start preparing" };
  if (s === "preparing" && pickup) return { status: "in_progress", live_status: "ready_for_pickup", label: "Ready for pickup" };
  if (s === "preparing") return { status: "in_progress", live_status: "on_the_way", label: "On the way" };
  if (s === "on_the_way" || s === "ready_for_pickup") return { status: "done", live_status: "done", label: "Mark done" };
  return null;
}

export default function QueueScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    snackApi.listRequests().then((d) => {
      const list = d?.requests || d?.queue || d?.data || d || [];
      setRows((Array.isArray(list) ? list : []).filter((r) => {
        const s = String(r.live_status || r.status || "").toLowerCase();
        return s !== "confirming" && s !== "done" && s !== "cancelled";
      }));
      setErr("");
    }).catch((e) => setErr(e.message));
  }, []);
  useFocusEffect(useCallback(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]));

  const advance = async (row) => {
    const next = nextAction(row);
    if (!next) return;
    try {
      await snackApi.patchStatus(row.id, { status: next.status, live_status: next.live_status });
      load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <PantryScreen>
      <BackHeader title="Fulfillment queue" navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <Text style={styles.sub}>Accept → preparing → deliver/pickup → done</Text>
        <Err text={err} />
        {rows.map((r) => {
          const next = nextAction(r);
          const ls = String(r.live_status || r.status || "").replace(/_/g, " ");
          return (
            <View key={r.id} style={styles.card}>
              <Pressable onPress={() => navigation.navigate("SnackifyTrack", { id: r.id })}>
                <Text style={styles.id}>#{r.user_order_number || r.id} · {r.delivery_mode === "self_pickup" ? "Pickup" : "Delivery"}</Text>
                <Text style={styles.meta}>{r.location || "Pantry counter"} · {ls}</Text>
              </Pressable>
              {next ? (
                <Pressable onPress={() => advance(r)} style={styles.go}>
                  <Text style={styles.goTxt}>{next.label}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {!rows.length ? <Text style={styles.meta}>Queue is clear.</Text> : null}
      </ScrollView>
    </PantryScreen>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: FONT.medium, fontSize: 26, color: SN.ink },
  sub: { fontFamily: FONT.light, color: SN.muted, marginTop: 6, marginBottom: 12 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10 },
  id: { fontFamily: FONT.medium, color: SN.ink },
  meta: { fontFamily: FONT.light, color: SN.muted, marginTop: 4, textTransform: "capitalize" },
  go: { marginTop: 10, alignSelf: "flex-start", backgroundColor: SN.espresso, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  goTxt: { fontFamily: FONT.medium, color: "#fff", fontSize: 13 },
});
