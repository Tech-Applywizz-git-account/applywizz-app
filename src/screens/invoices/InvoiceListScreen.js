import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { Text, TextInput } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getCached, setCached } from "../../api/queryCache";
import { inboxCacheKey } from "../../api/cacheKeys";
import {
  fetchBillingInbox,
  rowInvoicePdfUrl,
  rowPayUrl,
  rowMethod,
  isOfflineCollectionMethod,
  shiftBillingOwner,
  upsertLegacyOverride,
} from "../../api/billing";
import { useAuth } from "../../context/AuthContext";
import { Card, StatusPill, EmptyState, useTheme } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import CreateInvoiceFab from "../../components/CreateInvoiceFab";
import AssistiveAppSwitch from "../../components/AssistiveAppSwitch";
import BillingOfflineActions from "../../components/BillingOfflineActions";
import EditUnpaidBillingModal from "./EditUnpaidBillingModal";
import ShiftOwnerModal from "../../components/ShiftOwnerModal";
import { money } from "../../theme";
import { canCreateInvoice, formatApiError, isGatewayMethod } from "../../utils/billing";
import { useScreenQuery } from "../../navigation/useScreenQuery";
import { useLiveRefresh, LIVE_STALE_MS } from "../../hooks/useLiveRefresh";
import { isStoreDemoEnabled, fetchDemoBillingInbox } from "../../storeDemo";
import { DEMO_ORG } from "../../storeDemo/fixtures";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "created", label: "Open" },
  { id: "sent", label: "Sent" },
  { id: "paid", label: "Paid" },
  { id: "cancelled", label: "Cancelled" },
];

const DATE_FILTERS = [
  { id: "today", label: "Today" },
  { id: "this_week", label: "Week" },
  { id: "this_month", label: "Month" },
  { id: "all", label: "All dates" },
];

const STALE_MS = LIVE_STALE_MS;
const SEARCH_DEBOUNCE_MS = 150;

function cacheKey(filter, dateRange, q) {
  return inboxCacheKey(filter, dateRange, q);
}

function useDebounced(value, ms = SEARCH_DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

async function openUrl(url, label = "link") {
  if (!url) {
    Alert.alert("Unavailable", `No ${label} for this invoice.`);
    return;
  }
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert("Cannot open", url);
      return;
    }
    await Linking.openURL(url);
  } catch (e) {
    Alert.alert("Error", e?.message || `Could not open ${label}.`);
  }
}

