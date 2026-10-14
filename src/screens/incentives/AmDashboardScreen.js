import React, { useCallback, useMemo, useState } from "react";
import { View, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { fetchAmDashboard } from "../../api/incentives";
import { useTheme } from "../../components/ui";
import { ReportsSkeleton } from "../../components/Skeleton";
import { formatApiError } from "../../utils/billing";
import { AmSummaryBlock, MonthPicker, SearchBar, BoostLiveBanner } from "./shared";
import {
  AmMonthLockControls,
  LockedPeriodBadge,
  incentivesCacheTtlMs,
} from "./PeriodLockControls";
import { useScreenQuery } from "../../navigation/useScreenQuery";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { getCached, setCached } from "../../api/queryCache";

const PAGE_SIZE = 25;

export default function AmDashboardScreen({ navigation }) {
  const t = useTheme();
  const defaultMonth = new Date().toISOString().slice(0, 7);
  const { query, setQuery } = useScreenQuery({
    yearMonth: defaultMonth,
    userId: "",
    q: "",
  });
  const yearMonth = query.yearMonth || defaultMonth;
  const selectedUserId = query.userId || "";
  const search = query.q || "";
  const [page, setPage] = useState(1);

  const cacheKey = `am_dash:${yearMonth}:${selectedUserId || "all"}`;
  const initialData = getCached(cacheKey, 60000)?.data || null;
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const locked = data?.snapshot_status === "final";
  const cacheTtl = incentivesCacheTtlMs(data?.snapshot_status);

  const load = useCallback(async () => {
    setError(null);
    try {
      const payload = await fetchAmDashboard({
        yearMonth,
        userId: selectedUserId || undefined,
      });
      setData(payload);
      setCached(cacheKey, payload);
    } catch (e) {
      setError(formatApiError(e, "Could not load AM dashboard."));
    } finally {
      setLoading(false);
    }
  }, [selectedUserId, yearMonth, cacheKey]);

  useFocusEffect(useCallback(() => {
    const hit = getCached(cacheKey, cacheTtl)?.data;
    if (hit) {
      setData(hit);
      setLoading(false);
      if (hit?.snapshot_status === "final") return;
    } else {
      setLoading(true);
    }
    load();
  }, [load, cacheKey, cacheTtl]));

  useLiveRefresh(() => {
    if (locked) return;
    load();
  });

  const onRefresh = async () => {
    if (locked) return;
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filteredRows = useMemo(() => {
    const rows = data?.am_rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.name || "").toLowerCase().includes(q)
      || (r.email || "").toLowerCase().includes(q));
  }, [data, search]);

  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  if (loading && !data) return <ReportsSkeleton />;

  const personal = data?.view_mode === "personal";
  const summary = personal ? data?.summary : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            enabled={!locked}
          />
        )}
      >
        {selectedUserId ? (
          <TouchableOpacity
            onPress={() => { setQuery({ userId: "" }); setPage(1); }}
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}
          >
            <Ionicons name="arrow-back" size={18} color={t.accent} />
            <Text style={{ color: t.accent, fontWeight: "500", marginLeft: 6 }}>Back to team list</Text>
          </TouchableOpacity>
        ) : null}

        <MonthPicker
          yearMonth={yearMonth}
          onChange={(ym) => { setQuery({ yearMonth: ym }); setPage(1); }}
          t={t}
        />

        <LockedPeriodBadge
          snapshotStatus={data?.snapshot_status}
          lockedAt={data?.locked_at}
          t={t}
          department="AM"
        />
        <AmMonthLockControls
          yearMonth={yearMonth}
          snapshotStatus={data?.snapshot_status}
          lockedAt={data?.locked_at}
          onChanged={load}
          t={t}
        />

        {error ? <Text style={{ color: t.danger, marginBottom: 12 }}>{error}</Text> : null}

        {data?.boost_periods?.length ? (
          <BoostLiveBanner periods={data.boost_periods} t={t} />
        ) : null}

        {personal && summary ? (
          <AmSummaryBlock
            summary={summary}
            yearMonth={yearMonth}
            isFutureMonth={Boolean(data?.is_future_month)}
            weightedEnabled={Boolean(data?.weighted_month_pct_enabled)}
            t={t}
          />
        ) : null}

        {!personal && data?.view_mode === "admin" && !selectedUserId ? (
          <View>
            <Text style={{ fontWeight: "500", color: t.text, fontSize: 18, marginBottom: 8 }}>
              AM team · {yearMonth}
              {locked ? " · frozen" : ""}
            </Text>
            <SearchBar
              value={search}
              onChange={(v) => { setQuery({ q: v }); setPage(1); }}
              placeholder="Search AM…"
              t={t}
            />
            {pageRows.map((row) => (
              <TouchableOpacity
                key={row.user_id}
                onPress={() => navigation.push("AmDashboard", { userId: row.user_id, yearMonth })}
                style={{
                  backgroundColor: t.card,
                  borderWidth: 1,
                  borderColor: t.border,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 8,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "500", color: t.text }}>{row.name}</Text>
                    <Text style={{ color: t.subtext, fontSize: 12, fontWeight: "300" }}>{row.email}</Text>
                    <Text style={{ color: t.muted, fontSize: 11, marginTop: 4, fontWeight: "300" }}>
                      Face {row.revenue_usd} · credited {row.credited_revenue_usd ?? row.revenue_usd}
                      {" · "}{row.slab_label} · gate {row.gate_passed ? "ok" : "fail"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={t.muted} />
                </View>
              </TouchableOpacity>
            ))}
            {pageCount > 1 ? (
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 8 }}>
                <TouchableOpacity disabled={page <= 1} onPress={() => setPage((p) => p - 1)}>
                  <Text style={{ color: page <= 1 ? t.muted : t.accent, fontWeight: "500" }}>Prev</Text>
                </TouchableOpacity>
                <Text style={{ color: t.subtext, fontWeight: "300" }}>{page} / {pageCount}</Text>
                <TouchableOpacity disabled={page >= pageCount} onPress={() => setPage((p) => p + 1)}>
                  <Text style={{ color: page >= pageCount ? t.muted : t.accent, fontWeight: "500" }}>Next</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
