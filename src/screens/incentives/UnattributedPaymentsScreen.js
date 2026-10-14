import React, { useCallback, useState } from "react";
import { View, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { fetchUnattributedPayments } from "../../api/incentives";
import { getCached, setCached } from "../../api/queryCache";
import { useTheme } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { fmtUsd, formatApiError } from "../../utils/billing";
import { ChipRow } from "./shared";

const RANGES = [
  { id: "30", label: "30d" },
  { id: "90", label: "90d" },
  { id: "180", label: "180d" },
  { id: "365", label: "12m" },
];

const SOURCE_LABELS = {
  payment_order: "Payment order",
  billing: "Billing",
  nas: "NAS",
  paylink: "Pay link",
};

export default function UnattributedPaymentsScreen() {
  const t = useTheme();
  const [days, setDays] = useState("90");
  const [page, setPage] = useState(1);
  const cacheKey = `unattributed_payments:${days}:${page}`;
  const initial = getCached(cacheKey, 300000)?.data || null;
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(!initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const pageSize = 50;

  const load = useCallback(async ({ force = false } = {}) => {
    const key = `unattributed_payments:${days}:${page}`;
    if (!force) {
      const hit = getCached(key, 300000);
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
      const res = await fetchUnattributedPayments({ days, page, pageSize });
      setData(res);
      setCached(key, res);
    } catch (e) {
      setError(formatApiError(e, "Could not load unattributed payments."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days, page]);

  useFocusEffect(useCallback(() => {
    load({ force: false });
  }, [load]));

  if (loading && !data) return <ListSkeleton rows={8} />;

  const rows = data?.results || [];
  const total = data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <CardNotice t={t} />

        <ChipRow items={RANGES} value={days} onChange={(v) => { setDays(v); setPage(1); }} t={t} />

        {error ? <Text style={{ color: t.danger, marginBottom: 12 }}>{error}</Text> : null}

        <Text style={{ color: t.subtext, marginBottom: 12, fontSize: 12, fontWeight: "300"}}>
          {total} unattributed payment(s)
        </Text>

        {rows.map((row, i) => (
          <View
            key={row.id || i}
            style={{
              backgroundColor: t.card,
              borderWidth: 1,
              borderColor: t.border,
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <Text style={{ fontWeight: "500", color: t.text, fontFamily: "monospace" }}>{row.awlId || row.awl_id}</Text>
            <Text style={{ color: t.subtext, fontSize: 12, marginTop: 4, fontWeight: "300"}}>
              {SOURCE_LABELS[row.source] || row.source} · {fmtUsd(row.paidUsd ?? row.paid_usd)}
            </Text>
            <Text style={{ color: t.muted, fontSize: 11, marginTop: 2, fontWeight: "300"}}>
              Paid {row.paidAt || row.paid_at || "—"} · {row.paymentKind || row.payment_kind || "—"}
            </Text>
          </View>
        ))}

        {pageCount > 1 ? (
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 8 }}>
            <TouchableOpacity disabled={page <= 1} onPress={() => setPage((p) => p - 1)}>
              <Text style={{ color: page <= 1 ? t.muted : t.accent, fontWeight: "500" }}>Prev</Text>
            </TouchableOpacity>
            <Text style={{ color: t.subtext, fontWeight: "300"}}>{page} / {pageCount}</Text>
            <TouchableOpacity disabled={page >= pageCount} onPress={() => setPage((p) => p + 1)}>
              <Text style={{ color: page >= pageCount ? t.muted : t.accent, fontWeight: "500" }}>Next</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CardNotice({ t }) {
  return (
    <View style={{
      backgroundColor: "#FEF3C7",
      borderColor: "#FDE68A",
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    }}
    >
      <Text style={{ color: "#92400E", fontSize: 12, lineHeight: 18 }}>
        Paid payments with no CRM sales_closure match (±7 days). Fix AWL/CRM then run backfill_am_attributions.
      </Text>
    </View>
  );
}
