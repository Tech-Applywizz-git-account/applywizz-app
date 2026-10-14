import React, { useCallback, useRef, useState } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  useWindowDimensions,
} from "react-native";
import { Text } from "../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/client";
import { getCached, setCached, peekCached, hydrateQueryCache } from "../api/queryCache";
import { warmBackend } from "../api/warmup";
import { fetchBillingInbox, rowInvoicePdfUrl, resolveMediaUrl } from "../api/billing";
import { DASHBOARD_HOME_KEY, disputesCacheKey } from "../api/cacheKeys";
import { useAuth } from "../context/AuthContext";
import { Card, SoftHeader, StatusPill, useTheme } from "../components/ui";
import { DashboardSkeleton } from "../components/Skeleton";
import CreateInvoiceFab from "../components/CreateInvoiceFab";
import AssistiveAppSwitch from "../components/AssistiveAppSwitch";
import { BRAND, money } from "../theme";
import { canCreateInvoice, canViewDisputes, formatApiError, toList, isPlatformAdmin, isGatewayMethod } from "../utils/billing";
import { normalizeInboxHome } from "../utils/dashboardHome";
import { firstLetter } from "../utils/avatar";
import { fetchDisputes } from "../api/disputes";
import { useScreenQuery } from "../navigation/useScreenQuery";
import { useLiveRefresh, LIVE_STALE_MS } from "../hooks/useLiveRefresh";

const CACHE_KEY = DASHBOARD_HOME_KEY;
/** Fresh enough to skip network; stale data still paints immediately. */
const STALE_MS = LIVE_STALE_MS;
const EMPTY_HOME = {
  outstanding: 0,
  overdue_amount: 0,
  overdue_count: 0,
  paid_this_month: 0,
  paid_count: 0,
  open_count: 0,
  total_count: 0,
  draft_count: 0,
  client_count: 0,
  revenue_trend: [],
  method_split: { paypal: 0, razorpay: 0, cashfree: 0, other: 0 },
  recent_documents: [],
};

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] || "A").slice(0, 1).toUpperCase();
}

function isPaidStatus(status) {
  const s = String(status || "").toLowerCase();
  return s === "paid" || s.includes("paid");
}

function StatCell({ value, label, color, t }) {
  return (
    <View style={{ flex: 1, alignItems: "center", paddingVertical: 2 }}>
      <Text style={{ fontSize: 22, fontWeight: "500", color: color || t.text }}>{value}</Text>
      <Text style={{ color: t.subtext, fontSize: 11, marginTop: 3, fontWeight: "500" }}>{label}</Text>
    </View>
  );
}

