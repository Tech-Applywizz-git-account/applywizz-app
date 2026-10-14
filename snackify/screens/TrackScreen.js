import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";
import BrownButton from "../components/BrownButton";
import RidingLoader from "../components/RidingLoader";
import { snackApi, isUuid } from "../api";
import { LIVE_STEPS_DELIVERY, LIVE_STEPS_PICKUP } from "../constants";
import AssistiveAppSwitch from "../../src/components/AssistiveAppSwitch";
import Coin from "../components/Coin";
import { useSnackTokens } from "../TokenContext";
import { itemLabelFromLines, notifyCoinsRefunded } from "../coinNotify";

function liveStatus(row) {
  return String(row?.live_status || row?.status || "confirming").toLowerCase();
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m} ${ampm}`;
}

function itemsSummary(row) {
  if (!row) return "";
  const items = row.items || row.order_items || [];
  if (Array.isArray(items) && items.length) {
    return items.map((i) => `${i.name || i.item_name || "Item"}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ");
  }
  if (row.quick_item) return row.quick_item;
  return "";
}

const STEP_ICONS = {
  confirming: "time-outline",
  placed: "checkmark-circle-outline",
  accepted: "thumbs-up-outline",
  preparing: "cafe-outline",
  on_the_way: "bicycle-outline",
  ready_for_pickup: "walk-outline",
  done: "checkmark-done-circle-outline",
};

const STEP_LABELS = {
  confirming: "Confirming your order…",
  placed: "Order placed",
  accepted: "Accepted by pantry",
  preparing: "Being prepared",
  on_the_way: "On the way to you",
  ready_for_pickup: "Ready for pickup",
  done: "Delivered",
};

const CANCEL_WINDOW_SEC = 35;

function cancelSecondsLeft(row) {
  const created = new Date(row?.created_at || 0).getTime();
  if (!created) return CANCEL_WINDOW_SEC;
  return Math.max(0, Math.ceil(CANCEL_WINDOW_SEC - (Date.now() - created) / 1000));
}

function isCancellableStatus(status) {
  const st = String(status || "").toLowerCase();
  if (!st || st === "cancelled" || st === "done") return false;
  if (["accepted", "preparing", "on_the_way", "ready_for_pickup", "in_progress"].includes(st)) {
    return false;
  }
  return st === "confirming" || st === "placed" || st === "pending";
}

