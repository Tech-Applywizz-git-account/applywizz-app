import React, { useEffect, useState } from "react";
import { ScrollView, Alert, View, TouchableOpacity } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../api/client";
import { Card, Field, Button, useTheme } from "../../components/ui";
import { CATALOG_KEYS, asList, loadCatalog } from "../../api/catalogCache";

export default function ExpenseEditorScreen({ navigation, route }) {
  const t = useTheme();
  const id = route.params?.id;
  const [f, setF] = useState({ vendor: "", description: "", amount: "0", spent_on: new Date().toISOString().slice(0, 10), category: null });
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    navigation.setOptions({ title: id ? "Edit expense" : "New expense" });
    loadCatalog(
      CATALOG_KEYS.expenseCategories,
      async () => (await api.get("/expense-categories/")).data,
      { map: asList },
    ).then(setCategories).catch(() => {});
    if (id) api.get(`/expenses/${id}/`).then(({ data }) => setF({ ...data, amount: String(data.amount) }));
  }, [id, navigation]);

  const save = async () => {
    setSaving(true);
    const payload = { ...f, amount: Number(f.amount || 0) };
    try {
      if (id) await api.put(`/expenses/${id}/`, payload); else await api.post("/expenses/", payload);
      navigation.goBack();
    } catch (e) { Alert.alert("Error", "Could not save."); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card>
          <Field label="Vendor" value={f.vendor} onChangeText={(v) => set("vendor", v)} placeholder="e.g. Adobe" />
          <Field label="Amount" value={f.amount} onChangeText={(v) => set("amount", v)} keyboardType="decimal-pad" />
          <Field label="Date" value={f.spent_on} onChangeText={(v) => set("spent_on", v)} placeholder="YYYY-MM-DD" />
          <Field label="Description" value={f.description} onChangeText={(v) => set("description", v)} />
          <Text style={{ color: t.subtext, marginBottom: 6, fontWeight: "500", fontSize: 13 }}>Category</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {categories.map((c) => (
              <TouchableOpacity key={c.id} onPress={() => set("category", c.id)}>
                <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: f.category === c.id ? t.accent : t.card, borderWidth: 1, borderColor: f.category === c.id ? t.accent : t.border }}>
                  <Text style={{ color: f.category === c.id ? "#fff" : t.subtext, fontWeight: "300"}}>{c.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
        <Button title="Save expense" onPress={save} loading={saving} />
        {id && <Button title="Delete" variant="danger" style={{ marginTop: 10 }} onPress={() => Alert.alert("Delete?", "", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: async () => { await api.delete(`/expenses/${id}/`); navigation.goBack(); } }])} />}
      </ScrollView>
    </SafeAreaView>
  );
}