function MethodStat({ label, value, count, color, currency, t, onPress, width }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        width,
        backgroundColor: t.card,
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
        <Text style={{ color: t.subtext, fontSize: 11, fontWeight: "500" }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text
        style={{ fontSize: 15, fontWeight: "500", color: t.text }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {money(value, currency)}
      </Text>
      <Text style={{ color: t.muted, fontSize: 11, marginTop: 4, fontWeight: "300" }}>
        {count || 0} paid
      </Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen({ navigation }) {
  const t = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { profile, user, avatarUri } = useAuth();
  const allowCreate = canCreateInvoice(user);
  const showDisputes = canViewDisputes(user);
  const isAdmin = isPlatformAdmin(user);
  const letter = firstLetter(user, profile);
  // Instant paint: any disk/memory snapshot, even if stale.
  const peeked = peekCached(CACHE_KEY) || getCached(CACHE_KEY, STALE_MS);
  const disputesHit = showDisputes
    ? (peekCached(disputesCacheKey("open", "")) || getCached(disputesCacheKey("open", ""), STALE_MS))
    : null;
  const { query, setQuery } = useScreenQuery({ chip: "all" });
  const chip = query.chip || "all";
  const [data, setData] = useState(peeked?.data || null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openDisputes, setOpenDisputes] = useState(
    Array.isArray(disputesHit?.data) ? disputesHit.data.length : 0,
  );
  const inflight = useRef(null);
  const currency = profile?.currency || "USD";

  const pagePad = 16;
  const methodGap = 8;
  const methodWidth = Math.floor((windowWidth - pagePad * 2 - methodGap) / 2);

  const welcomeName = (() => {
    const name = (user?.name || "").trim();
    if (name && !name.includes("@")) return name;
    const email = (user?.email || name || "").trim();
    if (email.includes("@")) return email.split("@")[0];
    if (email) return email;
    return "there";
  })();

  const load = useCallback(async ({ force = false } = {}) => {
    // Never block first paint on hydrate — kick it off, use memory immediately.
    hydrateQueryCache().then(() => {
      if (!force) {
        const disk = peekCached(CACHE_KEY);
        if (disk?.data) setData((prev) => prev || disk.data);
      }
    }).catch(() => {});

    if (!force) {
      const hit = getCached(CACHE_KEY, STALE_MS);
      if (hit && !hit.stale) {
        setData(hit.data);
        return;
      }
      const any = peekCached(CACHE_KEY);
      if (any?.data) setData(any.data);
    }

    if (inflight.current) return inflight.current;

    setError(null);
    warmBackend({ force: false }).catch(() => {});
    const run = (async () => {
      try {
        // Home first (fast path). Analytics/disputes fill in without blocking UI.
        const homePayload = await api.get("/billing/home/", {
          params: { date_range: "this_month" },
          timeout: 12000,
          _light: true,
        }).then((r) => r.data);

        const homeHasRecent = Array.isArray(homePayload?.recent_documents)
          && homePayload.recent_documents.length > 0;
        const homeHasSummary = homePayload
          && (homePayload.outstanding != null || homePayload.paid_this_month != null);

        // Paint as soon as home returns — don't wait on analytics.
        const quick = normalizeInboxHome(
          { summary: {}, results: [] },
          null,
          homePayload,
          rowInvoicePdfUrl,
        );
        setCached(CACHE_KEY, quick);
        setData(quick);
        setError(null);

        const analyticsReq = api.get("/reports/analytics/", {
          params: { date_range: "this_month", granularity: "day" },
          timeout: 20000,
        }).then((r) => r.data).catch(() => null);
        const disputesReq = showDisputes
          ? fetchDisputes({ status: "open", page: 1 }).catch(() => null)
          : Promise.resolve(null);

        let inbox = { summary: {}, results: [] };
        if (!homeHasRecent && !homeHasSummary) {
          try {
            inbox = await fetchBillingInbox({
              page: 1,
              pageSize: 20,
              dateRange: "this_month",
            });
          } catch {
            /* keep quick paint */
          }
        }

        const [analytics, disputesPayload] = await Promise.all([analyticsReq, disputesReq]);
        if (disputesPayload) {
          const list = toList(disputesPayload);
          setOpenDisputes(
            typeof disputesPayload?.count === "number" ? disputesPayload.count : list.length,
          );
        }

        const normalized = normalizeInboxHome(inbox, analytics, homePayload, rowInvoicePdfUrl);
        setCached(CACHE_KEY, normalized);
        setData(normalized);
      } catch (e) {
        setError(formatApiError(e, "Could not load dashboard."));
        setData((prev) => prev || EMPTY_HOME);
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = run;
    return run;
  }, [showDisputes]);

  useFocusEffect(useCallback(() => { load({ force: false }); }, [load]));
  useLiveRefresh(() => { load({ force: true }); });

  const onRefresh = async () => {
    setRefreshing(true);
    await load({ force: true });
    setRefreshing(false);
  };

  // Never block on BrandLoader — skeleton only when we have zero cached data.
  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
        <DashboardSkeleton />
        <AssistiveAppSwitch />
      </SafeAreaView>
    );
  }

  const recent = Array.isArray(data.recent_documents) ? data.recent_documents : [];
  const filtered = recent.filter((d) => {
    if (chip === "paid") return isPaidStatus(d.status);
    if (chip === "open") return !isPaidStatus(d.status);
    return true;
  });

  const openRecent = (d) => {
    const method = String(d.method || "").toLowerCase();
    const isGateway = isGatewayMethod(method);
    const pdf = isGateway
      ? (d.invoicePdf || null)
      : resolveMediaUrl(d.invoicePdf);
    const buttons = [];
    if (pdf) {
      buttons.push({
        text: isGateway ? "Open gateway invoice" : "Open PDF",
        onPress: () => Linking.openURL(pdf).catch(() => Alert.alert("Error", "Could not open invoice.")),
      });
    }
    buttons.push({
      text: "View all invoices",
      onPress: () => navigation.navigate("Invoices"),
    });
    buttons.push({ text: "OK", style: "cancel" });
    Alert.alert(
      d.number || "Invoice",
      [
        d.client_name || "No client",
        d.awlId ? `AWL: ${d.awlId}` : null,
        d.clientEmail || null,
        `${money(d.total, d.currency || currency)} · ${d.status || "—"}`,
        d.method ? `Method: ${d.method}` : null,
      ].filter(Boolean).join("\n"),
      buttons,
    );
  };

  const totalCount = data.total_count || 0;
  const paidCount = data.paid_count || 0;
  const pendingCount = data.open_count || data.overdue_count || 0;
  const methods = data.method_split || {};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <SoftHeader style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 22 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Settings")}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "#fff",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
                borderWidth: 1,
                borderColor: "#fff",
                overflow: "hidden",
              }}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: 48, height: 48 }} />
              ) : (
                <Text style={{ fontWeight: "500", color: BRAND.teal, fontSize: 18 }}>{letter}</Text>
              )}
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.subtext, fontSize: 12, fontWeight: "300" }}>Welcome back</Text>
              <Text style={{ fontSize: 22, fontWeight: "500", color: t.text }} numberOfLines={1}>
                {welcomeName}
              </Text>
            </View>
          </View>

          <View
            style={{
              marginTop: 18,
              backgroundColor: "#ffffffee",
              borderRadius: 18,
              paddingVertical: 14,
              paddingHorizontal: 6,
              flexDirection: "row",
              borderWidth: 1,
              borderColor: "#ffffff",
            }}
          >
            <StatCell value={totalCount} label="Total" t={t} />
            <View style={{ width: 1, backgroundColor: t.border }} />
            <StatCell value={paidCount} label="Paid" color={BRAND.green} t={t} />
            <View style={{ width: 1, backgroundColor: t.border }} />
            <StatCell value={pendingCount} label="Open" color={BRAND.orange} t={t} />
          </View>
        </SoftHeader>

        <View style={{ paddingHorizontal: pagePad, marginTop: -4 }}>
          {error ? (
            <Text style={{ color: t.danger, marginBottom: 10, fontSize: 13 }}>{error}</Text>
          ) : null}

          <Card style={{ backgroundColor: BRAND.teal, borderColor: BRAND.tealDark, marginBottom: 12 }}>
            <Text style={{ color: "#ffffffcc", fontWeight: "500", fontSize: 12 }}>
              {isAdmin ? "Org paid revenue (this month)" : "Paid revenue (this month)"}
            </Text>
            <Text
              style={{ color: "#fff", fontSize: 30, fontWeight: "500", marginTop: 4 }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {money(data.paid_this_month, currency)}
            </Text>
            <Text style={{ color: "#ffffffdd", marginTop: 6, fontSize: 13 }}>
              Open balance {money(data.outstanding, currency)}
            </Text>
          </Card>

          {isAdmin ? (
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: "500", color: t.text }}>By gateway</Text>
                <TouchableOpacity onPress={() => navigation.navigate("Reports")}>
                  <Text style={{ color: t.accent, fontWeight: "500", fontSize: 13 }}>Full reports</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 }}>
                <MethodStat
                  label="PayPal"
                  value={methods.paypal}
                  count={methods.paypal_count}
                  color="#2563eb"
                  currency={currency}
                  t={t}
                  width={methodWidth}
                  onPress={() => navigation.navigate("Reports")}
                />
                <MethodStat
                  label="Razorpay"
                  value={methods.razorpay}
                  count={methods.razorpay_count}
                  color="#7c3aed"
                  currency={currency}
                  t={t}
                  width={methodWidth}
                  onPress={() => navigation.navigate("Reports")}
                />
                <MethodStat
                  label="Cashfree"
                  value={methods.cashfree}
                  count={methods.cashfree_count}
                  color="#f59e0b"
                  currency={currency}
                  t={t}
                  width={methodWidth}
                  onPress={() => navigation.navigate("Reports")}
                />
                <MethodStat
                  label="Other"
                  value={methods.other}
                  count={methods.other_count}
                  color="#059669"
                  currency={currency}
                  t={t}
                  width={methodWidth}
                  onPress={() => navigation.navigate("Reports")}
                />
              </View>
            </View>
          ) : null}

          {showDisputes ? (
            <Card
              onPress={() => navigation.navigate("Disputes")}
              style={{
                marginBottom: 16,
                borderColor: openDisputes > 0 ? "#FECACA" : t.border,
                backgroundColor: openDisputes > 0 ? "#FEF2F2" : t.card,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    backgroundColor: openDisputes > 0 ? "#FEE2E2" : BRAND.tealSoft,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Ionicons
                    name="shield-outline"
                    size={20}
                    color={openDisputes > 0 ? "#B91C1C" : BRAND.teal}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "500", color: t.text }}>Disputes</Text>
                  <Text style={{ color: t.subtext, fontSize: 12, marginTop: 2, fontWeight: "300" }}>
                    {openDisputes > 0
                      ? `${openDisputes} open · PayPal / Razorpay / Cashfree`
                      : "No open disputes · PayPal / Razorpay / Cashfree"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={t.muted} />
              </View>
            </Card>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 4,
              marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "500", color: t.text }}>Recent transactions</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Invoices")}>
              <Text style={{ color: t.accent, fontWeight: "500", fontSize: 13 }}>See all</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {[
              { id: "all", label: "All invoices" },
              { id: "paid", label: "Paid" },
              { id: "open", label: "Open" },
            ].map((c) => {
              const active = chip === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setQuery({ chip: c.id })}
                  style={{
                    marginRight: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: active ? t.accent : "#fff",
                    borderWidth: 1,
                    borderColor: active ? t.accent : t.border,
                  }}
                >
                  <Text style={{ color: active ? "#fff" : t.subtext, fontWeight: "500", fontSize: 12 }}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {!filtered.length ? (
            <Card>
              <Text style={{ color: t.muted, textAlign: "center", fontWeight: "300" }}>
                No invoices in this filter
              </Text>
            </Card>
          ) : (
            filtered.map((d) => (
              <Card
                key={`${d.source || "doc"}-${d.id}`}
                onPress={() => openRecent(d)}
                style={{ marginBottom: 10 }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      backgroundColor: BRAND.tealSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "500", color: BRAND.teal, fontSize: 12 }}>
                      {initials(d.client_name || d.number)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "500", color: t.text }} numberOfLines={1}>
                      {d.client_name || "No client"}
                    </Text>
                    <Text
                      style={{ color: t.subtext, fontSize: 12, marginTop: 2, fontWeight: "300" }}
                      numberOfLines={1}
                    >
                      {(d.method || "Invoice")} · {d.number || "—"}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontWeight: "500", color: t.text }}>
                      {money(d.total, d.currency || currency)}
                    </Text>
                    <View style={{ marginTop: 4 }}>
                      <StatusPill status={d.status} />
                    </View>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {allowCreate ? (
        <CreateInvoiceFab
          accent={t.accent}
          onPress={() => navigation.navigate("CreateBilling")}
        />
      ) : null}
      <AssistiveAppSwitch />
    </SafeAreaView>
  );
}
