import React, { useCallback, useState } from "react";
import { View, ScrollView, TouchableOpacity, Linking, Alert } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import { Card, Button, StatusPill, useTheme } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { money } from "../../theme";

export default function ClientDetailScreen({ navigation, route }) {
  const t = useTheme();
  const { id } = route.params;
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const { data } = await api.get(`/clients/${id}/statement/`);
    setData(data);
    navigation.setOptions({ title: data.client.name, headerRight: () => (
      <TouchableOpacity onPress={() => navigation.navigate("ClientEditor", { id })}><Ionicons name="create-outline" size={22} color={t.accent} /></TouchableOpacity>
    )});
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!data) return <ListSkeleton rows={6} />;
  const c = data.client;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card>
          <Text style={{ fontSize: 20, fontWeight: "500", color: t.text }}>{c.name}</Text>
          {c.company ? <Text style={{ color: t.subtext, fontWeight: "300"}}>{c.company}</Text> : null}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
            {c.email ? <TouchableOpacity onPress={() => Linking.openURL(`mailto:${c.email}`)}><Ionicons name="mail-outline" size={22} color={t.accent} /></TouchableOpacity> : null}
            {c.phone ? <TouchableOpacity onPress={() => Linking.openURL(`tel:${c.phone}`)}><Ionicons name="call-outline" size={22} color={t.accent} /></TouchableOpacity> : null}
          </View>
          <View style={{ height: 1, backgroundColor: t.border, marginVertical: 14 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View><Text style={{ color: t.subtext, fontSize: 12, fontWeight: "300"}}>Outstanding</Text><Text style={{ color: t.text, fontWeight: "500", fontSize: 18 }}>{money(c.outstanding)}</Text></View>
            <View><Text style={{ color: t.subtext, fontSize: 12, fontWeight: "300"}}>Total billed</Text><Text style={{ color: t.text, fontWeight: "500", fontSize: 18 }}>{money(c.total_billed)}</Text></View>
          </View>
        </Card>

        <Button title="New invoice for client" icon="add" onPress={() => navigation.navigate("InvoiceEditor", { kind: "invoice" })} />

        <Text style={{ fontSize: 18, fontWeight: "500", color: t.text, marginTop: 18, marginBottom: 8 }}>Invoices</Text>
        {data.documents.length === 0 && <Text style={{ color: t.subtext, fontWeight: "300"}}>No invoices yet.</Text>}
        {data.documents.map((d) => (
          <Card key={d.id} onPress={() => navigation.navigate("InvoiceDetail", { id: d.id })}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View><Text style={{ fontWeight: "500", color: t.text }}>{d.number}</Text><Text style={{ color: t.subtext, fontSize: 12, fontWeight: "300"}}>{d.issue_date}</Text></View>
              <View style={{ alignItems: "flex-end" }}><Text style={{ fontWeight: "500", color: t.text }}>{money(d.total, d.currency)}</Text><View style={{ marginTop: 4 }}><StatusPill status={d.status} /></View></View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
