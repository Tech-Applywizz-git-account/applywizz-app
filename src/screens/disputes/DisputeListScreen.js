import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { Text } from "../../components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { fetchDisputes } from "../../api/disputes";
import { getCached, setCached } from "../../api/queryCache";
import { disputesCacheKey } from "../../api/cacheKeys";
import { isRequestCanceled } from "../../api/client";
import { useTheme, Card } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { formatApiError, toList } from "../../utils/billing";
import { ChipRow, Badge } from "../incentives/shared";
import { useScreenQuery } from "../../navigation/useScreenQuery";
import { useLiveRefresh, LIVE_STALE_MS } from "../../hooks/useLiveRefresh";

const STALE_MS = LIVE_STALE_MS;

const STATUS_CHIPS = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "failed", label: "Failed" },
  { id: "all", label: "All" },
];

const PROVIDER_TONE = {
  paypal: "indigo",
  razorpay: "cyan",
  cashfree: "amber",
};

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
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })} IST`;
  } catch {
    return String(iso);
  }
}

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function DisputeListScreen({ navigation }) {
  const t = useTheme();
  const { query, setQuery } = useScreenQuery({ status: "open", q: "" });
  const status = query.status || "open";
  const [searchInput, setSearchInput] = useState(query.q || "");
  const search = useDebounced(searchInput, 300);
  const cacheKey = disputesCacheKey(status, search);
  const initial = getCached(cacheKey, STALE_MS);
  const [rows, setRows] = useState(initial?.data || []);
  const [loading, setLoading] = useState(!initial?.data);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    setQuery({ q: search });
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveStatus = search.trim() ? "" : (status === "all" ? "" : status);
  const listStatusKey = search.trim() ? "search" : status;

  const load = useCallback(async ({ force = false } = {}) => {
    const key = disputesCacheKey(listStatusKey, search);
    if (!force) {
      const hit = getCached(key, STALE_MS);
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
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await fetchDisputes({
        status: effectiveStatus,
        search,
        signal: controller.signal,
      });
      const list = toList(data);
      setCached(key, list);
      setRows(list);
    } catch (e) {
      if (isRequestCanceled(e)) return;
      setError(formatApiError(e, "Could not load disputes."));
      setRows((prev) => (prev.length ? prev : []));
    } finally {
      setLoading(false);
    }
  }, [effectiveStatus, listStatusKey, search]);

  useFocusEffect(useCallback(() => {
    load({ force: false });
    return () => abortRef.current?.abort();
  }, [load]));
  useLiveRefresh(() => { load({ force: true }); }, 10 * 60_000);

  const overdueCount = useMemo(
    () => rows.filter((r) => r.status === "open" && r.is_overdue).length,
    [rows],
  );

  if (loading && !rows.length && !error) return <ListSkeleton rows={8} />;

  const renderItem = ({ item: row }) => {
    const provider = String(row.provider || "").toLowerCase();
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate("DisputeDetail", { id: row.id })}
        style={{
          backgroundColor: t.card,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 14,
          padding: 14,
          marginBottom: 10,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ flex: 1, fontWeight: "500", color: t.text, fontSize: 15 }} numberOfLines={1}>
            {row.client_name || "Unknown client"}
          </Text>
          <Badge
            text={row.status || "open"}
            tone={row.status === "resolved" ? "emerald" : row.status === "failed" ? "amber" : "amber"}
          />
        </View>
        <Text style={{ color: t.subtext, fontSize: 12, marginTop: 4, fontWeight: "300" }} numberOfLines={1}>
          {row.client_email || "No email"}
          {row.client_awl_id ? ` · ${row.client_awl_id}` : ""}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
          <Badge text={provider || "gateway"} tone={PROVIDER_TONE[provider] || "slate"} />
          <Badge text={row.case_type || "dispute"} tone="slate" />
          <Text style={{ color: t.text, fontWeight: "500", fontSize: 13, marginLeft: 4 }}>
            {formatMoney(row.amount, row.currency)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 }}>
          <Ionicons
            name="time-outline"
            size={13}
            color={row.is_overdue && row.status === "open" ? "#B91C1C" : t.muted}
          />
          <Text style={{
            fontSize: 11,
            fontWeight: row.is_overdue && row.status === "open" ? "500" : "300",
            color: row.is_overdue && row.status === "open" ? "#B91C1C" : t.muted,
          }}
          >
            Due {formatIst(row.due_at_ist || row.due_at)}
            {row.is_overdue && row.status === "open" ? " · Overdue" : ""}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View>
      <Text style={{ color: t.subtext, fontSize: 13, marginBottom: 12, fontWeight: "300" }}>
        PayPal / Razorpay / Cashfree chargebacks — 24h priority (due in IST). Visibility follows your team role.
      </Text>
      {overdueCount > 0 && !search.trim() && status === "open" ? (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2",
          borderColor: "#FECACA", borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 12,
        }}
        >
          <Ionicons name="warning-outline" size={16} color="#B91C1C" />
          <Text style={{ color: "#B91C1C", fontSize: 12, fontWeight: "500", flex: 1 }}>
            {overdueCount} overdue open dispute{overdueCount === 1 ? "" : "s"}
          </Text>
        </View>
      ) : null}
      <ChipRow
        items={STATUS_CHIPS}
        value={search.trim() ? "" : status}
        onChange={(v) => {
          if (search.trim()) setSearchInput("");
          setQuery({ status: v || "all", q: "" });
        }}
        t={t}
      />
      <View style={{
        flexDirection: "row", alignItems: "center", backgroundColor: t.card, borderWidth: 1,
        borderColor: t.border, borderRadius: 14, paddingHorizontal: 12, marginBottom: 14,
      }}
      >
        <Ionicons name="search" size={18} color={t.muted} />
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search AWL ID or client email…"
          placeholderTextColor={t.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, color: t.text, fontSize: 14 }}
        />
        {searchInput ? (
          <TouchableOpacity onPress={() => setSearchInput("")} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={t.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {search.trim() ? (
        <Text style={{ color: t.muted, fontSize: 11, marginBottom: 10, fontWeight: "300" }}>
          Searching all statuses for AWL, email, invoice, or case id
        </Text>
      ) : null}
      {error ? <Text style={{ color: t.danger, marginBottom: 12 }}>{error}</Text> : null}
      <Text style={{ color: t.subtext, marginBottom: 10, fontSize: 12, fontWeight: "300" }}>
        {rows.length} dispute{rows.length === 1 ? "" : "s"}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={!error ? (
          <Card>
            <Text style={{ color: t.text, fontWeight: "500", textAlign: "center" }}>No disputes found</Text>
            <Text style={{ color: t.subtext, fontSize: 12, textAlign: "center", marginTop: 6, fontWeight: "300" }}>
              {search.trim()
                ? "Try another AWL ID or client email."
                : "New gateway disputes will appear here automatically."}
            </Text>
          </Card>
        ) : null}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load({ force: true });
              setRefreshing(false);
            }}
            tintColor={t.accent}
          />
        )}
      />
    </SafeAreaView>
  );
}
