import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { snackApi } from "../api";
import { useSnackCart } from "../CartContext";
import { useSnackAuth } from "../AuthContext";
import { C, ROLE_LABEL } from "../theme";
import { PantryScreen, PrimaryBtn, Err } from "../ui";

export default function CafeteriaScreen({ navigation }) {
  const cart = useSnackCart();
  const { profile, role } = useSnackAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [forcePickup, setForcePickup] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setErr("");
      const [menu, pickup] = await Promise.all([
        snackApi.items(),
        snackApi.selfPickupStatus().catch(() => null),
      ]);
      const list = Array.isArray(menu) ? menu : menu?.items || menu?.data || [];
      setItems(list.filter((i) => i.available !== false && i.visible_to_employees !== false));
      const forced = Boolean(pickup?.force_self_pickup || pickup?.on_leave || pickup?.self_pickup);
      setForcePickup(forced);
      if (forced) cart.setMode("self_pickup");
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = items.filter((i) => {
    const name = String(i.name || "").toLowerCase();
    return !q.trim() || name.includes(q.trim().toLowerCase());
  });

  const confirm = async () => {
    if (!cart.count) return;
    setBusy(true);
    try {
      const data = await snackApi.placeRequest(cart.payload());
      const id = data?.id || data?.request?.id;
      cart.setActiveId(id);
      cart.clear();
      navigation.navigate("SnackifyTrack", { id });
    } catch (e) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  return (
    <PantryScreen>
      <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={load} />} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.top}>
          <View>
            <Text style={styles.kicker}>{ROLE_LABEL[role] || "Pantry"}</Text>
            <Text style={styles.h}>Skip the queue.</Text>
            <Text style={styles.sub}>Hi {profile?.preferred_name || profile?.email || "there"} — tea, snacks, desk delivery.</Text>
          </View>
        </View>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search tea, sandwiches…" placeholderTextColor={C.muted} style={styles.searchIn} />
        </View>

        <View style={styles.modes}>
          {["get_it_here", "self_pickup"].map((m) => {
            const on = cart.mode === m;
            const locked = forcePickup && m === "get_it_here";
            return (
              <Pressable key={m} disabled={locked} onPress={() => cart.setMode(m)} style={[styles.mode, on && styles.modeOn, locked && { opacity: 0.4 }]}>
                <Text style={[styles.modeTxt, on && { color: "#fff" }]}>{m === "get_it_here" ? "Desk delivery" : "Self pickup"}</Text>
              </Pressable>
            );
          })}
        </View>
        {cart.mode === "get_it_here" ? (
          <TextInput
            value={cart.location}
            onChangeText={cart.setLocation}
            placeholder="Cabin / desk (e.g. Tech-12)"
            placeholderTextColor={C.muted}
            style={[styles.search, { marginTop: 8 }]}
          />
        ) : null}

        <Err text={err} />
        <View style={styles.grid}>
          {shown.map((item) => (
            <Pressable key={item.id} style={styles.card} onPress={() => cart.add(item)}>
              {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.img} /> : (
                <View style={[styles.img, { alignItems: "center", justifyContent: "center" }]}>
                  <Ionicons name="cafe-outline" size={22} color={C.teal} />
                </View>
              )}
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.meta}>{item.stock_servings != null ? `${item.stock_servings} left` : "In pantry"}</Text>
              <View style={styles.add}><Ionicons name="add" size={16} color="#fff" /></View>
            </Pressable>
          ))}
        </View>
        {!shown.length && !err ? <Text style={styles.empty}>No items yet. Pull to refresh.</Text> : null}
      </ScrollView>

      {cart.count ? (
        <View style={styles.bar}>
          <View>
            <Text style={styles.barLbl}>{cart.count} in bag</Text>
            <TextInput value={cart.note} onChangeText={cart.setNote} placeholder="Note for pantry" placeholderTextColor={C.muted} style={styles.note} />
          </View>
          <PrimaryBtn title="Place order" onPress={confirm} loading={busy} style={{ width: 140 }} />
        </View>
      ) : null}
    </PantryScreen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 18, paddingTop: 8 },
  kicker: { fontFamily: FONT.medium, color: C.teal, fontSize: 12, letterSpacing: 1 },
  h: { fontFamily: FONT.medium, fontSize: 26, color: C.ink, marginTop: 4 },
  sub: { fontFamily: FONT.light, color: C.muted, marginTop: 4 },
  search: {
    marginHorizontal: 18, marginTop: 14, height: 46, borderRadius: 14, backgroundColor: "#fff",
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: C.line,
    fontFamily: FONT.regular, color: C.ink,
  },
  searchIn: { flex: 1, fontFamily: FONT.regular, color: C.ink },
  modes: { flexDirection: "row", gap: 8, paddingHorizontal: 18, marginTop: 12 },
  mode: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: "#fff", justifyContent: "center", borderWidth: 1, borderColor: C.line },
  modeOn: { backgroundColor: C.teal, borderColor: C.teal },
  modeTxt: { fontFamily: FONT.medium, color: C.ink, fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: 18, marginTop: 16 },
  card: { width: "48%", backgroundColor: "#fff", borderRadius: 16, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  img: { width: "100%", height: 84, borderRadius: 12, backgroundColor: C.mint },
  name: { fontFamily: FONT.medium, marginTop: 8, color: C.ink },
  meta: { fontFamily: FONT.light, color: C.muted, fontSize: 12, marginTop: 2 },
  add: { position: "absolute", right: 12, bottom: 12, width: 26, height: 26, borderRadius: 13, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" },
  empty: { fontFamily: FONT.light, color: C.muted, padding: 18 },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#fff", padding: 14, borderTopWidth: 1, borderTopColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  barLbl: { fontFamily: FONT.medium, color: C.ink },
  note: { fontFamily: FONT.regular, color: C.ink, minWidth: 140, marginTop: 4 },
});
