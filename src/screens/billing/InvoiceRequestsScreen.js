import React, { useCallback, useState } from "react";
import { View, FlatList, RefreshControl, TouchableOpacity, Alert, TextInput } from "react-native";
import { Text } from "../../components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme, Card, EmptyState } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { formatApiError, canBypassMinAmount, isOwnerUser } from "../../utils/billing";
import { useAuth } from "../../context/AuthContext";
import { useScreenQuery } from "../../navigation/useScreenQuery";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import {
  fetchInvoiceRequests,
  approveInvoiceRequest,
  rejectInvoiceRequest,
  cancelInvoiceRequest,
} from "../../api/invoiceRequests";
import { getCached, setCached } from "../../api/queryCache";
import { QUEUE_TTL_MS } from "../../api/catalogCache";

function fmtWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export default function InvoiceRequestsScreen() {
  const t = useTheme();
  const { user } = useAuth();
  const { query, setQuery } = useScreenQuery({ status: "pending" });
  const filter = query.status || "pending";
  const cacheKey = `invoice_requests:${filter}`;
  const cachedRows = getCached(cacheKey, QUEUE_TTL_MS)?.data;
  const [rows, setRows] = useState(Array.isArray(cachedRows) ? cachedRows : []);
  const [loading, setLoading] = useState(!cachedRows?.length);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const admin = canBypassMinAmount(user);
  const owner = isOwnerUser(user);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchInvoiceRequests({ status: filter === "all" ? "" : filter, pageSize: 50 });
      const list = data.results || [];
      setRows(list);
      setCached(cacheKey, list);
    } catch (e) {
      setError(formatApiError(e, "Could not load invoice requests."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, cacheKey]);

  useFocusEffect(useCallback(() => {
    const hit = getCached(cacheKey, QUEUE_TTL_MS);
    if (hit && !hit.stale && Array.isArray(hit.data)) {
      setRows(hit.data);
      setLoading(false);
      load(); // background revalidate
      return;
    }
    setLoading(true);
    load();
  }, [load, cacheKey]));
  useLiveRefresh(() => { load(); });

  const runApprove = async (id, sendEmailToClient) => {
    try {
      await approveInvoiceRequest(id, { sendEmailToClient });
      Alert.alert(
        "Approved",
        sendEmailToClient
          ? "Invoice created and sent to the client."
          : "Invoice created. No email was sent to the client.",
      );
      load();
    } catch (e) {
      Alert.alert("Error", formatApiError(e, "Action failed."));
    }
  };

  const decide = async (id, action, reason = "") => {
    try {
      if (action === "approve") {
        if (owner) {
          Alert.alert(
            "Approve invoice request",
            "Send the invoice email to the client?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Don't send to client",
                onPress: () => runApprove(id, false),
              },
              {
                text: "Send to client",
                style: "default",
                onPress: () => runApprove(id, true),
              },
            ],
          );
          return;
        }
        await runApprove(id, true);
        return;
      }
      if (action === "reject") {
        await rejectInvoiceRequest(id, reason);
        Alert.alert("Rejected", "Invoice request rejected.");
        setRejectId(null);
        setRejectReason("");
      } else {
        await cancelInvoiceRequest(id);
        Alert.alert("Cancelled", "Request cancelled.");
      }
      load();
    } catch (e) {
      Alert.alert("Error", formatApiError(e, "Action failed."));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <View style={{ flexDirection: "row", padding: 12, gap: 8 }}>
        {["pending", "approved", "rejected", "all"].map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setQuery({ status: f })}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
              backgroundColor: filter === f ? t.accent : t.card,
              borderWidth: 1, borderColor: filter === f ? t.accent : t.border,
            }}
          >
            <Text style={{ color: filter === f ? "#fff" : t.subtext, fontSize: 12, fontWeight: "500", textTransform: "capitalize" }}>
              {f === "pending" ? "Requested" : f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={{ color: t.danger, paddingHorizontal: 16 }}>{error}</Text> : null}
      {loading ? (
        <ListSkeleton rows={6} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={<EmptyState icon="document-text-outline" title="No invoice requests" subtitle="Below-minimum requests and approvals appear here." />}
          renderItem={({ item }) => {
            const status = String(item.status || "").toLowerCase();
            const mine = String(item.requester) === String(user?.id);
            return (
              <Card style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontWeight: "500", color: t.text }}>{item.awl_id}</Text>
                  <Text style={{ color: t.subtext, fontSize: 11, textTransform: "capitalize" }}>{status}</Text>
                </View>
                <Text style={{ color: t.subtext, fontSize: 12, marginTop: 4 }}>
                  {item.client_name || "Client"} · {item.request_number}
                </Text>
                <Text style={{ color: t.muted, fontSize: 11, marginTop: 6 }}>
                  Requested by {item.requester_name} · {fmtWhen(item.requested_at)}
                </Text>
                {item.decided_by_name ? (
                  <Text style={{ color: t.muted, fontSize: 11, marginTop: 2 }}>
                    Decided by {item.decided_by_name} · {fmtWhen(item.decided_at)}
                  </Text>
                ) : null}
                {item.invoice_number ? (
                  <Text style={{ color: t.muted, fontSize: 11, marginTop: 2 }}>
                    Invoice {item.invoice_number} · created {fmtWhen(item.invoice_created_at)}
                    {item.invoice_paid_at ? ` · paid ${fmtWhen(item.invoice_paid_at)}` : " · unpaid"}
                  </Text>
                ) : null}
                {item.notes ? (
                  <Text style={{ color: t.subtext, fontSize: 12, marginTop: 6 }}>Notes: {item.notes}</Text>
                ) : null}
                {(item.below_min_lines || []).map((line) => (
                  <Text key={line.service_id} style={{ color: t.muted, fontSize: 11, marginTop: 2 }}>
                    {line.service_name}: ${line.unit_price} (min ${line.min_amount})
                  </Text>
                ))}
                {status === "pending" && admin && item.can_decide ? (
                  <View style={{ flexDirection: "row", marginTop: 10, gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => decide(item.id, "approve")}
                      style={{ flex: 1, backgroundColor: "#ECFDF5", padding: 10, borderRadius: 10, alignItems: "center" }}
                    >
                      <Text style={{ color: "#047857", fontWeight: "500" }}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setRejectId(item.id)}
                      style={{ flex: 1, backgroundColor: "#FEF2F2", padding: 10, borderRadius: 10, alignItems: "center" }}
                    >
                      <Text style={{ color: "#B91C1C", fontWeight: "500" }}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {status === "pending" && mine ? (
                  <TouchableOpacity onPress={() => decide(item.id, "cancel")} style={{ marginTop: 8, alignItems: "center" }}>
                    <Text style={{ color: t.subtext, fontSize: 12 }}>Cancel request</Text>
                  </TouchableOpacity>
                ) : null}
                {rejectId === item.id ? (
                  <View style={{ marginTop: 8 }}>
                    <TextInput
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      placeholder="Reject reason (optional)"
                      placeholderTextColor={t.muted}
                      style={{
                        borderWidth: 1, borderColor: t.border, borderRadius: 8, padding: 8,
                        color: t.text, marginBottom: 8,
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => decide(item.id, "reject", rejectReason)}
                      style={{ backgroundColor: "#FEF2F2", padding: 10, borderRadius: 10, alignItems: "center" }}
                    >
                      <Text style={{ color: "#B91C1C", fontWeight: "500" }}>Confirm reject</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
