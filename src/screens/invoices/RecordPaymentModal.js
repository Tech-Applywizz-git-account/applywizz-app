import React, { useState, useEffect } from "react";
import { View, Modal, TouchableOpacity, ScrollView } from "react-native";
import { Text } from "../../components/AppText";

import { Ionicons } from "@expo/vector-icons";
import { Field, Button, useTheme } from "../../components/ui";
import { money } from "../../theme";

const METHODS = ["bank", "cash", "card", "paypal", "stripe", "upi", "cheque", "other"];

export default function RecordPaymentModal({ visible, onClose, balance, onSubmit }) {
  const t = useTheme();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setAmount(String(balance || "")); }, [visible, balance]);

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit({ amount: Number(amount), method, reference, paid_on: new Date().toISOString().slice(0, 10) });
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: "500", color: t.text }}>Record payment</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color={t.subtext} /></TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={{ color: t.subtext, marginBottom: 12, fontWeight: "300"}}>Balance due: {money(balance)}</Text>
            <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            <Text style={{ color: t.subtext, marginBottom: 6, fontWeight: "500", fontSize: 13 }}>Method</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {METHODS.map((m) => (
                <TouchableOpacity key={m} onPress={() => setMethod(m)}>
                  <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: method === m ? t.accent : t.card, borderWidth: 1, borderColor: method === m ? t.accent : t.border }}>
                    <Text style={{ color: method === m ? "#fff" : t.subtext, textTransform: "capitalize", fontWeight: "500" }}>{m}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <Field label="Reference (optional)" value={reference} onChangeText={setReference} placeholder="Txn id / note" />
            <Button title="Save payment" onPress={submit} loading={saving} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
