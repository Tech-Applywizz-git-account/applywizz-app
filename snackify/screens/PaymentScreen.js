import React, { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN, money } from "../data";
import BrownButton from "../components/BrownButton";
import { useSnackCart } from "../CartContext";

const METHODS = [
  { id: "card", label: "Credit / Debit Card", icon: "card-outline" },
  { id: "upi", label: "UPI", icon: "phone-portrait-outline" },
  { id: "apple", label: "Apple Pay", icon: "logo-apple" },
  { id: "paypal", label: "PayPal", icon: "logo-paypal" },
  { id: "cod", label: "Cash on Delivery", icon: "cash-outline" },
];

export default function PaymentScreen({ navigation }) {
  const cart = useSnackCart();
  const [method, setMethod] = useState("card");
  const pay = () => {
    cart.place(method);
    navigation.replace("SnackifySuccess");
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SN.beige }} edges={["top"]}>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}><Ionicons name="arrow-back" size={20} color={SN.ink} /></Pressable>
        <Text style={styles.h}>Payment Method</Text>
      </View>
      <View style={{ padding: 18, flex: 1 }}>
        {METHODS.map((m) => {
          const on = method === m.id;
          return (
            <Pressable key={m.id} onPress={() => setMethod(m.id)} style={[styles.row, on && styles.rowOn]}>
              <Ionicons name={m.icon} size={20} color={SN.espresso} />
              <Text style={styles.lbl}>{m.label}</Text>
              <View style={[styles.radio, on && styles.radioOn]} />
            </Pressable>
          );
        })}
        {method === "card" ? (
          <View style={styles.form}>
            <Field ph="Card number" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Field ph="MM/YY" style={{ flex: 1 }} />
              <Field ph="CVV" style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 18 }}>
        <BrownButton title={`Pay ${money(cart.total || 9.77)}`} onPress={pay} />
      </View>
    </SafeAreaView>
  );
}

function Field({ ph, style }) {
  return (
    <TextInput
      placeholder={ph}
      placeholderTextColor={SN.muted}
      style={[{ height: 46, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, fontFamily: FONT.regular, marginBottom: 8, color: SN.ink }, style]}
    />
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 6 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  h: { fontFamily: FONT.medium, fontSize: 18, marginLeft: 10, color: SN.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 8 },
  rowOn: { borderWidth: 1.5, borderColor: SN.espresso },
  lbl: { flex: 1, fontFamily: FONT.medium, color: SN.ink },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: SN.line },
  radioOn: { backgroundColor: SN.espresso, borderColor: SN.espresso },
  form: { marginTop: 8 },
});
