import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { snackApi } from "../api";
import { useSnackAuth } from "../AuthContext";
import { SN } from "../data";
import { PantryScreen, PrimaryBtn, Err } from "../ui";
import BackHeader from "../components/BackHeader";

function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of [
    "inventory",
    "products",
    "items",
    "rows",
    "results",
    "data",
    "menu",
    "stock",
  ]) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function normalizeInventoryRow(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.product_id || raw.id || raw.item_id || `row-${index}`;
  const name = raw.name || raw.product_name || raw.item_name || raw.title || "Item";
  const stock = raw.current_stock ?? raw.stock ?? raw.count ?? 0;
  const unitCost = raw.cost_per_unit ?? raw.unit_cost ?? raw.unitCost;
  return {
    source: "inventory",
    product_id: id,
    id,
    name,
    baseline: Number(stock) || 0,
    new_count: String(stock ?? ""),
    unit_cost: unitCost == null || unitCost === "" ? "" : String(unitCost),
    baseline_unit_cost: unitCost == null || unitCost === "" ? null : Number(unitCost),
  };
}

function normalizeCafeteriaRow(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id || raw.product_id || raw.item_id || `row-${index}`;
  if (String(id).startsWith("virtual_")) return null;
  const name =
    raw.display_name || raw.item_name || raw.name || raw.product_name || raw.title || "Item";
  // Daily pack count matches pantry "daily update"; fall back to servings if packs missing.
  const stock =
    raw.stock_today != null && raw.stock_today !== ""
      ? raw.stock_today
      : (raw.stock_servings ?? raw.stock ?? 0);
  const field =
    raw.stock_today != null && raw.stock_today !== ""
      ? "stock_today"
      : "stock_servings";
  return {
    source: "cafeteria",
    product_id: id,
    id,
    name,
    stock_field: field,
    baseline: Number(stock) || 0,
    new_count: String(stock ?? ""),
    stock_servings: raw.stock_servings,
    stock_today: raw.stock_today,
  };
}

export default function DailyUpdateScreen({ navigation }) {
  const { isOwner } = useSnackAuth();
  const [rows, setRows] = useState([]);
  const [source, setSource] = useState("inventory");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    setOk("");
    try {
      let list = [];
      let mode = "inventory";
      try {
        const inv = await snackApi.inventory();
        list = asList(inv).map(normalizeInventoryRow).filter(Boolean);
      } catch (invErr) {
        console.log("[snackify] inventory failed:", invErr?.message || invErr);
      }

      // Production inventory table can be empty; cafeteria items still hold orderable stock.
      if (!list.length) {
        const menu = await snackApi.items();
        list = asList(menu).map(normalizeCafeteriaRow).filter(Boolean);
        mode = "cafeteria";
      }

      const seen = new Set();
      const unique = [];
      for (const row of list) {
        const key = String(row.product_id || row.name).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(row);
      }
      unique.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      setRows(unique);
      setSource(mode);
      if (!unique.length) {
        setErr("No pantry stock items returned. Check Snackify inventory access.");
      }
    } catch (e) {
      setRows([]);
      setErr(e.message || "Could not load stock items.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (isOwner) load();
  }, [load, isOwner]));

  const setCount = (id, count) => {
    setRows((prev) => prev.map((r) => (
      (r.product_id || r.id) === id ? { ...r, new_count: count } : r
    )));
  };

  const save = async () => {
    if (!isOwner) return;
    setBusy(true);
    setErr("");
    setOk("");
    try {
      if (source === "inventory") {
        const updates = rows.map((r) => {
          const current_stock = Number(r.new_count);
          if (Number.isNaN(current_stock)) return null;
          const changed = current_stock !== Number(r.baseline);
          const unitRaw = r.unit_cost;
          const unit_cost = unitRaw === "" || unitRaw == null ? null : Number(unitRaw);
          const priceChanged =
            unit_cost != null
            && !Number.isNaN(unit_cost)
            && unit_cost !== Number(r.baseline_unit_cost);
          if (!changed && !priceChanged) return null;
          const row = { product_id: r.product_id || r.id, current_stock };
          if (priceChanged) row.unit_cost = unit_cost;
          return row;
        }).filter(Boolean);

        if (!updates.length) {
          setOk("Nothing changed — all counts already match.");
          return;
        }

        const result = await snackApi.dailyUpdate(updates);
        const updated = result?.updated ?? updates.length;
        setOk(`Updated ${updated} item${updated === 1 ? "" : "s"}.`);
      } else {
        const changed = rows.filter((r) => {
          const next = Number(r.new_count);
          return !Number.isNaN(next) && next !== Number(r.baseline);
        });
        if (!changed.length) {
          setOk("Nothing changed — all counts already match.");
          return;
        }

        await Promise.all(changed.map((r) => {
          const value = Number(r.new_count);
          const field = r.stock_field || "stock_today";
          return snackApi.patchCafeteriaItem(r.product_id || r.id, { [field]: value });
        }));
        setOk(`Updated ${changed.length} item${changed.length === 1 ? "" : "s"}.`);
      }
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!isOwner) {
    return (
      <PantryScreen>
        <BackHeader title="Daily stock update" navigation={navigation} />
        <View style={{ padding: 18 }}>
          <Text style={styles.h}>Owner only</Text>
          <Text style={styles.sub}>
            Manual stock quantity updates in the Snackify app are limited to Dinesh.
          </Text>
        </View>
      </PantryScreen>
    );
  }

  return (
    <PantryScreen>
      <BackHeader title="Daily stock update" navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Text style={styles.h}>Manual stock counts</Text>
        <Text style={styles.sub}>
          Type quantities directly. Higher than yesterday = restock; lower = consumption.
          {source === "cafeteria"
            ? " Editing cafeteria pack counts (inventory catalog is empty)."
            : ""}
        </Text>
        <Err text={err} />
        {ok ? <Text style={styles.ok}>{ok}</Text> : null}
        {loading ? (
          <ActivityIndicator color={SN.espresso} style={{ marginTop: 24 }} />
        ) : null}
        {!loading && rows.map((r) => {
          const id = r.product_id || r.id;
          return (
            <View key={String(id)} style={styles.row}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.name}>{r.name || r.product_name}</Text>
                <Text style={styles.meta}>
                  Current: {r.baseline}
                  {r.stock_servings != null && r.stock_field === "stock_today"
                    ? ` · ${r.stock_servings} servings`
                    : ""}
                </Text>
              </View>
              <TextInput
                keyboardType="numeric"
                value={String(r.new_count ?? "")}
                onChangeText={(t) => setCount(id, t.replace(/[^0-9.]/g, ""))}
                style={styles.in}
                selectTextOnFocus
                placeholder="0"
                placeholderTextColor={SN.muted}
              />
            </View>
          );
        })}
        {!loading && rows.length ? (
          <PrimaryBtn title="Save counts" onPress={save} loading={busy} style={{ marginTop: 16 }} />
        ) : null}
        {!loading && !rows.length ? (
          <PrimaryBtn outline title="Retry load" onPress={load} style={{ marginTop: 16 }} />
        ) : null}
      </ScrollView>
    </PantryScreen>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: FONT.medium, fontSize: 26, color: SN.ink },
  sub: { fontFamily: FONT.light, color: SN.muted, marginTop: 6, marginBottom: 12, lineHeight: 20 },
  ok: { fontFamily: FONT.medium, color: "#15803D", marginBottom: 10 },
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
