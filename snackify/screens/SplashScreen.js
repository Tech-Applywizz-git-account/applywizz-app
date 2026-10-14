import React, { useEffect } from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";

const BG = "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1400&q=80";
export const SNACKIFY_ONBOARDED = "snackify.onboarded";

export function snackifyOnboardKey(email) {
  const e = String(email || "").trim().toLowerCase();
  return e ? `${SNACKIFY_ONBOARDED}.${e}` : SNACKIFY_ONBOARDED;
}

export async function hasSnackifyOnboarded(email) {
  try {
    const keys = [SNACKIFY_ONBOARDED];
    const perUser = snackifyOnboardKey(email);
    if (perUser !== SNACKIFY_ONBOARDED) keys.push(perUser);
    const pairs = await AsyncStorage.multiGet(keys);
    return pairs.some(([, v]) => v === "1" || v === "true");
  } catch {
    return false;
  }
}

export async function markSnackifyOnboarded(email) {
  const ops = [[SNACKIFY_ONBOARDED, "1"]];
  const perUser = snackifyOnboardKey(email);
  if (perUser !== SNACKIFY_ONBOARDED) ops.push([perUser, "1"]);
  await AsyncStorage.multiSet(ops);
}

export default function SplashScreen({ navigation, hold }) {
  useEffect(() => {
    if (hold || !navigation?.replace) return undefined;
    let timer;
    let cancelled = false;
    (async () => {
      try {
        const done = await hasSnackifyOnboarded();
        if (cancelled) return;
        if (done) {
          navigation.replace("SnackifyTabs");
          return;
        }
      } catch (_) {
        /* first visit */
      }
      timer = setTimeout(() => {
        if (!cancelled) navigation.replace("SnackifyOnboard");
      }, 1800);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [navigation, hold]);

  return (
    <ImageBackground source={{ uri: BG }} style={styles.bg} resizeMode="cover">
      <View style={styles.veil} />
      <View style={styles.brand}>
        <View style={styles.mark}>
          <Ionicons name="cafe" size={36} color="#fff" />
        </View>
        <Text style={styles.name}>Applywizz</Text>
        <Text style={styles.tag}>Office pantry · desk delivery · lunch tokens</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, justifyContent: "center", alignItems: "center" },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(42,24,16,0.72)" },
  brand: { alignItems: "center" },
  mark: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  name: { fontFamily: FONT.medium, fontSize: 36, color: "#fff", letterSpacing: 0.4 },
  tag: { fontFamily: FONT.light, fontSize: 13, color: "rgba(255,255,255,0.78)", marginTop: 8 },
});
