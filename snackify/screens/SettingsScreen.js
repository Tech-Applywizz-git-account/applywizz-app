import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { useSnackAuth } from "../AuthContext";
import { useAuth } from "../../src/context/AuthContext";
import { SN } from "../data";
import { ROLE_LABEL } from "../theme";
import { LOCATIONS, SHIFTS, TONES } from "../constants";
import { PantryScreen, PrimaryBtn, Err } from "../ui";
import BackHeader from "../components/BackHeader";

const ALL_LOCATIONS = [...LOCATIONS, "Ask Every Time"];

export default function SettingsScreen({ navigation }) {
  const { profile, role, isOwner, prefs, updatePrefs, signOut, setPreferredName } = useSnackAuth();
  const { canImpersonate } = useAuth();
  const [loc, setLoc] = useState(prefs?.preferred_location || "");
  const [shift, setShift] = useState(prefs?.shift || "morning");
  const [tone, setTone] = useState(prefs?.notification_tone || "Professional");
  const [empCode, setEmpCode] = useState(prefs?.employee_code || "");
  const [username, setUsername] = useState(profile?.preferred_name || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setBusy(true);
    try {
      if (username.trim()) {
        await setPreferredName(username.trim(), { employee_code: empCode || undefined });
      }
      await updatePrefs({
        ...prefs,
        preferred_location: loc,
        shift,
        notification_tone: tone,
        employee_code: empCode || undefined,
        onboarding_completed: true,
      });
      setErr("");
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const openDaily = () => {
    const parent = navigation.getParent?.();
    if (parent?.navigate) parent.navigate("SnackifyDaily");
    else navigation.navigate("SnackifyDaily");
  };

  return (
    <PantryScreen>
      <BackHeader title="Settings" navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <View style={styles.card}>
          <Text style={styles.name}>{profile?.preferred_name || profile?.name || profile?.email || "Applywizzian"}</Text>
          <Text style={styles.meta}>{ROLE_LABEL[role] || role}</Text>
          <Text style={styles.meta}>{profile?.email || ""}</Text>
        </View>

        <Text style={styles.lbl}>Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Shown on home and your cafeteria card"
          placeholderTextColor={SN.muted}
          style={styles.input}
        />

        {isOwner ? (
          <Pressable style={styles.ownerLink} onPress={openDaily}>
            <Text style={styles.ownerLinkT}>Daily stock update</Text>
            <Text style={styles.meta}>Type pantry quantities manually</Text>
          </Pressable>
        ) : null}

        {canImpersonate ? (
          <Pressable
            style={styles.ownerLink}
            onPress={() => navigation.navigate("ViewAsUsers")}
          >
            <Text style={styles.ownerLinkT}>View as user</Text>
            <Text style={styles.meta}>Open Invoice / Snackify / Career as another person</Text>
          </Pressable>
        ) : null}

        <Text style={styles.lbl}>Preferred cabin</Text>
        <View style={styles.chips}>
          {ALL_LOCATIONS.map((l) => (
            <Pressable key={l} onPress={() => setLoc(l)} style={[styles.chip, loc === l && styles.chipOn]}>
              <Text style={[styles.chipTxt, loc === l && { color: "#fff" }]}>{l}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.lbl}>Shift</Text>
        <View style={styles.chips}>
          {SHIFTS.map((s) => (
            <Pressable key={s.id} onPress={() => setShift(s.id)} style={[styles.chip, shift === s.id && styles.chipOn]}>
              <Text style={[styles.chipTxt, shift === s.id && { color: "#fff" }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.lbl}>Notification tone</Text>
        <View style={styles.chips}>
          {TONES.map((t) => (
            <Pressable key={t.id} onPress={() => setTone(t.id)} style={[styles.chip, tone === t.id && styles.chipOn]}>
              <Text style={[styles.chipTxt, tone === t.id && { color: "#fff" }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.lbl}>Employee code</Text>
        <TextInput
          value={empCode}
          onChangeText={setEmpCode}
          placeholder="Optional"
          placeholderTextColor={SN.muted}
          style={styles.input}
        />

        <Err text={err} />
        <PrimaryBtn title="Save" onPress={save} loading={busy} style={{ marginTop: 16 }} />
        <PrimaryBtn outline title="Sign out" onPress={signOut} style={{ marginTop: 12 }} />
      </ScrollView>
    </PantryScreen>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: FONT.medium, fontSize: 26, color: SN.ink },
  card: { marginTop: 12, backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 8 },
  name: { fontFamily: FONT.medium, fontSize: 18, color: SN.ink },
  meta: { fontFamily: FONT.light, color: SN.muted, marginTop: 4 },
  ownerLink: {
    backgroundColor: SN.cream, borderRadius: 14, padding: 14, marginBottom: 8, marginTop: 4,
  },
  ownerLinkT: { fontFamily: FONT.medium, color: SN.ink, fontSize: 15 },
  lbl: { fontFamily: FONT.medium, color: SN.ink, marginTop: 18, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: "#fff", justifyContent: "center" },
  chipOn: { backgroundColor: SN.espresso },
  chipTxt: { fontFamily: FONT.medium, color: SN.ink, fontSize: 12 },
  input: {
    height: 46, borderRadius: 14, backgroundColor: "#fff", paddingHorizontal: 12,
    fontFamily: FONT.regular, color: SN.ink,
  },
});
