import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Text, TextInput } from "./AppText";
import { fetchUsers } from "../api/admin";
import { Button, useTheme } from "./ui";
import { formatApiError } from "../utils/billing";

export default function ShiftOwnerModal({ visible, row, onClose, onSubmit, pending }) {
  const t = useTheme();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");

  const search = async (text) => {
    setQ(text);
    setLoading(true);
    try {
      const list = await fetchUsers({ search: text, is_active: true, page_size: 20 });
      setUsers(Array.isArray(list) ? list : []);
    } catch (e) {
      Alert.alert("Error", formatApiError(e, "Could not load users."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) search("");
  }, [visible]);

  const title = useMemo(
    () => row?.reference || row?.raw?.intent_number || row?.id || "invoice",
    [row],
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.bg, padding: 16, paddingTop: 48 }}>
        <Text style={{ fontWeight: "600", fontSize: 18, color: t.text }}>Shift owner</Text>
        <Text style={{ color: t.subtext, marginTop: 6, fontSize: 13 }}>
          {title} · currently {row?.sentByName || row?.raw?.created_by_name || "—"}
        </Text>
        {row?.source === "payment_order" ? (
          <Text style={{ color: t.warning || "#B45309", marginTop: 8, fontSize: 12 }}>
            Legacy APPLYWIZZ-INV record — incentive credit only, not actual revenue.
          </Text>
        ) : null}

        <TextInput
          value={q}
          onChangeText={search}
          placeholder="Search staff"
          style={{
            marginTop: 16,
            borderWidth: 1,
            borderColor: t.border,
            borderRadius: 8,
            padding: 10,
            color: t.text,
          }}
        />
        {loading ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          style={{ marginTop: 8, maxHeight: 240 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelected(item)}
              style={{
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: t.border,
                backgroundColor: selected?.id === item.id ? `${t.accent}14` : "transparent",
              }}
            >
              <Text style={{ color: t.text, fontWeight: "500" }}>{item.name}</Text>
              <Text style={{ color: t.subtext, fontSize: 12 }}>{item.email}</Text>
            </TouchableOpacity>
          )}
        />
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Reason for the shift"
          multiline
          style={{
            marginTop: 12,
            borderWidth: 1,
            borderColor: t.border,
            borderRadius: 8,
            padding: 10,
            minHeight: 72,
            color: t.text,
          }}
        />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
          <Button title="Cancel" onPress={onClose} variant="secondary" style={{ flex: 1 }} />
          <Button
            title={pending ? "Saving…" : "Shift owner"}
            disabled={pending}
            style={{ flex: 1 }}
            onPress={() => {
              if (!selected?.id) {
                Alert.alert("Pick a user", "Select the new invoice owner.");
                return;
              }
              if (!reason.trim()) {
                Alert.alert("Reason required", "Enter why this owner is being shifted.");
                return;
              }
              onSubmit({
                created_by_id: selected.id,
                reason: reason.trim(),
              });
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
