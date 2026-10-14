import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { snackApi } from "../api";
import { C } from "../theme";
import { PantryScreen, Err } from "../ui";

export default function DashboardScreen() {
  const [dash, setDash] = useState(null);
  const [err, setErr] = useState("");
  useFocusEffect(useCallback(() => {
    snackApi.dashboard().then(setDash).catch((e) => setErr(e.message));
  }, []));
  const cards = dash?.cards || dash || {};
  const entries = typeof cards === "object" && !Array.isArray(cards)
    ? Object.entries(cards).filter(([k]) => typeof cards[k] !== "object")
    : [];
  return (
    <PantryScreen>
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <Text style={styles.h}>Pantry snapshot</Text>
        <Text style={styles.sub}>Stock, spend, and AI summary for facility, accounts, and leadership.</Text>
        <Err text={err} />
        <View style={styles.grid}>
          {entries.slice(0, 8).map(([k, v]) => (
            <View key={k} style={styles.card}>
              <Text style={styles.lbl}>{k.replace(/_/g, " ")}</Text>
              <Text style={styles.val}>{String(v)}</Text>
            </View>
          ))}
        </View>
        {dash?.ai_summary || dash?.summary ? (
          <View style={styles.note}>
            <Text style={styles.lbl}>AI summary</Text>
            <Text style={styles.sub}>{dash.ai_summary || dash.summary}</Text>
          </View>
        ) : null}
      </ScrollView>
    </PantryScreen>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: FONT.medium, fontSize: 26, color: C.ink },
  sub: { fontFamily: FONT.light, color: C.muted, marginTop: 6, lineHeight: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 16 },
  card: { width: "48%", backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  lbl: { fontFamily: FONT.medium, color: C.muted, fontSize: 12, textTransform: "capitalize" },
  val: { fontFamily: FONT.medium, color: C.ink, fontSize: 20, marginTop: 6 },
  note: { backgroundColor: C.mint, borderRadius: 14, padding: 14, marginTop: 8 },
});
