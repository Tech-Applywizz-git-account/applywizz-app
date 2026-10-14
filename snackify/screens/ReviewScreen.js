import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";
import BrownButton from "../components/BrownButton";
import { snackApi } from "../api";
import BackHeader from "../components/BackHeader";

export default function ReviewScreen({ navigation, route }) {
  const [stars, setStars] = useState(5);
  const [err, setErr] = useState("");
  const id = route.params?.id;

  const done = async () => {
    try {
      if (id) await snackApi.rateRequest(id, stars);
      navigation.navigate("SnackifyTabs");
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SN.beige }} edges={["top"]}>
      <BackHeader title="Rate your order" navigation={navigation} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Ionicons name="gift-outline" size={64} color={SN.espresso} />
        <Text style={styles.h}>Enjoy your snack!</Text>
        <Text style={styles.copy}>Thank you for ordering with Applywizz pantry.</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setStars(n)}>
              <Ionicons name={n <= stars ? "star" : "star-outline"} size={28} color="#E8C56B" />
            </Pressable>
          ))}
        </View>
        {err ? <Text style={styles.err}>{err}</Text> : null}
      </View>
      <BrownButton title="Done" onPress={done} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: FONT.medium, fontSize: 26, color: SN.ink, marginTop: 16 },
  copy: { fontFamily: FONT.light, color: SN.muted, marginTop: 8 },
  stars: { flexDirection: "row", gap: 8, marginTop: 20 },
  err: { fontFamily: FONT.regular, color: "#B42318", marginTop: 12 },
});
