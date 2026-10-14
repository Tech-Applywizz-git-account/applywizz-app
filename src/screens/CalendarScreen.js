import React, { useCallback, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { Text } from "../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/client";
import { Card, useTheme } from "../components/ui";
import { ReportsSkeleton } from "../components/Skeleton";
import { money } from "../theme";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarScreen({ navigation }) {
  const t = useTheme();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    const { data } = await api.get("/calendar/", { params: { year, month } });
    setData(data);
  }, [year, month]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shift = (delta) => {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; } if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y); setSelected(null);
  };

  if (!data) return <ReportsSkeleton />;

  const first = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const byDay = {};
  let totalIn = 0, totalOut = 0;
  data.events.forEach((e) => {
    const d = Number(e.date.split("-")[2]);
    (byDay[d] = byDay[d] || []).push(e);
    if (e.direction === "in") totalIn += Number(e.amount); else totalOut += Number(e.amount);
  });

  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  const monthName = new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long" });
  const selectedEvents = selected ? (byDay[selected] || []) : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <TouchableOpacity onPress={() => shift(-1)}><Ionicons name="chevron-back" size={24} color={t.accent} /></TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "500", color: t.text }}>{monthName} {year}</Text>
          <TouchableOpacity onPress={() => shift(1)}><Ionicons name="chevron-forward" size={24} color={t.accent} /></TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <Card style={{ flex: 1, marginBottom: 0 }}><Text style={{ color: t.subtext, fontSize: 12, fontWeight: "300"}}>Money in</Text><Text style={{ color: t.success, fontWeight: "500", fontSize: 18 }}>{money(totalIn)}</Text></Card>
          <Card style={{ flex: 1, marginBottom: 0 }}><Text style={{ color: t.subtext, fontSize: 12, fontWeight: "300"}}>Money out</Text><Text style={{ color: t.danger, fontWeight: "500", fontSize: 18 }}>{money(totalOut)}</Text></Card>
        </View>

        <Card>
          <View style={{ flexDirection: "row" }}>
            {DOW.map((d, i) => <Text key={i} style={{ flex: 1, textAlign: "center", color: t.muted, fontWeight: "500", fontSize: 12 }}>{d}</Text>)}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
            {cells.map((d, i) => {
              const ev = d ? byDay[d] : null;
              const hasIn = ev?.some((e) => e.direction === "in");
              const hasOut = ev?.some((e) => e.direction === "out");
              return (
                <TouchableOpacity key={i} disabled={!d} onPress={() => setSelected(d)} style={{ width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" }}>
                  {d ? (
                    <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: selected === d ? t.accent : "transparent" }}>
                      <Text style={{ color: selected === d ? "#fff" : t.text, fontWeight: "500" }}>{d}</Text>
                      <View style={{ flexDirection: "row", gap: 2, position: "absolute", bottom: 3 }}>
                        {hasIn && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: selected === d ? "#fff" : t.success }} />}
                        {hasOut && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: selected === d ? "#fff" : t.danger }} />}
                      </View>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {selected && (
          <Card>
            <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>{monthName} {selected}</Text>
            {selectedEvents.length === 0 && <Text style={{ color: t.subtext, fontWeight: "300"}}>Nothing scheduled.</Text>}
            {selectedEvents.map((e, i) => (
              <TouchableOpacity key={i} disabled={!e.document_id} onPress={() => e.document_id && navigation.navigate("InvoiceDetail", { id: e.document_id })}
                style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
                <Text style={{ color: t.text }}>{e.label}</Text>
                <Text style={{ color: e.direction === "in" ? t.success : t.danger, fontWeight: "500" }}>
                  {e.direction === "in" ? "+" : "-"}{money(e.amount)}
                </Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
