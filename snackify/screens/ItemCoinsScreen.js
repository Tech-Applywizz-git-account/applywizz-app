import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { snackApi } from "../api";
import { useSnackAuth } from "../AuthContext";
import { useSnackMenu } from "../MenuContext";
import { SN } from "../data";
import { isOpsRole } from "../theme";
import { PantryScreen, PrimaryBtn, Err } from "../ui";
import BackHeader from "../components/BackHeader";

function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of ["items", "products", "rows", "results", "data", "menu"]) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function rowCoins(raw) {
  const v = raw?.token_price ?? raw?.coin_price ?? raw?.coins ?? raw?.price;
  if (v == null || v === "") return "";
  return String(v);
}

function rowName(raw) {
  return raw?.display_name || raw?.item_name || raw?.name || raw?.product_name || "Item";
}

export default function ItemCoinsScreen({ navigation }) {
  const { role, isOwner } = useSnackAuth();
  const menu = useSnackMenu();
  const canEdit = isOwner || isOpsRole(role);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    setOk("");
    try {
      const data = await snackApi.items();
      const list = asList(data)
        .filter((raw) => raw && !String(raw.id || "").startsWith("virtual_"))
        .map((raw) => ({
          id: raw.id || raw.product_id || raw.item_id,
          name: rowName(raw),
          baseline: rowCoins(raw),
          coins: rowCoins(raw),
        }))
        .filter((r) => r.id);
      list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      setRows(list);
      if (!list.length) setErr("No cafeteria items returned.");
    } catch (e) {
      setRows([]);
      setErr(e.message || "Could not load items.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (canEdit) load();
  }, [canEdit, load]));

  const setCoins = (id, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, coins: value } : r)));
  };

  const save = async () => {
    if (!canEdit) return;
    setBusy(true);
    setErr("");
    setOk("");
    try {
      const changed = rows.filter((r) => {
        const next = Number(r.coins);
        const prev = Number(r.baseline);
        return r.coins !== "" && !Number.isNaN(next) && next !== prev;
      });
      if (!changed.length) {
        setOk("Nothing changed.");
        return;
      }
      await Promise.all(changed.map((r) => {
        const value = Number(r.coins);
        return snackApi.patchCafeteriaItem(r.id, {
          token_price: value,
          coin_price: value,
        });
      }));
      setOk(`Updated coins on ${changed.length} item${changed.length === 1 ? "" : "s"}.`);
      await load();
      menu?.load?.();
    } catch (e) {
      setErr(e.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!canEdit) {
    return (
      <PantryScreen>
        <BackHeader title="Item coins" navigation={navigation} />
        <View style={{ padding: 18 }}>
          <Text style={styles.h}>Admins only</Text>
          <Text style={styles.sub}>
            Super admin, facility manager, office boy, finance, and leadership can edit item coin prices.
          </Text>
        </View>
      </PantryScreen>
    );
  }

  const filtered = rows.filter((r) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return String(r.name).toLowerCase().includes(needle);
  });

  return (
    <PantryScreen>
      <BackHeader title="Item coins" navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Text style={styles.h}>Edit coins per item</Text>
        <Text style={styles.sub}>
          Change how many Snackify coins each cafeteria item costs. Saves to the live menu.
        </Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search item…"
          placeholderTextColor={SN.muted}
          style={styles.search}
        />
        <Err text={err} />
        {ok ? <Text style={styles.ok}>{ok}</Text> : null}
        {loading ? <ActivityIndicator color={SN.espresso} style={{ marginTop: 20 }} /> : null}
        {!loading && filtered.map((r) => (
          <View key={String(r.id)} style={styles.row}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.name}>{r.name}</Text>
              <Text style={styles.meta}>Current: {r.baseline || "0"} coins</Text>
            </View>
            <TextInput
              keyboardType="numeric"
              value={String(r.coins ?? "")}
              onChangeText={(t) => setCoins(r.id, t.replace(/[^0-9.]/g, ""))}
              style={styles.in}
              selectTextOnFocus
              placeholder="0"
              placeholderTextColor={SN.muted}
            />
          </View>
        ))}
        {!loading && filtered.length ? (
          <PrimaryBtn title={busy ? "Saving…" : "Save coin prices"} onPress={save} loading={busy} style={{ marginTop: 16 }} />
        ) : null}
        {!loading && !filtered.length ? (
          <Pressable onPress={load} style={{ marginTop: 12 }}>
            <Text style={styles.meta}>No items. Tap to retry.</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </PantryScreen>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: FONT.medium, fontSize: 26, color: SN.ink },
  sub: { fontFamily: FONT.light, color: SN.muted, marginTop: 6, marginBottom: 12, lineHeight: 20 },
  ok: { fontFamily: FONT.medium, color: "#15803D", marginBottom: 10 },
  search: {
    height: 44, borderRadius: 12, backgroundColor: "#fff", paddingHorizontal: 14,
    fontFamily: FONT.regular, color: SN.ink, marginBottom: 12, borderWidth: 1, borderColor: SN.line,
  },
  row: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  name: { fontFamily: FONT.medium, color: SN.ink },
  meta: { fontFamily: FONT.light, color: SN.muted, fontSize: 12, marginTop: 2 },
  in: {
    width: 72, height: 40, borderRadius: 10, borderWidth: 1, borderColor: SN.line,
    textAlign: "center", fontFamily: FONT.medium, color: SN.ink,
  },
});
