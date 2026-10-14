import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";
import { useSnackCart } from "../CartContext";
import { useSnackMenu } from "../MenuContext";
import { useSnackAuth } from "../AuthContext";
import { snackApi, isUuid } from "../api";
import { LOCATIONS } from "../constants";
import { imgSource } from "../catalog";
import AssistiveAppSwitch from "../../src/components/AssistiveAppSwitch";
import { useSnackTokens } from "../TokenContext";
import Coin, { CoinPrice } from "../components/Coin";
import CheckoutSuccess from "../components/CheckoutSuccess";
import { itemLabelFromLines, notifyCoinsDeducted } from "../coinNotify";

const PAY_GREEN = "#1BA672";

export default function CartScreen({ navigation }) {
  const cart = useSnackCart();
  const menu = useSnackMenu();
  const auth = useSnackAuth();
  const tokens = useSnackTokens();
  const [busy, setBusy] = useState(false);
  const [payPhase, setPayPhase] = useState("");
  const [err, setErr] = useState("");
  const payRef = useRef({ amount: 0, result: null });

  useEffect(() => {
    if (menu.forcePickup && cart.mode !== "self_pickup") cart.setMode("self_pickup");
  }, [menu.forcePickup, cart.mode, cart.setMode]);

  useEffect(() => {
    if (!cart.location && auth.preferredLocation && auth.preferredLocation !== "Ask Every Time") {
      cart.setLocation(auth.preferredLocation);
    }
  }, [auth.preferredLocation]);

  const bal = Number(tokens?.wallet?.balance) || 0;
  const total = cart.totalCoins || 0;
  const remaining = Math.max(0, bal - total);
  const short = total > bal;

  const confirm = async () => {
    if (!cart.count) return;
    if (cart.mode === "get_it_here" && !String(cart.location || "").trim()) {
      setErr("Pick your cabin / desk location.");
      return;
    }
    if (short) {
      setErr(`Not enough coins. This order is ${total}, wallet has ${bal}.`);
      return;
    }
    setBusy(true);
    setErr("");
    payRef.current = { amount: total, result: null };
    setPayPhase("paying");
    try {
      const data = await snackApi.placeRequest(cart.payload());
      const reqRow = data?.request || data;
      const id = isUuid(reqRow?.id)
        ? reqRow.id
        : (isUuid(data?.id) ? data.id : (isUuid(data?.request_id) ? data.request_id : null));
      if (!id && !data?.queued) {
        throw new Error("Order was placed but the server did not return an order id. Open Orders to track it.");
      }
      const charged = Number(reqRow?.tokens_charged ?? total) || total;
      const remaining = Number(reqRow?.balance_after ?? Math.max(0, bal - charged));
      cart.setOrder({ id, ...reqRow, ...data });
      payRef.current = { amount: charged, result: { id, queued: data?.queued } };
      tokens?.apply?.({
        wallet: {
          balance: remaining,
          remaining,
          spent_this_month: (Number(tokens?.wallet?.spent_this_month) || 0) + charged,
        },
      });
      notifyCoinsDeducted({
        item: itemLabelFromLines(cart.lines),
        charged,
        remaining,
        requestId: id,
      }).catch(() => {});
      setPayPhase("paid");
      tokens?.refresh?.();
    } catch (e) {
      setPayPhase("fail");
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F4F5" }} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={SN.ink} />
        </Pressable>
        <View>
          <Text style={styles.h}>Payment</Text>
          <Text style={styles.hSub}>{cart.count} item{cart.count === 1 ? "" : "s"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 200 }}>
        {cart.lines.length === 0 ? (
          <Text style={styles.empty}>Your bag is empty. Add tea or a snack from Home.</Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your order</Text>
              {cart.lines.map((l, i) => {
                const unit = Number(l.coinPrice) || 0;
                const line = unit * l.qty;
                return (
                  <View key={l.key} style={[styles.itemRow, i === cart.lines.length - 1 && { borderBottomWidth: 0 }]}>
                    <Image source={imgSource(l.img)} style={styles.thumb} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{l.name}</Text>
                      {l.breadType ? <Text style={styles.sub}>on {l.breadType}</Text> : null}
                      <View style={styles.unitRow}>
                        <Coin size={13} />
                        <Text style={styles.unitTxt}>{unit} × {l.qty}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 8 }}>
                      <View style={styles.qty}>
                        <Pressable onPress={() => cart.setQty(l.key, l.qty - 1)} hitSlop={8}>
                          <Ionicons name="remove" size={14} color={PAY_GREEN} />
                        </Pressable>
                        {auth.isOwner ? (
                          <TextInput
                            value={String(l.qty)}
                            onChangeText={(t) => {
                              const digits = String(t || "").replace(/[^0-9]/g, "").slice(0, 3);
                              if (!digits) return;
                              cart.setQty(l.key, Math.max(1, Number(digits) || 1));
                            }}
                            keyboardType="number-pad"
                            selectTextOnFocus
                            style={styles.qtyInput}
                          />
                        ) : (
                          <Text style={styles.qtyN}>{l.qty}</Text>
                        )}
                        <Pressable onPress={() => cart.setQty(l.key, l.qty + 1)} hitSlop={8}>
                          <Ionicons name="add" size={14} color={PAY_GREEN} />
                        </Pressable>
                      </View>
                      <CoinPrice amount={line} size={14} />
                    </View>
                  </View>
                );
              })}
            </View>

            <Text style={styles.lbl}>Delivery</Text>
            <View style={styles.modes}>
              {[
                { id: "get_it_here", t: "Get it here" },
                { id: "self_pickup", t: "Self pickup" },
              ].map((m) => {
                const on = cart.mode === m.id;
                const locked = menu.forcePickup && m.id === "get_it_here";
                return (
                  <Pressable
                    key={m.id}
                    disabled={locked}
                    onPress={() => cart.setMode(m.id)}
                    style={[styles.mode, on && styles.modeOn, locked && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.modeTxt, on && { color: "#fff" }]}>{m.t}</Text>
                  </Pressable>
                );
              })}
            </View>
            {menu.forcePickup ? <Text style={styles.sub}>{menu.pickupMsg}</Text> : null}

            {cart.mode === "get_it_here" ? (
              <>
                <Text style={styles.lbl}>Deliver to</Text>
                <View style={styles.cabins}>
                  {LOCATIONS.map((loc) => {
                    const on = cart.location === loc;
                    return (
                      <Pressable key={loc} onPress={() => cart.setLocation(loc)} style={[styles.cabin, on && styles.cabinOn]}>
                        <Text style={[styles.cabinTxt, on && { color: "#fff" }]}>{loc}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <TextInput
              value={cart.note}
              onChangeText={cart.setNote}
              placeholder="Note for pantry (optional)"
              placeholderTextColor={SN.muted}
              style={styles.input}
            />

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Bill details</Text>
              {cart.lines.map((l) => (
                <View key={`bill-${l.key}`} style={styles.billRow}>
                  <Text style={styles.billLbl} numberOfLines={1}>
                    {l.name} × {l.qty}
                  </Text>
                  <CoinPrice amount={(Number(l.coinPrice) || 0) * l.qty} size={13} />
                </View>
              ))}
              <View style={styles.billRow}>
                <Text style={styles.billLbl}>Item total</Text>
                <CoinPrice amount={total} size={13} />
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLbl}>Taxes & fees</Text>
                <CoinPrice amount={0} size={13} />
              </View>
              <View style={[styles.billRow, styles.billPay]}>
                <Text style={styles.toPay}>To pay</Text>
                <CoinPrice amount={total} size={18} />
              </View>
            </View>

            <View style={styles.payCard}>
              <View style={styles.payHead}>
                <Ionicons name="wallet" size={18} color="#6D28D9" />
                <Text style={styles.payTitle}>Pay using Snackify Wallet</Text>
                <Ionicons name="checkmark-circle" size={18} color={PAY_GREEN} />
              </View>
              <View style={styles.walletLine}>
                <Text style={styles.billLbl}>Available balance</Text>
                <CoinPrice amount={bal} size={15} />
              </View>
              <View style={styles.walletLine}>
                <Text style={styles.billLbl}>Balance after this order</Text>
                <CoinPrice amount={remaining} size={15} muted={short} />
              </View>
            </View>
            {err ? <Text style={styles.err}>{err}</Text> : null}
          </>
        )}
      </ScrollView>

      {cart.lines.length ? (
        <View style={styles.footer}>
          <View>
            <Text style={styles.footLbl}>TO PAY</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Coin size={22} />
              <Text style={styles.footAmt}>{total}</Text>
            </View>
          </View>
          <Pressable
            onPress={confirm}
            disabled={busy || short}
            style={[styles.payBtn, (busy || short) && { opacity: 0.55 }]}
          >
            <Text style={styles.payBtnTxt}>{short ? "Not enough coins" : "Place Order"}</Text>
          </Pressable>
        </View>
      ) : null}

      <CheckoutSuccess
        visible={!!payPhase}
        status={payPhase === "paying" ? "running" : payPhase === "paid" ? "ok" : payPhase === "fail" ? "fail" : ""}
        amount={payRef.current.amount || total}
        variant="order"
        error={err}
        onDone={() => {
          const { result, amount } = payRef.current;
          setPayPhase("");
          cart.clear();
          if (isUuid(result?.id)) {
            navigation.replace("SnackifyTrack", { id: result.id, queued: result.queued, paid: amount });
          }
        }}
        onFailClose={() => setPayPhase("")}
      />
      <AssistiveAppSwitch />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 4,
    backgroundColor: "#fff",
    paddingBottom: 10,
    gap: 10,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F4F4F5", alignItems: "center", justifyContent: "center" },
  h: { fontFamily: FONT.medium, fontSize: 18, color: SN.ink },
  hSub: { fontFamily: FONT.light, fontSize: 12, color: "#9CA3AF" },
  empty: { fontFamily: FONT.light, color: SN.muted, marginTop: 24, paddingHorizontal: 8 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12 },
  cardTitle: { fontFamily: FONT.medium, fontSize: 15, color: SN.ink, marginBottom: 8 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEE",
  },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: SN.line },
  name: { fontFamily: FONT.medium, color: SN.ink, fontSize: 14 },
  sub: { fontFamily: FONT.light, color: SN.muted, fontSize: 12, marginTop: 2 },
  unitRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  unitTxt: { fontFamily: FONT.regular, color: "#6B7280", fontSize: 12 },
  qty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: PAY_GREEN,
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 28,
    backgroundColor: "#F0FDF4",
  },
  qtyN: { fontFamily: FONT.medium, minWidth: 14, textAlign: "center", color: PAY_GREEN, fontSize: 13 },
  qtyInput: {
    fontFamily: FONT.medium, minWidth: 28, maxWidth: 42, textAlign: "center",
    paddingVertical: 0, color: PAY_GREEN, fontSize: 13,
  },
  lbl: { fontFamily: FONT.medium, color: SN.ink, marginTop: 4, marginBottom: 8, paddingHorizontal: 4 },
  modes: { flexDirection: "row", gap: 8, marginBottom: 4 },
  mode: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: "#fff", justifyContent: "center" },
  modeOn: { backgroundColor: SN.espresso },
  modeTxt: { fontFamily: FONT.medium, color: SN.ink, fontSize: 13 },
  cabins: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cabin: { paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: "#fff", justifyContent: "center" },
  cabinOn: { backgroundColor: SN.espresso },
  cabinTxt: { fontFamily: FONT.medium, color: SN.ink, fontSize: 12 },
  input: {
    height: 46, borderRadius: 14, backgroundColor: "#fff", paddingHorizontal: 12,
    fontFamily: FONT.regular, color: SN.ink, marginTop: 10, marginBottom: 12,
  },
  billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 },
  billLbl: { fontFamily: FONT.regular, color: "#6B7280", fontSize: 13, flex: 1 },
  billPay: { borderTopWidth: 1, borderTopColor: "#EEE", paddingTop: 12, marginTop: 2, marginBottom: 0 },
  toPay: { fontFamily: FONT.medium, color: SN.ink, fontSize: 15 },
  payCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: PAY_GREEN },
  payHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  payTitle: { fontFamily: FONT.medium, color: SN.ink, fontSize: 14, flex: 1 },
  walletLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  err: { fontFamily: FONT.regular, color: "#B42318", marginTop: 8, paddingHorizontal: 4 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 18,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  footLbl: { fontFamily: FONT.medium, fontSize: 10, color: "#9CA3AF", letterSpacing: 0.6 },
  footAmt: { fontFamily: FONT.medium, fontSize: 22, color: SN.ink },
  payBtn: {
    backgroundColor: PAY_GREEN,
    height: 52,
    minWidth: 160,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  payBtnTxt: { fontFamily: FONT.medium, color: "#fff", fontSize: 15, letterSpacing: 0.3 },
});
