import React, { useCallback, useState } from "react";
import { View, FlatList, Alert } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../api/client";
import { Card, EmptyState, Button, useTheme } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";

function fmt(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}h ${m}m`;
}

export default function TimeEntriesScreen() {
  const t = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/time-entries/", { params: { ordering: "-started_at" } });
      const list = data.results || data;
      setItems(list);
      setRunning(list.find((e) => !e.ended_at) || null);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const startTimer = async () => { await api.post("/time-entries/start/", { description: "Work" }); load(); };
  const stopTimer = async () => { if (running) { await api.post(`/time-entries/${running.id}/stop/`); load(); } };

  if (loading && !items.length) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
        <ListSkeleton rows={6} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <View style={{ padding: 16 }}>
        {running ? (
          <Card style={{ backgroundColor: t.accent }}>
            <Text style={{ color: "#fff", fontWeight: "500", fontSize: 16 }}>Timer running…</Text>
            <Text style={{ color: "#ffffffcc", marginTop: 2 }}>{running.description || "Work"}</Text>
            <Button title="Stop timer" variant="outline" style={{ marginTop: 12, borderColor: "#fff" }} onPress={stopTimer} />
          </Card>
        ) : (
          <Button title="Start timer" onPress={startTimer} />
        )}
      </View>
      <FlatList
        data={items.filter((e) => e.ended_at)} keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 40 }}
        ListEmptyComponent={<EmptyState icon="time-outline" title="No entries" subtitle="Start a timer to track work." />}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontWeight: "500", color: t.text }}>{item.description || "Work"}</Text>
                <Text style={{ color: t.subtext, fontSize: 12, fontWeight: "300" }}>{item.started_at}</Text>
              </View>
              <Text style={{ fontWeight: "500", color: t.text }}>{fmt(item.duration_minutes || 0)}</Text>
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
