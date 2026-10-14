import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, TextInput, Alert, ActivityIndicator } from "react-native";
import { Text } from "../../components/AppText";
import { useTheme, Button } from "../../components/ui";
import { fetchInvoiceSettings, saveInvoiceSettings } from "../../api/admin";
import { formatApiError } from "../../utils/billing";
import { useScreenQuery } from "../../navigation/useScreenQuery";
import { FONT } from "../../typography";
import {
  CATALOG_KEYS,
  CATALOG_TTL_MS,
  loadCatalog,
  readFreshCatalog,
  writeCatalog,
} from "../../api/catalogCache";

const FIELDS = [
  { key: "invoice_footer", label: "Invoice footer" },
  { key: "terms_and_conditions", label: "Terms and conditions" },
  { key: "privacy_notice", label: "Privacy notice" },
  { key: "professional_disclaimer", label: "Professional disclaimer" },
  { key: "digital_services_acknowledgement", label: "Digital services acknowledgement" },
];

export default function InvoiceTermsScreen() {
  const t = useTheme();
  const { query, setQuery } = useScreenQuery({ tab: "terms" });
  const cached = readFreshCatalog(CATALOG_KEYS.invoiceSettings, CATALOG_TTL_MS);
  const [draft, setDraft] = useState(cached && typeof cached === "object" ? cached : {});
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!cached) setLoading(true);
    try {
      const data = await loadCatalog(
        CATALOG_KEYS.invoiceSettings,
        () => fetchInvoiceSettings(),
      );
      setDraft(data || {});
    } catch (e) {
      Alert.alert("Error", formatApiError(e, "Could not load invoice terms"));
    } finally {
      setLoading(false);
    }
  }, [cached]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={{ fontFamily: FONT.medium, fontSize: 13, color: t.muted, marginBottom: 12 }}>
        Tab: {query.tab || "terms"}
      </Text>
      {FIELDS.map((f) => (
        <View key={f.key} style={{ marginBottom: 14 }}>
          <Text style={{ fontFamily: FONT.medium, fontSize: 13, color: t.text, marginBottom: 6 }}>{f.label}</Text>
          <TextInput
            value={draft[f.key] == null ? "" : String(draft[f.key])}
            onChangeText={(v) => {
              setDraft((d) => ({ ...d, [f.key]: v }));
              setQuery({ tab: "terms" });
            }}
            multiline
            style={{
              minHeight: 100,
              borderWidth: 1,
              borderColor: t.border,
              borderRadius: 12,
              padding: 12,
              backgroundColor: "#fff",
              textAlignVertical: "top",
              fontFamily: FONT.regular,
              color: t.text,
            }}
          />
        </View>
      ))}
      <Button
        title="Save terms"
        loading={saving}
        onPress={async () => {
          setSaving(true);
          try {
            const payload = {};
            FIELDS.forEach((f) => { payload[f.key] = draft[f.key] || ""; });
            await saveInvoiceSettings(payload);
            writeCatalog(CATALOG_KEYS.invoiceSettings, { ...draft, ...payload });
            Alert.alert("Saved", "Invoice terms updated.");
          } catch (e) {
            Alert.alert("Error", formatApiError(e, "Save failed"));
          } finally {
            setSaving(false);
          }
        }}
      />
    </ScrollView>
  );
}
