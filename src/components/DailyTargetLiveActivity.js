import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  AppState,
} from "react-native";
import { Text } from "./AppText";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchIncentiveProgress } from "../api/incentives";
import { useAuth } from "../context/AuthContext";
import { canViewIncentives } from "../utils/billing";
import { firstLetter } from "../utils/avatar";
import { FONT } from "../typography";
import { BRAND } from "../theme";
import {
  isDailyTargetLiveWindow,
  formatIstClock,
  formatUsdShort,
  formatMinutesShort,
  liveWindowMinutes,
} from "../utils/dailyTargetWindow";

const POLL_MS = 25000;
/** Set true locally to preview the Live Activity outside 8 PM–5 AM IST. */
const FORCE_SHOW_OUTSIDE_WINDOW = __DEV__ && false;

/**
 * Uber-style Live Activity for daily target — active IST 8 PM → 5 AM.
 * Compact status pill + expandable dark progress card.
 */
export default function DailyTargetLiveActivity({ navigationRef }) {
  const { user, profile, avatarUri } = useAuth();
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [inWindow, setInWindow] = useState(
    FORCE_SHOW_OUTSIDE_WINDOW || isDailyTargetLiveWindow(),
  );
  const [tick, setTick] = useState(0);
  const thumbAnim = useRef(new Animated.Value(0)).current;

  const letter = firstLetter(user, profile);
  const eligible = Boolean(user && canViewIncentives(user));

  const goIncentives = useCallback(() => {
    const nav = navigationRef?.current;
    if (!nav?.isReady?.()) return;
    try {
      nav.navigate("Tabs", { screen: "Incentives" });
    } catch {
      try {
        nav.navigate("IncentivesHub");
      } catch {
        /* ignore */
      }
    }
  }, [navigationRef]);

  const load = useCallback(async () => {
    if (!eligible) {
      setProgress(null);
      return;
    }
    const open = FORCE_SHOW_OUTSIDE_WINDOW || isDailyTargetLiveWindow();
    setInWindow(open);
    if (!open) {
      setProgress(null);
      return;
    }
    const data = await fetchIncentiveProgress();
    if (!data || (!data.is_bda && !data.is_bdm && !data.is_team)) {
      setProgress(null);
      return;
    }
    if (!(Number(data.daily_target_usd) > 0 || data.target_met)) {
      setProgress(null);
      return;
    }
    setProgress(data);
  }, [eligible]);

  useEffect(() => {
    if (!eligible) return undefined;
    load();
    const poll = setInterval(load, POLL_MS);
    const clock = setInterval(() => setTick((n) => n + 1), 30000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") load();
    });
    return () => {
      clearInterval(poll);
      clearInterval(clock);
      sub?.remove?.();
    };
  }, [eligible, load]);

  const pct = useMemo(() => {
    if (!progress) return 0;
    const p = Number(progress.progress_percent);
    if (Number.isFinite(p)) return Math.min(100, Math.max(0, p));
    const t = Number(progress.daily_target_usd) || 0;
    const today = Number(progress.today_usd) || 0;
    if (t <= 0) return progress.target_met ? 100 : 0;
    return Math.min(100, Math.round((today / t) * 100));
  }, [progress]);

  useEffect(() => {
    Animated.spring(thumbAnim, {
      toValue: pct / 100,
      useNativeDriver: false,
      friction: 8,
    }).start();
  }, [pct, thumbAnim]);

  if (!eligible || !inWindow || !progress) return null;

  // tick forces clock / remaining-time refresh
  void tick;

  const win = liveWindowMinutes();
  const clock = formatIstClock();
  const today = formatUsdShort(progress.today_usd);
  const target = formatUsdShort(progress.daily_target_usd);
  const gap = Math.max(0, Number(progress.daily_target_usd || 0) - Number(progress.today_usd || 0));
  const title = progress.target_met
    ? `${clock} · target hit`
    : `${clock} · ${pct}% to target`;
  const subtitle = progress.target_met
    ? `${today} collected · great work`
    : gap > 0
      ? `${formatUsdShort(gap)} to go · ${formatMinutesShort(win.remaining)}`
      : `${today} / ${target} · ${formatMinutesShort(win.remaining)}`;

  const topPad = Math.max(insets.top, 8) + 8;

  if (!expanded) {
    return (
      <View style={[styles.pillWrap, { top: topPad }]} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setExpanded(true)}
          style={styles.pill}
        >
          <View style={styles.pillIcon}>
            <Ionicons name="flag" size={12} color="#0F172A" />
          </View>
          <Text style={styles.pillText}>
            {pct}% · {today}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { paddingTop: topPad }]} pointerEvents="box-none">
      <TouchableOpacity activeOpacity={0.95} onPress={goIncentives} style={styles.card}>
        <View style={styles.row}>
          <View style={styles.leadIcon}>
            <Ionicons name="flag" size={18} color="#fff" />
          </View>
          <View style={styles.mid}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.sub} numberOfLines={2}>{subtitle}</Text>
          </View>
          <View style={styles.art}>
            <View style={styles.artBlob}>
              <Ionicons name="trending-up" size={28} color="#93C5FD" />
            </View>
            <View style={styles.avatarOverlap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarLetter}>{letter}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            hitSlop={10}
            onPress={() => setExpanded(false)}
            style={styles.collapse}
          >
            <Ionicons name="chevron-up" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <View style={styles.track}>
          <View style={styles.trackBg} />
          <Animated.View
            style={[
              styles.trackFill,
              {
                width: thumbAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.thumb,
              {
                left: thumbAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
                transform: [{ translateX: -11 }],
              },
            ]}
          >
            <Ionicons
              name={progress.target_met ? "checkmark" : "flash"}
              size={12}
              color="#0F172A"
            />
          </Animated.View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>{today}</Text>
          <Text style={styles.metaMuted}>of {target} · 8 PM–5 AM IST</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    paddingHorizontal: 12,
  },
  pillWrap: {
    position: "absolute",
    left: 12,
    zIndex: 90,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pillIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: "#0F172A",
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#1F2937",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  leadIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND.blue,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  mid: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontFamily: FONT.medium,
    fontSize: 16,
    color: "#FFFFFF",
  },
  sub: {
    marginTop: 2,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 16,
  },
  art: {
    width: 64,
    height: 48,
    marginRight: 4,
  },
  artBlob: {
    width: 56,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#1E3A5F",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOverlap: {
    position: "absolute",
    right: 0,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: BRAND.tealSoft,
    borderWidth: 2,
    borderColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: 26,
    height: 26,
  },
  avatarLetter: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: BRAND.teal,
  },
  collapse: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  track: {
    marginTop: 16,
    height: 22,
    justifyContent: "center",
  },
  trackBg: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#374151",
  },
  trackFill: {
    position: "absolute",
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#93C5FD",
  },
  thumb: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#38BDF8",
  },
  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  meta: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: "#E2E8F0",
  },
  metaMuted: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: "#64748B",
  },
});
