import React, { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";
import BrownButton from "../components/BrownButton";
import { useSnackCart } from "../CartContext";
import { useSnackMenu } from "../MenuContext";
import { useSnackAuth } from "../AuthContext";
import { stockLabel, imgSource } from "../catalog";
import { CoinPrice } from "../components/Coin";

export default function ProductDetailScreen({ navigation, route }) {
  const cart = useSnackCart();
  const menu = useSnackMenu();
  const { isOwner } = useSnackAuth();
  const item = menu.byId(route.params?.id) || menu.items[0];
  const [qty, setQty] = useState(1);
  const [qtyText, setQtyText] = useState("1");
  const [added, setAdded] = useState(false);
  const [bread, setBread] = useState(item?.breadOptions?.[0] || "");
  const [sides, setSides] = useState("one");
  const [customNote, setCustomNote] = useState("");

  useEffect(() => {
    if (!bread && item?.breadOptions?.length) setBread(item.breadOptions[0]);
  }, [item?.id, item?.breadOptions, bread]);

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: SN.beige, padding: 24 }} edges={["top"]}>
        <Text style={{ fontFamily: FONT.medium, color: SN.ink }}>Item not on the menu.</Text>
      </SafeAreaView>
    );
  }

  const applyQty = (n) => {
    const next = Math.max(1, Math.min(999, Number(n) || 1));
    setQty(next);
    setQtyText(String(next));
    return next;
  };

  const add = () => {
    const finalQty = isOwner ? applyQty(qtyText) : qty;
    cart.add(item, {
      qty: finalQty,
      breadType: item.isSandwich ? bread : "",
      sides: item.isSandwich ? sides : "",
      customNote,
    });
    setAdded(true);
  };

  const unavailable = !item.available || (item.stock != null && Number(item.stock) <= 0);

  return (
    <View style={{ flex: 1, backgroundColor: SN.beige }}>
      <Image source={imgSource(item.img)} style={styles.hero} />
      <SafeAreaView style={styles.backWrap} edges={["top"]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={SN.ink} />
        </Pressable>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 }}>
          {Number(item.coinPrice) > 0 ? (
            <CoinPrice amount={item.coinPrice} size={20} color={SN.ink} suffix="coins" />
          ) : null}
        </View>
        <Text style={[styles.stock, unavailable && { color: "#B42318" }]}>{stockLabel(item)}</Text>
        {item.desc ? <Text style={styles.desc}>{item.desc}</Text> : null}

        {item.isSandwich ? (
          <>
            <Text style={styles.lbl}>Bread</Text>
            <View style={styles.pills}>
              {(item.breadOptions || []).map((b) => (
                <Pressable key={b} onPress={() => setBread(b)} style={[styles.pill, bread === b && styles.pillOn]}>
                  <Text style={[styles.pillTxt, bread === b && { color: "#fff" }]}>{b}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.lbl}>Sides</Text>
            <View style={styles.pills}>
              {["one", "both"].map((s) => (
                <Pressable key={s} onPress={() => setSides(s)} style={[styles.pill, sides === s && styles.pillOn]}>
                  <Text style={[styles.pillTxt, sides === s && { color: "#fff" }]}>{s === "one" ? "One side" : "Both sides"}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <TextInput
          value={customNote}
          onChangeText={setCustomNote}
          placeholder="Custom note (optional)"
          placeholderTextColor={SN.muted}
          style={styles.noteInput}
        />
        <Text style={styles.hint}>
          {isOwner
            ? "Owner: type any quantity below, then add to cart."
            : `Add for ${qty * (item.coinPrice || 0)} coins`}
        </Text>
      </ScrollView>
      <View style={styles.bar}>
        <View style={styles.qty}>
          <Pressable onPress={() => applyQty(qty - 1)}>
            <Ionicons name="remove" size={18} color={SN.ink} />
          </Pressable>
          {isOwner ? (
            <TextInput
              value={qtyText}
              onChangeText={(t) => setQtyText(t.replace(/[^0-9]/g, "").slice(0, 3))}
              onBlur={() => applyQty(qtyText)}
              keyboardType="number-pad"
              selectTextOnFocus
              style={styles.qtyInput}
            />
          ) : (
            <Text style={styles.qtyN}>{qty}</Text>
          )}
          <Pressable onPress={() => applyQty(qty + 1)}>
            <Ionicons name="add" size={18} color={SN.ink} />
          </Pressable>
        </View>
        <BrownButton
          title={unavailable ? "Unavailable" : `Add · ${qty * (item.coinPrice || 0)} coins`}
          onPress={add}
          style={{ flex: 1, ...(unavailable ? { opacity: 0.5 } : {}) }}
        />
      </View>

      <Modal visible={added} transparent animationType="fade">
        <View style={styles.modalVeil}>
          <View style={styles.modal}>
            <View style={styles.confetti}><Ionicons name="checkmark-circle" size={64} color={SN.green} /></View>
            <Text style={styles.modalTitle}>Added to cart</Text>
            <Text style={styles.modalCopy}>{item.name} is in your bag.</Text>
            <BrownButton outline title="Continue" onPress={() => { setAdded(false); navigation.goBack(); }} />
            <BrownButton title="Go to Cart" onPress={() => { setAdded(false); navigation.navigate("SnackifyCart"); }} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", height: 280, backgroundColor: SN.line },
  backWrap: { position: "absolute", top: 0, left: 12 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  name: { fontFamily: FONT.medium, fontSize: 24, color: SN.ink },
  inrEq: { fontFamily: FONT.regular, fontSize: 14, color: SN.muted },
  stock: { fontFamily: FONT.medium, fontSize: 14, color: SN.espresso, marginTop: 6 },
  desc: { fontFamily: FONT.light, fontSize: 14, color: SN.muted, marginTop: 8, lineHeight: 21 },
  lbl: { fontFamily: FONT.medium, fontSize: 14, color: SN.ink, marginTop: 18, marginBottom: 8 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 16, height: 36, borderRadius: 18, backgroundColor: "#fff", justifyContent: "center" },
  pillOn: { backgroundColor: SN.espresso },
  pillTxt: { fontFamily: FONT.medium, fontSize: 13, color: SN.ink },
  noteInput: {
    height: 46, borderRadius: 14, backgroundColor: "#fff", paddingHorizontal: 12,
    fontFamily: FONT.regular, color: SN.ink, marginTop: 16,
  },
  hint: { fontFamily: FONT.light, fontSize: 13, color: SN.brown, marginTop: 12, lineHeight: 20 },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, padding: 16, backgroundColor: SN.beige },
  qty: { height: 52, width: 120, borderRadius: 16, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  qtyN: { fontFamily: FONT.medium, fontSize: 16, color: SN.ink, minWidth: 28, textAlign: "center" },
  qtyInput: {
    fontFamily: FONT.medium, fontSize: 16, color: SN.ink, minWidth: 36, maxWidth: 48,
    textAlign: "center", paddingVertical: 0, paddingHorizontal: 2,
  },
  modalVeil: { flex: 1, backgroundColor: "rgba(44,24,16,0.4)", justifyContent: "center", padding: 24 },
  modal: { backgroundColor: "#fff", borderRadius: 24, padding: 22 },
  confetti: { alignItems: "center", marginBottom: 8 },
  modalTitle: { fontFamily: FONT.medium, fontSize: 22, color: SN.ink, textAlign: "center" },
  modalCopy: { fontFamily: FONT.light, color: SN.muted, textAlign: "center", marginTop: 6, marginBottom: 18 },
});
