import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";
import { PantryScreen, PrimaryBtn, Err } from "../ui";
import { useSnackAuth } from "../AuthContext";
import {
  LOCATIONS, SHIFTS, TONES,
  ONBOARDING_DRINKS, ONBOARDING_SNACKS,
} from "../constants";

const ALL_LOCATIONS = [...LOCATIONS, "Ask Every Time"];

export default function PantryOnboardScreen({ onDone }) {
  const auth = useSnackAuth();
  const [step, setStep] = useState(0);
  const [loc, setLoc] = useState("");
  const [shift, setShift] = useState("morning");
  const [drinks, setDrinks] = useState([]);
  const [snacks, setSnacks] = useState([]);
  const [tone, setTone] = useState("Professional");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleDrink = (d) => setDrinks((p) => {
    if (d === "None for me") return ["None for me"];
    const without = p.filter((x) => x !== "None for me");
    return without.includes(d) ? without.filter((x) => x !== d) : [...without, d];
  });

  const toggleSnack = (s) => setSnacks((p) =>
    p.includes(s) ? p.filter((x) => x !== s) : [...p, s],
  );

  const finish = async () => {
    if (!loc) { setErr("Pick a cabin"); return; }
    setBusy(true);
    try {
      const prefs = {
        preferred_location: loc,
        shift,
        preferred_drinks: drinks,
        preferred_snacks: snacks,
        notification_tone: tone,
        onboarding_completed: true,
      };
      await auth.updatePrefs(prefs);
      if (onDone) await onDone();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const pages = [
    /* 0: Location */
    <>
      <Text style={styles.h}>Where do you sit?</Text>
      <Text style={styles.sub}>We'll deliver to this cabin by default.</Text>
      <View style={styles.chips}>
        {ALL_LOCATIONS.map((l) => (
          <Pressable key={l} onPress={() => setLoc(l)} style={[styles.chip, loc === l && styles.chipOn]}>
            <Text style={[styles.chipTxt, loc === l && { color: "#fff" }]}>{l}</Text>
          </Pressable>
        ))}
      </View>
    </>,
    /* 1: Shift */
    <>
      <Text style={styles.h}>Your shift</Text>
      <View style={styles.chips}>
        {SHIFTS.map((s) => (
          <Pressable key={s.id} onPress={() => setShift(s.id)} style={[styles.chip, shift === s.id && styles.chipOn]}>
            <Text style={[styles.chipTxt, shift === s.id && { color: "#fff" }]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
    </>,
    /* 2: Drinks */
    <>
      <Text style={styles.h}>Pick your drinks</Text>
      <View style={styles.chips}>
        {ONBOARDING_DRINKS.map((d) => {
          const on = drinks.includes(d);
          return (
            <Pressable key={d} onPress={() => toggleDrink(d)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipTxt, on && { color: "#fff" }]}>{d}</Text>
            </Pressable>
          );
        })}
      </View>
    </>,
    /* 3: Snacks */
    <>
      <Text style={styles.h}>Pick your snacks</Text>
      <View style={styles.chips}>
        {ONBOARDING_SNACKS.map((s) => {
          const on = snacks.includes(s);
          return (
            <Pressable key={s} onPress={() => toggleSnack(s)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipTxt, on && { color: "#fff" }]}>{s}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setSnacks([])} style={[styles.chip, !snacks.length && styles.chipOn]}>
          <Text style={[styles.chipTxt, !snacks.length && { color: "#fff" }]}>No Snacks</Text>
        </Pressable>
      </View>
    </>,
    /* 4: Tone */
    <>
      <Text style={styles.h}>Notification tone</Text>
      <View style={styles.chips}>
        {TONES.map((t) => (
          <Pressable key={t.id} onPress={() => setTone(t.id)} style={[styles.chip, tone === t.id && styles.chipOn]}>
            <Text style={[styles.chipTxt, tone === t.id && { color: "#fff" }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </>,
  ];

  const last = step === pages.length - 1;

  return (
    <PantryScreen>
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
        <Text style={styles.kicker}>ONBOARDING · {step + 1}/{pages.length}</Text>
        {pages[step]}
        <Err text={err} />
        <View style={styles.nav}>
          {step > 0 ? (
            <PrimaryBtn outline title="Back" onPress={() => setStep(step - 1)} style={{ flex: 1, marginRight: 8 }} />
          ) : <View style={{ flex: 1 }} />}
          <PrimaryBtn
            title={last ? "Finish" : "Next"}
            onPress={last ? finish : () => setStep(step + 1)}
            loading={busy}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </PantryScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: FONT.medium, color: SN.espresso, letterSpacing: 1.4, fontSize: 11, marginBottom: 8 },
  h: { fontFamily: FONT.medium, fontSize: 26, color: SN.ink, marginBottom: 8 },
  sub: { fontFamily: FONT.light, color: SN.muted, marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 14, height: 38, borderRadius: 19, backgroundColor: "#fff", justifyContent: "center" },
  chipOn: { backgroundColor: SN.espresso },
  chipTxt: { fontFamily: FONT.medium, color: SN.ink, fontSize: 13 },
  nav: { flexDirection: "row", marginTop: 24 },
});
