import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert, Modal, FlatList } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import { Card, Button, Field, useTheme } from "../../components/ui";
import { money } from "../../theme";

const blankItem = () => ({ name: "", quantity: "1", unit_price: "0", tax_rate: "0" });

export default function InvoiceEditorScreen({ navigation, route }) {
  const t = useTheme();
  const editingId = route.params?.id;
  const kind = route.params?.kind || "invoice";

  const [clients, setClients] = useState([]);
  const [priceBook, setPriceBook] = useState([]);
  const [clientId, setClientId] = useState(null);
  const [clientName, setClientName] = useState("");
  const [items, setItems] = useState([blankItem()]);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [discountValue, setDiscountValue] = useState("0");
  const [discountType, setDiscountType] = useState("none");
  const [saving, setSaving] = useState(false);
  const [clientPicker, setClientPicker] = useState(false);
  const [itemPickerIndex, setItemPickerIndex] = useState(null);

  useEffect(() => {
    navigation.setOptions({ title: editingId ? "Edit" : `New ${kind}` });
    (async () => {
      const [c, p] = await Promise.all([api.get("/clients/", { params: { is_archived: false } }), api.get("/price-book/")]);
      setClients(c.data.results || c.data);
      setPriceBook(p.data.results || p.data);
      if (editingId) {
        const { data } = await api.get(`/documents/${editingId}/`);
        setClientId(data.client);
        setClientName(data.client_name || "");
        setItems(data.items.map((i) => ({ name: i.name, quantity: String(i.quantity), unit_price: String(i.unit_price), tax_rate: String(i.tax_rate), description: i.description })));
        setNotes(data.notes); setTerms(data.terms); setDueDate(data.due_date || "");
        setIssueDate(data.issue_date); setDiscountType(data.discount_type); setDiscountValue(String(data.discount_value));
      }
    })();
  }, [editingId]);

  const updateItem = (idx, key, val) => setItems((p) => p.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  const addItem = () => setItems((p) => [...p, blankItem()]);
  const removeItem = (idx) => setItems((p) => p.filter((_, i) => i !== idx));

  const applyPriceBook = (pb) => {
    updateItem(itemPickerIndex, "name", pb.name);
    updateItem(itemPickerIndex, "unit_price", String(pb.unit_price));
    updateItem(itemPickerIndex, "tax_rate", String(pb.tax_rate));
    setItemPickerIndex(null);
  };

  const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);
  const taxTotal = items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.unit_price || 0)) * Number(it.tax_rate || 0) / 100, 0);
  let discount = 0;
  if (discountType === "percent") discount = subtotal * Number(discountValue || 0) / 100;
  else if (discountType === "fixed") discount = Number(discountValue || 0);
  const total = subtotal - discount + taxTotal;

  const save = async () => {
    if (!items.length || items.every((i) => !i.name)) return Alert.alert("Add items", "Add at least one line item.");
    setSaving(true);
    const payload = {
      kind, client: clientId, issue_date: issueDate, due_date: dueDate || null,
      notes, terms, discount_type: discountType, discount_value: Number(discountValue || 0),
      items: items.filter((i) => i.name).map((i, idx) => ({
        name: i.name, description: i.description || "", quantity: Number(i.quantity || 1),
        unit_price: Number(i.unit_price || 0), tax_rate: Number(i.tax_rate || 0), position: idx,
      })),
    };
    try {
      const res = editingId ? await api.put(`/documents/${editingId}/`, payload) : await api.post("/documents/", payload);
      navigation.replace("InvoiceDetail", { id: res.data.id });
    } catch (e) {
      Alert.alert("Error", JSON.stringify(e.response?.data || "Failed"));
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Card>
          <Text style={{ fontWeight: "500", color: t.subtext, marginBottom: 6, fontSize: 13 }}>Client</Text>
          <TouchableOpacity onPress={() => setClientPicker(true)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: t.border, borderRadius: 12 }}>
            <Text style={{ color: clientName ? t.text : t.muted, fontSize: 15, fontWeight: "300"}}>{clientName || "Select client"}</Text>
            <Ionicons name="chevron-down" size={18} color={t.muted} />
          </TouchableOpacity>
        </Card>

        <Card>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}><Field label="Issue date" value={issueDate} onChangeText={setIssueDate} placeholder="YYYY-MM-DD" /></View>
            <View style={{ flex: 1 }}><Field label="Due date" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" /></View>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontWeight: "500", color: t.text, fontSize: 16 }}>Items</Text>
            <TouchableOpacity onPress={addItem}><Ionicons name="add-circle" size={26} color={t.accent} /></TouchableOpacity>
          </View>
          {items.map((it, idx) => (
            <View key={idx} style={{ marginBottom: 14, paddingBottom: 12, borderBottomWidth: idx < items.length - 1 ? 1 : 0, borderColor: t.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field label={null} value={it.name} onChangeText={(v) => updateItem(idx, "name", v)} placeholder="Item name" style={{ marginBottom: 0 }} />
                </View>
                <TouchableOpacity onPress={() => setItemPickerIndex(idx)}><Ionicons name="book-outline" size={22} color={t.accent} /></TouchableOpacity>
                {items.length > 1 && <TouchableOpacity onPress={() => removeItem(idx)}><Ionicons name="trash-outline" size={22} color={t.danger} /></TouchableOpacity>}
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}><Field label="Qty" value={it.quantity} onChangeText={(v) => updateItem(idx, "quantity", v)} keyboardType="decimal-pad" style={{ marginBottom: 0 }} /></View>
                <View style={{ flex: 1.4 }}><Field label="Price" value={it.unit_price} onChangeText={(v) => updateItem(idx, "unit_price", v)} keyboardType="decimal-pad" style={{ marginBottom: 0 }} /></View>
                <View style={{ flex: 1 }}><Field label="Tax %" value={it.tax_rate} onChangeText={(v) => updateItem(idx, "tax_rate", v)} keyboardType="decimal-pad" style={{ marginBottom: 0 }} /></View>
              </View>
            </View>
          ))}
        </Card>

        <Card>
          <Text style={{ fontWeight: "500", color: t.subtext, marginBottom: 8, fontSize: 13 }}>Discount</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            {["none", "percent", "fixed"].map((d) => (
              <TouchableOpacity key={d} onPress={() => setDiscountType(d)} style={{ flex: 1 }}>
                <View style={{ paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: discountType === d ? t.accent : t.card, borderWidth: 1, borderColor: discountType === d ? t.accent : t.border }}>
                  <Text style={{ color: discountType === d ? "#fff" : t.subtext, fontWeight: "500", textTransform: "capitalize" }}>{d}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          {discountType !== "none" && <Field label="Discount value" value={discountValue} onChangeText={setDiscountValue} keyboardType="decimal-pad" />}
        </Card>

        <Card>
          <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Notes for the client" multiline style={{ height: 70, textAlignVertical: "top" }} />
          <Field label="Terms" value={terms} onChangeText={setTerms} placeholder="Payment terms" multiline style={{ height: 60, textAlignVertical: "top" }} />
        </Card>

        <Card>
          <Row label="Subtotal" value={money(subtotal)} t={t} />
          {discount > 0 && <Row label="Discount" value={"-" + money(discount)} t={t} />}
          <Row label="Tax" value={money(taxTotal)} t={t} />
          <Row label="Total" value={money(total)} bold t={t} />
        </Card>
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: t.card, borderTopWidth: 1, borderColor: t.border }}>
        <Button title={editingId ? "Save changes" : `Create ${kind}`} onPress={save} loading={saving} />
      </View>

      {/* Client picker */}
      <PickerModal visible={clientPicker} onClose={() => setClientPicker(false)} title="Select client" t={t}
        data={[{ id: null, name: "No client" }, ...clients]}
        onSelect={(c) => { setClientId(c.id); setClientName(c.id ? c.name : ""); setClientPicker(false); }}
        renderLabel={(c) => c.name} />

      {/* Price book picker */}
      <PickerModal visible={itemPickerIndex !== null} onClose={() => setItemPickerIndex(null)} title="Price book" t={t}
        data={priceBook} onSelect={applyPriceBook}
        renderLabel={(p) => `${p.name} · ${money(p.unit_price)}`}
        empty="No saved items. Add them in More → Price book." />
    </SafeAreaView>
  );
}

function Row({ label, value, bold, t }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
      <Text style={{ color: t.subtext, fontWeight: "300"}}>{label}</Text>
      <Text style={{ color: t.text, fontWeight: bold ? "800" : "500", fontSize: bold ? 17 : 14 }}>{value}</Text>
    </View>
  );
}

function PickerModal({ visible, onClose, title, data, onSelect, renderLabel, t, empty }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "70%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: "500", color: t.text }}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color={t.subtext} /></TouchableOpacity>
          </View>
          <FlatList
            data={data} keyExtractor={(i, idx) => String(i.id ?? idx)}
            ListEmptyComponent={<Text style={{ color: t.subtext, padding: 20, textAlign: "center", fontWeight: "300"}}>{empty || "Nothing here yet."}</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => onSelect(item)} style={{ paddingVertical: 14, borderBottomWidth: 1, borderColor: t.border }}>
                <Text style={{ color: t.text, fontSize: 16 }}>{renderLabel(item)}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
