import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { ADDRESSES, SN } from "../data";
import BrownButton from "../components/BrownButton";
import { useSnackCart } from "../CartContext";

export default function AddressScreen({ navigation }) {
  const cart = useSnackCart();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SN.beige }} edges={["top"]}>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}><Ionicons name="arrow-back" size={20} color={SN.ink} /></Pressable>
        <Text style={styles.h}>Delivery Address</Text>
      </View>
      <View style={{ padding: 18, flex: 1 }}>
        {ADDRESSES.map((a) => {
          const on = cart.addressId === a.id;
          return (
            <Pressable key={a.id} onPress={() => cart.setAddressId(a.id)} style={styles.card}>
              <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.dot} /> : null}</View>
              <View>
                <Text style={styles.lbl}>{a.label}</Text>
                <Text style={styles.line}>{a.line}</Text>
              </View>
            </Pressable>
          );
        })}
        <Pressable style={styles.add}><Ionicons name="add" size={18} color={SN.espresso} /><Text style={styles.addTxt}>Add New Address</Text></Pressable>
      </View>
      <View style={{ padding: 18 }}>
        <BrownButton title="Deliver Here" onPress={() => navigation.navigate("SnackifyPayment")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 6 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  h: { fontFamily: FONT.medium, fontSize: 18, marginLeft: 10, color: SN.ink },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, gap: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: SN.line, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: SN.espresso },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: SN.espresso },
  lbl: { fontFamily: FONT.medium, color: SN.ink },
  line: { fontFamily: FONT.light, color: SN.muted, marginTop: 2, fontSize: 13 },
  add: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8 },
  addTxt: { fontFamily: FONT.medium, color: SN.espresso },
});
