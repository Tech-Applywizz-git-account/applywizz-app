import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";
import ProductCard from "../components/ProductCard";
import { useSnackCart } from "../CartContext";
import { useSnackMenu } from "../MenuContext";
import { useSnackAuth } from "../AuthContext";
import { imgSource } from "../catalog";
import AssistiveAppSwitch from "../../src/components/AssistiveAppSwitch";
import { useSnackTokens } from "../TokenContext";
import Coin from "../components/Coin";
import CartBar from "../components/CartBar";
import SupportTicketSheet, { HeadsetButton } from "../components/SupportTicketSheet";
import MealTicketSheet, { TicketButton } from "../components/MealTicketSheet";
import { snackApi } from "../api";
import {
  LOCATIONS,
  formatIstDateLabel,
  hasMealTicketToken,
  isAfterMealTicketWindow,
  isBeforeMealTicketWindow,
  isMealTicketWindow,
  istDateString,
  mergeMealTicketData,
  nextWorkingIstDate,
  unwrapMealTokenPayload,
} from "../constants";
import { displayFirstName, nameFontSize } from "../displayName";

const SCREEN_W = Dimensions.get("window").width;
const BANNER_W = SCREEN_W - 36;

const BANNER_COLORS = ["#3C2415", "#1B4332", "#7C2D12", "#1E3A5F", "#4A1942"];
const BANNER_ICONS = ["cafe", "leaf", "nutrition", "restaurant", "flame"];

function buildBanners(items, navigation) {
  const banners = [];

  banners.push({
    id: "meal",
    kicker: "LUNCH TOKEN",
    title: "Book lunch for\ntomorrow",
    cta: "Book meal",
    color: "#3C2415",
    img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80",
    onPress: () => navigation.navigate("SnackifyMealsTab"),
  });

  const inStock = (items || []).filter(
    (i) => i.available && i.stock != null && Number(i.stock) > 10,
  );
  if (inStock.length) {
    const top = inStock[0];
    banners.push({
      id: "stock-" + top.id,
      kicker: "FULLY STOCKED",
      title: `${top.name}\nis ready for you`,
      cta: "Order now",
      color: "#1B4332",
      img: typeof top.img === "number" ? null : top.img,
      localImg: typeof top.img === "number" ? top.img : null,
      onPress: () => navigation.navigate("SnackifyProduct", { id: top.id }),
    });
  }

  const teas = (items || []).filter((i) => i.cat === "tea" && i.available);
  if (teas.length) {
    banners.push({
      id: "tea-pick",
      kicker: "TEA TIME",
      title: `${teas.length} fresh teas\nbrewing today`,
      cta: "Explore teas",
      color: "#7C2D12",
      img: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80",
      onPress: () => navigation.navigate("SnackifyCategory", { cat: "tea" }),
    });
  }

  const coffees = (items || []).filter((i) => i.cat === "caffeine" && i.available);
  if (coffees.length) {
    banners.push({
      id: "coffee-pick",
      kicker: "CAFFEINE FIX",
      title: `${coffees.length} coffees\nto energize your day`,
      cta: "Browse coffees",
      color: "#1E3A5F",
      img: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80",
      onPress: () => navigation.navigate("SnackifyCategory", { cat: "caffeine" }),
    });
  }

  const sandwiches = (items || []).filter((i) => i.isSandwich && i.available);
  if (sandwiches.length) {
    const sw = sandwiches[0];
    banners.push({
      id: "food-pick",
      kicker: "HUNGRY?",
      title: `${sw.name}\nfreshly made`,
      cta: "Order sandwich",
      color: "#4A1942",
      img: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80",
      onPress: () => navigation.navigate("SnackifyProduct", { id: sw.id }),
    });
  }

  while (banners.length < 3) {
    banners.push({
      id: "pantry-" + banners.length,
      kicker: "OFFICE PANTRY",
      title: "Pay with\nSnackify coins",
      cta: "Browse menu",
      color: BANNER_COLORS[banners.length % BANNER_COLORS.length],
      img: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80",
      onPress: () => {},
    });
  }

  return banners.slice(0, 5);
}

