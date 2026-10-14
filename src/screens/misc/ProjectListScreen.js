import React, { useCallback, useState } from "react";
import { View, FlatList, TouchableOpacity, Modal } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import { Card, EmptyState, Field, Button, StatusPill, useTheme } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { money } from "../../theme";

export default function ProjectListScreen() {
  const t = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", budget: "0", hourly_rate: "0" });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/projects/");
      setItems(data.results || data);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const save = async () => {
    await api.post("/projects/", { name: f.name, budget: Number(f.budget || 0), hourly_rate: Number(f.hourly_rate || 0) });
    setOpen(false); setF({ name: "", budget: "0", hourly_rate: "0" }); load();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      {loading && !items.length ? (
        <ListSkeleton rows={6} />
      ) : (
        <FlatList
          data={items} keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListHeaderComponent={(
            <TouchableOpacity onPress={() => setOpen(true)} style={{ alignSelf: "flex-end", marginBottom: 12 }}>
              <Ionicons name="add-circle" size={32} color={t.accent} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<EmptyState icon="briefcase-outline" title="No projects" subtitle="Group work, budgets & profit." />}
          renderItem={({ item }) => (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ fontWeight: "500", color: t.text }}>{item.name}</Text>
                  <View style={{ marginTop: 6 }}><StatusPill status={item.status || "active"} /></View>
                </View>
                <Text style={{ fontWeight: "500", color: t.text }}>{money(item.budget)}</Text>
              </View>
            </Card>
          )}
        />
      )}
      <Modal visible={open} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#0006" }}>
          <View style={{ backgroundColor: t.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 }}>
            <Field label="Name" value={f.name} onChangeText={(v) => setF((p) => ({ ...p, name: v }))} />
            <Field label="Budget" value={f.budget} onChangeText={(v) => setF((p) => ({ ...p, budget: v }))} keyboardType="decimal-pad" />
            <Field label="Hourly rate" value={f.hourly_rate} onChangeText={(v) => setF((p) => ({ ...p, hourly_rate: v }))} keyboardType="decimal-pad" />
            <Button title="Create" onPress={save} />
            <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
