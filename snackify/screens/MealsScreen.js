import React, { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { snackApi } from "../api";
import { SN } from "../data";
import { PantryScreen, PrimaryBtn, Err } from "../ui";
import { ONION_OPTIONS } from "../constants";
import BackHeader from "../components/BackHeader";
import { useSnackTokens } from "../TokenContext";
import { CoinPrice } from "../components/Coin";
import CheckoutSuccess from "../components/CheckoutSuccess";

const REASON_COPY = {
  past: "You can only book lunch for the next working day.",
  future_locked: "This date is not open for booking yet.",
  not_open_yet: "Booking opens at 9:00 AM IST.",
  locked: "Booking closed at 8:00 PM IST.",
  skip_only: "After 6 PM you can only skip.",
  weekend: "No lunch booking on weekends.",
  already_booked: "Hey, you already booked your meal. Come back tomorrow to book again.",
  open: "",
};

const CHOICE_META = {
  veg: { emoji: "🥬", label: "Veg" },
  non_veg: { emoji: "🍗", label: "Non-veg" },
  egg: { emoji: "🥚", label: "Egg" },
  skip: { emoji: "🚫", label: "Skipped" },
};

function nextWorkingDayIst() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const d = new Date(Date.UTC(Number(m.year), Number(m.month) - 1, Number(m.day)));
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function weekdayUtc(dateStr) {
  const [y, mo, da] = String(dateStr).split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
}

function formatMealDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00+05:30`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

export default function MealsScreen({ navigation }) {
  const tokens = useSnackTokens();
  const date = tokens?.mealOptions?.date || nextWorkingDayIst();
  const [opts, setOpts] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState("");
  const [onion, setOnion] = useState("no onion");
  const [payPhase, setPayPhase] = useState("");
  const payRef = useRef({ amount: 0 });

  const load = useCallback(async () => {
    try {
      const data = await snackApi.mealOptions(date);
      setOpts(data);
      setErr("");
      const booked = data?.booking?.choice;
      if (booked) setChoice(booked);
      if (data?.booking?.onion_slices) setOnion(data.booking.onion_slices);
    } catch (e) { setErr(e.message); }
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const mealDate = opts?.meal_date || date;
  const alreadyBooked = Boolean(
    opts?.already_booked || (opts?.booking?.choice && opts.booking.choice !== "skip"),
  );
  const canBook = !alreadyBooked && opts?.canBook !== false && opts?.working_day !== false;
  const canSkip = opts?.canSkip !== false && opts?.working_day !== false;
  const reason = alreadyBooked
    ? REASON_COPY.already_booked
    : (REASON_COPY[opts?.reason] || opts?.reason || "");
  const types = opts?.options || [];
  const typeList = Array.isArray(types) ? types : Object.keys(types || {});
  const showOnion = (weekdayUtc(mealDate) === 3 || weekdayUtc(mealDate) === 5) && choice === "non_veg";
  const tokenPrice = Number(opts?.token_price || tokens?.mealOptions?.token_price || 0);
  const bookedChoice = opts?.booking?.choice;
  const bookedMeta = CHOICE_META[bookedChoice] || {
    emoji: "🍱",
    label: String(bookedChoice || "meal").replace(/_/g, " "),
  };

  const book = async () => {
    if (!choice) return;
    if (alreadyBooked && choice !== "skip") {
      setErr("Hey, you already booked your meal. Come back tomorrow to book again.");
      return;
    }
    setBusy(true);
    setErr("");
    const charged = choice === "skip" ? 0 : tokenPrice;
    payRef.current = { amount: charged };
    setPayPhase("paying");
    try {
      const payload = { date: mealDate, choice };
      if (showOnion) payload.onion_slices = onion;
      await snackApi.bookMeal(payload);
      tokens?.refresh?.();
      await load();
      setPayPhase("paid");
    } catch (e) {
      setPayPhase("fail");
      setErr(e.message);
    } finally { setBusy(false); }
  };

  return (
    <PantryScreen>
      <BackHeader title="Book lunch" navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {alreadyBooked ? (
          <View style={styles.doneCard}>
            <View style={styles.doneIconWrap}>
              <Ionicons name="checkmark-circle" size={54} color="#1BA672" />
            </View>
            <Text style={styles.doneHey}>Hey, you already booked your meal</Text>
            <Text style={styles.doneBody}>
              Come back tomorrow to book again. Only one lunch booking is allowed per day.
            </Text>
            <View style={styles.doneMeal}>
              <Text style={styles.doneEmoji}>{bookedMeta.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.doneMealLbl}>{bookedMeta.label} lunch</Text>
                <Text style={styles.doneMealSub}>{formatMealDay(mealDate)}</Text>
                {opts?.booking?.onion_slices && opts.booking.onion_slices !== "no onion" ? (
                  <Text style={styles.doneMealSub}>Onion: {opts.booking.onion_slices}</Text>
                ) : null}
              </View>
            </View>
            <PrimaryBtn
              title="View my meal ticket"
              onPress={() => navigation.navigate("SnackifyMealBox")}
              style={{ marginTop: 18 }}
            />
            {canSkip ? (
              <PrimaryBtn
                outline
                title="Skip this meal instead"
                onPress={() => { setChoice("skip"); book(); }}
                loading={busy}
                style={{ marginTop: 10 }}
              />
            ) : null}
          </View>
        ) : (
          <>
            <Text style={styles.sub}>
              Booking lunch for {formatMealDay(mealDate)}. Your printed token is ready after pantry confirms.
            </Text>
            {tokenPrice && choice !== "skip" ? (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 }}>
                <CoinPrice amount={tokenPrice} size={16} suffix="coins" />
              </View>
            ) : null}
            {reason ? <Text style={styles.reason}>{reason}</Text> : null}
            <Err text={err} />

            {canBook || canSkip ? (
              <>
                <Text style={styles.lbl}>Meal choice</Text>
                <View style={styles.chips}>
                  {typeList.map((t) => {
                    const key = t?.type || t?.id || t;
                    const label = String(key).replace(/_/g, " ");
                    const on = choice === key;
                    const disabled = key !== "skip" && !canBook;
                    return (
                      <Pressable
                        key={key}
                        disabled={disabled}
                        onPress={() => setChoice(key)}
                        style={[styles.chip, on && styles.chipOn, disabled && { opacity: 0.4 }]}
                      >
                        <Text style={[styles.chipTxt, on && { color: "#fff" }]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                  {!typeList.includes("skip") ? (
                    <Pressable
                      disabled={!canSkip}
                      onPress={() => setChoice("skip")}
                      style={[styles.chip, choice === "skip" && styles.chipOn, !canSkip && { opacity: 0.4 }]}
                    >
                      <Text style={[styles.chipTxt, choice === "skip" && { color: "#fff" }]}>skip</Text>
                    </Pressable>
                  ) : null}
                </View>

                {showOnion ? (
                  <>
                    <Text style={styles.lbl}>Onion slices</Text>
                    <View style={styles.chips}>
                      {ONION_OPTIONS.map((o) => (
                        <Pressable key={o} onPress={() => setOnion(o)} style={[styles.chip, onion === o && styles.chipOn]}>
                          <Text style={[styles.chipTxt, onion === o && { color: "#fff" }]}>{o}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}

                <PrimaryBtn
                  title={
                    choice === "skip"
                      ? "Skip meal"
                      : choice
                        ? `Pay ${tokenPrice} coins · Book ${String(choice).replace(/_/g, " ")}`
                        : "Select a meal"
                  }
                  onPress={book}
                  loading={busy}
                  disabled={!choice || (choice !== "skip" && !canBook) || (choice === "skip" && !canSkip)}
                  style={{ marginTop: 18 }}
                />
              </>
            ) : (
              <Text style={styles.reason}>{reason || "Booking is currently closed."}</Text>
            )}
          </>
        )}

        {!alreadyBooked ? (
          <PrimaryBtn outline title="My meal box / token" onPress={() => navigation.navigate("SnackifyMealBox")} style={{ marginTop: 18 }} />
        ) : null}
        <PrimaryBtn outline title="Booking history" onPress={() => navigation.navigate("SnackifyMealHistory")} style={{ marginTop: alreadyBooked ? 10 : 10 }} />
      </ScrollView>
      <CheckoutSuccess
        visible={!!payPhase}
        status={payPhase === "paying" ? "running" : payPhase === "paid" ? "ok" : payPhase === "fail" ? "fail" : ""}
        amount={payRef.current.amount}
        variant="booking"
        error={err}
        onDone={() => {
          setPayPhase("");
          load();
        }}
        onFailClose={() => setPayPhase("")}
      />
    </PantryScreen>
  );
}

const styles = StyleSheet.create({
  sub: { fontFamily: FONT.light, color: SN.muted, marginTop: 8, lineHeight: 20 },
  reason: { fontFamily: FONT.regular, color: SN.brown, marginTop: 8 },
  lbl: { fontFamily: FONT.medium, color: SN.ink, marginTop: 18, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: "#fff", justifyContent: "center" },
  chipOn: { backgroundColor: SN.espresso },
  chipTxt: { fontFamily: FONT.medium, color: SN.ink, fontSize: 13, textTransform: "capitalize" },
  doneCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "#D8F3E8",
    alignItems: "center",
  },
  doneIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#E8F8F1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  doneHey: {
    fontFamily: FONT.medium,
    fontSize: 22,
    color: SN.ink,
    textAlign: "center",
    lineHeight: 28,
  },
  doneBody: {
    fontFamily: FONT.regular,
    fontSize: 14,
    color: SN.muted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
  },
  doneMeal: {
    marginTop: 18,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: SN.beige,
    borderRadius: 16,
    padding: 14,
  },
  doneEmoji: { fontSize: 32 },
  doneMealLbl: { fontFamily: FONT.medium, fontSize: 16, color: SN.ink, textTransform: "capitalize" },
  doneMealSub: { fontFamily: FONT.light, fontSize: 13, color: SN.muted, marginTop: 2 },
});
