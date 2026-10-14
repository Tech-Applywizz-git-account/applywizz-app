import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { Text } from "../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/client";
import { getCached, setCached } from "../api/queryCache";
import { reportsCacheKey } from "../api/cacheKeys";
import { Card, useTheme } from "../components/ui";
import { ReportsSkeleton } from "../components/Skeleton";
import { GatewayErrorState } from "../components/ErrorState";
import CreateInvoiceFab from "../components/CreateInvoiceFab";
import { money } from "../theme";
import { businessDayFilterLabel } from "../utils/businessDay";
import { useAuth } from "../context/AuthContext";
import { canCreateInvoice } from "../utils/billing";
import { useScreenQuery } from "../navigation/useScreenQuery";
import { useLiveRefresh, LIVE_STALE_MS } from "../hooks/useLiveRefresh";

const STALE_MS = LIVE_STALE_MS;

const DATE_RANGES = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yday" },
  { id: "this_week", label: "Week" },
  { id: "this_month", label: "Month" },
  { id: "last_30_days", label: "30 days" },
  { id: "this_year", label: "Year" },
];

const GRANULARITY_BY_RANGE = {
  today: "day",
  yesterday: "day",
  this_week: "day",
  this_month: "day",
  last_30_days: "day",
  this_year: "month",
};

const METHOD_COLORS = {
  total: "#6366f1",
  paypal: "#2563eb",
  razorpay: "#7c3aed",
  cashfree: "#f59e0b",
  other: "#059669",
};

const fmt = (v) => money(v);

