import React, { useCallback, useState } from "react";
import { View, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { Text, TextInput } from "../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/client";
import { Card, useTheme } from "../components/ui";
import { ListSkeleton } from "../components/Skeleton";
import { money } from "../theme";
import { useLiveRefresh } from "../hooks/useLiveRefresh";

const PAGE_SIZE = 50;

const METHOD_COLORS = {
  paypal: "#2563eb",
  razorpay: "#7c3aed",
  cashfree: "#f59e0b",
  nas: "#059669",
  zelle: "#d97706",
  upi: "#ea580c",
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

export default function ReportTransactionsScreen({ route }) {
  const t = useTheme();
  const {
    title = "Paid records",
    dateRange = "this_month",
    provider = "",
    source = "all",
    paymentKind = "",
    userId = "",
  } = route.params || {};

  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    setPage(1);
  }, [debounced, dateRange, provider, source, paymentKind, userId]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = {
        date_range: dateRange,
        source,
        page,
        page_size: PAGE_SIZE,
      };
      if (provider) params.provider = provider;
      if (paymentKind) params.payment_kind = paymentKind;
      if (userId) params.user_id = userId;
      if (debounced) params.search = debounced;

      const { data } = await api.get("/reports/analytics/transactions/", { params });
      setRows(data.results || []);
      setCount(data.count || 0);
      setTotalAmount(data.total_amount || 0);
      setNumPages(data.num_pages || 1);
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.error?.message || "Failed to load records.");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, provider, source, paymentKind, userId, page, debounced]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));
  useLiveRefresh(() => { load(); });

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const renderItem = ({ item, index }) => {
    const method = String(item.collection_method || item.method || item.provider || "").toLowerCase();
    const color = METHOD_COLORS[method] || t.accent;
    return (
      <Card style={{ marginBottom: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "500", color: t.text }} numberOfLines={1}>
              {item.reference || "—"}
            </Text>
            <Text style={{ color: t.subtext, fontSize: 12, marginTop: 2, fontWeight: "300"}} numberOfLines={1}>
              {item.client_name || "—"}{item.awl_id ? ` · ${item.awl_id}` : ""}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <View style={{
                backgroundColor: `${color}18`,
                borderColor: `${color}44`,
                borderWidth: 1,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
              >
                <Text style={{ color, fontSize: 10, fontWeight: "500", textTransform: "uppercase" }}>
                  {item.collection_method || item.method || item.channel_label || "other"}
                </Text>
              </View>
              <Text style={{ color: t.muted, fontSize: 11, fontWeight: "300"}}>{fmtDate(item.paid_at)}</Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontWeight: "500", color: t.text }}>{money(item.amount)}</Text>
            <Text style={{ color: t.muted, fontSize: 10, marginTop: 4, fontWeight: "300"}}>
              #{(page - 1) * PAGE_SIZE + index + 1}
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: "500", color: t.text }}>{title}</Text>
        <Text style={{ color: t.subtext, fontSize: 12, marginTop: 2, fontWeight: "300"}}>
          {count.toLocaleString()} records · {money(totalAmount)} · 8 PM–8 PM IST
        </Text>

        <View style={{
          marginTop: 12,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: t.card,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 12,
          paddingHorizontal: 12,
        }}
        >
          <Ionicons name="search" size={16} color={t.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search reference, client, email…"
            placeholderTextColor={t.muted}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: t.text }}
          />
        </View>
      </View>

      {loading ? (
        <ListSkeleton rows={8} />
      ) : error ? (
        <View style={{ padding: 24, alignItems: "center" }}>
          <Text style={{ color: t.danger, textAlign: "center" }}>{error}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(); }} style={{ marginTop: 12 }}>
            <Text style={{ color: t.accent, fontWeight: "500" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => `${item.channel}-${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={(
            <Text style={{ color: t.muted, textAlign: "center", marginTop: 40, fontWeight: "300"}}>
              No paid records match these filters.
            </Text>
          )}
          ListFooterComponent={numPages > 1 ? (
            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 8,
              marginBottom: 16,
            }}
            >
              <TouchableOpacity
                disabled={page <= 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                style={{ opacity: page <= 1 ? 0.4 : 1 }}
              >
                <Text style={{ color: t.accent, fontWeight: "500" }}>← Prev</Text>
              </TouchableOpacity>
              <Text style={{ color: t.subtext, fontWeight: "300"}}>Page {page} / {numPages}</Text>
              <TouchableOpacity
                disabled={page >= numPages}
                onPress={() => setPage((p) => Math.min(numPages, p + 1))}
                style={{ opacity: page >= numPages ? 0.4 : 1 }}
              >
                <Text style={{ color: t.accent, fontWeight: "500" }}>Next →</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        />
      )}
    </SafeAreaView>
  );
}
