import React, { useEffect, useState } from "react";
import { ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../api/client";
import { Card, Field, Button, useTheme } from "../../components/ui";

export default function ClientEditorScreen({ navigation, route }) {
  const t = useTheme();
  const id = route.params?.id;
  const [f, setF] = useState({ name: "", company: "", email: "", phone: "", address: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    navigation.setOptions({ title: id ? "Edit client" : "New client" });
    if (id) api.get(`/clients/${id}/`).then(({ data }) => setF(data));
  }, [id]);

  const save = async () => {
    if (!f.name) return Alert.alert("Name required");
    setSaving(true);
    try {
      if (id) await api.put(`/clients/${id}/`, f);
      else await api.post("/clients/", f);
      navigation.goBack();
    } catch (e) { Alert.alert("Error", "Could not save."); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card>
          <Field label="Name *" value={f.name} onChangeText={(v) => set("name", v)} />
          <Field label="Company" value={f.company} onChangeText={(v) => set("company", v)} />
          <Field label="Email" value={f.email} onChangeText={(v) => set("email", v)} keyboardType="email-address" autoCapitalize="none" />
          <Field label="Phone" value={f.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" />
          <Field label="Address" value={f.address} onChangeText={(v) => set("address", v)} multiline style={{ height: 70, textAlignVertical: "top" }} />
          <Field label="Notes" value={f.notes} onChangeText={(v) => set("notes", v)} multiline style={{ height: 60, textAlignVertical: "top" }} />
        </Card>
        <Button title="Save client" onPress={save} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}