function KpiCard({ label, value, sub, color, onPress, t, width }) {
  return (
    <Card
      onPress={onPress}
      style={{
        width,
        marginBottom: 0,
        padding: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Ionicons name="chevron-forward" size={14} color={t.muted} />
      </View>
      <Text
        style={{ fontSize: 16, fontWeight: "500", color: t.text, marginTop: 8 }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {value}
      </Text>
      <Text style={{ color: t.text, fontSize: 12, fontWeight: "500", marginTop: 4 }} numberOfLines={1}>
        {label}
      </Text>
      {sub ? (
        <Text style={{ color: t.subtext, fontSize: 11, marginTop: 2, fontWeight: "300" }} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </Card>
  );
}

export default function ReportsScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  const { user } = useAuth();
  const allowCreate = canCreateInvoice(user);
  const { width: windowWidth } = useWindowDimensions();
  const pagePad = 16;
  const gap = 10;
  // Two equal columns that always fit the screen
  const kpiWidth = Math.floor((windowWidth - pagePad * 2 - gap) / 2);

  const { query, setQuery } = useScreenQuery({ range: "this_month" });
  const range = query.range || "this_month";
  const cacheKey = reportsCacheKey(range);
  const cached = getCached(cacheKey, STALE_MS);
  const [data, setData] = useState(cached?.data || null);
  const [loading, setLoading] = useState(!cached?.data);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const inflight = useRef(null);

  const load = useCallback(async (force = false, selectedRange) => {
    const r = selectedRange || range;
    const key = reportsCacheKey(r);
    if (!force) {
      const hit = getCached(key, STALE_MS);
      if (hit && !hit.stale) {
        setData(hit.data);
        setLoading(false);
        return;
      }
      if (hit?.data) {
        setData(hit.data);
        setLoading(false);
      }
    }
    if (inflight.current === key) return;
    inflight.current = key;
    setError(null);
    try {
      const granularity = GRANULARITY_BY_RANGE[r] || "day";
      const res = await api.get("/reports/analytics/", {
        params: { date_range: r, granularity, source: "all" },
      });
      setCached(key, res.data);
      setData(res.data);
    } catch (e) {
      setError(e.response?.status || 500);
    } finally {
      if (inflight.current === key) inflight.current = null;
      setLoading(false);
    }
  }, [range]);

  useFocusEffect(useCallback(() => { load(false); }, [load]));
  useLiveRefresh(() => { load(true); });

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const changeRange = (r) => {
    setQuery({ range: r });
    const hit = getCached(reportsCacheKey(r), STALE_MS);
    if (hit?.data) {
      setData(hit.data);
      setLoading(false);
      setError(null);
      load(false, r);
      return;
    }
    setData(null);
    setLoading(true);
    setError(null);
    load(true, r);
  };

  const summary = data?.summary || {};
  const daily = data?.daily_breakdown || [];
  const methodSplit = data?.provider_category_split || [
    { provider: "paypal", revenue: summary.paypal_revenue, count: summary.paypal_count },
    { provider: "razorpay", revenue: summary.razorpay_revenue, count: summary.razorpay_count },
    { provider: "cashfree", revenue: summary.cashfree_revenue, count: summary.cashfree_count },
    { provider: "other", revenue: summary.other_revenue, count: summary.other_count },
  ];

  const paidTotal = Number(summary.total_paid_revenue || 0);
  const methodTotal = methodSplit.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  const totalsReconcile = Math.abs(methodTotal - paidTotal) < 0.01;
  const changePct = Number(summary.revenue_change_pct || 0);
  const windowLabel = useMemo(
    () => businessDayFilterLabel(range) || data?.business_day_note,
    [range, data?.business_day_note],
  );

  const openDrillDown = (provider, label) => {
    navigation.navigate("ReportTransactions", {
      title: label,
      dateRange: range,
      provider: provider || "",
      source: "all",
    });
  };

  if (loading && !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
        <ReportsSkeleton />
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
        <GatewayErrorState statusCode={error} onRetry={() => { setLoading(true); load(true); }} />
      </SafeAreaView>
    );
  }

  const kpis = [
    {
      key: "total",
      label: "Total Revenue",
      value: fmt(summary.total_paid_revenue),
      sub: `Paid · ${summary.total_paid_count || 0} · ${Math.abs(changePct)}%`,
      color: METHOD_COLORS.total,
      filter: "",
    },
    {
      key: "paypal",
      label: "PayPal",
      value: fmt(summary.paypal_revenue),
      sub: `${summary.paypal_count || 0} paid`,
      color: METHOD_COLORS.paypal,
      filter: "paypal",
    },
    {
      key: "razorpay",
      label: "Razorpay",
      value: fmt(summary.razorpay_revenue),
      sub: `${summary.razorpay_count || 0} paid`,
      color: METHOD_COLORS.razorpay,
      filter: "razorpay",
    },
    {
      key: "cashfree",
      label: "Cashfree",
      value: fmt(summary.cashfree_revenue),
      sub: `${summary.cashfree_count || 0} paid`,
      color: METHOD_COLORS.cashfree,
      filter: "cashfree",
    },
    {
      key: "other",
      label: "Other",
      value: fmt(summary.other_revenue),
      sub: `${summary.other_count || 0} · NAS/Zelle/UPI`,
      color: METHOD_COLORS.other,
      filter: "other",
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: pagePad, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: 22, fontWeight: "500", color: t.text }}>Home</Text>
        <Text style={{ color: t.subtext, fontSize: 12, marginBottom: 12, fontWeight: "300" }}>
          High-level revenue · Total = PayPal + Razorpay + Cashfree + Other · 8 PM–8 PM IST
        </Text>

        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8, marginBottom: 12, gap: 8 }}
        >
          {DATE_RANGES.map((r) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => changeRange(r.id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: range === r.id ? t.accent : t.card,
                borderWidth: 1,
                borderColor: range === r.id ? t.accent : t.border,
              }}
            >
              <Text style={{ color: range === r.id ? "#fff" : t.text, fontWeight: "500", fontSize: 12 }}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {windowLabel ? (
          <View style={{
            backgroundColor: "#eef2ff",
            borderRadius: 12,
            padding: 10,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: "#c7d2fe",
          }}
          >
            <Text style={{ color: "#4338ca", fontSize: 11, fontWeight: "500" }}>{windowLabel}</Text>
          </View>
        ) : null}

        <View style={{
          backgroundColor: totalsReconcile ? "#ecfdf5" : "#fef2f2",
          borderRadius: 12,
          padding: 10,
          marginBottom: 14,
          borderWidth: 1,
          borderColor: totalsReconcile ? "#a7f3d0" : "#fecaca",
        }}
        >
          <Text style={{
            color: totalsReconcile ? "#047857" : "#b91c1c",
            fontSize: 11,
            fontWeight: "500",
            lineHeight: 16,
          }}
          >
            {totalsReconcile
              ? `Verified: PayPal ${fmt(summary.paypal_revenue)} + Razorpay ${fmt(summary.razorpay_revenue)} + Cashfree ${fmt(summary.cashfree_revenue)} + Other ${fmt(summary.other_revenue)} = ${fmt(paidTotal)}`
              : `Mismatch: methods ${fmt(methodTotal)} ≠ total ${fmt(paidTotal)}`}
          </Text>
        </View>

        <View style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          rowGap: gap,
          marginBottom: 14,
        }}
        >
          {kpis.map((k) => (
            <KpiCard
              key={k.key}
              label={k.label}
              value={k.value}
              sub={k.sub}
              color={k.color}
              t={t}
              width={kpiWidth}
              onPress={() => openDrillDown(k.filter, k.label)}
            />
          ))}
        </View>

        <Card>
          <Text style={{ fontWeight: "500", color: t.text, fontSize: 16, marginBottom: 12 }}>
            Method split
          </Text>
          {methodSplit.map((p) => {
            const name = p.provider === "other"
              ? "Other"
              : p.provider === "paypal"
                ? "PayPal"
                : p.provider === "razorpay"
                  ? "Razorpay"
                  : p.provider === "cashfree"
                    ? "Cashfree"
                    : p.provider;
            return (
              <TouchableOpacity
                key={p.provider}
                onPress={() => openDrillDown(p.provider === "other" ? "other" : p.provider, `${name} Revenue`)}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                <Text style={{ color: t.subtext, fontWeight: "300", flexShrink: 1 }} numberOfLines={1}>
                  {name} · {p.count || 0}
                </Text>
                <Text style={{ fontWeight: "500", color: t.text }} numberOfLines={1}>
                  {fmt(p.revenue || 0)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Card>

        {daily.length > 0 && (
          <Card>
            <Text style={{ fontWeight: "500", color: t.text, fontSize: 16, marginBottom: 4 }}>
              Daily revenue
            </Text>
            <Text style={{ color: t.muted, fontSize: 11, marginBottom: 12, fontWeight: "300" }}>
              Each day = prior 8 PM → 7:59 PM IST
            </Text>
            {daily.slice(0, 14).map((d, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <Text style={{ color: t.subtext, fontSize: 13, fontWeight: "300", flex: 1 }} numberOfLines={1}>
                    {d.date || d.label}
                  </Text>
                  <Text style={{ fontWeight: "500", color: t.text }} numberOfLines={1}>
                    {fmt(d.total || 0)}
                  </Text>
                </View>
                <Text style={{ color: t.muted, fontSize: 10, marginTop: 2, fontWeight: "300" }} numberOfLines={2}>
                  Pay {fmt(d.payments_revenue || 0)} · Links {fmt(d.paylinks_revenue || 0)} · NAS {fmt(d.nas_revenue || 0)} · Zelle {fmt(d.zelle_revenue || 0)} · UPI {fmt(d.upi_revenue || 0)}
                </Text>
              </View>
            ))}
            {daily.length > 14 && (
              <Text style={{ color: t.muted, fontSize: 12, textAlign: "center", fontWeight: "300" }}>
                +{daily.length - 14} more days
              </Text>
            )}
          </Card>
        )}
      </ScrollView>

      {allowCreate ? (
        <CreateInvoiceFab
          accent={t.accent}
          onPress={() => navigation.navigate("CreateBilling")}
        />
      ) : null}
    </SafeAreaView>
  );
}
