import React, { useCallback, useState } from "react";
import { View, FlatList, TouchableOpacity, Modal, Alert } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import { Card, EmptyState, Field, Button, StatusPill, useTheme } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";

export default function ContractsScreen() {
  const t = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", body: "" });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/contracts/");
      setItems(data.results || data);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const save = async () => {
    if (!f.title) return Alert.alert("Title required");
    await api.post("/contracts/", f);
    setOpen(false); setF({ title: "", body: "" }); load();
  };

  const sign = async (id) => { await api.post(`/contracts/${id}/sign/`, { name: "Client" }); load(); };

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
          ListEmptyComponent={<EmptyState icon="reader-outline" title="No contracts" subtitle="Create client agreements here." />}
          renderItem={({ item }) => (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "500", color: t.text }}>{item.title}</Text>
                  <View style={{ marginTop: 6 }}><StatusPill status={item.status} /></View>
                </View>
                {item.status !== "signed" ? (
                  <Button title="Sign" onPress={() => sign(item.id)} style={{ paddingHorizontal: 12, paddingVertical: 8 }} />
                ) : null}
              </View>
            </Card>
          )}
        />
      )}
      <Modal visible={open} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#0006" }}>
          <View style={{ backgroundColor: t.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 }}>
            <Field label="Title" value={f.title} onChangeText={(v) => setF((p) => ({ ...p, title: v }))} />
            <Field label="Body" value={f.body} onChangeText={(v) => setF((p) => ({ ...p, body: v }))} multiline style={{ height: 100 }} />
            <Button title="Create" onPress={save} />
            <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
