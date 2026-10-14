import React, { useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";

const EMPTY = "—";
const WATERMARK_SRC = require("../assets/ticket-wm-logo.png");
const SEAL_SALT = "SNK-MEAL-TICKET-v1";

function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Two-round mix of displayed + hidden token fields. Same live token → same seal. */
function fingerprintOf(src, displayed) {
  const hidden = [
    src.id,
    src.pk,
    src.uuid,
    src.booking_id,
    src.bookingId,
    src.user_id,
    src.userId,
    src.employee_id,
    typeof src.user === "object" ? src.user?.id : src.user,
    src.created_at,
    src.issued_at,
    src.issued_on,
    src.updated_at,
  ]
    .map((v) => (v == null || typeof v === "object" ? "" : String(v).trim()))
    .filter(Boolean)
    .join("~");
  const visible = [displayed.code, displayed.name, displayed.date, displayed.meal, displayed.cabin].join("|");
  const payload = `${SEAL_SALT}|${visible}|${hidden}`;
  const a = fnv1a(payload);
  const b = fnv1a(`${a.toString(16)}:${payload.split("").reverse().join("")}`);
  return (a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0")).toUpperCase();
}

function sealFromFingerprint(fp) {
  return `AW-${fp.slice(0, 4)}-${fp.slice(12, 16)}`;
}

function identiconCells(fp) {
  const cells = [];
  for (let i = 0; i < 81; i += 1) {
    const hex = parseInt(fp[i % fp.length], 16);
    if (((hex + i * 5) & 3) === 0) continue;
    cells.push({ key: i, r: Math.floor(i / 9), c: i % 9 });
  }
  return cells;
}

function firstText(...vals) {
  for (const v of vals) {
    if (v == null || typeof v === "object") continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function formatMealChoice(raw) {
  const s = String(raw || "").toLowerCase().replace(/_/g, " ").trim();
  if (!s) return EMPTY;
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTicketDate(token) {
  const raw = firstText(token?.date, token?.meal_date, token?.booking_date);
  if (!raw) return EMPTY;
  try {
    const d = new Date(String(raw).includes("T") ? raw : `${raw}T12:00:00+05:30`);
    if (Number.isNaN(d.getTime())) return raw;
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return raw;
  }
}

/** Bind ticket rows to the live token/booking record — never hardcoded people. */
function fieldsFromToken(token) {
  const t = token && typeof token === "object" ? token : {};
  const nested = t.token && typeof t.token === "object" ? t.token : {};
  const src = { ...nested, ...t };
  const code = firstText(
    src.token_number,
    typeof src.token === "string" ? src.token : "",
    src.code,
    src.verification_code,
    src.verificationCode,
  ) || EMPTY;
  const displayed = {
    code,
    name: firstText(
      src.preferred_name,
      src.name,
      src.user_name,
      src.employee_name,
      src.cardholder,
      src.display_name,
      src.full_name,
    ) || EMPTY,
    date: formatTicketDate(src),
    meal: formatMealChoice(src.choice || src.meal_type || src.meal).toUpperCase(),
    cabin: firstText(src.cabin_name, src.cabin, src.location, src.department, src.cabin_label) || EMPTY,
  };
  displayed.fingerprint = fingerprintOf(src, displayed);
  displayed.seal = sealFromFingerprint(displayed.fingerprint);
  displayed.barcodeSeed = displayed.fingerprint;
  return displayed;
}

function TicketWatermark({ fingerprint, seal }) {
  const cells = useMemo(() => identiconCells(String(fingerprint || "0")), [fingerprint]);
  return (
    <View
      pointerEvents="none"
      collapsable={false}
      accessibilityElementsHidden
      style={styles.watermarkWrap}
    >
      <View style={styles.watermarkStack} collapsable={false}>
        <View style={styles.identicon} collapsable={false}>
          {cells.map((cell) => (
            <View
              key={cell.key}
              style={[
                styles.identiconDot,
                { top: cell.r * 11, left: cell.c * 11 },
              ]}
            />
          ))}
        </View>
        <Image
          source={WATERMARK_SRC}
          style={styles.watermarkLogo}
          resizeMode="contain"
          fadeDuration={0}
        />
        <Text style={styles.watermarkSeal}>{seal}</Text>
      </View>
    </View>
  );
}

/** Decorative non-scannable barcode strip (visual only). */
function BarcodeStrip({ seed = "meal" }) {
  const bars = useMemo(() => {
    const out = [];
    let n = 0;
    for (let i = 0; i < String(seed).length; i += 1) n += String(seed).charCodeAt(i);
    for (let i = 0; i < 42; i += 1) {
      const w = ((n + i * 17) % 5) + 1;
      const gap = ((n + i * 7) % 3) + 1;
      out.push({ key: i, w, gap });
    }
    return out;
  }, [seed]);

  return (
    <View style={styles.barcode} accessibilityElementsHidden>
      {bars.map((b) => (
        <View key={b.key} style={{ width: b.w, height: 36 + (b.w % 3) * 4, backgroundColor: SN.ink, marginRight: b.gap }} />
      ))}
    </View>
  );
}

/**
 * BookMyShow-style digital lunch ticket.
 * Show to the food counter — display only (no QR).
 */
export default function MealTicketSheet({ visible, onClose, token }) {
  const { code, name, date, meal, cabin, barcodeSeed, fingerprint, seal } = fieldsFromToken(token);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>Meal ticket</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.caption}>Show this to the food counter</Text>

          <View style={styles.ticketShadow}>
            <View style={styles.ticket} collapsable={false}>
              <View style={styles.stub}>
                <Text style={styles.brand}>SNACKIFY</Text>
                <Text style={styles.stubSub}>LUNCH TOKEN</Text>
              </View>

              <View style={styles.notchRow}>
                <View style={styles.notchLeft} />
                <View style={styles.dashLine} />
                <View style={styles.notchRight} />
              </View>

              <View style={styles.body} collapsable={false}>
                <TicketWatermark fingerprint={fingerprint} seal={seal} />
                <View style={styles.bodyContent} collapsable={false}>
                  <Text style={styles.codeLbl}>TOKEN</Text>
                  <Text style={styles.code} selectable>{String(code)}</Text>

                  <View style={styles.row}>
                    <Text style={styles.k}>Name</Text>
                    <Text style={styles.v}>{name}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.k}>Date</Text>
                    <Text style={styles.v}>{date}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.k}>Meal</Text>
                    <Text style={styles.v}>{meal}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.k}>Cabin</Text>
                    <Text style={styles.v}>{cabin}</Text>
                  </View>

                  <View style={styles.barcodeWrap}>
                    <BarcodeStrip seed={String(barcodeSeed)} />
                    <Text style={styles.barcodeHint}>Counter verification</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function TicketButton({ onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.ticketBtn, disabled && styles.ticketBtnOff]}
      hitSlop={8}
      accessibilityLabel="Meal ticket"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Ionicons
        name={disabled ? "ticket-outline" : "ticket"}
        size={20}
        color={disabled ? SN.muted : "#EA580C"}
      />
    </Pressable>
  );
}

