import React, { useCallback, useState } from "react";
import { View, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { fetchAmOverview } from "../../api/incentives";
import { getCached, setCached } from "../../api/queryCache";
import { useTheme } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { fmtInr, fmtUsd, formatApiError } from "../../utils/billing";
import { amDisplayInr } from "../../utils/incentives";
import { AmPaymentRow, MonthPicker } from "./shared";
import {
  AmMonthLockControls,
  LockedPeriodBadge,
  incentivesCacheTtlMs,
} from "./PeriodLockControls";
import { useScreenQuery } from "../../navigation/useScreenQuery";

export default function AmOverviewScreen({ navigation }) {
  const t = useTheme();
  const defaultMonth = new Date().toISOString().slice(0, 7);
  const { query, setQuery } = useScreenQuery({
    yearMonth: defaultMonth,
    includeProjected: true,
  });
  const yearMonth = query.yearMonth || defaultMonth;
  const includeProjected = query.includeProjected !== false;
  const cacheKey = `am_overview:${yearMonth}:${includeProjected}`;
  const initial = getCached(cacheKey, 300000);
  const [openId, setOpenId] = useState(null);
  const [data, setData] = useState(initial?.data || null);
  const [loading, setLoading] = useState(!initial?.data);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const locked = data?.snapshot_status === "final";
  const cacheTtl = incentivesCacheTtlMs(data?.snapshot_status);

  const load = useCallback(async ({ force = false } = {}) => {
    const key = `am_overview:${yearMonth}:${includeProjected}`;
    if (!force) {
      const hit = getCached(key, cacheTtl);
      if (hit?.data?.snapshot_status === "final") {
        setData(hit.data);
        setLoading(false);
        return;
      }
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
    setError(null);
    try {
      const res = await fetchAmOverview({ yearMonth, includeProjected });
      setData(res);
      setCached(key, res);
    } catch (e) {
      setError(formatApiError(e, "Could not load AM overview."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [includeProjected, yearMonth, cacheTtl]);

  useFocusEffect(useCallback(() => {
    load({ force: false });
  }, [load]));

  const onRefresh = async () => {
    if (locked) return;
    setRefreshing(true);
    await load({ force: true });
  };

  if (loading && !data) return <ListSkeleton rows={8} />;

  const team = data?.team_summary;
  const rows = data?.am_rows || [];

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
        <MonthPicker yearMonth={yearMonth} onChange={(ym) => setQuery({ yearMonth: ym })} t={t} />

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
          onChanged={() => load({ force: true })}
          t={t}
        />

        <TouchableOpacity
          onPress={() => setQuery({ includeProjected: !includeProjected })}
          style={{ marginBottom: 12 }}
        >
          <Text style={{ color: t.accent, fontWeight: "500", fontSize: 13 }}>
            {includeProjected ? "Including projected months" : "Closed months only"} · tap to toggle
          </Text>
        </TouchableOpacity>

        {error ? <Text style={{ color: t.danger, marginBottom: 12 }}>{error}</Text> : null}

        {team ? (
          <View style={{
            backgroundColor: "#0F766E",
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
          }}
          >
            <Text style={{ color: "#ffffffaa", fontSize: 11, fontWeight: "500" }}>
              TEAM SUMMARY{locked ? " · FROZEN" : ""}
            </Text>
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "500", marginTop: 4 }}>
              {fmtInr(team.total_inr)}
            </Text>
            <Text style={{ color: "#ffffffcc", marginTop: 4 }}>
              Face {fmtUsd(team.revenue_usd)} · credited {fmtUsd(team.credited_revenue_usd ?? team.revenue_usd)} · {rows.length} AM(s)
            </Text>
          </View>
        ) : null}

        {rows.map((row, idx) => {
          const s = row.summary || {};
          const open = openId === row.user?.id;
          return (
            <View
              key={row.user?.id || idx}
              style={{
                borderWidth: 1,
                borderColor: t.border,
                borderRadius: 16,
                marginBottom: 10,
                overflow: "hidden",
                backgroundColor: t.card,
              }}
            >
              <TouchableOpacity
                onPress={() => setOpenId(open ? null : row.user?.id)}
                style={{ padding: 14, backgroundColor: t.accent + "12" }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "500", color: t.text }}>{row.user?.name}</Text>
                    <Text style={{ color: t.subtext, fontSize: 12, fontWeight: "300"}}>{row.user?.email}</Text>
                    <Text style={{ color: t.muted, fontSize: 11, marginTop: 4, fontWeight: "300"}}>
                      {row.payment_count} payment(s) · {s.slab_label}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontWeight: "500", color: t.text }}>{amDisplayInr(s)}</Text>
                    <Text style={{ color: t.subtext, fontSize: 11, fontWeight: "300"}}>
                      Face {fmtUsd(s.revenue_usd)} · credited {fmtUsd(s.credited_revenue_usd ?? s.revenue_usd)}
                    </Text>
                    <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={t.muted} style={{ marginTop: 4 }} />
                  </View>
                </View>
              </TouchableOpacity>

              {open ? (
                <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("AmDashboard", { userId: row.user?.id, yearMonth })}
                    style={{ marginVertical: 8 }}
                  >
                    <Text style={{ color: t.accent, fontWeight: "500" }}>Open full dashboard →</Text>
                  </TouchableOpacity>
                  {(s.payments || []).slice(0, 15).map((p, i) => (
                    <AmPaymentRow key={`${p.awl_id}-${i}`} row={p} index={i} t={t} />
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
