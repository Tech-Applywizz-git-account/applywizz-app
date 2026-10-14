import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Text, TextInput } from "../../components/AppText";

import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../components/ui";
import { fmtUsd, fmtInr } from "../../utils/billing";
import {
  amDisplayInr,
  amPayableNote,
  paymentKindBadge,
  paymentProvenanceBadges,
} from "../../utils/incentives";

const BADGE_COLORS = {
  teal: { bg: "#CCFBF1", text: "#115E59", border: "#99F6E4" },
  amber: { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  slate: { bg: "#F1F5F9", text: "#334155", border: "#E2E8F0" },
  indigo: { bg: "#E0E7FF", text: "#3730A3", border: "#C7D2FE" },
  violet: { bg: "#EDE9FE", text: "#5B21B6", border: "#DDD6FE" },
  cyan: { bg: "#CFFAFE", text: "#155E75", border: "#A5F3FC" },
  emerald: { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0" },
};

export function BoostLiveBanner({ periods = [], t }) {
  const rows = Array.isArray(periods) ? periods : [];
  if (!rows.length) return null;
  const live = rows.filter((row) => row.is_live);
  const featured = live[0] || rows[0];
  const liveNow = live.length > 0;
  return (
    <Card style={{
      marginBottom: 12,
      backgroundColor: liveNow ? "#EA580C" : t.card,
      borderColor: liveNow ? "#FDBA74" : t.border,
    }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{
          color: liveNow ? "#FFEDD5" : t.muted,
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}
        >
          {liveNow ? "Live boost window" : "Boosted days this month"}
        </Text>
        <Text style={{
          color: liveNow ? "#9A3412" : t.accent,
          backgroundColor: liveNow ? "#fff" : t.accent + "18",
          overflow: "hidden",
          fontWeight: "800",
          fontSize: 16,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 10,
        }}
        >
          ×{featured.multiplier}
        </Text>
      </View>
      {liveNow ? (
        <>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 10, lineHeight: 26 }}>
            Currently boosting — bring your entire strength
          </Text>
          <Text style={{ color: "#FFEDD5", fontSize: 13, marginTop: 8, lineHeight: 19, fontWeight: "400" }}>
            Every paid invoice in this window counts at ×{featured.multiplier} toward actual incentive revenue. The bill amount stays the same. Go productive.
          </Text>
        </>
      ) : (
        <Text style={{ color: t.subtext, fontSize: 12, marginTop: 8, lineHeight: 18, fontWeight: "300" }}>
          Paid invoices in these 8:00 PM → 7:59 PM windows multiply into actual revenue. When a window goes live, bring your entire strength.
        </Text>
      )}
      {rows.map((row) => (
        <View key={row.id || row.business_day} style={{ marginTop: 10 }}>
          <Text style={{ color: liveNow ? "#fff" : t.text, fontWeight: "600", fontSize: 13 }}>
            {row.window_text || row.business_day} × {row.multiplier}
          </Text>
          <Text style={{ color: liveNow ? "#FFEDD5" : t.muted, fontSize: 11, marginTop: 2, fontWeight: "300" }}>
            {row.audience === "accounts" ? "AM / CSM" : "BDA / BDM"}
            {row.approved_by_name ? ` · granted by ${row.approved_by_name}` : ""}
          </Text>
        </View>
      ))}
    </Card>
  );
}

export function ChipRow({ items, value, onChange, t }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      {items.map((item) => {
        const active = value === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => onChange(item.id)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 16,
              backgroundColor: active ? t.accent : t.card,
              borderWidth: 1,
              borderColor: active ? t.accent : t.border,
            }}
          >
            <Text style={{ color: active ? "#fff" : t.subtext, fontWeight: "500", fontSize: 12 }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function MonthPicker({ yearMonth, onChange, t }) {
  const shift = (delta) => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 }}>
      <TouchableOpacity onPress={() => shift(-1)} style={{ padding: 8 }}>
        <Ionicons name="chevron-back" size={20} color={t.accent} />
      </TouchableOpacity>
      <Text style={{ flex: 1, textAlign: "center", fontWeight: "500", color: t.text }}>{yearMonth}</Text>
      <TouchableOpacity onPress={() => shift(1)} style={{ padding: 8 }}>
        <Ionicons name="chevron-forward" size={20} color={t.accent} />
      </TouchableOpacity>
    </View>
  );
}

export function Badge({ text, tone = "slate" }) {
  const c = BADGE_COLORS[tone] || BADGE_COLORS.slate;
  return (
    <View style={{
      alignSelf: "flex-start",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      marginRight: 4,
      marginBottom: 4,
    }}
    >
      <Text style={{ color: c.text, fontSize: 9, fontWeight: "500", textTransform: "uppercase" }}>
        {text}
      </Text>
    </View>
  );
}

export function StatTile({ label, value, sub, t }) {
  return (
    <View style={{
      flex: 1,
      minWidth: "45%",
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    }}
    >
      <Text style={{ color: t.muted, fontSize: 11, fontWeight: "500", textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 20, fontWeight: "500", marginTop: 4 }}>{value}</Text>
      {sub ? <Text style={{ color: t.subtext, fontSize: 11, marginTop: 4, fontWeight: "300"}}>{sub}</Text> : null}
    </View>
  );
}

export function Hero({ title, amount, sub, t, tone }) {
  const bg = tone || t.accent;
  return (
    <Card style={{ backgroundColor: bg, marginBottom: 12 }}>
      <Text style={{ color: "#ffffffcc", fontSize: 12, fontWeight: "500", textTransform: "uppercase" }}>{title}</Text>
      <Text style={{ color: "#fff", fontSize: 32, fontWeight: "500", marginTop: 6 }}>{amount}</Text>
      {sub ? <Text style={{ color: "#ffffffcc", marginTop: 6, fontSize: 13 }}>{sub}</Text> : null}
    </Card>
  );
}

export function SearchBar({ value, onChange, placeholder, t }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={t.muted}
      style={{
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.card,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: t.text,
        marginBottom: 12,
      }}
    />
  );
}

