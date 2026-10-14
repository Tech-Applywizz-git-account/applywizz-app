import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "./AppText";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../api/client";
import { fetchDisputes } from "../api/disputes";
import { useAuth } from "../context/AuthContext";
import { canViewDisputes, toList } from "../utils/billing";
import { FONT } from "../typography";
import { BRAND } from "../theme";

const AUTO_MS = 4000; // 3–5s toast window
const EXIT_MS = 280;
const SEEN_KEY = "inapp_notify_seen_v1";

function relativeTime(iso) {
  if (!iso) return "now";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "now";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function toneMeta(tone) {
  if (tone === "danger") {
    return { avatarBg: "#FEE2E2", avatarFg: "#B91C1C", badgeBg: "#EF4444", icon: "shield" };
  }
  if (tone === "warn") {
    return { avatarBg: "#FEF3C7", avatarFg: "#B45309", badgeBg: "#F59E0B", icon: "pricetag" };
  }
  if (tone === "success") {
    return { avatarBg: "#DCFCE7", avatarFg: "#15803D", badgeBg: "#22C55E", icon: "checkmark" };
  }
  return { avatarBg: BRAND.tealSoft, avatarFg: BRAND.teal, badgeBg: BRAND.blue, icon: "notifications" };
}

/** IST calendar YYYY-MM-DD for "today". */
function istDateKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function isRaisedTodayIst(iso) {
  if (!iso) return false;
  const dt = new Date(iso);
  if (!Number.isFinite(dt.getTime())) return false;
  return istDateKey(dt) === istDateKey(new Date());
}

async function loadSeenMap(userId) {
  try {
    const raw = await AsyncStorage.getItem(`${SEEN_KEY}:${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveSeenMap(userId, map) {
  try {
    // Keep map from growing forever — drop entries older than 7 days
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const next = {};
    for (const [k, v] of Object.entries(map || {})) {
      if (Number(v) >= cutoff) next[k] = v;
    }
    await AsyncStorage.setItem(`${SEEN_KEY}:${userId}`, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function NotifyCard({ item, onOpen, onDismiss }) {
  const meta = toneMeta(item.tone);
  const translateY = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissedRef = useRef(false);

  const finishDismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onDismiss(item.id, item.alertId);
  }, [item.id, item.alertId, onDismiss]);

  const animateOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: EXIT_MS, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: EXIT_MS, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) finishDismiss();
    });
  }, [finishDismiss, opacity, translateY]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(animateOut, AUTO_MS);
    return () => clearTimeout(t);
  }, [animateOut, opacity, translateY]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && g.dy < 0,
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) {
          translateY.setValue(g.dy);
          opacity.setValue(Math.max(0.2, 1 + g.dy / 120));
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -40 || g.vy < -0.8) {
          animateOut();
        } else {
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, friction: 7, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[styles.cardShadow, { opacity, transform: [{ translateY }] }]}
      {...pan.panHandlers}
    >
      <TouchableOpacity activeOpacity={0.92} onPress={() => onOpen(item)} style={styles.card}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: meta.avatarBg }]}>
            <Ionicons name={meta.icon} size={22} color={meta.avatarFg} />
          </View>
          <View style={[styles.badge, { backgroundColor: meta.badgeBg }]}>
            <Ionicons name={item.badgeIcon || "notifications"} size={10} color="#fff" />
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.dot}> · </Text>
            <Text style={styles.time}>{relativeTime(item.at)}</Text>
          </View>
          {item.body ? (
            <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
          ) : null}
        </View>

        <TouchableOpacity hitSlop={12} onPress={animateOut} style={styles.chevronBtn}>
          <Ionicons name="close" size={16} color="#64748B" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Ephemeral in-app notifications (toast style): show 3–5s, slide up, or swipe/dismiss.
 * Disputes: only tickets raised today (IST).
 */
export default function StickyAlertsBanner({ navigationRef }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState([]);
  const seenRef = useRef({});
  const seenLoaded = useRef(false);

  const go = useCallback((screen) => {
    const nav = navigationRef?.current;
    if (!nav || !screen) return;
    try {
      if (nav.isReady?.()) nav.navigate(screen);
    } catch {
      /* ignore */
    }
  }, [navigationRef]);

  const markSeen = useCallback(async (id, alertId) => {
    if (!user?.id || !id) return;
    seenRef.current = { ...seenRef.current, [id]: Date.now() };
    await saveSeenMap(user.id, seenRef.current);
    if (alertId) {
      try {
        await api.post("/notifications/alerts/acknowledge/", { ids: [alertId] });
      } catch {
        /* ignore */
      }
    }
  }, [user?.id]);

  const dismiss = useCallback((id, alertId) => {
    setQueue((q) => q.filter((x) => x.id !== id));
    markSeen(id, alertId);
  }, [markSeen]);

  const enqueueNew = useCallback((candidates) => {
    const fresh = candidates.filter((c) => c?.id && !seenRef.current[c.id]);
    if (!fresh.length) return;
    // Mark as seen immediately so polls don't re-queue while toast is visible
    const now = Date.now();
    const nextSeen = { ...seenRef.current };
    for (const c of fresh) nextSeen[c.id] = now;
    seenRef.current = nextSeen;
    if (user?.id) saveSeenMap(user.id, nextSeen);
    setQueue((q) => {
      const existing = new Set(q.map((x) => x.id));
      const add = fresh.filter((c) => !existing.has(c.id));
      return [...q, ...add].slice(0, 4);
    });
  }, [user?.id]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setQueue([]);
      return;
    }
    if (!seenLoaded.current) {
      seenRef.current = await loadSeenMap(user.id);
      seenLoaded.current = true;
    }

    const next = [];

    const [disputesRes, pendingCouponsRes, couponListRes, alertsRes] = await Promise.all([
      canViewDisputes(user)
        ? fetchDisputes({ status: "open", page: 1 }).catch(() => null)
        : Promise.resolve(null),
      api.get("/payments/coupon-requests/", {
        params: { status: "pending", page_size: 5 },
        timeout: 12000,
      }).catch(() => null),
      api.get("/payments/coupon-requests/", {
        params: { page_size: 10 },
        timeout: 12000,
      }).catch(() => null),
      api.get("/notifications/alerts/pending/", { timeout: 12000 }).catch(() => null),
    ]);

    if (disputesRes) {
      const list = toList(disputesRes);
      const today = list.filter((row) =>
        isRaisedTodayIst(row.raised_at || row.raised_at_ist || row.created_at),
      );
      for (const row of today.slice(0, 3)) {
        next.push({
          id: `dispute-${row.id}`,
          tone: "danger",
          title: "Dispute raised",
          body: row.client_name || row.gateway_case_id || "PayPal / Razorpay / Cashfree chargeback",
          screen: "DisputeDetail",
          screenParams: { id: row.id },
          at: row.raised_at || row.created_at,
          badgeIcon: "alert",
        });
      }
    }

    if (pendingCouponsRes?.data) {
      const pending = toList(pendingCouponsRes.data).filter(
        (r) => String(r.status || "").toLowerCase() === "pending",
      );
      for (const top of pending.slice(0, 2)) {
        const asManager = String(top.manager_id || top.manager?.id) === String(user.id);
        next.push({
          id: `coupon-pending-${top.id}`,
          tone: "warn",
          title: "Coupon request",
          body: asManager
            ? `${top.requester_name || top.requester?.name || "Associate"} · waiting for approval`
            : "Awaiting manager decision",
          screen: "CouponRequests",
          at: top.requested_at || top.created_at || top.updated_at,
          badgeIcon: "pricetag",
        });
      }
    }

    if (couponListRes?.data) {
      const rows = toList(couponListRes.data);
      const recent = rows.filter((r) => {
        const st = String(r.status || "").toLowerCase();
        if (st !== "approved" && st !== "auto_approved" && st !== "rejected") return false;
        if (String(r.requester_id || r.requester?.id) !== String(user.id)) return false;
        const decided = r.decided_at || r.updated_at;
        if (!decided) return false;
        return isRaisedTodayIst(decided);
      });
      for (const r of recent.slice(0, 2)) {
        const rejected = String(r.status || "").toLowerCase() === "rejected";
        next.push({
          id: `coupon-decision-${r.id}`,
          tone: rejected ? "danger" : "success",
          title: rejected ? "Coupon rejected" : "Coupon approved",
          body: r.client_name || r.client?.name || r.rejection_reason || "Tap to view details",
          screen: "CouponRequests",
          at: r.decided_at || r.updated_at,
          badgeIcon: rejected ? "close" : "checkmark",
        });
      }
    }

    if (alertsRes?.data) {
      const alerts = Array.isArray(alertsRes.data) ? alertsRes.data : [];
      for (const a of alerts.slice(0, 3)) {
        const typ = String(a?.data?.type || "").toLowerCase();
        if (!typ.includes("dispute") && !typ.includes("coupon")) continue;
        const at = a.created_at || a.timestamp;
        if (typ.includes("dispute") && !isRaisedTodayIst(at)) continue;
        next.push({
          id: `alert-${a.id}`,
          tone: typ.includes("reject")
            ? "danger"
            : typ.includes("dispute")
              ? "danger"
              : typ.includes("approv")
                ? "success"
                : "info",
          title: a.title || "Notification",
          body: a.body || "",
          screen: a?.data?.screen || (typ.includes("dispute") ? "Disputes" : "CouponRequests"),
          screenParams: a?.data?.dispute_id ? { id: a.data.dispute_id } : undefined,
          at,
          alertId: a.id,
          badgeIcon: typ.includes("dispute") ? "shield" : "pricetag",
        });
      }
    }

    enqueueNew(next);
  }, [user, enqueueNew]);

  useEffect(() => {
    seenLoaded.current = false;
    if (!user?.id) {
      setQueue([]);
      return undefined;
    }
    load();
    const t = setInterval(load, 25000);
    return () => clearInterval(t);
  }, [user?.id, load]);

  const onOpen = useCallback((item) => {
    const nav = navigationRef?.current;
    if (!nav?.isReady?.()) return;
    try {
      if (item.screen === "DisputeDetail" && item.screenParams?.id) {
        nav.navigate("DisputeDetail", item.screenParams);
      } else if (item.screen) {
        nav.navigate(item.screen, item.screenParams);
      }
    } catch {
      go(item.screen);
    }
    dismiss(item.id, item.alertId);
  }, [dismiss, go, navigationRef]);

  if (!queue.length) return null;

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 8) }]} pointerEvents="box-none">
      {queue.map((item) => (
        <NotifyCard
          key={item.id}
          item={item}
          onOpen={onOpen}
          onDismiss={dismiss}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 12,
    gap: 8,
  },
  cardShadow: {
    borderRadius: 18,
    backgroundColor: "transparent",
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8ECF1",
  },
  avatarWrap: {
    width: 48,
    height: 48,
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    paddingRight: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontFamily: FONT.medium,
    fontSize: 15,
    color: "#0F172A",
    maxWidth: "72%",
  },
  dot: {
    fontFamily: FONT.regular,
    fontSize: 13,
    color: "#94A3B8",
  },
  time: {
    fontFamily: FONT.regular,
    fontSize: 13,
    color: "#94A3B8",
  },
  body: {
    marginTop: 3,
    fontFamily: FONT.regular,
    fontSize: 13,
    color: "#334155",
    lineHeight: 18,
  },
  chevronBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
});
