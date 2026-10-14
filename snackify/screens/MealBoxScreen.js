import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { snackApi } from "../api";
import { SN } from "../data";
import { PantryScreen, PrimaryBtn, Err } from "../ui";
import BackHeader from "../components/BackHeader";
import { CoinPrice } from "../components/Coin";

export default function MealBoxScreen({ navigation }) {
  const [token, setToken] = useState(null);
  const [err, setErr] = useState("");
  const [reprinting, setReprinting] = useState(false);

  useFocusEffect(useCallback(() => {
    snackApi.myToken().then(setToken).catch((e) => setErr(e.message));
  }, []));

  const t = token?.token_number || token?.token || token?.code || token?.id;

  const reprint = async () => {
    if (!token?.id) return;
    setReprinting(true);
    try {
      await snackApi.reprintToken(token.id);
      setErr("");
    } catch (e) { setErr(e.message); }
    finally { setReprinting(false); }
  };

  return (
    <PantryScreen>
      <BackHeader title="My meal box" navigation={navigation} />
      <View style={{ padding: 22, flex: 1 }}>
        <Err text={err} />
        <View style={styles.card}>
          <Text style={styles.lbl}>Today's token</Text>
          <Text style={styles.code}>{t || "Token pending"}</Text>
          {token?.cabin_name ? <Text style={styles.tokenSub}>{token.cabin_name}</Text> : null}
          {token?.choice || token?.meal_type ? (
            <Text style={styles.tokenSub}>{String(token.choice || token.meal_type).toUpperCase()}</Text>
          ) : null}
          {token?.onion_slices && token.onion_slices !== "no onion" ? (
            <Text style={styles.tokenSub}>Onion: {token.onion_slices}</Text>
          ) : null}
          {token?.tokens_charged ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <Text style={styles.tokenSub}>Paid</Text>
              <CoinPrice amount={token.tokens_charged} size={14} />
            </View>
          ) : null}
          {token?.print_count > 0 ? (
            <Text style={styles.tokenSub}>Printed {token.print_count} time{token.print_count === 1 ? "" : "s"}</Text>
          ) : (
            <Text style={styles.tokenSub}>Waiting for printer — retries automatically if paper or power failed.</Text>
          )}
          {token?.preferred_name ? <Text style={styles.tokenSub}>{token.preferred_name}</Text> : null}
          {!t ? <Text style={styles.tokenSub}>Tokens print after the ~10:59 AM cabin job.</Text> : null}
        </View>
        {t ? (
          <PrimaryBtn outline title={reprinting ? "Reprinting…" : "Reprint token"} onPress={reprint} loading={reprinting} style={{ marginTop: 16 }} />
        ) : null}
      </View>
    </PantryScreen>
  );
}

export function MealHistoryScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  useFocusEffect(useCallback(() => {
    snackApi.myBookings().then((d) => setRows(d?.bookings || d || [])).catch((e) => setErr(e.message));
  }, []));
  return (
    <PantryScreen>
      <BackHeader title="Meal history" navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <Err text={err} />
        {(rows || []).map((r, i) => (
          <View key={r.id || i} style={styles.row}>
            <Text style={styles.rowT}>{r.date || r.booking_date}</Text>
            <Text style={styles.sub}>{String(r.meal_type || r.choice || r.status || "").replace(/_/g, " ")}</Text>
          </View>
        ))}
        {!rows.length && !err ? <Text style={styles.sub}>No bookings yet.</Text> : null}
      </ScrollView>
    </PantryScreen>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: FONT.medium, fontSize: 26, color: SN.ink },
  card: { marginTop: 18, backgroundColor: SN.espresso, borderRadius: 20, padding: 22 },
  lbl: { fontFamily: FONT.light, color: "#E8C56B" },
  code: { fontFamily: FONT.medium, color: "#fff", fontSize: 28, marginTop: 8 },
  tokenSub: { fontFamily: FONT.light, color: "rgba(255,255,255,0.75)", marginTop: 6 },
  sub: { fontFamily: FONT.light, color: SN.muted, marginTop: 8, textTransform: "capitalize" },
  row: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginTop: 10 },
  rowT: { fontFamily: FONT.medium, color: SN.ink },
});