export function AmPaymentRow({ row, index, t }) {
  const kindBadge = paymentKindBadge(row.payment_kind);
  const extraBadges = paymentProvenanceBadges(row);
  const calc = row.calculation
    || (row.retention_percent
      ? `${fmtUsd(row.base_usd ?? row.eligible_usd)} × ${Number(row.retention_percent)}% = ${fmtUsd(row.credited_usd ?? row.eligible_usd)}`
      : fmtUsd(row.eligible_usd));

  return (
    <View style={{
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      backgroundColor: row.is_projected ? t.accent + "08" : "transparent",
    }}
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Text style={{ color: t.muted, fontSize: 11, width: 18, fontWeight: "300"}}>{index + 1}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: "500", fontFamily: "monospace", fontSize: 12 }}>
            {row.awl_id}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
            {kindBadge ? <Badge text={kindBadge.text} tone={kindBadge.tone} /> : null}
            {extraBadges.map((b) => <Badge key={b.text} text={b.text} tone={b.tone} />)}
          </View>
          {row.label ? (
            <Text style={{ color: t.subtext, fontSize: 11, marginTop: 4, fontWeight: "300"}}>{row.label}</Text>
          ) : null}
          <Text style={{ color: t.text, fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>{calc}</Text>
          {row.paid_amount_usd && Number(row.paid_amount_usd) > 0 ? (
            <Text style={{ color: t.muted, fontSize: 10, marginTop: 2, fontWeight: "300"}}>
              Invoice paid {fmtUsd(row.paid_amount_usd)}
            </Text>
          ) : null}
        </View>
        <Text style={{ color: t.text, fontWeight: "500", fontSize: 13 }}>
          {fmtUsd(row.credited_usd ?? row.eligible_usd)}
        </Text>
      </View>
    </View>
  );
}

export function AmSummaryBlock({ summary, yearMonth, isFutureMonth, weightedEnabled, t }) {
  if (!summary) return null;
  const note = amPayableNote(summary);
  const payments = summary.payments || [];
  const showWeighted = weightedEnabled ?? Boolean(summary.weighted_month_pct_enabled);
  const face = summary.revenue_usd;
  const credited = summary.credited_revenue_usd ?? summary.revenue_usd;
  const sub = showWeighted
    ? `Face ${fmtUsd(face)} · credited ${fmtUsd(credited)} · ${summary.slab_label || "—"} · Month ${summary.weighted_retention_pct ?? "—"}%`
    : `Face ${fmtUsd(face)} · credited (slab) ${fmtUsd(credited)} · ${summary.slab_label || "—"}`;

  return (
    <View>
      {isFutureMonth ? (
        <Card style={{ marginBottom: 12, backgroundColor: t.accent + "10" }}>
          <Text style={{ color: t.accent, fontSize: 12 }}>
            Projected month — prepaid accruals and scheduled renewal slices.
          </Text>
        </Card>
      ) : null}

      <Hero
        title={`AM · ${yearMonth}${isFutureMonth ? " · projected" : ""}`}
        amount={amDisplayInr(summary)}
        sub={sub}
        t={t}
        tone="#0F766E"
      />

      {note ? (
        <Card style={{ marginBottom: 12 }}>
          <Text style={{ color: note.includes("₹0") ? t.danger : t.warning, fontWeight: "500", fontSize: 12 }}>
            {note}
          </Text>
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <StatTile label="Base slab" value={fmtInr(summary.base_inr)} t={t} />
        {showWeighted ? (
          <StatTile label="Base × %" value={fmtInr(summary.projected_inr ?? summary.base_inr)} t={t} />
        ) : null}
        <StatTile label="Perf. bonus" value={fmtInr(summary.performance_bonus_inr)} t={t} />
        <StatTile label="Clawback" value={fmtInr(summary.clawback_inr)} t={t} />
        <StatTile label="Renewal gate" value={`${summary.renewal_rate_pct ?? 0}%`} sub={summary.gate_passed ? "Passed" : "Failed"} t={t} />
        <StatTile label="Payable" value={fmtInr(summary.gate_passed ? summary.total_inr : 0)} t={t} />
      </View>

      <Card>
        <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>
          Payments ({payments.length})
        </Text>
        {payments.length === 0 ? (
          <Text style={{ color: t.muted, textAlign: "center", paddingVertical: 16, fontWeight: "300"}}>
            No AM-attributed payments this month
          </Text>
        ) : (
          payments.map((p, i) => <AmPaymentRow key={`${p.awl_id}-${i}`} row={p} index={i} t={t} />)
        )}
      </Card>
    </View>
  );
}
