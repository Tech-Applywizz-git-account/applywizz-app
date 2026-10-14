import React, { useState } from "react";
import { View, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { Text } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { formatApiError } from "../../utils/billing";
import {
  calculateAmMonth,
  lockAmMonth,
  unlockAmMonth,
  recalculateAmMonth,
  lockSalesPeriod,
  unlockSalesPeriod,
  recalculateSalesPeriod,
} from "../../api/incentives";

const OWNER_EMAIL = "dinesh@applywizz.ai";

/** Owner-only lock controls — same API as web; works on iOS + Android. */
export function isIncentiveOwner(user) {
  return Boolean(
    user?.is_owner
    || (user?.email || "").toLowerCase() === OWNER_EMAIL,
  );
}

export function LockedPeriodBadge({ snapshotStatus, lockedAt, t, department = "AM" }) {
  if (snapshotStatus === "draft") {
    return (
      <View style={{
        alignSelf: "flex-start",
        marginBottom: 10,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: "#FEF3C7",
        borderWidth: 1,
        borderColor: "#FDE68A",
      }}
      >
        <Text style={{ color: "#92400E", fontSize: 11, fontWeight: "700" }}>
          Draft snapshot — not frozen yet
        </Text>
      </View>
    );
  }
  if (snapshotStatus !== "final") return null;
  const when = lockedAt ? ` · ${new Date(lockedAt).toLocaleDateString()}` : "";
  return (
    <View style={{
      alignSelf: "flex-start",
      marginBottom: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: "#D1FAE5",
      borderWidth: 1,
      borderColor: "#A7F3D0",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    }}
    >
      <Ionicons name="lock-closed" size={12} color="#065F46" />
      <Text style={{ color: "#065F46", fontSize: 11, fontWeight: "700" }}>
        Locked · {department} snapshot (read-only){when}
      </Text>
    </View>
  );
}

function LockBtn({ label, icon, onPress, busy, tone, t, disabled }) {
  const styles = {
    lock: { bg: "#F0FDFA", border: "#99F6E4", text: "#115E59" },
    unlock: { bg: t.card, border: t.border, text: t.text },
    recalc: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
  }[tone] || { bg: t.card, border: t.border, text: t.text };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      style={{
        height: 36,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: styles.border,
        backgroundColor: styles.bg,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        opacity: disabled || busy ? 0.5 : 1,
      }}
    >
      {busy
        ? <ActivityIndicator size="small" color={styles.text} />
        : <Ionicons name={icon} size={14} color={styles.text} />}
      <Text style={{ color: styles.text, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Dinesh-only AM month Lock / Unlock / Recalculate.
 */
export function AmMonthLockControls({
  yearMonth,
  snapshotStatus,
  lockedAt,
  onChanged,
  t,
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(null);
  if (!isIncentiveOwner(user) || !yearMonth) return null;

  const isFinal = snapshotStatus === "final";
  const isDraft = snapshotStatus === "draft";

  const run = (action, fn, confirmTitle, confirmMsg) => {
    Alert.alert(confirmTitle, confirmMsg, [
      { text: "Cancel", style: "cancel" },
      {
        text: action === "unlock" ? "Unlock" : "Confirm",
        style: action === "unlock" ? "destructive" : "default",
        onPress: async () => {
          setBusy(action);
          try {
            await fn();
            onChanged?.();
          } catch (e) {
            Alert.alert("Error", formatApiError(e, `Failed to ${action}`));
          } finally {
            setBusy(null);
          }
        },
      },
    ], { cancelable: true });
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
        {!isFinal ? (
          <LockBtn
            label="Lock month"
            icon="lock-closed"
            tone="lock"
            t={t}
            busy={busy === "lock"}
            onPress={() => run(
              "lock",
              async () => {
                if (!isDraft) await calculateAmMonth(yearMonth);
                await lockAmMonth(yearMonth);
              },
              `Lock ${yearMonth}?`,
              "Freezes AM credit in Invoice day-lock table + cache. CRM shuffles after this will NOT change past-month numbers on Android or iOS.",
            )}
          />
        ) : (
          <>
            <LockBtn
              label="Unlock"
              icon="lock-open"
              tone="unlock"
              t={t}
              busy={busy === "unlock"}
              onPress={() => run(
                "unlock",
                () => unlockAmMonth(yearMonth),
                `Unlock ${yearMonth}?`,
                "Filters will leave the frozen snapshot and may drift with CRM until you lock again.",
              )}
            />
            <LockBtn
              label="Recalculate"
              icon="refresh"
              tone="recalc"
              t={t}
              busy={busy === "recalculate"}
              onPress={() => run(
                "recalculate",
                () => recalculateAmMonth(yearMonth, { relock: true }),
                `Recalculate & relock ${yearMonth}?`,
                "Rewrites the frozen snapshot for ALL AMs from current Invoice + shuffle-as-of month start.",
              )}
            />
          </>
        )}
      </View>
      {isFinal && lockedAt ? (
        <Text style={{ color: t.muted, fontSize: 10, marginTop: 6, textAlign: "right" }}>
          Frozen {new Date(lockedAt).toLocaleString()} · {Platform.OS}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Dinesh-only Sales period Lock / Unlock / Recalculate (scope + month).
 */
export function SalesPeriodLockControls({
  scope = "month",
  yearMonth,
  startDate = "",
  endDate = "",
  snapshotStatus,
  lockedAt,
  periodId,
  onChanged,
  t,
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(null);
  if (!isIncentiveOwner(user) || !yearMonth) return null;

  const isFinal = snapshotStatus === "final";
  const body = {
    scope,
    year_month: yearMonth,
    start_date: startDate,
    end_date: endDate,
  };

  const run = (action, fn, title, msg) => {
    Alert.alert(title, msg, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setBusy(action);
          try {
            await fn();
            onChanged?.();
          } catch (e) {
            Alert.alert("Error", formatApiError(e, `Failed to ${action}`));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {!isFinal ? (
          <LockBtn
            label="Lock sales"
            icon="lock-closed"
            tone="lock"
            t={t}
            busy={busy === "lock"}
            onPress={() => run(
              "lock",
              () => lockSalesPeriod(body),
              `Lock sales ${scope} ${yearMonth}?`,
              "Freezes BDA/BDM team numbers for this filter (day-lock table). Same on iOS and Android.",
            )}
          />
        ) : (
          <>
            <LockBtn
              label="Unlock"
              icon="lock-open"
              tone="unlock"
              t={t}
              busy={busy === "unlock"}
              onPress={() => run(
                "unlock",
                () => unlockSalesPeriod({ ...body, period_id: periodId }),
                `Unlock sales ${yearMonth}?`,
                "Past filter may drift until you lock again.",
              )}
            />
            <LockBtn
              label="Recalculate"
              icon="refresh"
              tone="recalc"
              t={t}
              busy={busy === "recalculate"}
              onPress={() => run(
                "recalculate",
                () => recalculateSalesPeriod({ ...body, relock: true }),
                `Recalculate sales ${yearMonth}?`,
                "Rebuilds and re-locks this sales period for all teams.",
              )}
            />
          </>
        )}
      </View>
      {isFinal && lockedAt ? (
        <Text style={{ color: t.muted, fontSize: 10, marginTop: 6 }}>
          Frozen {new Date(lockedAt).toLocaleString()}
        </Text>
      ) : null}
    </View>
  );
}

/** Cache TTL: locked periods stay warm much longer. */
export function incentivesCacheTtlMs(snapshotStatus) {
  return snapshotStatus === "final" ? 24 * 60 * 60 * 1000 : 60 * 1000;
}
