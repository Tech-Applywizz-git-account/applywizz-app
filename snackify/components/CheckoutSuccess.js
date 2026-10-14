import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import Coin from "./Coin";
import { playPaySuccess, playPayWhoosh } from "../checkoutSound";

const PURPLE = "#7C5CFF";
const CYAN = "#2EE6FF";
const GREEN = "#00C853";
const CARD = "#14141A";
const RING = 58;
const RING_C = 2 * Math.PI * RING;
const STAGE = 160;

const COPY = {
  order: {
    kicker: "Payment Checkout",
    payWith: "Snackify Wallet",
    processing: "Processing...",
    verifyA: "Verifying Payment",
    verifyB: "Secure Connection",
    success: "Payment Successful",
    confirmed: "Order Confirmed",
    thanks: "Thank you for your purchase!",
    cta: "View Order Details",
  },
  booking: {
    kicker: "Lunch Booking",
    payWith: "Snackify Wallet",
    processing: "Processing...",
    verifyA: "Verifying Payment",
    verifyB: "Secure Connection",
    success: "Booking Successful",
    confirmed: "Lunch Confirmed",
    thanks: "Your printed token is ready after pantry confirms.",
    cta: "View meal token",
  },
};

function formatCoins(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

/** Single rotating arc around the lock — one motion, one center. */
function OrbitArc({ color = PURPLE, active }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      spin.setValue(0);
      return undefined;
    }
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, spin]);

  return (
    <Animated.View
      pointerEvents="none"
      collapsable={false}
      style={[
        styles.orbitWrap,
        { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] },
      ]}
    >
      <Svg width={140} height={140}>
        <Circle cx={70} cy={70} r={RING} stroke="rgba(255,255,255,0.08)" strokeWidth={3} fill="none" />
        <Circle
          cx={70}
          cy={70}
          r={RING}
          stroke={color}
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${RING_C * 0.28} ${RING_C}`}
        />
      </Svg>
    </Animated.View>
  );
}

function CircleStage({ children }) {
  return (
    <View style={styles.circleStage} collapsable={false}>
      {children}
    </View>
  );
}

export default function CheckoutSuccess({
  visible,
  status,
  amount = 0,
  variant = "order",
  error = "",
  onDone,
  onFailClose,
}) {
  const copy = COPY[variant] || COPY.order;
  const [phase, setPhase] = useState("processing");
  const [pct, setPct] = useState(0);
  const checkPop = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const startedAt = useRef(0);
  const successPlayed = useRef(false);
  const doneTimer = useRef(null);
  const finished = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    if (doneTimer.current) clearTimeout(doneTimer.current);
    onDoneRef.current?.();
  };

  useEffect(() => {
    if (!visible) {
      setPhase("processing");
      setPct(0);
      checkPop.setValue(0);
      fadeIn.setValue(0);
      successPlayed.current = false;
      if (doneTimer.current) clearTimeout(doneTimer.current);
      return undefined;
    }
    startedAt.current = Date.now();
    finished.current = false;
    setPhase("processing");
    setPct(0);
    playPayWhoosh();
    const toVerify = setTimeout(() => setPhase("verifying"), 480);
    return () => clearTimeout(toVerify);
  }, [visible, checkPop, fadeIn]);

  useEffect(() => {
    if (!visible || phase !== "verifying" || status === "fail") return undefined;
    const id = setInterval(() => {
      setPct((p) => {
        if (status === "ok") return p;
        if (p >= 88) return 88;
        return Math.min(88, p + 1.6);
      });
    }, 50);
    return () => clearInterval(id);
  }, [visible, phase, status]);

  useEffect(() => {
    if (!visible || status !== "ok" || phase === "success") return undefined;
    const elapsed = Date.now() - startedAt.current;
    const wait = Math.max(0, 2800 - elapsed);
    const t = setTimeout(() => {
      setPct(100);
      setPhase("success");
    }, wait + 280);
    return () => clearTimeout(t);
  }, [visible, status, phase]);

  useEffect(() => {
    if (!visible || status !== "fail") return;
    setPhase("fail");
  }, [visible, status]);

  useEffect(() => {
    if (phase !== "success") return undefined;
    if (!successPlayed.current) {
      successPlayed.current = true;
      playPaySuccess();
    }
    checkPop.setValue(0);
    fadeIn.setValue(0);
    Animated.spring(checkPop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
    Animated.timing(fadeIn, { toValue: 1, duration: 420, delay: 120, useNativeDriver: true }).start();
    doneTimer.current = setTimeout(() => finish(), 2600);
    return () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, [phase, checkPop, fadeIn]);

  const verifyLabel = pct < 56 ? copy.verifyA : copy.verifyB;
  const ringColor = pct >= 80 ? GREEN : CYAN;
  const coins = formatCoins(amount);

  return (
    <Modal visible={!!visible} animationType="fade" transparent={false} statusBarTranslucent onRequestClose={() => {}}>
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <View style={styles.viewport}>
          <Text style={styles.kicker}>{copy.kicker}</Text>
          <View style={styles.card}>
            {phase === "processing" ? (
              <View style={styles.stack}>
                <CircleStage>
                  <OrbitArc color={PURPLE} active />
                  <View style={styles.lockSq}>
                    <Ionicons name="lock-closed" size={20} color="#fff" />
                  </View>
                </CircleStage>
                <View style={styles.payBtn}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.payBtnTxt}>{copy.processing}</Text>
                </View>
                <View style={styles.amountRow}>
                  <Coin size={28} />
                  <Text style={styles.amountWhite}>{coins}</Text>
                </View>
                <Text style={styles.muted}>{copy.payWith}</Text>
              </View>
            ) : null}

            {phase === "verifying" ? (
              <View style={styles.stack}>
                <CircleStage>
                  <View style={styles.ringBox}>
                    <Svg width={140} height={140}>
                      <Circle cx={70} cy={70} r={RING} stroke="rgba(255,255,255,0.08)" strokeWidth={3} fill="none" />
                      <Circle
                        cx={70}
                        cy={70}
                        r={RING}
                        stroke={ringColor}
                        strokeWidth={3.5}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${RING_C}`}
                        strokeDashoffset={RING_C * (1 - pct / 100)}
                        rotation="-90"
                        origin="70, 70"
                      />
                    </Svg>
                    <View style={styles.lockOnRing}>
                      <View style={styles.lockOnRingInner}>
                        <Ionicons name="lock-closed" size={18} color="#fff" />
                      </View>
                    </View>
                  </View>
                </CircleStage>
                <Text style={styles.verifyLbl}>{verifyLabel}</Text>
                <Text style={styles.pct}>{`${Math.round(pct)}%`}</Text>
              </View>
            ) : null}

            {phase === "success" ? (
              <View style={styles.stack}>
                <CircleStage>
                  <Animated.View style={{ transform: [{ scale: checkPop }] }}>
                    <View style={styles.checkGlow}>
                      <View style={styles.check}>
                        <Ionicons name="checkmark" size={44} color="#fff" />
                      </View>
                    </View>
                  </Animated.View>
                </CircleStage>
                <Animated.View style={{ opacity: fadeIn, alignItems: "center", alignSelf: "stretch" }}>
                  <Text style={styles.successTitle}>{copy.success}</Text>
                  <View style={styles.successAmt}>
                    <Coin size={34} />
                    <Text style={styles.amountGreen}>{coins}</Text>
                  </View>
                  <Text style={styles.confirmed}>{copy.confirmed}</Text>
                  <Text style={styles.thanks}>{copy.thanks}</Text>
                  <Pressable onPress={finish} style={styles.cta}>
                    <Ionicons name="document-text-outline" size={16} color="#fff" />
                    <Text style={styles.ctaTxt}>{copy.cta}</Text>
                  </Pressable>
                </Animated.View>
              </View>
            ) : null}

            {phase === "fail" ? (
              <View style={styles.stack}>
                <View style={[styles.check, { backgroundColor: "#E11D48" }]}>
                  <Ionicons name="close" size={40} color="#fff" />
                </View>
                <Text style={styles.successTitle}>Payment failed</Text>
                <Text style={styles.thanks}>{error || "Try again"}</Text>
                <Pressable onPress={onFailClose} style={[styles.cta, { marginTop: 22 }]}>
                  <Text style={styles.ctaTxt}>Close</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  viewport: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  kicker: {
    width: "100%",
    fontFamily: FONT.medium,
    color: "#fff",
    fontSize: 18,
    marginBottom: 12,
    textAlign: "center",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    minHeight: 520,
    alignSelf: "center",
    backgroundColor: CARD,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  stack: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  circleStage: {
    width: STAGE,
    height: STAGE,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  ringBox: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  lockSq: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
  },
  lockOnRing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  lockOnRingInner: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
  },
  payBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: PURPLE,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  payBtnTxt: { fontFamily: FONT.medium, color: "#fff", fontSize: 16 },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 28,
  },
  amountWhite: { fontFamily: FONT.medium, color: "#fff", fontSize: 36 },
  muted: {
    fontFamily: FONT.regular,
    color: "#9CA3AF",
    marginTop: 8,
    fontSize: 13,
    textAlign: "center",
    width: "100%",
  },
  verifyLbl: {
    fontFamily: FONT.regular,
    color: "#C4B5FD",
    marginTop: 16,
    fontSize: 14,
    textAlign: "center",
    width: "100%",
  },
  pct: {
    fontFamily: FONT.medium,
    color: "#fff",
    fontSize: 32,
    marginTop: 4,
    textAlign: "center",
    width: "100%",
    includeFontPadding: false,
  },
  checkGlow: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 2,
    borderColor: "rgba(0,200,83,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontFamily: FONT.medium,
    color: "#fff",
    fontSize: 20,
    marginTop: 20,
    textAlign: "center",
    width: "100%",
  },
  successAmt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
    width: "100%",
  },
  amountGreen: { fontFamily: FONT.medium, color: GREEN, fontSize: 42 },
  confirmed: {
    fontFamily: FONT.medium,
    color: "#fff",
    fontSize: 15,
    marginTop: 10,
    textAlign: "center",
    width: "100%",
  },
  thanks: {
    fontFamily: FONT.light,
    color: "#9CA3AF",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
    width: "100%",
    paddingHorizontal: 12,
  },
  cta: {
    marginTop: 28,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaTxt: { fontFamily: FONT.medium, color: "#fff", fontSize: 14 },
});
