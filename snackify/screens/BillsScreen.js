import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { snackApi } from "../api";
import { C } from "../theme";
import { PantryScreen, Err } from "../ui";

export default function BillsScreen() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  useFocusEffect(useCallback(() => {
    snackApi.bills().then((d) => setRows(d?.bills || d || [])).catch((e) => setErr(e.message));
  }, []));
  return (
    <PantryScreen>
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <Text style={styles.h}>Bills</Text>
        <Text style={styles.sub}>Upload on the web for GPT extract. Leadership verifies stock; finance approves pay.</Text>
        <Err text={err} />
        {(Array.isArray(rows) ? rows : []).map((b) => (
          <View key={b.id} style={styles.card}>
            <Text style={styles.name}>{b.vendor || b.vendor_name || "Invoice"}</Text>
            <Text style={styles.meta}>{b.invoice_number} · {b.verification_status || b.approval_status}</Text>
          </View>
        ))}
      </ScrollView>
    </PantryScreen>
  );
}

export function AvailableScreen() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  useFocusEffect(useCallback(() => {
    snackApi.items().then((d) => setRows(d?.items || d || [])).catch((e) => setErr(e.message));
  }, []));
  return (
    <PantryScreen>
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <Text style={styles.h}>What’s in stock</Text>
        <Err text={err} />
        {(Array.isArray(rows) ? rows : []).map((i) => (
          <View key={i.id} style={styles.card}>
            <Text style={styles.name}>{i.name}</Text>
            <Text style={styles.meta}>{i.stock_servings ?? "—"} servings</Text>
          </View>
        ))}
      </ScrollView>
    </PantryScreen>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: FONT.medium, fontSize: 26, color: C.ink },
  sub: { fontFamily: FONT.light, color: C.muted, marginTop: 6, marginBottom: 12 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  name: { fontFamily: FONT.medium, color: C.ink },
  meta: { fontFamily: FONT.light, color: C.muted, marginTop: 4 },
});
