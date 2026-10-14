import React, { useCallback, useState } from "react";
import { View, FlatList, TouchableOpacity, Modal } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import { Card, EmptyState, Field, Button, useTheme } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { money } from "../../theme";
import {
  CATALOG_KEYS,
  CATALOG_TTL_MS,
  asList,
  loadCatalog,
  readFreshCatalog,
} from "../../api/catalogCache";

export default function PriceBookScreen() {
  const t = useTheme();
  const cached = readFreshCatalog(CATALOG_KEYS.priceBook, CATALOG_TTL_MS);
  const [items, setItems] = useState(Array.isArray(cached) ? cached : []);
  const [loading, setLoading] = useState(!cached?.length);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", unit_price: "0", tax_rate: "0" });

  const load = useCallback(async ({ force = false } = {}) => {
    try {
      if (!force) {
        const fresh = readFreshCatalog(CATALOG_KEYS.priceBook, CATALOG_TTL_MS);
        if (fresh?.length) {
          setItems(fresh);
          return;
        }
      }
      const list = await loadCatalog(
        CATALOG_KEYS.priceBook,
        async () => (await api.get("/price-book/")).data,
        { map: asList },
      );
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    const fresh = readFreshCatalog(CATALOG_KEYS.priceBook, CATALOG_TTL_MS);
    if (fresh?.length) {
      setItems(fresh);
      setLoading(false);
      return;
    }
    setLoading(true);
    load();
  }, [load]));

  const save = async () => {
    await api.post("/price-book/", { name: f.name, unit_price: Number(f.unit_price || 0), tax_rate: Number(f.tax_rate || 0) });
    setOpen(false); setF({ name: "", unit_price: "0", tax_rate: "0" });
    await load({ force: true });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      {loading && !items.length ? (
        <ListSkeleton rows={8} />
      ) : (
        <FlatList
          data={items} keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListHeaderComponent={(
            <TouchableOpacity onPress={() => setOpen(true)} style={{ alignSelf: "flex-end", marginBottom: 12 }}>
              <Ionicons name="add-circle" size={32} color={t.accent} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<EmptyState icon="pricetags-outline" title="No saved items" subtitle="Save services you bill often." />}
          renderItem={({ item }) => (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "500", color: t.text }}>{item.name}</Text>
                <Text style={{ fontWeight: "500", color: t.text }}>{money(item.unit_price)}</Text>
              </View>
            </Card>
          )}
        />
      )}
      <Modal visible={open} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#0006" }}>
          <View style={{ backgroundColor: t.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 }}>
            <Text style={{ fontWeight: "500", fontSize: 18, color: t.text, marginBottom: 12 }}>New item</Text>
            <Field label="Name" value={f.name} onChangeText={(v) => setF((p) => ({ ...p, name: v }))} />
            <Field label="Unit price" value={f.unit_price} onChangeText={(v) => setF((p) => ({ ...p, unit_price: v }))} keyboardType="decimal-pad" />
            <Field label="Tax %" value={f.tax_rate} onChangeText={(v) => setF((p) => ({ ...p, tax_rate: v }))} keyboardType="decimal-pad" />
            <Button title="Save" onPress={save} />
            <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