function BannerCarousel({ items, navigation }) {
  const banners = useMemo(() => buildBanners(items, navigation), [items, navigation]);
  const flatRef = useRef(null);
  const indexRef = useRef(0);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (indexRef.current + 1) % banners.length;
      indexRef.current = next;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
    }, 2000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const onScroll = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / BANNER_W);
    if (idx !== indexRef.current) {
      indexRef.current = idx;
      setActiveIdx(idx);
    }
  }, []);

  const renderBanner = useCallback(({ item: b }) => (
    <Pressable onPress={b.onPress} style={[bStyles.banner, { backgroundColor: b.color }]}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={bStyles.kicker}>{b.kicker}</Text>
        <Text style={bStyles.title}>{b.title}</Text>
        <View style={bStyles.cta}>
          <Text style={bStyles.ctaTxt}>{b.cta}</Text>
        </View>
      </View>
      {b.localImg ? (
        <Image source={b.localImg} style={bStyles.img} />
      ) : b.img ? (
        <Image source={{ uri: b.img }} style={bStyles.img} />
      ) : null}
    </Pressable>
  ), []);

  return (
    <View style={bStyles.wrap}>
      <FlatList
        ref={flatRef}
        data={banners}
        keyExtractor={(b) => b.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={BANNER_W}
        decelerationRate="fast"
        contentContainerStyle={{ gap: 0 }}
        getItemLayout={(_, i) => ({ length: BANNER_W, offset: BANNER_W * i, index: i })}
        onScroll={onScroll}
        scrollEventThrottle={64}
        renderItem={renderBanner}
      />
      <View style={bStyles.dots}>
        {banners.map((_, i) => (
          <View key={i} style={[bStyles.dot, i === activeIdx && bStyles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

const bStyles = StyleSheet.create({
  wrap: { marginHorizontal: 18, marginTop: 16 },
  banner: {
    width: BANNER_W, borderRadius: 22,
    padding: 16, flexDirection: "row", alignItems: "center", overflow: "hidden", minHeight: 132,
  },
  kicker: { fontFamily: FONT.medium, color: "#E8C56B", fontSize: 11, letterSpacing: 1 },
  title: { fontFamily: FONT.medium, color: "#fff", fontSize: 18, marginTop: 6, lineHeight: 24 },
  cta: {
    marginTop: 12, alignSelf: "flex-start", backgroundColor: "#fff",
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7,
  },
  ctaTxt: { fontFamily: FONT.medium, color: "#3C2415", fontSize: 12 },
  img: { width: 100, height: 100, borderRadius: 50 },
  dots: { flexDirection: "row", justifyContent: "center", marginTop: 10, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D4C5B5" },
  dotOn: { backgroundColor: SN.espresso, width: 18 },
});

function recentOrderNames(orders) {
  const names = [];
  const seen = new Set();
  const push = (raw) => {
    const n = String(raw || "").trim().toLowerCase();
    if (!n || seen.has(n)) return;
    seen.add(n);
    names.push(n);
  };
  for (const row of orders || []) {
    const items = row?.items || row?.order_items || [];
    if (Array.isArray(items)) {
      for (const i of items) push(i.name || i.item_name || i.display_name);
    }
    push(row?.quick_item);
  }
  return names;
}

function matchesRecent(item, recentNames) {
  const n = String(item?.name || "").toLowerCase();
  return recentNames.some((r) => n.includes(r) || r.includes(n));
}

export default function HomeScreen({ navigation }) {
  const cart = useSnackCart();
  const menu = useSnackMenu();
  const auth = useSnackAuth();
  const tokens = useSnackTokens();
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState(null);
  const [locOpen, setLocOpen] = useState(false);
  const [ticket, setTicket] = useState(false);
  const [mealToken, setMealToken] = useState(null);
  const [mealTicketOpen, setMealTicketOpen] = useState(false);
  const [inTicketWindow, setInTicketWindow] = useState(() => isMealTicketWindow());
  const [recentNames, setRecentNames] = useState([]);

  const refreshMealToken = useCallback(() => {
    setInTicketWindow(isMealTicketWindow());
    const today = istDateString();
    const previousDay = (() => {
      const [y, mo, da] = today.split("-").map(Number);
      const d = new Date(Date.UTC(y, mo - 1, da));
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    })();
    const fromCtx = tokens?.mealOptions?.booking
      && (tokens?.mealOptions?.meal_date || tokens?.mealOptions?.date) === today
      ? {
          ...tokens.mealOptions.booking,
          date: tokens.mealOptions.meal_date || tokens.mealOptions.date,
          meal_date: tokens.mealOptions.meal_date || tokens.mealOptions.date,
        }
      : null;

    Promise.all([
      snackApi.myToken().catch(() => null),
      snackApi.myToken(today).catch(() => null),
      auth?.isOwner ? snackApi.myToken(previousDay).catch(() => null) : Promise.resolve(null),
    ]).then(([tokenRes, tokenTodayRes, ownerPrevTokenRes]) => {
      let token = unwrapMealTokenPayload(tokenTodayRes) || unwrapMealTokenPayload(tokenRes);
      if (auth?.isOwner && !hasMealTicketToken(token)) {
        token = unwrapMealTokenPayload(ownerPrevTokenRes) || token;
      }
      const merged = mergeMealTicketData(token, fromCtx);
      if (merged) {
        if (!merged.preferred_name && !merged.name && !merged.user_name) {
          merged.preferred_name = auth?.profile?.name || auth?.profile?.preferred_name || "";
        }
        if (!merged.cabin_name && !merged.cabin) {
          merged.cabin_name = auth?.preferredLocation || "";
        }
      }
      setMealToken(hasMealTicketToken(merged) ? merged : null);
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log("[meal-ticket]", {
          today,
          previousDay,
          hasToken: !!token,
          ctxBooking: !!fromCtx,
          show: hasMealTicketToken(merged),
          isOwner: !!auth?.isOwner,
          inWindow: isMealTicketWindow(),
        });
      }
    });
  }, [auth?.isOwner, auth?.profile?.name, auth?.profile?.preferred_name, auth?.preferredLocation, tokens?.mealOptions]);

  useFocusEffect(useCallback(() => {
    menu.load();
    refreshMealToken();
    snackApi.listRequests().then((d) => {
      const list = d?.requests || d?.queue || d?.data || d || [];
      setRecentNames(recentOrderNames(Array.isArray(list) ? list : []));
    }).catch(() => {});
    const id = setInterval(refreshMealToken, 45_000);
    return () => clearInterval(id);
  }, [menu.load, refreshMealToken]));

  const goBookMeal = () => {
    const parent = navigation.getParent?.();
    if (parent?.navigate) parent.navigate("SnackifyMealsTab");
    else navigation.navigate("SnackifyMeals");
  };

  const onMealTicketPress = () => {
    if (auth?.isOwner && !mealToken) {
      Alert.alert("Meal ticket", "Open Meal token dashboard from More to search and view any user's token.");
      return;
    }
    const today = istDateString();
    const tomorrow = nextWorkingIstDate(today);
    const ticketDay = String(
      mealToken?.date || mealToken?.meal_date || mealToken?.booking_date || "",
    ).slice(0, 10);
    const hasToday = hasMealTicketToken(mealToken) && (!ticketDay || ticketDay === today);
    const hasTomorrow = hasMealTicketToken(mealToken) && ticketDay === tomorrow;
    const label = formatIstDateLabel(tomorrow);

    if (isMealTicketWindow() && hasToday) {
      setInTicketWindow(true);
      setMealTicketOpen(true);
      return;
    }

    if (hasTomorrow) {
      Alert.alert(
        "Meal token",
        `Your meal for ${label} is successfully booked. Kindly wait until ${label} 11:00 AM to get this meal token.`,
      );
      return;
    }

    if (isBeforeMealTicketWindow() && hasToday) {
      Alert.alert(
        "Meal token",
        "Your ordered ticket or token will be visible from 11:00 AM. Kindly wait.",
      );
      return;
    }

    if (isAfterMealTicketWindow() || isBeforeMealTicketWindow()) {
      Alert.alert(
        "Meal token",
        "Your token will be available if you book a meal for tomorrow. Tomorrow from 11:00 AM the token will be available.",
        [
          { text: "Close", style: "cancel" },
          { text: "Book meal", onPress: goBookMeal },
        ],
      );
      return;
    }

    Alert.alert(
      "Meal token",
      "No meal token for today. Book a meal to get a token from 11:00 AM.",
      [
        { text: "Close", style: "cancel" },
        { text: "Book meal", onPress: goBookMeal },
      ],
    );
  };

  const shown = useMemo(() => {
    const filtered = (menu.items || []).filter((p) => {
      if (!p.available) return false;
      if (activeCat && p.cat !== activeCat) return false;
      if (!q.trim()) return true;
      return p.name.toLowerCase().includes(q.trim().toLowerCase());
    });
    if (!recentNames.length) return filtered;
    const rank = new Map(recentNames.map((n, i) => [n, i]));
    return filtered.slice().sort((a, b) => {
      const ia = rank.has(a.name.toLowerCase())
        ? rank.get(a.name.toLowerCase())
        : (matchesRecent(a, recentNames) ? 500 : 9999);
      const ib = rank.has(b.name.toLowerCase())
        ? rank.get(b.name.toLowerCase())
        : (matchesRecent(b, recentNames) ? 500 : 9999);
      return ia - ib;
    });
  }, [menu.items, activeCat, q, recentNames]);

  const again = !q.trim() && !activeCat
    ? shown.filter((p) => matchesRecent(p, recentNames)).slice(0, 6)
    : [];
  const rest = again.length ? shown.filter((p) => !again.some((r) => r.id === p.id)) : shown;

  const cabin = cart.mode === "get_it_here"
    ? (cart.location || auth.preferredLocation || "Cabin")
    : "Self pickup";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SN.beige }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: cart.count ? 88 : 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={!!menu.loading} onRefresh={() => { menu.load(); refreshMealToken(); }} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            {(() => {
              const first = displayFirstName(auth?.profile);
              return (
                <Pressable onPress={() => navigation.navigate("SnackifyProfile")} hitSlop={6}>
                  <Text
                    numberOfLines={1}
                    style={[styles.userName, { fontSize: nameFontSize(first) }]}
                  >
                    {first}
                  </Text>
                </Pressable>
              );
            })()}
            <Text style={styles.deliverLbl}>
              {cart.mode === "get_it_here" ? "Deliver to" : "Pickup"}
            </Text>
            <Pressable style={styles.locRow} onPress={() => setLocOpen(!locOpen)}>
              <Text style={styles.loc} numberOfLines={1}>{cabin}</Text>
              <Ionicons name="chevron-down" size={14} color={SN.espresso} />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TicketButton onPress={onMealTicketPress} />
            <HeadsetButton onPress={() => setTicket(true)} />
            <Pressable onPress={() => navigation.navigate("SnackifyProfile")} style={styles.walletChip}>
              <Coin size={16} />
              <Text style={styles.tokenChip}>{tokens?.wallet?.balance ?? 0}</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate("SnackifyCart")} style={styles.bell}>
            <Ionicons name="bag-outline" size={20} color={SN.espresso} />
            {cart.count ? (
              <View style={styles.badge}><Text style={styles.badgeTxt}>{cart.count}</Text></View>
            ) : null}
          </Pressable>
          </View>
        </View>

        {locOpen ? (
          <View style={styles.locDrop}>
            {LOCATIONS.map((l) => (
              <Pressable key={l} onPress={() => { cart.setLocation(l); cart.setMode("get_it_here"); setLocOpen(false); }} style={styles.locItem}>
                <Text style={[styles.locItemTxt, cart.location === l && { color: SN.espresso, fontFamily: FONT.medium }]}>{l}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => { cart.setMode("self_pickup"); cart.setLocation(""); setLocOpen(false); }} style={styles.locItem}>
              <Text style={[styles.locItemTxt, cart.mode === "self_pickup" && { color: SN.espresso, fontFamily: FONT.medium }]}>Self pickup</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.search}>
          <Ionicons name="search" size={18} color={SN.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search tea, coffee, snacks..."
            placeholderTextColor={SN.muted}
            style={styles.searchIn}
          />
        </View>

        <BannerCarousel items={menu.items} navigation={navigation} />

        {menu.cats.length ? (
          <>
            <Text style={styles.section}>Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 12 }}>
              <Pressable style={[styles.catChip, !activeCat && styles.catChipOn]} onPress={() => setActiveCat(null)}>
                <Text style={[styles.catChipTxt, !activeCat && { color: "#fff" }]}>All</Text>
              </Pressable>
              {menu.cats.map((c) => (
                <Pressable key={c.id} style={[styles.catChip, activeCat === c.id && styles.catChipOn]} onPress={() => setActiveCat(c.id)}>
                  <Ionicons name={c.icon} size={16} color={activeCat === c.id ? "#fff" : SN.espresso} style={{ marginRight: 4 }} />
                  <Text style={[styles.catChipTxt, activeCat === c.id && { color: "#fff" }]}>{c.label || c.id}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        <View style={styles.rowBetween}>
          <Text style={styles.section}>{again.length ? "Order again" : "Pantry menu"}</Text>
        </View>
        {again.length ? (
          <>
            <View style={styles.grid}>
              {again.map((item) => (
                <ProductCard
                  key={`again-${item.id}`}
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
            </View>
            <Text style={styles.section}>All items</Text>
          </>
        ) : null}
        {menu.err ? (
          <View style={{ paddingHorizontal: 18, marginBottom: 8 }}>
            <Text style={styles.err}>{menu.err}</Text>
            <Pressable onPress={menu.load} style={{ marginTop: 6 }}>
              <Text style={{ fontFamily: FONT.medium, color: SN.espresso, fontSize: 13 }}>Tap to retry</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.grid}>
          {rest.map((item) => (
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
        </View>
        {!shown.length && !menu.loading && !menu.err ? (
          <Text style={styles.empty}>
            No cafeteria items yet. Pull down to refresh.
          </Text>
        ) : null}
      </ScrollView>
      <CartBar navigation={navigation} />
      <SupportTicketSheet visible={ticket} onClose={() => setTicket(false)} />
      <MealTicketSheet
        visible={mealTicketOpen}
        onClose={() => setMealTicketOpen(false)}
        token={{
          ...(mealToken || {}),
          preferred_name:
            mealToken?.preferred_name
            || mealToken?.name
            || mealToken?.user_name
            || mealToken?.employee_name
            || mealToken?.cardholder
            || auth?.profile?.name
            || auth?.profile?.preferred_name
            || tokens?.card?.display_name
            || tokens?.card?.cardholder
            || "",
          cabin_name:
            mealToken?.cabin_name
            || mealToken?.cabin
            || mealToken?.location
            || auth?.preferredLocation
            || "",
        }}
      />
      <AssistiveAppSwitch />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18, paddingTop: 6,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  userName: { fontFamily: FONT.medium, color: SN.ink, marginBottom: 2, maxWidth: 180 },
  deliverLbl: { fontFamily: FONT.light, fontSize: 11, color: SN.muted },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  loc: { fontFamily: FONT.medium, fontSize: 16, color: SN.ink, maxWidth: 180 },
  bell: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  tokenChip: { fontFamily: FONT.medium, fontSize: 12, color: SN.espresso, marginLeft: 4 },
  walletChip: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  badge: {
    position: "absolute", top: -4, right: -4, minWidth: 16, height: 16,
    borderRadius: 8, backgroundColor: SN.espresso, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  badgeTxt: { fontFamily: FONT.medium, color: "#fff", fontSize: 9 },
  locDrop: { marginHorizontal: 18, marginTop: 4, backgroundColor: "#fff", borderRadius: 14, padding: 6, elevation: 4 },
  locItem: { paddingVertical: 10, paddingHorizontal: 12 },
  locItemTxt: { fontFamily: FONT.regular, color: SN.ink, fontSize: 14 },
  search: {
    marginHorizontal: 18, marginTop: 14, height: 46, borderRadius: 14,
    backgroundColor: "#fff", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8,
  },
  searchIn: { flex: 1, fontFamily: FONT.regular, fontSize: 14, color: SN.ink },
  section: { fontFamily: FONT.medium, fontSize: 16, color: SN.ink, marginHorizontal: 18, marginTop: 20, marginBottom: 10 },
  catChip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: "#fff",
  },
  catChipOn: { backgroundColor: SN.espresso },
  catChipTxt: { fontFamily: FONT.medium, fontSize: 12, color: SN.ink, textTransform: "capitalize" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: 18 },
  empty: { fontFamily: FONT.light, color: SN.muted, paddingHorizontal: 18, marginTop: 8 },
  err: { fontFamily: FONT.regular, color: "#B42318", paddingHorizontal: 18, marginBottom: 8 },
});