export default function TrackScreen({ navigation, route }) {
  const id = route.params?.id;
  const badId = Boolean(id) && !isUuid(id);
  const tokens = useSnackTokens();
  const [row, setRow] = useState(null);
  const [eta, setEta] = useState(null);
  const [err, setErr] = useState(
    badId ? "This order could not be tracked. Open Orders to find it." : "",
  );
  const [left, setLeft] = useState(CANCEL_WINDOW_SEC);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [refundInfo, setRefundInfo] = useState(null);
  const confirmed = useRef(false);
  const cancelLock = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const load = useCallback(async () => {
    if (!id || !isUuid(id) || cancelLock.current) return;
    try {
      const data = await snackApi.getRequest(id);
      if (cancelLock.current) return;
      setRow(data?.request || data);
      setErr("");
    } catch (e) {
      if (e.status === 429) return;
      setErr(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
    snackApi.queueCount().then(setEta).catch(() => {});
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const status = liveStatus(row);
  const confirming = !row || status === "confirming";
  const isPickup = row?.delivery_mode === "self_pickup";
  const night = /recorded/i.test(status);
  const cancelled = status === "cancelled";
  const done = status === "done";
  const canCancel = !badId && isUuid(id) && !cancelled && !done && !night && isCancellableStatus(row ? status : "confirming") && left > 0;

  const steps = useMemo(
    () => isPickup ? LIVE_STEPS_PICKUP : LIVE_STEPS_DELIVERY,
    [isPickup],
  );

  const active = useMemo(() => {
    if (cancelled) return -1;
    if (night) return steps.length - 1;
    const mapped = status === "placed" ? "placed"
      : status === "in_progress" ? "preparing"
      : status;
    const i = steps.indexOf(mapped);
    return i >= 0 ? i : 1;
  }, [status, steps, cancelled, night]);

  useEffect(() => {
    const tick = setInterval(() => setLeft(cancelSecondsLeft(row)), 250);
    setLeft(cancelSecondsLeft(row));
    return () => clearInterval(tick);
  }, [row?.created_at]);

  useEffect(() => {
    if (!id || !isUuid(id) || cancelled || confirmed.current || cancelLock.current) return undefined;
    const ms = Math.max(500, cancelSecondsLeft(row) * 1000);
    const auto = setTimeout(async () => {
      if (confirmed.current || cancelLock.current) return;
      confirmed.current = true;
      try { await snackApi.confirmRequest(id); } catch (_) {}
      load();
    }, ms);
    return () => clearTimeout(auto);
  }, [id, row?.created_at, cancelled, load]);

  const goHome = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("SnackifyHomeTab");
  };

  const cancel = useCallback(async () => {
    if (!id || !isUuid(id) || cancelLock.current || cancelBusy) return;
    cancelLock.current = true;
    confirmed.current = true;
    setCancelBusy(true);
    setErr("");
    try {
      const item = itemsSummary(row) || itemLabelFromLines(row?.items || row?.order_items) || "your order";
      const charged = Number(row?.tokens_charged || route.params?.paid || 0);
      const data = await snackApi.cancelRequest(id);
      const refunded = Number(data?.tokens_refunded ?? charged);
      let remaining = data?.balance_after;
      if (remaining == null) {
        const boot = await tokens?.refresh?.();
        remaining = Number(boot?.wallet?.balance ?? tokens?.wallet?.balance) || 0;
      } else {
        tokens?.apply?.({
          wallet: {
            balance: remaining,
            remaining,
            spent_this_month: Math.max(0, (Number(tokens?.wallet?.spent_this_month) || 0) - refunded),
          },
        });
        tokens?.refresh?.();
      }
      setRefundInfo({ refunded, remaining: Number(remaining) || 0, item });
      setRow((prev) => ({
        ...(prev || {}),
        ...(data || {}),
        status: "cancelled",
        live_status: "cancelled",
      }));
      notifyCoinsRefunded({
        item,
        refunded,
        remaining: Number(remaining) || 0,
        requestId: id,
      }).catch(() => {});
    } catch (e) {
      cancelLock.current = false;
      setErr(e.message || "Could not cancel. Try again.");
    } finally {
      setCancelBusy(false);
    }
  }, [id, row, route.params?.paid, tokens, cancelBusy]);

  if (badId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F4F5" }} edges={["top", "bottom"]}>
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <Text style={{ fontFamily: FONT.medium, fontSize: 18, color: SN.ink, marginBottom: 8 }}>
            Could not track this order
          </Text>
          <Text style={{ fontFamily: FONT.light, fontSize: 14, color: SN.muted, marginBottom: 20 }}>
            {err || "Open Orders to find it, or place the order again."}
          </Text>
          <BrownButton title="Back to home" onPress={goHome} />
        </View>
      </SafeAreaView>
    );
  }

  const etaMin = eta
    ? (Number(eta.pending || 0) + Number(eta.in_progress || 0)) * 3 + 5
    : null;

  const summary = itemsSummary(row);
  const confirmProgress = 1 - (left / CANCEL_WINDOW_SEC);

  const cancelBtn = (
    <Pressable
      onPress={cancel}
      disabled={cancelBusy}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Cancel order"
      android_ripple={{ color: "rgba(255,255,255,0.2)" }}
      style={({ pressed }) => [
        styles.cancelBtn,
        pressed && !cancelBusy ? { opacity: 0.88 } : null,
        cancelBusy ? { opacity: 0.75 } : null,
      ]}
    >
      {cancelBusy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Ionicons name="close-circle" size={20} color="#fff" />
      )}
      <Text style={styles.cancelBtnTxt}>
        {cancelBusy ? "Cancelling…" : `Cancel order${left > 0 ? `  ·  ${left}s` : ""}`}
      </Text>
    </Pressable>
  );

  if (confirming && !cancelled) {
    return (
      <SafeAreaView style={styles.fullBleed} edges={["top", "bottom"]} pointerEvents="box-none">
        <View style={styles.loaderWrap} pointerEvents="none">
          <RidingLoader />
        </View>
        <View style={styles.placeSheet} pointerEvents="auto" collapsable={false}>
          <Text style={styles.placeTitle}>Payment received</Text>
          <Text style={styles.placeSub}>
            {left > 0
              ? `Full refund if you cancel in the next ${left}s`
              : "Refund window is closing…"}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(4, Math.min(100, confirmProgress * 100))}%` }]} />
          </View>
          {err ? <Text style={[styles.err, { paddingHorizontal: 0, marginTop: 12 }]}>{err}</Text> : null}
          {canCancel || cancelBusy ? cancelBtn : (
            <Text style={styles.placeHint}>Sending your order to the pantry…</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SN.beige }} edges={["top"]}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={styles.top}>
          <Pressable onPress={goHome} style={styles.back}>
            <Ionicons name="arrow-back" size={20} color={SN.ink} />
          </Pressable>
          <Text style={styles.h}>Track Order</Text>
        </View>

        <View style={styles.infoStrip}>
          <Text style={styles.orderNum}>
            #{row?.user_order_number || (id ? id.slice(0, 8) : "—")}
          </Text>
          <Text style={styles.infoDot}> · </Text>
          <Text style={styles.infoMode}>
            {night ? "Night shift" : (isPickup ? "Self pickup" : (row?.location || "Desk"))}
          </Text>
          {row?.created_at ? (
            <>
              <Text style={styles.infoDot}> · </Text>
              <Text style={styles.infoTime}>{formatTime(row.created_at)}</Text>
            </>
          ) : null}
        </View>

        {summary ? (
          <Text style={styles.summary} numberOfLines={2}>{summary}</Text>
        ) : null}
        {row?.tokens_charged || route.params?.paid ? (
          <View style={styles.paidStrip}>
            <Coin size={18} />
            <Text style={styles.paidTxt}>
              Paid {row?.tokens_charged || route.params?.paid} coins
            </Text>
          </View>
        ) : null}
        {route.params?.queued ? (
          <Text style={styles.summary}>Saved offline — will send when you are back online.</Text>
        ) : null}
        {row?.print_status === "failed" || row?.token_print_status === "failed" ? (
          <Text style={styles.summary}>Waiting for printer (paper or power). Will retry automatically.</Text>
        ) : row?.print_status === "printed" ? (
          <Text style={styles.summary}>Receipt printed</Text>
        ) : !confirming && !cancelled ? (
          <Text style={styles.summary}>Receipt queued for the pantry printer</Text>
        ) : null}

        {err ? <Text style={styles.err}>{err}</Text> : null}

        {cancelled ? (
          <View style={styles.centerWrap}>
            <View style={[styles.statusCircle, { backgroundColor: "#FEE4E2" }]}>
              <Ionicons name="close-circle-outline" size={48} color="#B42318" />
            </View>
            <Text style={styles.statusTitle}>Order cancelled</Text>
            <Text style={styles.statusSub}>
              {refundInfo
                ? `${refundInfo.refunded} coins added back for ${refundInfo.item}. Available now: ${refundInfo.remaining}.`
                : "Your coins have been added back. Feel free to order again."}
            </Text>
            <BrownButton title="Back to Home" onPress={goHome} style={{ marginTop: 20, alignSelf: "stretch" }} />
          </View>
        ) : null}

        {night && !cancelled ? (
          <View style={styles.centerWrap}>
            <View style={[styles.statusCircle, { backgroundColor: "#E8E0F4" }]}>
              <Ionicons name="moon-outline" size={48} color="#6941C6" />
            </View>
            <Text style={styles.statusTitle}>Night — recorded</Text>
            <Text style={styles.statusSub}>
              No delivery at night shift. Pick it up from the pantry counter.{"\n"}A night slip has been printed.
            </Text>
          </View>
        ) : null}

        {!confirming && !cancelled && !night ? (
          <View style={styles.stepperWrap}>
            {etaMin ? (
              <View style={styles.etaBadge}>
                <Ionicons name="timer-outline" size={14} color={SN.espresso} />
                <Text style={styles.etaText}>ETA ~{etaMin} min</Text>
              </View>
            ) : null}

            {steps.map((s, i) => {
              const past = i < active;
              const current = i === active;
              const icon = STEP_ICONS[s] || "ellipse-outline";
              return (
                <View key={s} style={styles.stepRow}>
                  <View style={styles.stepLeft}>
                    <View style={[
                      styles.dot,
                      past && styles.dotPast,
                      current && styles.dotCurrent,
                    ]}>
                      {(past || current) ? (
                        <Ionicons name={past ? "checkmark" : icon} size={past ? 12 : 16} color="#fff" />
                      ) : null}
                    </View>
                    {i < steps.length - 1 ? (
                      <View style={[styles.connector, past && styles.connectorDone]} />
                    ) : null}
                  </View>
                  <View style={styles.stepRight}>
                    <Text style={[
                      styles.stepLabel,
                      past && { color: SN.muted },
                      current && { color: SN.green, fontFamily: FONT.medium },
                    ]}>
                      {STEP_LABELS[s] || s.replace(/_/g, " ")}
                    </Text>
                    {current && !done ? (
                      <Text style={styles.stepHint}>In progress…</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}

            {done ? (
              <View style={styles.doneBox}>
                <Ionicons name="checkmark-done-circle" size={36} color={SN.green} />
                <Text style={styles.doneTitle}>Order complete!</Text>
                <Text style={styles.doneSub}>Enjoy your pantry goodies.</Text>
              </View>
            ) : (
              <View style={styles.liveMap}>
                <Ionicons name={isPickup ? "walk-outline" : "bicycle"} size={40} color={SN.espresso} />
                <Text style={styles.liveStatus}>{STEP_LABELS[status] || status.replace(/_/g, " ")}</Text>
              </View>
            )}
          </View>
        ) : null}

        {done && !night ? (
          <View style={{ padding: 18 }}>
            <BrownButton title="Rate this order" onPress={() => navigation.navigate("SnackifyReview", { id })} />
          </View>
        ) : null}

        {!cancelled && (canCancel || cancelBusy) ? (
          <View style={styles.cancelDock}>
            {err ? <Text style={[styles.err, { paddingHorizontal: 0, marginTop: 0, marginBottom: 8 }]}>{err}</Text> : null}
            {cancelBtn}
          </View>
        ) : null}
      </Animated.View>
      <AssistiveAppSwitch />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  h: { fontFamily: FONT.medium, fontSize: 18, marginLeft: 10, color: SN.ink },
  infoStrip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 22, marginTop: 6 },
  orderNum: { fontFamily: FONT.medium, color: SN.espresso, fontSize: 14 },
  infoDot: { color: SN.muted },
  infoMode: { fontFamily: FONT.light, color: SN.muted, fontSize: 13 },
  infoTime: { fontFamily: FONT.light, color: SN.muted, fontSize: 13 },
  summary: { fontFamily: FONT.regular, color: SN.ink, fontSize: 13, paddingHorizontal: 22, marginTop: 4 },
  paidStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 18,
    marginTop: 10,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  paidTxt: { fontFamily: FONT.medium, color: "#047857", fontSize: 13 },
  err: { fontFamily: FONT.regular, color: "#B42318", paddingHorizontal: 22, marginTop: 8 },

  fullBleed: { flex: 1, backgroundColor: SN.beige },
  loaderWrap: { flex: 1, zIndex: 0 },
  placeSheet: {
    zIndex: 20,
    elevation: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: "stretch",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
  },
  placeTitle: { fontFamily: FONT.medium, fontSize: 22, color: SN.ink, textAlign: "center" },
  placeSub: { fontFamily: FONT.regular, fontSize: 14, color: SN.muted, marginTop: 6, textAlign: "center" },
  placeHint: { fontFamily: FONT.regular, fontSize: 13, color: SN.muted, marginTop: 16, textAlign: "center" },
  progressTrack: { height: 4, width: "100%", backgroundColor: "#E8D9C8", borderRadius: 999, marginTop: 16, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: SN.espresso, borderRadius: 999 },
  cancelBtn: {
    marginTop: 16,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: "#B42318",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  cancelBtnTxt: { fontFamily: FONT.medium, color: "#fff", fontSize: 16 },
  cancelDock: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: SN.beige,
  },

  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  statusCircle: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  statusTitle: { fontFamily: FONT.medium, fontSize: 22, color: SN.ink },
  statusSub: { fontFamily: FONT.regular, fontSize: 14, color: SN.muted, textAlign: "center", marginTop: 8, lineHeight: 21 },

  stepperWrap: { padding: 22, flex: 1 },
  etaBadge: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    backgroundColor: "#FFF3E0", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16, gap: 6,
  },
  etaText: { fontFamily: FONT.medium, color: SN.espresso, fontSize: 13 },
  stepRow: { flexDirection: "row", minHeight: 52 },
  stepLeft: { width: 30, alignItems: "center" },
  dot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: SN.line, alignItems: "center", justifyContent: "center",
  },
  dotPast: { backgroundColor: SN.green },
  dotCurrent: { backgroundColor: SN.espresso },
  connector: { width: 2, flex: 1, backgroundColor: SN.line, marginVertical: 2 },
  connectorDone: { backgroundColor: SN.green },
  stepRight: { flex: 1, marginLeft: 12, paddingBottom: 14 },
  stepLabel: { fontFamily: FONT.regular, fontSize: 15, color: SN.ink, textTransform: "capitalize" },
  stepHint: { fontFamily: FONT.light, color: SN.espresso, fontSize: 12, marginTop: 2 },

  doneBox: { alignItems: "center", marginTop: 16, padding: 16, backgroundColor: "#E8F5E9", borderRadius: 18 },
  doneTitle: { fontFamily: FONT.medium, fontSize: 18, color: SN.green, marginTop: 8 },
  doneSub: { fontFamily: FONT.light, color: SN.muted, fontSize: 13, marginTop: 4 },

  liveMap: { marginTop: 16, height: 120, borderRadius: 20, backgroundColor: "#F3EDE7", alignItems: "center", justifyContent: "center" },
  liveStatus: { fontFamily: FONT.medium, color: SN.espresso, marginTop: 6, textTransform: "capitalize" },
});
