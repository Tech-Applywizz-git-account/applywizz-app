import React, { useCallback, useState } from "react";
import { View, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import { Card, EmptyState, useTheme } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { money } from "../../theme";

export default function ExpenseListScreen({ navigation }) {
  const t = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/expenses/", { params: { ordering: "-spent_on" } });
      setItems(data.results || data);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const total = items.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
        <View>
          <Text style={{ fontSize: 26, fontWeight: "500", color: t.text }}>Expenses</Text>
          <Text style={{ color: t.subtext, fontWeight: "300" }}>{money(total)} total shown</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("ExpenseEditor", {})} style={{ backgroundColor: t.accent, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
      {loading && !items.length ? (
        <ListSkeleton rows={8} />
      ) : (
        <FlatList
          data={items} keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="card-outline" title="No expenses" subtitle="Track business costs here." />}
          renderItem={({ item }) => (
            <Card onPress={() => navigation.navigate("ExpenseEditor", { id: item.id })}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ fontWeight: "500", color: t.text }}>{item.vendor || item.description || "Expense"}</Text>
                  <Text style={{ color: t.subtext, fontSize: 12, fontWeight: "300" }}>{item.category_name || "Uncategorized"} · {item.spent_on}</Text>
                </View>
                <Text style={{ fontWeight: "500", color: t.text }}>{money(item.amount, item.currency)}</Text>
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}
