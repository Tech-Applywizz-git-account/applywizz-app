import React, { useCallback, useState } from "react";
import { View, FlatList, RefreshControl, TouchableOpacity, Alert, TextInput, Linking } from "react-native";
import { Text } from "../../components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme, Card, EmptyState } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { formatApiError, canBypassMinAmount } from "../../utils/billing";
import { useAuth } from "../../context/AuthContext";
import { useScreenQuery } from "../../navigation/useScreenQuery";
import {
  fetchExternalPaidRequests,
  approveExternalPaidRequest,
  rejectExternalPaidRequest,
  cancelExternalPaidRequest,
} from "../../api/externalPaidRequests";
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

export default function ExternalPaidRequestsScreen({ navigation }) {
  const t = useTheme();
  const { user } = useAuth();
  const { query, setQuery } = useScreenQuery({ status: "pending" });
  const filter = query.status || "pending";
  const cacheKey = `external_paid_requests:${filter}`;
  const cachedRows = getCached(cacheKey, QUEUE_TTL_MS)?.data;
  const [rows, setRows] = useState(Array.isArray(cachedRows) ? cachedRows : []);
  const [loading, setLoading] = useState(!cachedRows?.length);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const admin = canBypassMinAmount(user);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchExternalPaidRequests({
        status: filter === "all" ? "" : filter,
        pageSize: 50,
      });
      const list = data.results || [];
      setRows(list);
      setCached(cacheKey, list);
    } catch (e) {
      setError(formatApiError(e, "Could not load external paid requests."));
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
      load();
      return;
    }
    setLoading(true);
    load();
  }, [load, cacheKey]));

  const decide = async (id, action, reason = "") => {
    try {
      if (action === "approve") {
        await approveExternalPaidRequest(id);
        Alert.alert("Approved", "Invoice marked paid" + ("" ));
      } else if (action === "reject") {
        await rejectExternalPaidRequest(id, reason);
        Alert.alert("Rejected", "Request rejected.");
        setRejectId(null);
        setRejectReason("");
      } else {
        await cancelExternalPaidRequest(id);
        Alert.alert("Cancelled", "Request cancelled.");
      }
      load();
    } catch (e) {
      Alert.alert("Error", formatApiError(e, "Action failed."));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <View style={{ flexDirection: "row", padding: 12, gap: 8, flexWrap: "wrap" }}>
        {["pending", "approved", "rejected", "all"].map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setQuery({ status: f })}
            style={{
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
              backgroundColor: filter === f ? t.accent : t.card,
              borderWidth: 1, borderColor: filter === f ? t.accent : t.border,
            }}
          >
            <Text style={{ color: filter === f ? "#fff" : t.subtext, fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => navigation.navigate("CreateExternalPaid")}
          style={{
            marginLeft: "auto", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
            backgroundColor: t.card, borderWidth: 1, borderColor: t.border,
          }}
        >
          <Text style={{ color: t.accent, fontSize: 12, fontWeight: "700" }}>Record paid</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ListSkeleton /> : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={!error ? <EmptyState title="No requests" subtitle="External paid approvals appear here." /> : null}
          ListHeaderComponent={error ? (
            <Text style={{ color: "#b91c1c", marginBottom: 8 }}>{error}</Text>
          ) : null}
          renderItem={({ item }) => (
            <Card style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: "monospace", fontWeight: "700", color: t.text }}>{item.request_number}</Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: t.subtext, textTransform: "uppercase" }}>{item.status}</Text>
              </View>
              <Text style={{ marginTop: 6, color: t.text, fontWeight: "600" }}>{item.awl_id}</Text>
              <Text style={{ color: t.subtext, fontSize: 12, marginTop: 2 }}>
                {item.attributed_user_name} · {(item.collection_method || "").toUpperCase()} · {fmtWhen(item.paid_at)}
              </Text>
              <Text style={{ color: t.subtext, fontSize: 12, marginTop: 6 }} numberOfLines={3}>{item.reason}</Text>
              {item.payment_screenshot_url ? (
                <TouchableOpacity onPress={() => Linking.openURL(item.payment_screenshot_url)} style={{ marginTop: 8 }}>
                  <Text style={{ color: t.accent, fontWeight: "600", fontSize: 13 }}>View screenshot</Text>
                </TouchableOpacity>
              ) : null}

              {item.status === "pending" && admin ? (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <TouchableOpacity
                    onPress={() => decide(item.id, "approve")}
                    style={{ flex: 1, backgroundColor: "#059669", padding: 10, borderRadius: 10, alignItems: "center" }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setRejectId(item.id)}
                    style={{ flex: 1, backgroundColor: t.card, borderWidth: 1, borderColor: "#fecaca", padding: 10, borderRadius: 10, alignItems: "center" }}
                  >
                    <Text style={{ color: "#b91c1c", fontWeight: "700" }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {item.status === "pending" && !admin && String(item.requester) === String(user?.id) ? (
                <TouchableOpacity onPress={() => decide(item.id, "cancel")} style={{ marginTop: 10 }}>
                  <Text style={{ color: "#b91c1c", fontWeight: "600" }}>Cancel request</Text>
                </TouchableOpacity>
              ) : null}

              {rejectId === item.id ? (
                <View style={{ marginTop: 10, gap: 8 }}>
                  <TextInput
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    placeholder="Rejection reason (required)"
                    placeholderTextColor={t.muted}
                    style={{
                      borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 10,
                      color: t.text, minHeight: 70, textAlignVertical: "top",
                    }}
                    multiline
                  />
                  <TouchableOpacity
                    onPress={() => {
                      if (!rejectReason.trim()) {
                        Alert.alert("Required", "Rejection reason is mandatory.");
                        return;
                      }
                      decide(item.id, "reject", rejectReason.trim());
                    }}
                    style={{ backgroundColor: "#b91c1c", padding: 10, borderRadius: 10, alignItems: "center" }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Confirm reject</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}
