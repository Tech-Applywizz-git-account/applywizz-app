import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";
import { stockLabel, imgSource } from "../catalog";
import { CoinPrice } from "./Coin";

export default function ProductCard({ item, onAdd, onPress, qty: cartQty }) {
  const [showOos, setShowOos] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [addGuard, setAddGuard] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const out = item?.stock != null && Number(item.stock) <= 0;
  const unavailable = !item?.available || out;

  useEffect(() => {
    if (!justAdded) return;
    scaleAnim.setValue(0);
    fadeAnim.setValue(1);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
      Animated.delay(800),
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setJustAdded(false));
  }, [justAdded]);

  const handleAdd = (e) => {
    e?.stopPropagation?.();
    if (unavailable) {
      setShowOos(true);
      return;
    }
    if (onAdd) onAdd();
    setJustAdded(true);
  };

  const onCardPress = () => {
    if (addGuard) { setAddGuard(false); return; }
    if (unavailable) { setShowOos(true); return; }
    if (onPress) onPress();
  };

  return (
    <>
      <Pressable onPress={onCardPress} style={styles.card}>
        <View>
          <Image source={imgSource(item.img)} style={styles.img} />
          {/* "Added!" overlay */}
          {justAdded ? (
            <Animated.View
              style={[styles.addedOverlay, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
              pointerEvents="none"
            >
              <View style={styles.addedBubble}>
                <Ionicons name="checkmark-circle" size={28} color="#fff" />
                <Text style={styles.addedText}>Added!</Text>
              </View>
            </Animated.View>
          ) : null}
        </View>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            {Number(item.coinPrice) > 0 ? (
              <CoinPrice amount={item.coinPrice} size={14} color={SN.ink} suffix="coins" />
            ) : null}
            <Text style={[styles.meta, out && { color: "#B42318" }]}>{stockLabel(item)}</Text>
          </View>
          <View style={styles.addRow}>
            {cartQty > 0 ? (
              <View style={styles.qtyBadge}>
                <Text style={styles.qtyBadgeTxt}>{cartQty}</Text>
              </View>
            ) : null}
            <Pressable
              onPressIn={() => setAddGuard(true)}
              onPress={handleAdd}
              style={({ pressed }) => [
                styles.plus,
                unavailable && styles.plusOff,
                pressed && !unavailable && styles.plusPressed,
              ]}
              hitSlop={8}
            >
              <Ionicons name={unavailable ? "close" : "add"} size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Pressable>

      <Modal visible={showOos} transparent animationType="fade" onRequestClose={() => setShowOos(false)}>
        <Pressable style={styles.veil} onPress={() => setShowOos(false)}>
          <View style={styles.popup}>
            <View style={styles.oosIcon}>
              <Ionicons name="cafe-outline" size={40} color={SN.espresso} />
            </View>
            <Text style={styles.oosTitle}>
              {out ? "Out of stock" : "Not available"}
            </Text>
            <Text style={styles.oosMsg}>
              {out
                ? `${item.name} is currently out of stock. The pantry team is working on restocking it soon!`
                : `${item.name} isn't available right now. Check back later or ask the pantry team.`}
            </Text>
            <Pressable onPress={() => setShowOos(false)} style={styles.oosBtn}>
              <Text style={styles.oosBtnTxt}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SN.card,
    borderRadius: 18,
    padding: 10,
    width: "48%",
    marginBottom: 12,
    shadowColor: "#3C2415",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  img: {
    width: "100%",
    height: 92,
    borderRadius: 14,
    backgroundColor: SN.line,
  },
  addedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    backgroundColor: "rgba(60,36,21,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  addedBubble: { alignItems: "center" },
  addedText: { fontFamily: FONT.medium, color: "#fff", fontSize: 14, marginTop: 2 },
  name: { fontFamily: FONT.medium, fontSize: 14, color: SN.ink, marginTop: 8, minHeight: 18, marginBottom: 2 },
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 6 },
  meta: { fontFamily: FONT.regular, fontSize: 11, color: SN.muted, marginTop: 3 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  qtyBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: SN.green, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  qtyBadgeTxt: { fontFamily: FONT.medium, color: "#fff", fontSize: 11 },
  plus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: SN.espresso,
    alignItems: "center",
    justifyContent: "center",
  },
  plusPressed: {
    backgroundColor: "#5A3420",
    transform: [{ scale: 0.9 }],
  },
  plusOff: {
    backgroundColor: "#C4A68A",
  },
  veil: { flex: 1, backgroundColor: "rgba(44,24,16,0.45)", justifyContent: "center", alignItems: "center", padding: 30 },
  popup: { backgroundColor: "#fff", borderRadius: 24, padding: 28, width: "100%", alignItems: "center" },
  oosIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: SN.beige, alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  oosTitle: { fontFamily: FONT.medium, fontSize: 20, color: SN.ink, marginBottom: 8 },
  oosMsg: { fontFamily: FONT.regular, fontSize: 14, color: SN.muted, textAlign: "center", lineHeight: 21, marginBottom: 20 },
  oosBtn: {
    height: 44, borderRadius: 14, backgroundColor: SN.espresso,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 32,
  },
  oosBtnTxt: { fontFamily: FONT.medium, color: "#fff", fontSize: 14 },
});
