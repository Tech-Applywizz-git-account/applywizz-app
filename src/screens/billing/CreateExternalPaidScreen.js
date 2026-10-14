import React, { useEffect, useState } from "react";
import {
  View, ScrollView, Switch, Alert, TouchableOpacity, Image,
} from "react-native";
import { Text } from "../../components/AppText";
import * as ImagePicker from "expo-image-picker";
import { Button, Card, Field, Screen, useTheme } from "../../components/ui";
import api from "../../api/client";
import { getCached, setCached } from "../../api/queryCache";
import { formatApiError, toList } from "../../utils/billing";
import {
  createExternalPaidRequest,
  fetchExternalPaidAssociates,
} from "../../api/externalPaidRequests";

const METHODS = [
  { id: "nas", label: "NAS" },
  { id: "zelle", label: "Zelle" },
  { id: "upi", label: "UPI" },
];

function emptyLine() {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, serviceId: "", unitPrice: "", qty: "1" };
}

function toLocalInputValue(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateExternalPaidScreen({ navigation }) {
  const t = useTheme();
  const [associates, setAssociates] = useState([]);
  const [services, setServices] = useState([]);
  const [countries, setCountries] = useState([]);
  const [upiAccounts, setUpiAccounts] = useState([]);
  const [awlId, setAwlId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [associateId, setAssociateId] = useState("");
  const [method, setMethod] = useState("nas");
  const [countryCode, setCountryCode] = useState("US");
  const [currency, setCurrency] = useState("USD");
  const [paidAt, setPaidAt] = useState(toLocalInputValue());
  const [reason, setReason] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [lines, setLines] = useState(() => [emptyLine()]);
  const [nasUrl, setNasUrl] = useState("");
  const [zelleEmail, setZelleEmail] = useState("");
  const [zellePhone, setZellePhone] = useState("");
  const [upiKey, setUpiKey] = useState("");
  const [asset, setAsset] = useState(null);
  const [busy, setBusy] = useState(false);

  const updateLine = (key, patch) => {
    setLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  useEffect(() => {
    const CATALOG_TTL_MS = 15 * 60_000; // TTL-only — Redis invalidation does not reach mobile.
    (async () => {
      try {
        let assoc = getCached("catalog:external-associates", CATALOG_TTL_MS);
        let svc = getCached("catalog:services-active", CATALOG_TTL_MS);
        let ctry = getCached("catalog:countries", CATALOG_TTL_MS);
        if (!assoc || assoc.stale || !svc || svc.stale || !ctry || ctry.stale) {
          const [assocRaw, svcRes, ctryRes] = await Promise.all([
            fetchExternalPaidAssociates(),
            api.get("/services/", { params: { page_size: 200, is_active: true } }),
            api.get("/services/countries/"),
          ]);
          assoc = { data: assocRaw };
          svc = { data: toList(svcRes.data) };
          ctry = { data: toList(ctryRes.data).filter((c) => c.is_active !== false) };
          setCached("catalog:external-associates", assoc.data);
          setCached("catalog:services-active", svc.data);
          setCached("catalog:countries", ctry.data);
        }
        setAssociates(assoc.data);
        setServices(svc.data);
        const countriesList = ctry.data;
        setCountries(countriesList);
        if (countriesList[0]) {
          setCountryCode(countriesList[0].code || "US");
          setCurrency((countriesList[0].currency_code || "USD").toUpperCase());
        }
      } catch (e) {
        Alert.alert("Error", formatApiError(e, "Could not load form data."));
      }
    })();
  }, []);

  useEffect(() => {
    if (method !== "upi") return;
    const CATALOG_TTL_MS = 15 * 60_000;
    const hit = getCached("catalog:upi-accounts", CATALOG_TTL_MS);
    if (hit && !hit.stale) {
      setUpiAccounts(toList(hit.data));
      return;
    }
    api.get("/billing/upi-accounts/").then((res) => {
      setUpiAccounts(toList(res.data));
      setCached("catalog:upi-accounts", res.data);
    }).catch(() => {});
  }, [method]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo library access to upload a screenshot.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      setAsset(result.assets[0]);
    }
  };

  const submit = async () => {
    if (!associateId) return Alert.alert("Required", "Select the associate who took the payment.");
    if (!awlId.trim()) return Alert.alert("Required", "AWL-ID is required.");
    if (!clientName.trim()) return Alert.alert("Required", "Client name is required.");
    if (!clientEmail.trim()) return Alert.alert("Required", "Client email is required.");
    const incomplete = lines.some((row) => !row.serviceId || row.unitPrice === "");
    if (!lines.length || incomplete) return Alert.alert("Required", "Each line needs a service and price.");
    if (!asset?.uri) return Alert.alert("Required", "Payment screenshot is required.");
    if (!reason.trim()) return Alert.alert("Required", "Reason is required.");
    if (method === "upi" && !upiKey) return Alert.alert("Required", "Select a UPI account.");
    if (method === "zelle" && !zelleEmail.trim() && !zellePhone.trim()) {
      return Alert.alert("Required", "Zelle email or phone is required.");
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("attributed_user_id", associateId);
      form.append("awl_id", awlId.trim());
      form.append("client_name", clientName.trim());
      form.append("client_email", clientEmail.trim());
      form.append("client_phone", clientPhone.trim());
      form.append("collection_method", method);
      form.append("currency", currency);
      form.append("country_code", countryCode);
      form.append("paid_at", new Date(paidAt).toISOString());
      form.append("reason", reason.trim());
      form.append("send_email", sendEmail ? "true" : "false");
      form.append("items", JSON.stringify(lines.map((row) => ({
        service_id: row.serviceId,
        quantity: Number(row.qty) || 1,
        unit_price: row.unitPrice,
      }))));
      form.append("nas_payment_url", nasUrl);
      form.append("zelle_recipient_email", zelleEmail);
      form.append("zelle_recipient_phone", zellePhone);
      form.append("upi_account_key", upiKey);
      const name = asset.fileName || `screenshot.${(asset.uri.split(".").pop() || "jpg")}`;
      form.append("payment_screenshot", {
        uri: asset.uri,
        name,
        type: asset.mimeType || "image/jpeg",
      });
      await createExternalPaidRequest(form);
      Alert.alert("Submitted", "Waiting for Admin approval.", [
        { text: "OK", onPress: () => navigation.replace("ExternalPaidRequests") },
      ]);
    } catch (e) {
      Alert.alert("Error", formatApiError(e, "Could not submit."));
    } finally {
      setBusy(false);
    }
  };

  const currencies = [...new Set(countries.map((c) => (c.currency_code || "").toUpperCase()).filter(Boolean))];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: t.subtext, fontSize: 13 }}>
          NAS / Zelle / UPI · within 24h goes live now · older needs Admin approval
        </Text>

        <Card style={{ padding: 14 }}>
          <Field label="AWL-ID *" value={awlId} onChangeText={setAwlId} placeholder="AWL-…" autoCapitalize="characters" />
          <Field label="Client name" value={clientName} onChangeText={setClientName} />
          <Field label="Client email" value={clientEmail} onChangeText={setClientEmail} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Client phone" value={clientPhone} onChangeText={setClientPhone} keyboardType="phone-pad" />
          <Text style={{ color: t.text, marginBottom: 8, fontWeight: "500", fontSize: 13 }}>Associate (took payment) *</Text>
          <View style={{ gap: 6, marginBottom: 8 }}>
            {associates.map((a) => (
              <TouchableOpacity
                key={a.id}
                onPress={() => setAssociateId(a.id)}
                style={{
                  padding: 10, borderRadius: 10, borderWidth: 1,
                  borderColor: associateId === a.id ? t.accent : t.border,
                  backgroundColor: associateId === a.id ? `${t.accent}18` : "#fff",
                }}
              >
                <Text style={{ color: t.text, fontWeight: "600" }}>{a.name}</Text>
                <Text style={{ color: t.subtext, fontSize: 11 }}>{a.role_code} · {a.email}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card style={{ padding: 14 }}>
          <Text style={{ color: t.subtext, fontWeight: "600", fontSize: 12, marginBottom: 8 }}>METHOD</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {METHODS.map((m) => (
              <TouchableOpacity
                key={m.id}
                onPress={() => setMethod(m.id)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: method === m.id ? t.accent : "#fff",
                  borderWidth: 1, borderColor: method === m.id ? t.accent : t.border,
                }}
              >
                <Text style={{ color: method === m.id ? "#fff" : t.subtext, fontWeight: "600" }}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {method === "nas" ? (
            <Field label="NAS URL (optional)" value={nasUrl} onChangeText={setNasUrl} autoCapitalize="none" placeholder="https://" />
          ) : null}
          {method === "zelle" ? (
            <>
              <Field label="Zelle email" value={zelleEmail} onChangeText={setZelleEmail} autoCapitalize="none" keyboardType="email-address" />
              <Field label="Zelle phone" value={zellePhone} onChangeText={setZellePhone} keyboardType="phone-pad" />
            </>
          ) : null}
          {method === "upi" ? (
            <View style={{ gap: 6, marginBottom: 8 }}>
              <Text style={{ color: t.text, fontSize: 13, fontWeight: "500" }}>UPI account *</Text>
              {upiAccounts.map((u) => (
                <TouchableOpacity
                  key={u.key}
                  onPress={() => setUpiKey(u.key)}
                  style={{
                    padding: 10, borderRadius: 10, borderWidth: 1,
                    borderColor: upiKey === u.key ? t.accent : t.border,
                  }}
                >
                  <Text style={{ color: t.text }}>{u.label || u.key} ({u.vpa})</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </Card>

        <Card style={{ padding: 14 }}>
          <Field label="Paid at (local) *" value={paidAt} onChangeText={setPaidAt} placeholder="YYYY-MM-DDTHH:mm" autoCapitalize="none" />
          <Text style={{ color: t.text, marginBottom: 8, fontWeight: "500", fontSize: 13 }}>Currency</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {currencies.map((c) => (
              <TouchableOpacity key={c} onPress={() => setCurrency(c)} style={{
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                backgroundColor: currency === c ? t.accent : "#fff", borderWidth: 1, borderColor: t.border,
              }}>
                <Text style={{ color: currency === c ? "#fff" : t.text, fontSize: 12 }}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: t.text, fontWeight: "600", fontSize: 13 }}>Items *</Text>
            <TouchableOpacity
              onPress={() => setLines((prev) => [...prev, emptyLine()])}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: t.border }}
            >
              <Text style={{ color: t.accent, fontWeight: "700", fontSize: 12 }}>Add item</Text>
            </TouchableOpacity>
          </View>
          {lines.map((row, idx) => (
            <View key={row.key} style={{ marginBottom: 12, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: t.border, gap: 6 }}>
              <Text style={{ color: t.subtext, fontSize: 12, fontWeight: "600" }}>Service {idx + 1}</Text>
              <View style={{ gap: 6, marginBottom: 6 }}>
                {services.slice(0, 40).map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => updateLine(row.key, { serviceId: s.id })}
                    style={{
                      padding: 10, borderRadius: 10, borderWidth: 1,
                      borderColor: row.serviceId === s.id ? t.accent : t.border,
                    }}
                  >
                    <Text style={{ color: t.text }}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Qty"
                    value={String(row.qty)}
                    onChangeText={(v) => updateLine(row.key, { qty: v })}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Unit price *"
                    value={String(row.unitPrice)}
                    onChangeText={(v) => updateLine(row.key, { unitPrice: v })}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              {lines.length > 1 ? (
                <TouchableOpacity onPress={() => setLines((prev) => prev.filter((r) => r.key !== row.key))}>
                  <Text style={{ color: "#b91c1c", fontWeight: "600", fontSize: 12 }}>Remove item</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          <Field label="Reason *" value={reason} onChangeText={setReason} multiline style={{ minHeight: 80, textAlignVertical: "top" }} />
        </Card>

        <Card style={{ padding: 14 }}>
          <TouchableOpacity onPress={pickImage} style={{
            borderWidth: 1, borderStyle: "dashed", borderColor: t.border, borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 12,
          }}>
            <Text style={{ color: t.accent, fontWeight: "700" }}>
              {asset ? "Change screenshot" : "Upload payment screenshot *"}
            </Text>
          </TouchableOpacity>
          {asset?.uri ? (
            <Image source={{ uri: asset.uri }} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 12 }} resizeMode="contain" />
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: t.text, flex: 1, paddingRight: 12 }}>
              Email paid PDF to client after Admin approval
            </Text>
            <Switch value={sendEmail} onValueChange={setSendEmail} />
          </View>
        </Card>

        <Button title={busy ? "Submitting…" : "Submit for approval"} onPress={submit} disabled={busy} loading={busy} />
      </ScrollView>
    </Screen>
  );
}