export default function InvoiceListScreen({ navigation }) {
  const t = useTheme();
  const { user, profile } = useAuth();
  const currency = profile?.currency || "USD";
  const allowCreate = canCreateInvoice(user);
  const { query, setQuery } = useScreenQuery({ status: "all", date: "today", q: "" });

  const [filter, setFilter] = useState(query.status || "all");
  const [dateRange, setDateRange] = useState(query.date || "today");
  const [q, setQ] = useState(query.q || "");
  const search = useDebounced(q, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    setQuery({ status: filter, date: dateRange, q: search });
  }, [filter, dateRange, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const initial = getCached(cacheKey(filter, dateRange, ""), STALE_MS);
  const [items, setItems] = useState(initial?.data || []);
  const [loading, setLoading] = useState(!initial?.data);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [cachedAt, setCachedAt] = useState(initial?.at || null);
  const [editRow, setEditRow] = useState(null);
  const [shiftRow, setShiftRow] = useState(null);
  const [shiftBusy, setShiftBusy] = useState(false);
  const inflightKey = useRef(null);
  const abortRef = useRef(null);

  const load = useCallback(async ({ force = false, nextFilter, nextDateRange, nextQ } = {}) => {
    const f = nextFilter ?? filter;
    const dr = nextDateRange ?? dateRange;
    const query = nextQ ?? search;
    const key = cacheKey(f, dr, query);

    if (!force) {
      const hit = getCached(key, STALE_MS);
      if (hit && !hit.stale) {
        setItems(hit.data);
        setCachedAt(hit.at || null);
        setLoading(false);
        return;
      }
      if (hit?.data) {
        setItems(hit.data);
        setCachedAt(hit.at || null);
        setLoading(false);
      }
    }

    if (inflightKey.current === key) return;
    inflightKey.current = key;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    if (force || !getCached(key, STALE_MS)?.data) {
      setLoading(true);
      // Keep previous rows visible while refreshing so network blips don't blank the UI.
    }

    try {
      // Store-demo capture path: synthetic rows only — never hits live billing APIs.
      if (isStoreDemoEnabled()) {
        const data = await fetchDemoBillingInbox({
          status: f,
          search: query,
        });
        if (inflightKey.current !== key) return;
        const list = data.results || [];
        setCached(key, list);
        setItems(list);
        setCachedAt(Date.now());
        return;
      }

      const data = await fetchBillingInbox({
        page: 1,
        pageSize: 50,
        dateRange: dr,
        status: f,
        search: query,
        signal: controller.signal,
      });
      if (inflightKey.current !== key) return;
      const list = data.results || [];
      setCached(key, list);
      setItems(list);
      setCachedAt(Date.now());
    } catch (e) {
      if (inflightKey.current !== key) return;
      if (e?.code === "ERR_CANCELED" || e?.name === "CanceledError") return;
      setError(formatApiError(e, "Could not load invoices."));
    } finally {
      if (inflightKey.current === key) {
        inflightKey.current = null;
        setLoading(false);
      }
    }
  }, [filter, dateRange, search]);

  useFocusEffect(
    useCallback(() => {
      load({ force: false });
    }, [load]),
  );
  useLiveRefresh(() => { load({ force: true }); });

  // Debounced search → refetch only when the query actually changes (not on first mount).
  const searchBoot = useRef(true);
  useEffect(() => {
    if (searchBoot.current) {
      searchBoot.current = false;
      return;
    }
    load({ force: true, nextQ: search });
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => {
    setRefreshing(true);
    await load({ force: true });
    setRefreshing(false);
  };

  const onFilter = (id) => {
    setFilter(id);
    load({ force: true, nextFilter: id });
  };

  const onDateRange = (id) => {
    setDateRange(id);
    load({ force: true, nextDateRange: id });
  };

  const openItem = (item) => {
    const pdf = rowInvoicePdfUrl(item);
    const pay = rowPayUrl(item);
    const gateway = isGatewayMethod(rowMethod(item));
    const pdfLabel = gateway ? "Open gateway invoice" : "Open PDF";
    const title = item.reference || "Invoice";
    const body = [
      item.clientName || "No client",
      item.awlId || item.awl_id ? `AWL: ${item.awlId || item.awl_id}` : null,
      item.clientEmail || item.client_email || null,
      `${money(item.amount, item.currency || currency)} · ${item.displayStatus || item.status || "—"}`,
      item.methodLabel ? `Method: ${item.methodLabel}` : null,
      item.source === "payment_order" ? "Source: legacy" : null,
    ].filter(Boolean).join("\n");

    const buttons = [];
    if (pdf) {
      buttons.push({ text: pdfLabel, onPress: () => openUrl(pdf, gateway ? "gateway invoice" : "invoice PDF") });
    }
    if (pay && String(item.displayStatus || item.status || "").toLowerCase() !== "paid") {
      buttons.push({ text: "Pay link", onPress: () => openUrl(pay, "pay link") });
    }
    buttons.push({ text: "OK", style: "cancel" });

    if (Platform.OS === "ios" && buttons.length > 2) {
      const options = [];
      if (pdf) options.push(pdfLabel);
      if (pay && String(item.displayStatus || item.status || "").toLowerCase() !== "paid") {
        options.push("Pay link");
      }
      options.push("Cancel");
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          message: body,
          options,
          cancelButtonIndex: options.length - 1,
        },
        (idx) => {
          const label = options[idx];
          if (label === pdfLabel) openUrl(pdf, gateway ? "gateway invoice" : "invoice PDF");
          if (label === "Pay link") openUrl(pay, "pay link");
        },
      );
      return;
    }

    Alert.alert(title, body, buttons);
  };

  const searching = Boolean(search.trim());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 8 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 26, fontWeight: "500", color: t.text }}>Invoices</Text>
          <Text style={{ color: t.muted, fontSize: 12, marginTop: 2, fontWeight: "300" }}>
            {isStoreDemoEnabled()
              ? DEMO_ORG.timezoneLabel
              : searching
                ? "Searching live + legacy orders"
                : cachedAt
                  ? `Updated ${new Date(cachedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · 8 PM–8 PM IST`
                  : "8 PM–8 PM IST · your team scope"}
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.border, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={t.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="BILL-… or APPLYWIZZ-INV-…, email, AWL"
            placeholderTextColor={t.muted}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: t.text }}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {q ? (
            <TouchableOpacity onPress={() => setQ("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={t.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {error ? (
        <Text style={{ color: t.danger, paddingHorizontal: 16, marginBottom: 8, fontSize: 13 }}>{error}</Text>
      ) : null}

      {!searching ? (
        <View style={{ paddingLeft: 16, marginBottom: 8 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={DATE_FILTERS}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => {
              const active = dateRange === item.id;
              return (
                <TouchableOpacity onPress={() => onDateRange(item.id)} style={{ marginRight: 8 }}>
                  <View style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                    backgroundColor: active ? `${t.accent}18` : t.card,
                    borderWidth: 1, borderColor: active ? t.accent : t.border,
                  }}
                  >
                    <Text style={{ color: active ? t.accent : t.subtext, fontWeight: "500", fontSize: 12 }}>
                      {item.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      ) : null}

      <View style={{ paddingLeft: 16, marginBottom: 4 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => {
            const active = filter === item.id;
            return (
              <TouchableOpacity onPress={() => onFilter(item.id)} style={{ marginRight: 8 }}>
                <View style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: active ? t.accent : t.card,
                  borderWidth: 1, borderColor: active ? t.accent : t.border,
                }}
                >
                  <Text style={{ color: active ? "#fff" : t.subtext, fontWeight: "500", fontSize: 13 }}>
                    {item.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading ? (
        <ListSkeleton rows={8} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => `${i.source || "row"}-${i.id}`}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title={searching ? "No matches" : "No invoices yet"}
              subtitle={
                searching
                  ? "Tried live billing and legacy payment orders."
                  : (allowCreate ? "Use Create invoice to add one." : "Nothing in your visibility scope.")
              }
            />
          }
          renderItem={({ item }) => {
            const pdf = rowInvoicePdfUrl(item);
            const pay = rowPayUrl(item);
            const isPaid = String(item.displayStatus || item.status || "").toLowerCase() === "paid";
            const method = rowMethod(item);
            const offline = item.source === "billing" && isOfflineCollectionMethod(method);
            const gateway = isGatewayMethod(method);
            return (
              <Card onPress={() => openItem(item)}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontWeight: "500", color: t.text, fontSize: 15 }}>
                      {item.reference || item.id}
                    </Text>
                    {item.secondaryReference && item.secondaryReference !== item.reference ? (
                      <Text style={{ color: t.muted, fontSize: 11, marginTop: 1, fontWeight: "300" }}>
                        {item.secondaryReference}
                      </Text>
                    ) : null}
                    {item.source === "payment_order" ? (
                      <Text style={{ color: "#B45309", fontSize: 10, marginTop: 2, fontWeight: "500" }}>LEGACY</Text>
                    ) : null}
                    <Text style={{ color: t.subtext, fontSize: 13, marginTop: 2, fontWeight: "300" }}>
                      {item.clientName || "No client"}
                    </Text>
                    <Text style={{ color: t.muted, fontSize: 12, marginTop: 2, fontWeight: "300" }}>
                      {[
                        item.awlId || item.awl_id,
                        item.clientEmail || item.client_email,
                        item.methodLabel || item.method,
                        item.source === "payment_order" ? "legacy" : null,
                      ].filter(Boolean).join(" · ")}
                    </Text>
                    <View style={{ flexDirection: "row", marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                      {pdf ? (
                        <TouchableOpacity
                          onPress={() => openUrl(pdf, gateway ? "gateway invoice" : "invoice PDF")}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 8,
                            backgroundColor: `${t.accent}14`,
                            borderWidth: 1,
                            borderColor: `${t.accent}33`,
                          }}
                        >
                          <Ionicons name="document-text-outline" size={14} color={t.accent} />
                          <Text style={{ marginLeft: 4, color: t.accent, fontSize: 12, fontWeight: "500" }}>
                            {gateway ? "Gateway" : "PDF"}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {pay && !isPaid && !offline ? (
                        <TouchableOpacity
                          onPress={() => openUrl(pay, "pay link")}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 8,
                            backgroundColor: "#EFF6FF",
                            borderWidth: 1,
                            borderColor: "#BFDBFE",
                          }}
                        >
                          <Ionicons name="open-outline" size={14} color="#1D4ED8" />
                          <Text style={{ marginLeft: 4, color: "#1D4ED8", fontSize: 12, fontWeight: "500" }}>Pay</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <BillingOfflineActions
                      row={item}
                      user={user}
                      onChanged={() => load({ force: true })}
                      onEdit={(r) => setEditRow(r)}
                      onShiftOwner={(r) => setShiftRow(r)}
                    />
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontWeight: "500", color: t.text, fontSize: 16 }}>
                      {money(item.amount, item.currency || currency)}
                    </Text>
                    <View style={{ marginTop: 6 }}>
                      <StatusPill status={item.displayStatus || item.status} />
                    </View>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}

      {allowCreate ? (
        <CreateInvoiceFab
          accent={t.accent}
          onPress={() => navigation.navigate("CreateBilling")}
        />
      ) : null}

      <EditUnpaidBillingModal
        visible={Boolean(editRow)}
        row={editRow}
        onClose={() => setEditRow(null)}
        onSaved={() => load({ force: true })}
      />
      <ShiftOwnerModal
        visible={Boolean(shiftRow)}
        row={shiftRow}
        pending={shiftBusy}
        onClose={() => setShiftRow(null)}
        onSubmit={async ({ created_by_id, reason }) => {
          setShiftBusy(true);
          try {
            if (shiftRow?.source === "payment_order") {
              await upsertLegacyOverride({
                order_number: shiftRow.reference || shiftRow.raw?.order_number,
                created_by_id,
                treat_as_paid: true,
                amount_usd: shiftRow.amount,
                paid_at: shiftRow.paidAt || shiftRow.raw?.paid_at,
                notes: reason,
              });
            } else {
              await shiftBillingOwner(shiftRow.id, { created_by_id, reason });
            }
            setShiftRow(null);
            await load({ force: true });
          } catch (e) {
            Alert.alert("Error", formatApiError(e, "Could not shift owner."));
          } finally {
            setShiftBusy(false);
          }
        }}
      />
      <AssistiveAppSwitch />
    </SafeAreaView>
  );
}
