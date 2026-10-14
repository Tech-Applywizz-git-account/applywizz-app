import React, { useCallback, useState } from "react";
import { View, FlatList, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { Text } from "../components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/client";
import { fetchCouponRequests } from "../api/coupons";
import { getCached, setCached } from "../api/queryCache";
import { useTheme, Card, EmptyState } from "../components/ui";
import { ListSkeleton } from "../components/Skeleton";
import { formatApiError } from "../utils/billing";
import { useAuth } from "../context/AuthContext";
import { useScreenQuery } from "../navigation/useScreenQuery";
import { useLiveRefresh } from "../hooks/useLiveRefresh";

export default function CouponRequestsScreen() {
  const t = useTheme();
  const { user } = useAuth();
  const { query, setQuery } = useScreenQuery({ status: "pending" });
  const filter = query.status || "pending";
  const cacheKey = `coupon_requests:${filter}`;
  const initial = getCached(cacheKey, 60000);
  const [rows, setRows] = useState(initial?.data || []);
  const [loading, setLoading] = useState(!initial?.data);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ force = false } = {}) => {
    const key = `coupon_requests:${filter}`;
    if (!force) {
      const hit = getCached(key, 60000);
      if (hit && !hit.stale) {
        setRows(hit.data || []);
        setLoading(false);
        return;
      }
      if (hit?.data) {
        setRows(hit.data);
        setLoading(false);
      }
    }
    setError(null);
    try {
      const data = await fetchCouponRequests({ status: filter === "all" ? "" : filter, pageSize: 50 });
      const list = data.results || [];
      setCached(key, list);
      setRows(list);
    } catch (e) {
      setError(formatApiError(e, "Could not load coupon requests."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { load({ force: false }); }, [load]));
  useLiveRefresh(() => { load({ force: true }); });

  const decide = async (id, action) => {
    try {
      if (action === "approve") {
        await api.post(`/payments/coupon-requests/${id}/approve/`);
        Alert.alert("Approved", "Coupon request approved.");
      } else {
        await api.post(`/payments/coupon-requests/${id}/reject/`, { reason: "Rejected from mobile" });
        Alert.alert("Rejected", "Coupon request rejected.");
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
              {f}
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
          ListEmptyComponent={<EmptyState icon="pricetag-outline" title="No coupon requests" subtitle="Requests and decisions appear here." />}
          renderItem={({ item }) => {
            const status = String(item.status || "").toLowerCase();
            const isManager = String(item.manager_id || item.manager?.id) === String(user?.id);
            return (
              <Card style={{ marginBottom: 10 }}>
                <Text style={{ fontWeight: "500", color: t.text }}>
                  {item.client_name || item.client?.name || "Client"}
                </Text>
                <Text style={{ color: t.subtext, fontSize: 12, marginTop: 4 }}>
                  {[item.requester_name || item.requester?.name, status].filter(Boolean).join(" · ")}
                </Text>
                {status === "pending" && isManager ? (
                  <View style={{ flexDirection: "row", marginTop: 10, gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => decide(item.id, "approve")}
                      style={{ flex: 1, backgroundColor: "#ECFDF5", padding: 10, borderRadius: 10, alignItems: "center" }}
                    >
                      <Text style={{ color: "#047857", fontWeight: "500" }}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => decide(item.id, "reject")}
                      style={{ flex: 1, backgroundColor: "#FEF2F2", padding: 10, borderRadius: 10, alignItems: "center" }}
                    >
                      <Text style={{ color: "#B91C1C", fontWeight: "500" }}>Reject</Text>
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
