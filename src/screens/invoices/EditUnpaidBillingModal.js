import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { Text } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchBillingIntent,
  updateUnpaidBilling,
  rowMethod,
} from "../../api/billing";
import { Button, Field, useTheme } from "../../components/ui";
import { formatApiError, normalizeUpiAccounts, normalizeZelleAccounts } from "../../utils/billing";
import api from "../../api/client";
import { CATALOG_KEYS, CATALOG_TTL_MS, loadCatalog } from "../../api/catalogCache";

/**
 * Compact edit modal for unpaid NAS / Zelle / UPI / PayPal / Razorpay / Cashfree billing intents.
 */
export default function EditUnpaidBillingModal({ visible, row, onClose, onSaved }) {
  const t = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [nasUrl, setNasUrl] = useState("");
  const [zelleEmail, setZelleEmail] = useState("");
  const [zellePhone, setZellePhone] = useState("");
  const [upiKey, setUpiKey] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [items, setItems] = useState([]);
  const [upiAccounts, setUpiAccounts] = useState([]);
  const [zelleAccounts, setZelleAccounts] = useState([]);
  const method = rowMethod(row);

  useEffect(() => {
    if (!visible || !row?.id) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const detail = await fetchBillingIntent(row.id);
        if (cancelled) return;
        const client = detail.client || detail.billing_client || {};
        setClientName(client.name || row.clientName || "");
        setClientEmail(client.email || row.clientEmail || "");
        setClientPhone(client.phone || "");
        setNotes(detail.notes || "");
        const attempt = detail.latest_attempt || detail.attempts?.[0] || row.attempt || {};
        setNasUrl(attempt.nas_payment_url || "");
        setZelleEmail(attempt.zelle_recipient_email || "");
        setZellePhone(attempt.zelle_recipient_phone || "");
        setUpiKey(attempt.upi_account_key || "");
        const lines = (detail.items || detail.line_items || []).map((it) => ({
          service_id: it.service_id || it.service?.id,
          quantity: Number(it.quantity || 1),
          unit_price: String(it.unit_price || it.price || 0),
        })).filter((it) => it.service_id);
        setItems(lines);

        if (method === "upi") {
          try {
            const data = await loadCatalog(
              CATALOG_KEYS.upiAccounts,
              async () => (await api.get("/billing/upi-accounts/")).data,
              { ttlMs: CATALOG_TTL_MS },
            );
            setUpiAccounts(normalizeUpiAccounts(data));
          } catch { /* ignore */ }
        }
        if (method === "zelle") {
          try {
            const data = await loadCatalog(
              CATALOG_KEYS.zelleAccounts,
              async () => (await api.get("/billing/zelle-accounts/")).data,
              { ttlMs: CATALOG_TTL_MS },
            );
            setZelleAccounts(normalizeZelleAccounts(data));
          } catch { /* ignore */ }
        }
      } catch (e) {
        Alert.alert("Error", formatApiError(e, "Could not load invoice."));
        onClose?.();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, row?.id, method, onClose, row?.clientName, row?.clientEmail, row?.attempt]);

  const save = async () => {
    if (!items.length) {
      Alert.alert("Missing items", "This invoice has no line items to update.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        collection_method: method,
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        client_phone: clientPhone.trim(),
        notes: notes.trim(),
        send_email: sendEmail,
        items,
      };
      if (method === "nas") payload.nas_payment_url = nasUrl.trim();
      if (method === "zelle") {
        payload.zelle_recipient_email = zelleEmail.trim();
        payload.zelle_recipient_phone = zellePhone.trim();
      }
      if (method === "upi") payload.upi_account_key = upiKey;
      await updateUnpaidBilling(row.id, payload);
      Alert.alert("Updated", "Invoice updated successfully.");
      onSaved?.();
      onClose?.();
    } catch (e) {
      Alert.alert("Error", formatApiError(e, "Could not update invoice."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: t.border,
          backgroundColor: t.card,
        }}
        >
          <Text style={{ fontSize: 18, fontWeight: "500", color: t.text }}>
            Edit {method.toUpperCase()} invoice
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={t.muted} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={t.accent} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Field label="Client name" value={clientName} onChangeText={setClientName} />
            <Field
              label="Client email"
              value={clientEmail}
              onChangeText={setClientEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field label="Client phone" value={clientPhone} onChangeText={setClientPhone} keyboardType="phone-pad" />
            <Field label="Notes" value={notes} onChangeText={setNotes} multiline style={{ height: 70, textAlignVertical: "top" }} />

            {method === "nas" ? (
              <Field label="NAS payment URL" value={nasUrl} onChangeText={setNasUrl} autoCapitalize="none" />
            ) : null}

            {method === "zelle" ? (
              <>
                <Field label="Zelle recipient email" value={zelleEmail} onChangeText={setZelleEmail} autoCapitalize="none" />
                <Field label="Zelle recipient phone" value={zellePhone} onChangeText={setZellePhone} />
                {zelleAccounts.length ? (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: t.subtext, fontSize: 12, marginBottom: 6, fontWeight: "500" }}>
                      Quick pick
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {zelleAccounts.map((a) => (
                        <TouchableOpacity
                          key={a.id || a.email || a.phone}
                          onPress={() => {
                            if (a.email) setZelleEmail(a.email);
                            if (a.phone) setZellePhone(a.phone);
                          }}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 12,
                            backgroundColor: t.card,
                            borderWidth: 1,
                            borderColor: t.border,
                          }}
                        >
                          <Text style={{ color: t.text, fontSize: 12 }}>{a.label || a.email || a.phone}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}

            {method === "upi" ? (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: t.subtext, fontSize: 13, fontWeight: "500", marginBottom: 8 }}>UPI account</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {upiAccounts.map((a) => {
                    const active = String(upiKey) === String(a.id || a.key);
                    return (
                      <TouchableOpacity
                        key={a.id || a.key}
                        onPress={() => setUpiKey(a.id || a.key)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 14,
                          backgroundColor: active ? t.accent : t.card,
                          borderWidth: 1,
                          borderColor: active ? t.accent : t.border,
                        }}
                      >
                        <Text style={{ color: active ? "#fff" : t.text, fontSize: 12, fontWeight: "500" }}>
                          {a.label || a.vpa || a.id}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              paddingVertical: 8,
            }}
            >
              <Text style={{ color: t.text, fontWeight: "500" }}>Resend email after save</Text>
              <Switch value={sendEmail} onValueChange={setSendEmail} trackColor={{ true: t.accent }} />
            </View>

            <Button title="Save changes" onPress={save} loading={saving} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
