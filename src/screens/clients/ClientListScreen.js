import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, FlatList, TouchableOpacity, RefreshControl, TextInput } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import { getCached, setCached } from "../../api/queryCache";
import { CLIENTS_LIST_KEY } from "../../api/cacheKeys";
import { Card, EmptyState, useTheme } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { money } from "../../theme";
import { useScreenQuery } from "../../navigation/useScreenQuery";
import { useLiveRefresh, LIVE_STALE_MS } from "../../hooks/useLiveRefresh";

const HEALTH = { good: "#16A34A", fair: "#D97706", poor: "#DC2626", new: "#64748B" };
const STALE_MS = LIVE_STALE_MS;

export default function ClientListScreen({ navigation }) {
  const t = useTheme();
  const { query, setQuery } = useScreenQuery({ q: "" });
  const initial = getCached(CLIENTS_LIST_KEY, STALE_MS);
  const [items, setItems] = useState(initial?.data || []);
  const [loading, setLoading] = useState(!initial?.data);
  const [refreshing, setRefreshing] = useState(false);
  const inflight = useRef(false);

  const load = useCallback(async ({ force = false } = {}) => {
    if (!force) {
      const hit = getCached(CLIENTS_LIST_KEY, STALE_MS);
      if (hit && !hit.stale) {
        setItems(hit.data || []);
        setLoading(false);
        return;
      }
      if (hit?.data) {
        setItems(hit.data);
        setLoading(false);
      }
    }
    if (inflight.current) return;
    inflight.current = true;
    try {
      const { data } = await api.get("/clients/", { params: { is_archived: false, ordering: "name" } });
      const list = data.results || data;
      setCached(CLIENTS_LIST_KEY, list);
      setItems(list);
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load({ force: false }); }, [load]));
  useLiveRefresh(() => { load({ force: true }); });
  const onRefresh = async () => { setRefreshing(true); await load({ force: true }); setRefreshing(false); };

  const filtered = useMemo(() => {
    const q = String(query.q || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) =>
      `${row.name || ""} ${row.company || ""} ${row.email || ""}`.toLowerCase().includes(q));
  }, [items, query.q]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
        <Text style={{ fontSize: 26, fontWeight: "500", color: t.text }}>Clients</Text>
        <TouchableOpacity onPress={() => navigation.navigate("ClientEditor", {})} style={{ backgroundColor: t.accent, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 16,
        marginBottom: 8,
        backgroundColor: t.card,
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: 14,
        paddingHorizontal: 12,
      }}
      >
        <Ionicons name="search" size={18} color={t.muted} />
        <TextInput
          value={query.q || ""}
          onChangeText={(v) => setQuery({ q: v })}
          placeholder="Search clients…"
          placeholderTextColor={t.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, color: t.text, fontSize: 14 }}
        />
      </View>
      {loading && !items.length ? (
        <ListSkeleton rows={8} />
      ) : (
        <FlatList
          data={filtered} keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No clients" subtitle="Add a client to start invoicing." />}
          renderItem={({ item }) => (
            <Card onPress={() => navigation.navigate("ClientDetail", { id: item.id })}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.accent + "22", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Text style={{ color: t.accent, fontWeight: "500", fontSize: 17 }}>{(item.name || "?")[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "500", color: t.text, fontSize: 15 }}>{item.name}</Text>
                  <Text style={{ color: t.subtext, fontSize: 13, fontWeight: "300" }}>{item.company || item.email || "—"}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontWeight: "500", color: t.text }}>{money(item.outstanding, item.currency || "USD")}</Text>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: HEALTH[item.health] || HEALTH.new, marginTop: 6 }} />
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}
