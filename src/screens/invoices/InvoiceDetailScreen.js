import React, { useCallback, useState } from "react";
import { View, ScrollView, Alert, TouchableOpacity, Linking } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api, { API_BASE } from "../../api/client";
import { Card, Button, StatusPill, useTheme, Field } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { money } from "../../theme";
import RecordPaymentModal from "./RecordPaymentModal";

export default function InvoiceDetailScreen({ navigation, route }) {
  const t = useTheme();
  const { id } = route.params;
  const [doc, setDoc] = useState(null);
  const [payOpen, setPayOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get(`/documents/${id}/`);
    setDoc(data);
    navigation.setOptions({ title: data.number });
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!doc) return <ListSkeleton rows={8} />;
  const isEstimate = doc.kind === "estimate";

  const act = async (fn, ok) => {
    try { await fn(); await load(); if (ok) Alert.alert("Done", ok); }
    catch (e) { Alert.alert("Error", e.response?.data?.detail || "Something went wrong."); }
  };

  const openPdf = () => Linking.openURL(`${API_BASE}/documents/${id}/pdf/`);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <Text style={{ fontSize: 22, fontWeight: "500", color: t.text }}>{doc.number}</Text>
              <Text style={{ color: t.subtext, marginTop: 2, textTransform: "capitalize", fontWeight: "300"}}>{doc.kind}</Text>
            </View>
            <StatusPill status={doc.status} />
          </View>
          <View style={{ height: 1, backgroundColor: t.border, marginVertical: 14 }} />
          <Row label="Client" value={doc.client_name || "—"} t={t} />
          <Row label="Issue date" value={doc.issue_date} t={t} />
          <Row label="Due date" value={doc.due_date || "—"} t={t} />
        </Card>

        <Card>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 10 }}>Items</Text>
          {doc.items.map((it) => (
            <View key={it.id} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: "500" }}>{it.name}</Text>
                <Text style={{ color: t.subtext, fontSize: 12, fontWeight: "300"}}>{it.quantity} × {money(it.unit_price, doc.currency)}{Number(it.tax_rate) ? ` · ${it.tax_rate}% tax` : ""}</Text>
              </View>
              <Text style={{ color: t.text, fontWeight: "500" }}>{money(it.amount, doc.currency)}</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: t.border, marginVertical: 10 }} />
          <Row label="Subtotal" value={money(doc.subtotal, doc.currency)} t={t} />
          <Row label="Tax" value={money(doc.tax_total, doc.currency)} t={t} />
          <Row label="Total" value={money(doc.total, doc.currency)} bold t={t} />
          {!isEstimate && (
            <>
              <Row label="Paid" value={money(doc.amount_paid, doc.currency)} t={t} />
              <Row label="Balance due" value={money(doc.balance_due, doc.currency)} bold t={t} />
            </>
          )}
        </Card>

        {!isEstimate && doc.payments?.length > 0 && (
          <Card>
            <Text style={{ fontWeight: "500", color: t.text, marginBottom: 10 }}>Payments</Text>
            {doc.payments.map((p) => (
              <View key={p.id} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ color: t.subtext, fontWeight: "300"}}>{p.paid_on} · {p.method}</Text>
                <Text style={{ color: t.success, fontWeight: "500" }}>{money(p.amount, doc.currency)}</Text>
              </View>
            ))}
          </Card>
        )}

        <View style={{ gap: 10, marginTop: 4 }}>
          {!isEstimate && Number(doc.balance_due) > 0 && (
            <Button title="Record payment" icon="cash-outline" onPress={() => setPayOpen(true)} />
          )}
          {isEstimate && doc.status !== "accepted" && (
            <Button title="Mark accepted" icon="checkmark-circle-outline" onPress={() => act(() => api.post(`/documents/${id}/accept/`), "Estimate accepted")} />
          )}
          {isEstimate && (
            <Button title="Convert to invoice" icon="swap-horizontal-outline" variant="outline"
              onPress={() => act(async () => { const { data } = await api.post(`/documents/${id}/convert_to_invoice/`); navigation.replace("InvoiceDetail", { id: data.id }); })} />
          )}
          {doc.status === "draft" && (
            <Button title="Mark as sent" icon="send-outline" variant="outline" onPress={() => act(() => api.post(`/documents/${id}/mark_sent/`))} />
          )}
          <Button title="View / share PDF" icon="document-text-outline" variant="outline" onPress={openPdf} />
          <Button title="Edit" icon="create-outline" variant="ghost" onPress={() => navigation.navigate("InvoiceEditor", { id, kind: doc.kind })} />
          <Button title="Duplicate" icon="copy-outline" variant="ghost" onPress={() => act(async () => { const { data } = await api.post(`/documents/${id}/duplicate/`); navigation.replace("InvoiceDetail", { id: data.id }); })} />
          <Button title="Delete" icon="trash-outline" variant="danger"
            onPress={() => Alert.alert("Delete?", "This cannot be undone.", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => act(async () => { await api.delete(`/documents/${id}/`); navigation.goBack(); }) }])} />
        </View>
      </ScrollView>

      <RecordPaymentModal
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        balance={doc.balance_due}
        onSubmit={async (payload) => { await api.post(`/documents/${id}/record_payment/`, payload); setPayOpen(false); load(); }}
      />
    </SafeAreaView>
  );
}

function Row({ label, value, bold, t }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
      <Text style={{ color: t.subtext, fontWeight: "300"}}>{label}</Text>
      <Text style={{ color: t.text, fontWeight: bold ? "800" : "500" }}>{value}</Text>
    </View>
  );
}
