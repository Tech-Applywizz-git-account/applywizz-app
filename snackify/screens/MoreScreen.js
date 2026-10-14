import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { snackApi } from "../api";
import { useSnackAuth } from "../AuthContext";
import { useAuth } from "../../src/context/AuthContext";
import { useSnackTokens } from "../TokenContext";
import { SN } from "../data";
import { isDashRole, isOpsRole } from "../theme";
import { PantryScreen, PrimaryBtn, Err } from "../ui";
import BackHeader from "../components/BackHeader";
import CafeteriaCard from "../components/CafeteriaCard";
import SupportTicketSheet, { HeadsetButton } from "../components/SupportTicketSheet";
import MealTicketSheet from "../components/MealTicketSheet";
import {
  LOCATIONS,
  istDateString,
  mergeMealTicketData,
  unwrapMealTokenPayload,
} from "../constants";

export default function MoreScreen({ navigation }) {
  const { role, isOwner, signOut, profile } = useSnackAuth();
  const { canImpersonate } = useAuth();
  const tokens = useSnackTokens();
  const [print, setPrint] = useState(null);
  const [err, setErr] = useState("");
  const [ticket, setTicket] = useState(false);

  useFocusEffect(useCallback(() => {
    if (role === "office_boy" || isDashRole(role) || role === "leadership" || isOwner) {
      snackApi.printStatus().then(setPrint).catch((e) => setErr(e.message));
    }
  }, [role, isOwner]));

  const open = (screen) => {
    if (screen === "SnackifyProfile" || screen === "SnackifySettings" || screen === "ViewAsUsers") {
      navigation.navigate(screen);
      return;
    }
    const parent = navigation.getParent?.();
    if (parent?.navigate) parent.navigate(screen);
    else navigation.navigate(screen);
  };

  const links = [
    { t: "Settings", s: "SnackifySettings" },
    { t: "Profile", s: "SnackifyProfile" },
    canImpersonate ? { t: "View as user", s: "ViewAsUsers" } : null,
    { t: "What's in stock", s: "SnackifyAvailable" },
    role === "office_boy" || isDashRole(role) || isOwner ? { t: "Meal token dashboard", s: "SnackifyTokens" } : null,
    isOwner || isOpsRole(role) ? { t: "Edit item coins", s: "SnackifyItemCoins" } : null,
    isDashRole(role) || role === "finance" || isOwner ? { t: "Bills", s: "SnackifyBills" } : null,
    isOwner ? { t: "Daily stock update", s: "SnackifyDaily" } : null,
    isDashRole(role) || isOwner ? { t: "Pantry dashboard", s: "SnackifyDashboard" } : null,
  ].filter(Boolean);

  return (
    <PantryScreen>
      <BackHeader
        title="More"
        navigation={navigation}
        right={<HeadsetButton onPress={() => setTicket(true)} />}
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Err text={err} />
        <CafeteriaCard
          compact
          cardNumber={tokens?.card?.cafeteria_card_number}
          cardMasked={tokens?.card?.card_masked}
          cardholder={tokens?.card?.cardholder || profile?.preferred_name || profile?.name || ""}
        />

        {links.map((l) => (
          <Pressable key={l.s} style={styles.row} onPress={() => open(l.s)}>
            <Text style={styles.rowT}>{l.t}</Text>
          </Pressable>
        ))}
        {print ? (
          <View style={styles.card}>
            <Text style={styles.rowT}>Print jobs</Text>
            <Text style={styles.meta}>{JSON.stringify(print?.status || print?.summary || "See cabin dashboard")}</Text>
          </View>
        ) : null}
        {isOwner ? (
          <PrimaryBtn
            outline
            title="Reset all wallets to 4000 (monthly)"
            onPress={async () => {
              setErr("");
              try {
                await snackApi.resetMonthlyWallets({ amount: 4000 });
                await tokens?.refresh?.();
              } catch (e) {
                setErr(e.message || "Monthly wallet reset failed on Snackify API.");
              }
            }}
            style={{ marginTop: 12 }}
          />
        ) : null}
        <PrimaryBtn outline title="Sign out" onPress={signOut} style={{ marginTop: 20 }} />
      </ScrollView>
      <SupportTicketSheet visible={ticket} onClose={() => setTicket(false)} />
    </PantryScreen>
  );
}

