import React, { useCallback, useState } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Switch,
  ActivityIndicator,
} from "react-native";
import { Text } from "../../components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { fetchDispute, resolveDispute, failDispute } from "../../api/disputes";
import { useTheme, Card } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { formatApiError } from "../../utils/billing";
import { resolveMediaUrl } from "../../api/billing";
import { Badge } from "../incentives/shared";
import { useScreenQuery } from "../../navigation/useScreenQuery";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";

const PROVIDER_TONE = { paypal: "indigo", razorpay: "cyan", cashfree: "amber" };

function formatMoney(amount, currency) {
  const n = Number(amount);
  const cur = (currency || "USD").toUpperCase();
  if (Number.isNaN(n)) return `${cur} ${amount ?? ""}`.trim();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${cur} ${n.toFixed(2)}`;
  }
}

function formatIst(iso) {
  if (!iso) return "—";
  try {
    return `${new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })} IST`;
  } catch {
    return String(iso);
  }
}

function Meta({ label, value, t }) {
  return (
    <View style={{ marginBottom: 12, minWidth: "45%", flexGrow: 1, flexBasis: "45%" }}>
      <Text style={{ color: t.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: "500" }}>
        {label}
      </Text>
      <Text style={{ color: t.text, marginTop: 4, fontSize: 14, fontWeight: "400" }}>{value || "—"}</Text>
    </View>
  );
}

export default function DisputeDetailScreen({ route, navigation }) {
  const t = useTheme();
  const { query } = useScreenQuery({ id: "" });
  const id = query.id || route.params?.id;
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [pdf, setPdf] = useState(null);
  const [note, setNote] = useState("");
  const [checks, setChecks] = useState({
    refusal: false,
    service: false,
    billing: false,
  });

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setTicket(await fetchDispute(id));
    } catch (e) {
      setError(formatApiError(e, "Could not load dispute."));
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));
  useLiveRefresh(load, 10 * 60_000);

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setPdf({
        uri: asset.uri,
        name: asset.name || "dispute_evidence.pdf",
        mimeType: asset.mimeType || "application/pdf",
      });
    } catch (e) {
      Alert.alert("Picker error", formatApiError(e, "Could not open document picker."));
    }
  };

  const onResolve = async () => {
    if (!pdf?.uri) {
      Alert.alert("PDF required", "Upload a single evidence PDF first.");
      return;
    }
    if (!checks.refusal || !checks.service || !checks.billing) {
      Alert.alert("Confirm checklist", "Confirm all three evidence sections are in the PDF.");
      return;
    }
    setBusy(true);
    try {
      const updated = await resolveDispute(id, {
        uri: pdf.uri,
        name: pdf.name,
        mimeType: pdf.mimeType,
        note,
        confirmRefusalReason: true,
        confirmServiceProof: true,
        confirmBillingProof: true,
      });
      setTicket(updated);
      setResolveOpen(false);
      setPdf(null);
      setNote("");
      setChecks({ refusal: false, service: false, billing: false });
      Alert.alert("Resolved", "Dispute marked resolved with evidence PDF.");
    } catch (e) {
      Alert.alert("Resolve failed", formatApiError(e, "Could not resolve dispute."));
    } finally {
      setBusy(false);
    }
  };

  const onFail = async () => {
    setBusy(true);
    try {
      const updated = await failDispute(id, { note });
      setTicket(updated);
      setFailOpen(false);
      setNote("");
      Alert.alert("Marked failed", "Dispute recorded as failed / lost.");
    } catch (e) {
      Alert.alert("Failed", formatApiError(e, "Could not mark dispute failed."));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !ticket) return <ListSkeleton rows={10} />;

  if (!ticket) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: 16 }} edges={["bottom"]}>
        <Text style={{ color: t.danger }}>{error || "Dispute not found."}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: t.accent, fontWeight: "500" }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const provider = String(ticket.provider || "").toLowerCase();
  const isOpen = ticket.status === "open";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={t.accent}
          />
        )}
      >
        {error ? <Text style={{ color: t.danger, marginBottom: 10 }}>{error}</Text> : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Badge text={ticket.status || "open"} tone={ticket.status === "resolved" ? "emerald" : "amber"} />
          <Badge text={provider || "gateway"} tone={PROVIDER_TONE[provider] || "slate"} />
          <Badge text={ticket.case_type || "dispute"} tone="slate" />
        </View>

        <Text style={{ fontSize: 22, fontWeight: "500", color: t.text }}>
          {ticket.client_name || "Client"}
        </Text>
        <Text style={{ color: t.subtext, marginTop: 4, fontWeight: "300" }}>
          {ticket.client_email || "—"}
          {ticket.client_awl_id ? ` · ${ticket.client_awl_id}` : ""}
        </Text>

        {ticket.is_overdue && isOpen ? (
          <View style={{
            marginTop: 12,
            backgroundColor: "#FEF2F2",
            borderColor: "#FECACA",
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
            flexDirection: "row",
            gap: 8,
          }}
          >
            <Ionicons name="warning-outline" size={18} color="#B91C1C" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#B91C1C", fontWeight: "500" }}>Priority SLA overdue</Text>
              <Text style={{ color: "#B91C1C", fontSize: 12, marginTop: 2, fontWeight: "300" }}>
                Due {formatIst(ticket.due_at_ist || ticket.due_at)}
              </Text>
            </View>
          </View>
        ) : null}

        {isOpen ? (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => { setNote(""); setResolveOpen(true); }}
              style={{
                flex: 1, backgroundColor: "#047857", borderRadius: 14,
                paddingVertical: 14, alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "500" }}>Resolve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setNote(""); setFailOpen(true); }}
              style={{
                flex: 1, borderWidth: 1.5, borderColor: "#FECACA", borderRadius: 14,
                paddingVertical: 14, alignItems: "center", backgroundColor: "#fff",
              }}
            >
              <Text style={{ color: "#B91C1C", fontWeight: "500" }}>Mark failed</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Card style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 10 }}>Case summary</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <Meta label="Amount" value={formatMoney(ticket.amount, ticket.currency)} t={t} />
            <Meta label="Invoice" value={ticket.invoice_number || "—"} t={t} />
            <Meta label="Gateway case" value={ticket.gateway_case_id || "—"} t={t} />
            <Meta
              label="Gateway status"
              value={`${ticket.gateway_status || "—"} · ${ticket.gateway_outcome || ""}`.trim()}
              t={t}
            />
            <Meta label="Raised (IST)" value={formatIst(ticket.raised_at_ist || ticket.raised_at)} t={t} />
            <Meta label="Due (IST)" value={formatIst(ticket.due_at_ist || ticket.due_at)} t={t} />
            <Meta
              label="Owner"
              value={ticket.owner_name
                ? `${ticket.owner_name}${ticket.owner_email ? ` (${ticket.owner_email})` : ""}`
                : "Unassigned"}
              t={t}
            />
            <Meta
              label="Manager"
              value={ticket.missing_manager ? "Missing manager" : (ticket.manager_name || "—")}
              t={t}
            />
            <Meta
              label="Reason"
              value={(ticket.reason || "—").replace(/_/g, " ").toLowerCase()}
              t={t}
            />
          </View>
          {ticket.evidence_pdf_url ? (
            <TouchableOpacity
              onPress={() => {
                const url = resolveMediaUrl(ticket.evidence_pdf_url);
                if (url) Linking.openURL(url);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}
            >
              <Ionicons name="document-text-outline" size={16} color={t.accent} />
              <Text style={{ color: t.accent, fontWeight: "500" }}>Open evidence PDF</Text>
            </TouchableOpacity>
          ) : null}
        </Card>

        {ticket.resolution_note ? (
          <Card style={{ marginTop: 12 }}>
            <Text style={{ color: t.muted, fontSize: 11, fontWeight: "500", textTransform: "uppercase" }}>
              Resolution note
            </Text>
            <Text style={{ color: t.text, marginTop: 6, lineHeight: 20 }}>{ticket.resolution_note}</Text>
          </Card>
        ) : null}

        <Card style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 10 }}>
            Activity ({(ticket.events || []).length})
          </Text>
          {(ticket.events || []).length === 0 ? (
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: "300" }}>No events yet.</Text>
          ) : (
            (ticket.events || []).map((ev) => (
              <View
                key={ev.id}
                style={{
                  borderLeftWidth: 2,
                  borderLeftColor: t.border,
                  paddingLeft: 10,
                  marginBottom: 12,
                }}
              >
                <Text style={{ color: t.text, fontSize: 12, fontWeight: "500" }}>{ev.event_type}</Text>
                <Text style={{ color: t.subtext, fontSize: 11, marginTop: 2, fontWeight: "300" }}>
                  {ev.summary || "—"} · {formatIst(ev.created_at)}
                </Text>
              </View>
            ))
          )}
        </Card>

        {resolveOpen ? (
          <Card style={{ marginTop: 16, borderColor: "#A7F3D0" }}>
            <Text style={{ fontWeight: "500", color: t.text, fontSize: 16 }}>Resolve with evidence PDF</Text>
            <Text style={{ color: t.subtext, fontSize: 12, marginTop: 6, fontWeight: "300", lineHeight: 18 }}>
              Upload one PDF covering refusal reason, service proof, and billing proof.
            </Text>

            <TouchableOpacity
              onPress={pickPdf}
              style={{
                marginTop: 12, borderWidth: 1, borderColor: t.border, borderRadius: 12,
                padding: 14, backgroundColor: t.bg,
              }}
            >
              <Text style={{ color: t.text, fontWeight: "500" }}>
                {pdf?.name ? pdf.name : "Choose PDF…"}
              </Text>
            </TouchableOpacity>

            {[
              ["refusal", "PDF includes refusal / dispute reason"],
              ["service", "PDF includes service delivery proof"],
              ["billing", "PDF includes billing / payment proof"],
            ].map(([key, label]) => (
              <View
                key={key}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}
              >
                <Text style={{ color: t.text, flex: 1, paddingRight: 12, fontSize: 13 }}>{label}</Text>
                <Switch
                  value={checks[key]}
                  onValueChange={(v) => setChecks((c) => ({ ...c, [key]: v }))}
                />
              </View>
            ))}

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional note"
              placeholderTextColor={t.muted}
              multiline
              style={{
                marginTop: 12, borderWidth: 1, borderColor: t.border, borderRadius: 12,
                padding: 12, minHeight: 80, textAlignVertical: "top", color: t.text,
              }}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => setResolveOpen(false)}
                disabled={busy}
                style={{ flex: 1, borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ color: t.subtext, fontWeight: "500" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onResolve}
                disabled={busy}
                style={{
                  flex: 1, backgroundColor: "#047857", borderRadius: 12,
                  paddingVertical: 12, alignItems: "center", opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: "#fff", fontWeight: "500" }}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        {failOpen ? (
          <Card style={{ marginTop: 16, borderColor: "#FECACA" }}>
            <Text style={{ fontWeight: "500", color: "#B91C1C", fontSize: 16 }}>Mark dispute failed</Text>
            <Text style={{ color: t.subtext, fontSize: 12, marginTop: 6, fontWeight: "300", lineHeight: 18 }}>
              Use when the dispute is lost and funds are gone. Incentives/coupons are not reversed in v1.
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional note"
              placeholderTextColor={t.muted}
              multiline
              style={{
                marginTop: 12, borderWidth: 1, borderColor: t.border, borderRadius: 12,
                padding: 12, minHeight: 80, textAlignVertical: "top", color: t.text,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => setFailOpen(false)}
                disabled={busy}
                style={{ flex: 1, borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ color: t.subtext, fontWeight: "500" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onFail}
                disabled={busy}
                style={{
                  flex: 1, backgroundColor: "#B91C1C", borderRadius: 12,
                  paddingVertical: 12, alignItems: "center", opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: "#fff", fontWeight: "500" }}>Confirm failed</Text>
                )}
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
