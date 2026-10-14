import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { Text } from "../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, Field, Button, useTheme } from "../components/ui";
import { THEMES } from "../theme";
import { sendTestLocalNotification, syncPendingPushAlerts } from "../notifications/push";
import { useToast } from "../components/Toast";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD"];

export default function SettingsScreen({ navigation }) {
  const t = useTheme();
  const toast = useToast();
  const { profile, setProfile, signOut, loadProfile, user, signingOut, canImpersonate } = useAuth();
  const [f, setF] = useState(profile || {});
  const [saving, setSaving] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => { if (profile) setF(profile); }, [profile]);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch("/settings/", {
        business_name: f.business_name, email: f.email, phone: f.phone, website: f.website,
        address: f.address, tax_number: f.tax_number, currency: f.currency,
        default_tax_rate: Number(f.default_tax_rate || 0), accent_color: f.accent_color, theme: f.theme,
        invoice_prefix: f.invoice_prefix, estimate_prefix: f.estimate_prefix,
        bank_details: f.bank_details, default_terms: f.default_terms, default_notes: f.default_notes,
      });
      setProfile(data);
      await loadProfile();
      Alert.alert("Saved", "Your settings were updated.");
    } catch (e) { Alert.alert("Error", "Could not save settings."); }
    finally { setSaving(false); }
  };

  const testPush = async () => {
    setTestingPush(true);
    try {
      await sendTestLocalNotification();
      await syncPendingPushAlerts({ force: true });
    } catch (e) {
      toast?.error("Push test failed");
    } finally {
      setTestingPush(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 12 }}>Business</Text>
          <Field label="Business name" value={f.business_name} onChangeText={(v) => set("business_name", v)} />
          <Field label="Email" value={f.email} onChangeText={(v) => set("email", v)} autoCapitalize="none" />
          <Field label="Phone" value={f.phone} onChangeText={(v) => set("phone", v)} />
          <Field label="Website" value={f.website} onChangeText={(v) => set("website", v)} autoCapitalize="none" />
          <Field label="Address" value={f.address} onChangeText={(v) => set("address", v)} multiline style={{ height: 70, textAlignVertical: "top" }} />
          <Field label="Tax number (GST/VAT)" value={f.tax_number} onChangeText={(v) => set("tax_number", v)} />
        </Card>

        <Card>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 12 }}>Defaults</Text>
          <Text style={{ color: t.subtext, marginBottom: 6, fontWeight: "500", fontSize: 13 }}>Currency</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {CURRENCIES.map((c) => (
              <TouchableOpacity key={c} onPress={() => set("currency", c)}>
                <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: f.currency === c ? t.accent : t.card, borderWidth: 1, borderColor: f.currency === c ? t.accent : t.border }}>
                  <Text style={{ color: f.currency === c ? "#fff" : t.subtext, fontWeight: "500" }}>{c}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <Field label="Default tax rate %" value={String(f.default_tax_rate ?? "")} onChangeText={(v) => set("default_tax_rate", v)} keyboardType="decimal-pad" />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}><Field label="Invoice prefix" value={f.invoice_prefix} onChangeText={(v) => set("invoice_prefix", v)} /></View>
            <View style={{ flex: 1 }}><Field label="Estimate prefix" value={f.estimate_prefix} onChangeText={(v) => set("estimate_prefix", v)} /></View>
          </View>
          <Field label="Bank / payment details (on PDF)" value={f.bank_details} onChangeText={(v) => set("bank_details", v)} multiline style={{ height: 70, textAlignVertical: "top" }} />
        </Card>

        <Card>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 12 }}>Theme</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {Object.entries(THEMES).map(([name, color]) => (
              <TouchableOpacity key={name} onPress={() => { set("theme", name); set("accent_color", color); }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color, borderWidth: f.accent_color === color ? 3 : 0, borderColor: t.text }} />
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Button title="Save settings" onPress={save} loading={saving} />
        <Card style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>Notifications</Text>
          <Text style={{ color: t.subtext, fontSize: 13, marginBottom: 12 }}>
            Logged in as {user?.email || "—"}. Tap below to show a sample banner on this phone.
          </Text>
          <Button title="Send test payment banner" onPress={testPush} loading={testingPush} />
        </Card>
        {canImpersonate ? (
          <Card style={{ marginTop: 12 }}>
            <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>View as user</Text>
            <Text style={{ color: t.subtext, fontSize: 13, marginBottom: 12 }}>
              Open the app as another person (their Invoice / Snackify / Career access). No password or MFA.
            </Text>
            <Button
              title="Choose user…"
              onPress={() => navigation.navigate("Users")}
            />
          </Card>
        ) : null}
        <Button
          title={signingOut ? "Signing out…" : "Sign out"}
          variant="outline"
          style={{ marginTop: 12 }}
          onPress={() => {
            if (signingOut) return;
            Alert.alert("Sign out?", "You’ll be signed out of Invoice, Snackify, and Career.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => { signOut(); } },
            ]);
          }}
          loading={signingOut}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
