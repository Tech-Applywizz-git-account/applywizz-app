import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { useAuth } from "../../src/context/AuthContext";
import { useSnackAuth } from "../AuthContext";
import { SN } from "../data";
import { ROLE_LABEL, isDashRole, isQueueRole } from "../theme";
import AssistiveAppSwitch from "../../src/components/AssistiveAppSwitch";
import BrownButton from "../components/BrownButton";
import { useSnackTokens } from "../TokenContext";
import Coin, { CoinPrice } from "../components/Coin";
import CafeteriaCard from "../components/CafeteriaCard";

export default function ProfileScreen({ navigation }) {
  const invoice = useAuth();
  const pantry = useSnackAuth();
  const tokens = useSnackTokens();
  const role = pantry?.role || "staff";
  const name = pantry?.profile?.preferred_name || pantry?.profile?.name || invoice?.user?.name || pantry?.profile?.email || "Applywizzian";
  const [username, setUsername] = useState(pantry?.profile?.preferred_name || name);
  const [savingName, setSavingName] = useState(false);
  const [nameErr, setNameErr] = useState("");

  const saveUsername = async () => {
    const next = String(username || "").trim();
    if (!next) {
      setNameErr("Enter a username.");
      return;
    }
    setSavingName(true);
    setNameErr("");
    try {
      await pantry.setPreferredName(next);
      tokens?.refresh?.();
    } catch (e) {
      setNameErr(e.message || "Could not save username.");
    } finally {
      setSavingName(false);
    }
  };

  const links = [
    { t: "Book lunch (printed token)", s: "SnackifyMealsTab" },
    { t: "My meal box / token", s: "SnackifyMealBox" },
    { t: "Meal history", s: "SnackifyMealHistory" },
    isQueueRole(role) ? { t: "Fulfillment queue", s: "SnackifyQueue" } : null,
    isQueueRole(role) ? { t: "Cabin print jobs", s: "SnackifyTokens" } : null,
    isQueueRole(role) || role === "finance" ? { t: "Bills", s: "SnackifyBills" } : null,
    isDashRole(role) ? { t: "Pantry dashboard", s: "SnackifyDashboard" } : null,
    pantry?.isOwner ? { t: "Daily stock update", s: "SnackifyDaily" } : null,
    { t: "What’s in stock", s: "SnackifyAvailable" },
  ].filter(Boolean);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SN.beige }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.h}>Profile</Text>
        <View style={styles.card}>
          <Text style={styles.name}>{pantry?.profile?.preferred_name || name}</Text>
          <Text style={styles.mail}>{ROLE_LABEL[role] || role}</Text>
          <Text style={styles.mail}>{pantry?.profile?.email || invoice?.user?.email || ""}</Text>
          <Text style={[styles.mail, { marginTop: 14 }]}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Your first name"
            placeholderTextColor={SN.muted}
            style={styles.input}
          />
          {nameErr ? <Text style={styles.err}>{nameErr}</Text> : null}
          <Pressable onPress={saveUsername} disabled={savingName} style={styles.saveBtn}>
            <Text style={styles.saveTxt}>{savingName ? "Saving…" : "Save username"}</Text>
          </Pressable>
        </View>
        <CafeteriaCard
          cardNumber={tokens?.card?.cafeteria_card_number}
          cardMasked={tokens?.card?.card_masked}
          cardholder={pantry?.profile?.preferred_name || tokens?.card?.cardholder || name}
          balance={tokens?.wallet?.balance ?? 0}
          color={tokens?.card?.color || "neon"}
        />
        <View style={styles.card}>
          <Text style={styles.walletLbl}>Snackify Wallet</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
            <Coin size={40} />
            <View>
              <Text style={styles.walletBal}>{tokens?.wallet?.balance ?? 0}</Text>
              <Text style={styles.mail}>{tokens?.wallet?.balance ?? 0} coins in wallet</Text>
            </View>
          </View>
          <Text style={[styles.mail, { marginTop: 10 }]}>
            Monthly benefit 4,000 coins · {tokens?.wallet?.spent_this_month ?? 0} spent this month
          </Text>
          {(tokens?.ledger || []).slice(0, 8).map((row) => (
            <View key={row.id} style={styles.ledRow}>
              <Text style={styles.ledT}>{row.reason.replace(/_/g, " ")}</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.ledT}>{row.tokens_delta > 0 ? "+" : "−"}</Text>
                <CoinPrice amount={Math.abs(row.tokens_delta || 0)} size={13} />
              </View>
            </View>
          ))}
        </View>
        {links.map((l) => (
          <Pressable key={l.s} style={styles.row} onPress={() => navigation.navigate(l.s)}>
            <Text style={styles.rowT}>{l.t}</Text>
          </Pressable>
        ))}
        <View style={{ paddingHorizontal: 18, marginTop: 12 }}>
          <BrownButton outline title="Sign out" onPress={pantry.signOut} />
        </View>
      </ScrollView>
      <AssistiveAppSwitch />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: FONT.medium, fontSize: 24, color: SN.ink, paddingHorizontal: 18, paddingTop: 8 },
  card: { margin: 18, backgroundColor: "#fff", borderRadius: 16, padding: 16 },
  walletLbl: { fontFamily: FONT.light, color: SN.muted, fontSize: 12 },
  walletBal: { fontFamily: FONT.medium, fontSize: 32, color: SN.ink, marginTop: 4 },
  ledRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  ledT: { fontFamily: FONT.regular, color: SN.ink, fontSize: 13 },
  name: { fontFamily: FONT.medium, fontSize: 18, color: SN.ink },
  mail: { fontFamily: FONT.light, color: SN.muted, marginTop: 4 },
  input: {
    height: 46, borderRadius: 12, backgroundColor: SN.beige, paddingHorizontal: 12,
    fontFamily: FONT.regular, color: SN.ink, marginTop: 6,
  },
  saveBtn: {
    marginTop: 10, height: 42, borderRadius: 12, backgroundColor: SN.espresso,
    alignItems: "center", justifyContent: "center",
  },
  saveTxt: { fontFamily: FONT.medium, color: "#fff", fontSize: 14 },
  err: { fontFamily: FONT.regular, color: "#B42318", marginTop: 6, fontSize: 12 },
  row: { marginHorizontal: 18, marginBottom: 8, backgroundColor: "#fff", borderRadius: 14, padding: 16 },
  rowT: { fontFamily: FONT.medium, color: SN.ink },
});
