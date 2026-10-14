import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";
import ProductCard from "../components/ProductCard";
import CartBar from "../components/CartBar";
import { useSnackCart } from "../CartContext";
import { useSnackMenu } from "../MenuContext";

const FILTERS = ["All", "Hot", "Cold"];

export default function CategoryScreen({ navigation, route }) {
  const cart = useSnackCart();
  const menu = useSnackMenu();
  const cat = route.params?.cat || menu.cats[0]?.id || "Coffee";
  const [filter, setFilter] = useState("All");
  const items = useMemo(() => {
    let list = (menu.items || []).filter((p) => p.cat === cat && p.available !== false);
    if (filter === "Hot" || filter === "Cold") list = list.filter((p) => p.tag === filter);
    return list;
  }, [cat, filter, menu.items]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SN.beige }} edges={["top"]}>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={SN.ink} />
        </Pressable>
        <Text style={styles.title}>{cat}</Text>
        <Pressable onPress={() => navigation.navigate("SnackifyCart")} style={styles.iconBtn}>
          <Ionicons name="bag-outline" size={20} color={SN.ink} />
        </Pressable>
      </View>
      <View style={styles.chipWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => {
            const on = f === filter;
            return (
              <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipTxt, on && { color: "#fff" }]}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={[styles.grid, cart.count ? { paddingBottom: 88 } : null]}>
        {items.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              qty={(cart.lines || []).filter((l) => l.id === item.id).reduce((s, l) => s + l.qty, 0)}
              onPress={() => navigation.navigate("SnackifyProduct", { id: item.id })}
              onAdd={() =>
                item.isSandwich
                  ? navigation.navigate("SnackifyProduct", { id: item.id })
                  : cart.add(item)
              }
            />
        ))}
        {!items.length ? (
          <Text style={{ fontFamily: FONT.light, color: SN.muted, width: "100%", marginTop: 12 }}>
            Nothing in this category right now.
          </Text>
        ) : null}
      </ScrollView>
      <CartBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontFamily: FONT.medium, fontSize: 18, color: SN.ink },
  chipWrap: { height: 46 },
  chips: { paddingHorizontal: 16, gap: 8, flexDirection: "row", alignItems: "center" },
  chip: { paddingHorizontal: 16, height: 34, borderRadius: 17, backgroundColor: "#fff", justifyContent: "center" },
  chipOn: { backgroundColor: SN.espresso },
  chipTxt: { fontFamily: FONT.medium, fontSize: 13, color: SN.ink },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 24 },
});