export function TokenDashScreen({ navigation }) {
  const { isOwner } = useSnackAuth();
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [err, setErr] = useState("");
  const loadOwnerTokens = useCallback(async () => {
    const today = istDateString();
    const [userData, ...cabinData] = await Promise.all([
      snackApi.users(),
      ...LOCATIONS.map((cabin) => snackApi.cabinBookings(today, cabin).catch(() => null)),
    ]);
    const userList = Array.isArray(userData)
      ? userData
      : (userData?.users || userData?.results || []);
    const tokenRows = cabinData.flatMap((bucket, idx) => {
      const list = Array.isArray(bucket)
        ? bucket
        : (bucket?.bookings || bucket?.rows || bucket?.tokens || []);
      return (Array.isArray(list) ? list : []).map((row) => ({
        ...unwrapMealTokenPayload(row),
        cabin_name: row?.cabin_name || row?.cabin || LOCATIONS[idx],
      }));
    });
    setUsers(Array.isArray(userList) ? userList : []);
    setRows(tokenRows);
  }, []);

  useFocusEffect(useCallback(() => {
    setErr("");
    if (isOwner) {
      loadOwnerTokens().catch((e) => setErr(e.message));
      return;
    }
    snackApi.printStatus().then(setData).catch((e) => setErr(e.message));
  }, [isOwner, loadOwnerTokens]));

  const ownerRows = useMemo(() => {
    if (!isOwner) return [];
    const norm = (v) => String(v || "").trim().toLowerCase();
    const tokensByKey = new Map();
    rows.forEach((row) => {
      const keys = [
        row?.user_id,
        norm(row?.user_email || row?.email),
        norm(row?.preferred_name || row?.name || row?.employee_name),
      ].filter(Boolean);
      keys.forEach((key) => {
        if (!tokensByKey.has(key)) tokensByKey.set(key, row);
      });
    });

    const merged = users.map((user) => {
      const token = tokensByKey.get(user.id)
        || tokensByKey.get(norm(user.email))
        || tokensByKey.get(norm(user.name));
      return {
        id: user.id,
        name: user.name || user.email || "User",
        email: user.email || "",
        token: token ? mergeMealTicketData(token, token) : null,
      };
    }).filter((row) => row.token);

    const query = norm(q);
    if (!query) return merged;
    return merged.filter((row) => `${row.name} ${row.email}`.toLowerCase().includes(query));
  }, [isOwner, q, rows, users]);

  return (
    <PantryScreen>
      <BackHeader title={isOwner ? "Meal tokens" : "Cabin print jobs"} navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <Err text={err} />
        {isOwner ? (
          <>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search user name or email"
              placeholderTextColor={SN.muted}
              style={styles.input}
            />
            <Text style={styles.meta}>
              Tap a user to open their lunch token for today.
            </Text>
            {(ownerRows || []).map((row) => (
              <Pressable key={row.id} style={styles.row} onPress={() => setSelected(row)}>
                <Text style={styles.rowT}>{row.name}</Text>
                <Text style={styles.meta}>
                  {row.email || "No email"} · Token {row.token?.token_number || row.token?.token || row.token?.code || row.token?.id || "pending"}
                </Text>
              </Pressable>
            ))}
            {!ownerRows.length && !err ? (
              <Text style={styles.meta}>No user meal tokens found for today.</Text>
            ) : null}
            <MealTicketSheet
              visible={!!selected}
              onClose={() => setSelected(null)}
              token={{
                ...(selected?.token || {}),
                preferred_name:
                  selected?.name
                  || selected?.token?.preferred_name
                  || selected?.token?.name
                  || selected?.token?.user_name
                  || selected?.token?.employee_name
                  || "",
                cabin_name:
                  selected?.token?.cabin_name
                  || selected?.token?.cabin
                  || selected?.token?.location
                  || "",
              }}
            />
          </>
        ) : (
          <>
            <Text style={styles.meta}>{data ? JSON.stringify(data).slice(0, 400) : "No jobs yet."}</Text>
            <PrimaryBtn title="Trigger print batch" onPress={() => snackApi.triggerCabin().catch((e) => setErr(e.message))} style={{ marginTop: 16 }} />
          </>
        )}
      </ScrollView>
    </PantryScreen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: 12 },
  tapHint: { fontFamily: FONT.light, color: SN.muted, fontSize: 12, marginTop: 8, marginBottom: 14 },
  custom: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 14 },
  lbl: { fontFamily: FONT.medium, color: SN.ink, marginBottom: 8, marginTop: 4 },
  swatches: { flexDirection: "row", gap: 10, marginBottom: 12 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 3 },
  input: {
    height: 46, borderRadius: 14, backgroundColor: SN.beige, paddingHorizontal: 12,
    fontFamily: FONT.regular, color: SN.ink,
  },
  ownerBanner: { backgroundColor: SN.cream, borderRadius: 14, padding: 14, marginBottom: 12 },
  ownerBannerT: { fontFamily: FONT.medium, color: SN.ink, fontSize: 15 },
  row: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 8 },
  rowT: { fontFamily: FONT.medium, color: SN.ink },
  card: { backgroundColor: SN.cream, borderRadius: 14, padding: 14, marginTop: 8 },
  meta: { fontFamily: FONT.light, color: SN.muted, marginTop: 6 },
});
