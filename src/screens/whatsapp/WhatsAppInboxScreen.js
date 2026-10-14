import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { fetchWhatsAppUsers, createWhatsAppContact } from "../../api/whatsapp";
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
  { id: "pending", label: "Pending" },
  { id: "resolved", label: "Resolved" },
  { id: "unassigned", label: "Unassigned" },
  { id: "all", label: "All" },
];

function fmtWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

export default function WhatsAppInboxScreen({ navigation }) {
  const t = useTheme();
  const { query, setQuery } = useScreenQuery({ status: "open", q: "" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(query.q || "");
  const [newPhone, setNewPhone] = useState("");
  const [starting, setStarting] = useState(false);
  const abortRef = useRef(null);

  const statusId = query.status || "open";
  const unassigned = statusId === "unassigned";
  const status = statusId === "all" || unassigned ? "" : statusId;

  const load = useCallback(async () => {
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await fetchWhatsAppUsers({
        status,
        search,
        unassigned,
        signal: controller.signal,
      });
      setRows(toList(data));
    } catch (e) {
      if (isRequestCanceled(e)) return;
      setError(formatApiError(e, "Could not load WhatsApp inbox."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, search, unassigned]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
    return () => abortRef.current?.abort();
  }, [load]));
  useLiveRefresh(() => { load(); }, STALE_MS);

  useEffect(() => {
    const tmr = setTimeout(() => setQuery({ q: search }), 300);
    return () => clearTimeout(tmr);
  }, [search, setQuery]);

  const onStart = async () => {
    const phone = newPhone.trim();
    if (!phone) return;
    setStarting(true);
    try {
      const created = await createWhatsAppContact({ phone });
      setNewPhone("");
      await load();
      if (created?.id) navigation.navigate("WhatsAppThread", { id: created.id });
    } catch (e) {
      setError(formatApiError(e, "Could not start chat."));
    } finally {
      setStarting(false);
    }
  };

  const renderItem = useCallback(({ item: row }) => (
    <Card
      onPress={() => navigation.navigate("WhatsAppThread", { id: row.id })}
      style={{ marginBottom: 10 }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontWeight: "500", color: t.text }}>{row.name || row.phone_e164}</Text>
          <Text style={{ color: t.subtext, fontSize: 12, marginTop: 2 }}>{row.phone_e164}</Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
            <Badge text={row.status || "open"} tone="slate" />
            {row.team ? <Badge text={row.team} tone="indigo" /> : null}
            {!row.assigned_to ? <Badge text="unassigned" tone="amber" /> : null}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {row.unread_count > 0 ? (
            <View style={{ backgroundColor: t.accent, borderRadius: 10, minWidth: 20, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "500", textAlign: "center" }}>{row.unread_count}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={t.muted} />
          )}
          <Text style={{ color: t.muted, fontSize: 10, marginTop: 8 }}>{fmtWhen(row.last_message_at)}</Text>
        </View>
      </View>
    </Card>
  ), [navigation, t]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <Text style={{ fontWeight: "500", fontSize: 20, color: t.text, marginBottom: 10 }}>WhatsApp</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or phone"
          placeholderTextColor={t.muted}
          style={{
            backgroundColor: t.card, borderWidth: 1, borderColor: t.border,
            borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: t.text,
          }}
        />
        <View style={{ marginTop: 10 }}>
          <ChipRow
            items={STATUS_CHIPS}
            value={statusId}
            onChange={(id) => setQuery({ status: id })}
            t={t}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <TextInput
            value={newPhone}
            onChangeText={setNewPhone}
            placeholder="Start chat: US number"
            placeholderTextColor={t.muted}
            keyboardType="phone-pad"
            style={{
              flex: 1, backgroundColor: t.card, borderWidth: 1, borderColor: t.border,
              borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: t.text,
            }}
          />
          <TouchableOpacity
            onPress={onStart}
            disabled={starting || !newPhone.trim()}
            style={{
              backgroundColor: t.accent, borderRadius: 12, paddingHorizontal: 14,
              justifyContent: "center", opacity: starting || !newPhone.trim() ? 0.5 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "500" }}>Start</Text>
          </TouchableOpacity>
        </View>
      </View>
      {error ? <Text style={{ color: t.danger, paddingHorizontal: 16 }}>{error}</Text> : null}
      {loading && !rows.length ? (
        <ListSkeleton rows={8} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListEmptyComponent={(
            <Text style={{ color: t.muted, textAlign: "center", marginTop: 40 }}>No conversations.</Text>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        />
      )}
    </SafeAreaView>
  );
}
