import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";
import { markSnackifyOnboarded } from "./SplashScreen";

const LATTE = "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=900&q=80";

export default function OnboardScreen({ navigation }) {
  const next = async () => {
    try {
      await markSnackifyOnboarded();
    } catch (_) {
      /* ignore */
    }
    navigation.replace("SnackifyTabs");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SN.beige }} edges={["top", "bottom"]}>
      <View style={styles.top}>
        <Text style={styles.hello}>Good Morning!</Text>
        <Text style={styles.line}>Tea, snacks, and lunch{"\n"}tokens at your desk.</Text>
      </View>
      <View style={styles.heroWrap}>
        <Image source={{ uri: LATTE }} style={styles.hero} />
      </View>
      <View style={styles.bottom}>
        <Pressable onPress={next} style={styles.next}>
          <Text style={styles.nextTxt}>Next</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 28, paddingTop: 28 },
  hello: { fontFamily: FONT.medium, fontSize: 28, color: SN.ink },
  line: { fontFamily: FONT.light, fontSize: 18, color: SN.brown, marginTop: 8, lineHeight: 26 },
  heroWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { width: 260, height: 260, borderRadius: 130, backgroundColor: SN.line },
  bottom: { padding: 22, alignItems: "flex-end" },
  next: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: SN.espresso,
    height: 52,
    paddingHorizontal: 22,
    borderRadius: 26,
  },
  nextTxt: { fontFamily: FONT.medium, color: "#fff", fontSize: 15 },
});