const BG = "#1A120C";

const styles = StyleSheet.create({
  ticketBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF7ED",
    borderWidth: 1.5,
    borderColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
  },
  ticketBtnOff: {
    opacity: 0.5,
    borderColor: SN.line,
    backgroundColor: "#fff",
  },
  root: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 8,
  },
  topTitle: { fontFamily: FONT.medium, fontSize: 16, color: "#fff" },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { paddingHorizontal: 22, paddingBottom: 40 },
  caption: {
    fontFamily: FONT.regular,
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginBottom: 18,
    marginTop: 6,
  },
  ticketShadow: {
    borderRadius: 18,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    backgroundColor: "#FFFDF9",
  },
  ticket: {
    backgroundColor: "#FFFDF9",
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
  },
  watermarkWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  watermarkStack: {
    width: 210,
    alignItems: "center",
    justifyContent: "center",
  },
  identicon: {
    position: "absolute",
    width: 95,
    height: 95,
    opacity: 0.16,
  },
  identiconDot: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 1.5,
    backgroundColor: "#6B5344",
  },
  watermarkLogo: {
    width: 210,
    height: 96,
    opacity: 0.12,
  },
  watermarkSeal: {
    marginTop: 6,
    fontFamily: FONT.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: "#8A7464",
    opacity: 0.28,
  },
  stub: {
    backgroundColor: SN.espresso,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    zIndex: 1,
  },
  brand: {
    fontFamily: FONT.medium,
    fontSize: 13,
    letterSpacing: 3,
    color: "rgba(255,255,255,0.85)",
  },
  stubSub: {
    fontFamily: FONT.medium,
    fontSize: 20,
    color: "#fff",
    marginTop: 6,
  },
  notchRow: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    zIndex: 1,
  },
  notchLeft: {
    width: 14,
    height: 28,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    backgroundColor: BG,
    marginLeft: -1,
  },
  notchRight: {
    width: 14,
    height: 28,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    backgroundColor: BG,
    marginRight: -1,
  },
  dashLine: {
    flex: 1,
    height: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: SN.line,
    marginHorizontal: 4,
  },
  body: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    paddingTop: 4,
    backgroundColor: "#FFFDF9",
    position: "relative",
    minHeight: 320,
  },
  bodyContent: {
    position: "relative",
    zIndex: 1,
    backgroundColor: "transparent",
  },
  codeLbl: {
    fontFamily: FONT.regular,
    fontSize: 11,
    letterSpacing: 2,
    color: SN.muted,
    textAlign: "center",
  },
  code: {
    fontFamily: FONT.medium,
    fontSize: 40,
    color: SN.ink,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 18,
    letterSpacing: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SN.line,
  },
  k: { fontFamily: FONT.regular, fontSize: 13, color: SN.muted },
  v: { fontFamily: FONT.medium, fontSize: 13, color: SN.ink, maxWidth: "62%", textAlign: "right" },
  barcodeWrap: { marginTop: 22, alignItems: "center" },
  barcode: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    height: 48,
    overflow: "hidden",
    maxWidth: "100%",
  },
  barcodeHint: {
    fontFamily: FONT.light,
    fontSize: 11,
    color: SN.muted,
    marginTop: 8,
  },
});
