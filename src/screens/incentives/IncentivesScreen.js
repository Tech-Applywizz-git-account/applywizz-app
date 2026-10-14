import React, { useCallback, useMemo, useState } from "react";
import { View, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchIncentiveProgress,
  fetchRoleDashboard,
  fetchSalesPeriodLockStatus,
} from "../../api/incentives";
import { getCached, setCached } from "../../api/queryCache";
import { INCENTIVES_PROGRESS_KEY, incentivesCacheKey } from "../../api/cacheKeys";
import { useAuth } from "../../context/AuthContext";
import { Card, useTheme, Button } from "../../components/ui";
import { ReportsSkeleton } from "../../components/Skeleton";
import {
  fmtUsd, fmtInr, formatApiError, canViewIncentives,
} from "../../utils/billing";
import {
  getIncentiveRoleMeta,
  isIncentiveAdmin,
  resolveIncentiveRoles,
} from "../../utils/incentives";
import { AmSummaryBlock, ChipRow, MonthPicker, BoostLiveBanner } from "./shared";
import {
  AmMonthLockControls,
  LockedPeriodBadge,
  SalesPeriodLockControls,
  isIncentiveOwner,
} from "./PeriodLockControls";
import { useScreenQuery } from "../../navigation/useScreenQuery";
import { useLiveRefresh, LIVE_STALE_MS } from "../../hooks/useLiveRefresh";

const STALE_MS = LIVE_STALE_MS;

function StatTile({ label, value, sub, t }) {
  return (
    <View style={{
      flex: 1, minWidth: "45%", backgroundColor: t.card, borderWidth: 1, borderColor: t.border,
      borderRadius: 12, padding: 12, marginBottom: 8,
    }}
    >
      <Text style={{ color: t.muted, fontSize: 11, fontWeight: "500", textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 20, fontWeight: "500", marginTop: 4 }}>{value}</Text>
      {sub ? <Text style={{ color: t.subtext, fontSize: 11, marginTop: 4, fontWeight: "300" }}>{sub}</Text> : null}
    </View>
  );
}

function Hero({ title, amount, sub, t }) {
  return (
    <Card style={{ backgroundColor: t.accent, marginBottom: 12 }}>
      <Text style={{ color: "#ffffffcc", fontSize: 12, fontWeight: "500", textTransform: "uppercase" }}>{title}</Text>
      <Text style={{ color: "#fff", fontSize: 32, fontWeight: "500", marginTop: 6 }}>{amount}</Text>
      {sub ? <Text style={{ color: "#ffffffcc", marginTop: 6, fontSize: 13 }}>{sub}</Text> : null}
    </Card>
  );
}

function RowLine({ left, right, sub, t }) {
  return (
    <View style={{
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border,
      flexDirection: "row", justifyContent: "space-between", gap: 8,
    }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: "500" }} numberOfLines={1}>{left}</Text>
        {sub ? <Text style={{ color: t.subtext, fontSize: 11, marginTop: 2, fontWeight: "300" }}>{sub}</Text> : null}
      </View>
      <Text style={{ color: t.text, fontWeight: "500" }}>{right}</Text>
    </View>
  );
}

function BdaView({ data, t }) {
  const summary = data?.summary || data || {};
  const half = Number(summary.half_usd ?? summary.revenue_usd ?? 0);
  const projected = summary.projected_incentive_inr ?? summary.projected_inr;
  const ladder = data?.slab_ladder || summary.slab_ladder || [];
  const payments = data?.recent_payments || summary.recent_payments || [];
  const daily = data?.daily_rows || [];
  const bonusDays = daily.filter((r) => r.daily_bonus_qualified);
  const hitToday = Boolean(summary.today_met_daily_bonus) || Number(summary.today_usd) >= 700;

  return (
    <View>
      <Hero
        title={data?.view_mode === "admin" ? "BDA · all departments" : "BDA · this half"}
        amount={fmtInr(projected ?? summary.projected_total_inr)}
        sub={`Boosted ${fmtUsd(summary.half_boosted_revenue_usd ?? (half || summary.total_revenue_usd))} · slab + daily (8PM–8PM)`}
        t={t}
      />
      {data?.view_mode === "admin" && Array.isArray(data?.bda_rows) && data.bda_rows.length > 0 ? (
        <Card>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>All BDAs</Text>
          {data.bda_rows.slice(0, 40).map((r, i) => (
            <RowLine
              key={r.user_id || i}
              left={r.name || r.user_name}
              sub={`Slab ${fmtInr(r.slab_incentive_inr)} + daily ${fmtInr(r.daily_bonus_total_inr)}`}
              right={fmtInr(r.projected_incentive_inr ?? r.incentive_inr)}
              t={t}
            />
          ))}
        </Card>
      ) : null}

      {data?.view_mode !== "admin" && (
        <>
          <Card>
            <Text style={{ fontWeight: "700", color: t.text, fontSize: 15 }}>How your pay adds up</Text>
            <RowLine left="1 · Biweekly slab (boosted)" sub={summary.current_slab_label} right={fmtInr(summary.slab_incentive_inr)} t={t} />
            <RowLine
              left="2 · Daily bonuses"
              sub={`${summary.daily_bonus_days || bonusDays.length} × 8PM–8PM day(s) ≥ $700 · USD × 0.5`}
              right={fmtInr(summary.daily_bonus_total_inr)}
              t={t}
            />
            <RowLine left="= Total this half" right={fmtInr(projected)} t={t} />
            {summary.half_actual_revenue_usd != null
              && Number(summary.half_actual_revenue_usd)
                !== Number(summary.half_boosted_revenue_usd ?? half) ? (
              <Text style={{ color: t.subtext, fontSize: 11, marginTop: 8, fontWeight: "300" }}>
                Actual {fmtUsd(summary.half_actual_revenue_usd)} → boosted{" "}
                {fmtUsd(summary.half_boosted_revenue_usd ?? half)} (slab uses boosted)
              </Text>
            ) : null}
          </Card>
          <Card style={{ marginTop: 12 }}>
            <Text style={{ fontWeight: "700", color: t.text, fontSize: 15 }}>Daily bonus (cash)</Text>
            <Text style={{ color: t.subtext, fontSize: 11, marginTop: 4, marginBottom: 10, fontWeight: "300" }}>
              Business day = prev day 8:00 PM → this day 7:59 PM IST. ≥ $700 (boosted) → USD × 0.5 ₹
            </Text>
            <Text style={{ color: hitToday ? "#047857" : t.text, fontSize: 22, fontWeight: "800" }}>
              Today {fmtUsd(summary.today_usd)}
              {hitToday ? ` → ${fmtInr(summary.today_daily_bonus_inr)}` : " · need $700+"}
            </Text>
            <Text style={{ color: t.subtext, fontSize: 12, marginTop: 6, marginBottom: 8 }}>
              This half {fmtInr(summary.daily_bonus_total_inr)} · {summary.daily_bonus_days || bonusDays.length} day(s)
            </Text>
            {bonusDays.length > 0 ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={{ color: "#047857", fontSize: 11, fontWeight: "700", marginBottom: 6 }}>
                  Dates you earned daily bonus
                </Text>
                {bonusDays.map((r) => (
                  <RowLine
                    key={`earned-${r.date}`}
                    left={`${r.weekday ? `${r.weekday} ` : ""}${r.short_label || r.date}`}
                    sub={fmtUsd(r.revenue_usd)}
                    right={fmtInr(r.daily_bonus_inr)}
                    t={t}
                  />
                ))}
              </View>
            ) : null}
            {daily.filter((r) => Number(r.revenue_usd) > 0).slice(0, 16).map((r) => (
              <RowLine
                key={r.date}
                left={`${r.weekday ? `${r.weekday} ` : ""}${r.short_label || r.label || r.date}`}
                sub={fmtUsd(r.revenue_usd)}
                right={r.daily_bonus_qualified ? fmtInr(r.daily_bonus_inr) : "—"}
                t={t}
              />
            ))}
          </Card>
        </>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <StatTile label="Today" value={fmtUsd(summary.today_usd)} t={t} />
        <StatTile label="This week" value={fmtUsd(summary.week_usd)} t={t} />
        <StatTile label="Half" value={fmtUsd(half)} sub={summary.pace ? `Pace: ${summary.pace}` : null} t={t} />
      </View>
      {ladder.length > 0 && (
        <Card>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>Slab ladder</Text>
          {ladder.map((s, i) => (
            <RowLine key={i} left={s.label || s.slab_label} right={fmtInr(s.incentive_inr ?? s.inr)} t={t} />
          ))}
        </Card>
      )}
      {payments.length > 0 && (
        <Card>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>Recent payments</Text>
          {payments.slice(0, 12).map((p, i) => (
            <RowLine key={i} left={p.client_name || p.awl_id} sub={p.paid_at} right={fmtUsd(p.amount ?? p.amount_usd)} t={t} />
          ))}
        </Card>
      )}
    </View>
  );
}

function BdmView({ data, t }) {
  const summary = data?.summary || data?.team_summary || {};
  const bdas = data?.bda_rows || [];
  const members = data?.team_member_rows || [];
  const bdmRows = data?.bdm_rows || [];
  const bonusRows = data?.daily_bonus_rows || [];
  const bdmTotal =
    summary.bdm_incentive_total_inr
    ?? summary.projected_total_inr
    ?? summary.total_bdm_incentive_inr
    ?? summary.projected_biweekly_inr;

  if (data?.view_mode === "admin" && bdmRows.length > 0) {
    const byDept = {};
    for (const row of bdmRows) {
      const dept = row.manager?.department || "Unassigned";
      if (!byDept[dept]) byDept[dept] = [];
      byDept[dept].push(row);
    }
    const deptTotal =
      summary.total_bdm_incentive_inr
      ?? (Number(summary.total_biweekly_inr || 0) + Number(summary.total_daily_bonus_inr || 0));
    return (
      <View>
        <Hero
          title="BDM · all departments"
          amount={fmtInr(deptTotal)}
          sub={`${bdmRows.length} teams · biweekly ${fmtInr(summary.total_biweekly_inr)} + daily ${fmtInr(summary.total_daily_bonus_inr)}`}
          t={t}
        />
        {Object.entries(byDept).map(([dept, rows]) => (
          <Card key={dept}>
            <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>{dept}</Text>
            {rows.map((row, i) => {
              const total =
                row.summary?.bdm_incentive_total_inr
                ?? row.summary?.projected_total_inr
                ?? (Number(row.summary?.projected_biweekly_inr || 0) + Number(row.summary?.daily_bonus_total_inr || 0));
              return (
                <RowLine
                  key={row.manager?.id || i}
                  left={row.manager?.name || "BDM"}
                  sub={`${row.team_size || (row.bda_rows || []).length} BDAs · slab ${fmtInr(row.summary?.projected_biweekly_inr)} + daily ${fmtInr(row.summary?.daily_bonus_total_inr)}`}
                  right={fmtInr(total)}
                  t={t}
                />
              );
            })}
          </Card>
        ))}
      </View>
    );
  }

  return (
    <View>
      <Hero
        title={`Your BDM incentive · team of ${data?.team_size ?? bdas.length}`}
        amount={fmtInr(bdmTotal)}
        sub={`Boosted ${fmtUsd(summary.half_boosted_revenue_usd ?? summary.half_revenue_usd ?? summary.half_usd ?? summary.team_half_usd)} / ${fmtUsd(data?.minimum_team_usd)} min`}
        t={t}
      />
      {summary.half_actual_revenue_usd != null
        && Number(summary.half_actual_revenue_usd)
          !== Number(summary.half_boosted_revenue_usd ?? summary.half_revenue_usd) && (
        <Text style={{ color: t.subtext, fontSize: 12, marginBottom: 8, fontWeight: "300" }}>
          Actual {fmtUsd(summary.half_actual_revenue_usd)} → after boost{" "}
          {fmtUsd(summary.half_boosted_revenue_usd ?? summary.half_revenue_usd)} (BDM uses boosted)
        </Text>
      )}

      <Card>
        <Text style={{ fontWeight: "700", color: t.text, fontSize: 15, marginBottom: 8 }}>How your pay adds up</Text>
        <RowLine left="1 · Biweekly slab" sub={summary.bdm_slab_label} right={fmtInr(summary.projected_biweekly_inr)} t={t} />
        <RowLine
          left="2 · Daily team bonuses"
          sub={`${summary.qualifying_days || 0} day(s) × ${fmtInr(summary.daily_bonus_inr)}`}
          right={fmtInr(summary.daily_bonus_total_inr)}
          t={t}
        />
        <RowLine left="= Your BDM total" right={fmtInr(bdmTotal)} t={t} />
        <Text style={{ color: t.muted, fontSize: 11, marginTop: 8, fontWeight: "300" }}>
          BDA slabs ({fmtInr(summary.team_bda_incentive_inr)}) are paid to BDAs, not you. Biweekly gate/slab use boosted team revenue (e.g. $14k face → $15k after boost counts as $15k).
        </Text>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={{ fontWeight: "700", color: t.text, fontSize: 15 }}>Daily team bonus (cash to you)</Text>
        <Text style={{ color: t.subtext, fontSize: 11, marginTop: 4, marginBottom: 8, fontWeight: "300" }}>
          Team hits {fmtUsd(summary.daily_target_usd)}/day → fixed {fmtInr(summary.daily_bonus_inr)} that day (not averaged)
        </Text>
        <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>
          Today {fmtUsd(summary.today_revenue_usd)} / {fmtUsd(summary.daily_target_usd)}
          {summary.today_met_daily_bonus ? " · earned" : ""}
        </Text>
        <Text style={{ color: t.subtext, fontSize: 12, marginTop: 6, marginBottom: 8 }}>
          This half {fmtInr(summary.daily_bonus_total_inr)} · {summary.qualifying_days || 0} bonus day(s)
        </Text>
        {bonusRows.filter((r) => r.qualified).length > 0 ? (
          <View style={{ marginBottom: 10 }}>
            <Text style={{ color: "#047857", fontSize: 11, fontWeight: "700", marginBottom: 6 }}>
              Dates your team earned daily bonus
            </Text>
            {bonusRows.filter((r) => r.qualified).map((r) => (
              <RowLine
                key={`earned-${r.date}`}
                left={r.short_label || r.date}
                sub={fmtUsd(r.team_revenue_usd)}
                right={fmtInr(r.bonus_inr)}
                t={t}
              />
            ))}
          </View>
        ) : null}
        {bonusRows.filter((r) => Number(r.team_revenue_usd) > 0).slice(0, 16).map((r) => (
          <RowLine
            key={r.date}
            left={r.short_label}
            sub={`${fmtUsd(r.team_revenue_usd)} / ${fmtUsd(r.target_usd)}`}
            right={r.qualified ? fmtInr(r.bonus_inr) : "—"}
            t={t}
          />
        ))}
      </Card>

      {bdas.length > 0 && (
        <Card style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "700", color: t.text, fontSize: 15, marginBottom: 4 }}>Team BDAs</Text>
          <Text style={{ color: t.subtext, fontSize: 11, marginBottom: 8, fontWeight: "300" }}>
            Half slab ₹ · today vs daily target (pace, not cash)
          </Text>
          {bdas.map((r, i) => (
            <RowLine
              key={r.user_id || i}
              left={r.name || r.user_name}
              sub={`Slab ${fmtInr(r.slab_incentive_inr)} + daily ${fmtInr(r.daily_bonus_inr)} · today ${fmtUsd(r.today_usd)}${r.today_met_daily_bonus ? " · bonus" : ""}`}
              right={fmtInr(r.incentive_inr)}
              t={t}
            />
          ))}
        </Card>
      )}

      {members.length > 0 ? (
        <>
          <Card style={{ marginTop: 12 }}>
            <Text style={{ fontWeight: "700", color: t.text, fontSize: 16, marginBottom: 4 }}>
              Team H1 / H2
            </Text>
            <Text style={{ color: t.subtext, fontSize: 11, marginBottom: 10, fontWeight: "300" }}>
              {data?.report_year_month || ""} · revenue · slab · incentive · month actual vs boost
            </Text>
            {members.map((r) => (
              <View key={r.user_id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border }}>
                <Text style={{ color: t.text, fontSize: 18, fontWeight: "800" }}>{r.name}</Text>
                <Text style={{ color: t.muted, fontSize: 11, marginTop: 2, fontWeight: "300" }}>{r.email}</Text>
                <View style={{ marginTop: 8, gap: 4 }}>
                  <Text style={{ color: t.subtext, fontSize: 12 }}>
                    H1 {fmtUsd(r.h1?.revenue_usd)} · {r.h1?.slab_label || "—"} · {fmtInr(r.h1?.incentive_inr)}
                  </Text>
                  <Text style={{ color: t.subtext, fontSize: 12 }}>
                    H2 {fmtUsd(r.h2?.revenue_usd)} · {r.h2?.slab_label || "—"} · {fmtInr(r.h2?.incentive_inr)}
                  </Text>
                  <Text style={{ color: t.text, fontSize: 12, fontWeight: "600", marginTop: 2 }}>
                    Actual {fmtUsd(r.month?.actual_revenue_usd)} → After boost {fmtUsd(r.month?.boosted_revenue_usd)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>

          <Card style={{ marginTop: 12 }}>
            <Text style={{ fontWeight: "700", color: t.text, fontSize: 16, marginBottom: 4 }}>
              Full month · actual vs boost
            </Text>
            <Text style={{ color: t.subtext, fontSize: 11, marginBottom: 10, fontWeight: "300" }}>
              Incentive = H1 + H2 slabs before / after boost
            </Text>
            {members.map((r) => (
              <View key={`m-${r.user_id}`} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}>
                <Text style={{ color: t.text, fontSize: 17, fontWeight: "800" }}>{r.name}</Text>
                <Text style={{ color: t.subtext, fontSize: 12, marginTop: 6 }}>
                  Actual {fmtUsd(r.month?.actual_revenue_usd)} · After boost {fmtUsd(r.month?.boosted_revenue_usd)}
                </Text>
                <Text style={{ color: t.text, fontSize: 12, marginTop: 4, fontWeight: "600" }}>
                  Incentive {fmtInr(r.month?.incentive_before_boost_inr)} → {fmtInr(r.month?.incentive_after_boost_inr)}
                </Text>
              </View>
            ))}
            {summary?.month_boosted_revenue_usd != null ? (
              <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.border }}>
                <Text style={{ color: t.muted, fontSize: 11, fontWeight: "600", textTransform: "uppercase" }}>Team total</Text>
                <Text style={{ color: t.text, fontSize: 13, marginTop: 4, fontWeight: "600" }}>
                  {fmtUsd(summary.month_actual_revenue_usd)} → {fmtUsd(summary.month_boosted_revenue_usd)}
                  {" · "}
                  {fmtInr(summary.month_bda_incentive_before_boost_inr)} → {fmtInr(summary.month_bda_incentive_after_boost_inr)}
                </Text>
              </View>
            ) : null}
          </Card>
        </>
      ) : null}
    </View>
  );
}

function CsmView({ data, t }) {
  const amRows = data?.am_rows || [];
  const csmRows = data?.csm_rows || [];
  return (
    <View>
      <Hero
        title={data?.view_mode === "admin" ? "CSM · all teams" : "CSM / AMM"}
        amount={fmtInr(data?.csm_incentive_inr ?? data?.team_summary?.total_csm_incentive_inr)}
        sub={`12% of paid AM pool ${fmtInr(data?.am_pool_inr ?? data?.team_summary?.total_am_pool_inr)}`}
        t={t}
      />
      {amRows.length > 0 && (
        <Card>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>AM team (pool)</Text>
          {amRows.map((r, i) => (
            <RowLine
              key={i}
              left={r.name || r.user_name}
              sub={r.counts_toward_pool ? "In pool" : "Excluded"}
              right={fmtInr(r.incentive_inr ?? r.total_inr)}
              t={t}
            />
          ))}
          <RowLine left="CSM @ 12%" right={fmtInr(data?.csm_incentive_inr)} t={t} />
        </Card>
      )}
      {csmRows.length > 0 && (
        <Card>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>All CSM teams</Text>
          {csmRows.map((r, i) => (
            <RowLine
              key={i}
              left={r.manager?.name || r.name}
              sub={`${r.team_size || 0} AMs · pool ${fmtInr(r.am_pool_inr)}`}
              right={fmtInr(r.csm_incentive_inr)}
              t={t}
            />
          ))}
        </Card>
      )}
    </View>
  );
}

const ADMIN_TABS = [
  { id: "overview", label: "Overview" },
  { id: "bda", label: "BDA" },
  { id: "bdm", label: "BDM" },
  { id: "am", label: "AM" },
  { id: "csm", label: "CSM" },
  { id: "tools", label: "Tools" },
];

const SCOPES = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "half", label: "Half" },
  { id: "month", label: "Month" },
];

function AdminTools({ navigation, t }) {
  const links = [
    { label: "AM Overview", sub: "Team charts & expandable rows", screen: "AmOverview" },
    { label: "AM Dashboard", sub: "AM drill-down (locked months frozen)", screen: "AmDashboard" },
    { label: "Unattributed payments", sub: "Paid with no CRM match", screen: "UnattributedPayments" },
    { label: "Policy & boosts", sub: "Approvals, dual credit, slabs, payroll", screen: "IncentiveAdmin" },
  ];
  return (
    <View>
      {links.map((item) => (
        <Card key={item.label} onPress={() => navigation.navigate(item.screen)}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "500", color: t.text }}>{item.label}</Text>
              <Text style={{ color: t.subtext, fontSize: 12, fontWeight: "300" }}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.muted} />
          </View>
        </Card>
      ))}
    </View>
  );
}

export default function IncentivesScreen({ navigation }) {
  const t = useTheme();
  const { user } = useAuth();
  const allowed = canViewIncentives(user);
  const roleMeta = useMemo(() => getIncentiveRoleMeta(user), [user]);
  const kind = roleMeta.kind;
  const roles = resolveIncentiveRoles(user);
  const admin = isIncentiveAdmin(user);
  const defaultMonth = new Date().toISOString().slice(0, 7);
  const { query, setQuery } = useScreenQuery({
    tab: "overview",
    scope: "half",
    yearMonth: defaultMonth,
  });
  const adminTab = query.tab || "overview";
  const scope = query.scope || "half";
  const yearMonth = query.yearMonth || defaultMonth;

  const fetchKind = useMemo(() => {
    if (!admin) {
      if (kind === "admin" && roles.isAm && !roles.isBda) return "am";
      return kind === "admin" ? "bda" : kind;
    }
    if (adminTab === "overview" || adminTab === "bdm") return "bdm";
    if (adminTab === "bda") return "bda";
    if (adminTab === "am") return "am";
    if (adminTab === "csm") return "csm";
    return null;
  }, [admin, adminTab, kind, roles.isAm, roles.isBda]);

  const dashKey = fetchKind ? incentivesCacheKey(fetchKind, scope, yearMonth) : null;
  const initialDash = dashKey ? getCached(dashKey, STALE_MS) : null;
  const initialProg = getCached(INCENTIVES_PROGRESS_KEY, STALE_MS);

  const [data, setData] = useState(initialDash?.data || null);
  const [progress, setProgress] = useState(initialProg?.data || null);
  const [salesLock, setSalesLock] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!initialDash?.data && !(admin && adminTab === "tools"));
  const [refreshing, setRefreshing] = useState(false);

  const owner = isIncentiveOwner(user);
  const amLocked = fetchKind === "am" && data?.snapshot_status === "final";
  const salesSnapshot = salesLock?.snapshot_status
    || (salesLock?.locked ? "final" : (data?.snapshot_status || "none"));
  const salesLocked = (fetchKind === "bdm" || fetchKind === "bda") && salesSnapshot === "final";
  const periodLocked = amLocked || salesLocked;

  const load = useCallback(async ({ force = false } = {}) => {
    if (!allowed) { setLoading(false); return; }
    if (admin && adminTab === "tools") {
      setData(null);
      setSalesLock(null);
      setLoading(false);
      return;
    }
    if (!fetchKind) {
      setLoading(false);
      return;
    }
    const key = incentivesCacheKey(fetchKind, scope, yearMonth);
    if (!force) {
      const hit = getCached(key, STALE_MS);
      const progHit = getCached(INCENTIVES_PROGRESS_KEY, STALE_MS);
      if (hit?.data) {
        setData(hit.data);
        setLoading(false);
        if (hit.data?.snapshot_status === "final" && fetchKind === "am" && !hit.stale) {
          return;
        }
      }
      if (progHit?.data) setProgress(progHit.data);
      if (hit && !hit.stale && fetchKind === "am") return;
    }
    setError(null);
    try {
      const wantSalesLock = owner && (fetchKind === "bdm" || fetchKind === "bda");
      const [dash, prog, lockStatus] = await Promise.all([
        fetchRoleDashboard(fetchKind, { scope, yearMonth }),
        fetchIncentiveProgress(),
        wantSalesLock
          ? fetchSalesPeriodLockStatus({ scope, yearMonth }).catch(() => null)
          : Promise.resolve(null),
      ]);
      setCached(key, dash);
      setData(dash);
      if (prog) {
        setCached(INCENTIVES_PROGRESS_KEY, prog);
        setProgress(prog);
      }
      setSalesLock(wantSalesLock ? lockStatus : null);
    } catch (e) {
      setError(formatApiError(e, "Could not load incentives."));
    } finally {
      setLoading(false);
    }
  }, [admin, adminTab, allowed, fetchKind, scope, yearMonth, owner]);

  useFocusEffect(useCallback(() => {
    load({ force: false });
  }, [load]));
  useLiveRefresh(() => {
    if (periodLocked) return;
    load({ force: true });
  });

  const onRefresh = async () => {
    if (periodLocked) return;
    setRefreshing(true);
    await load({ force: true });
    setRefreshing(false);
  };

  const onAdminTab = (id) => {
    setQuery({ tab: id });
    if (id === "tools") {
      setData(null);
      setLoading(false);
      return;
    }
    const nextKind = id === "overview" || id === "bdm"
      ? "bdm"
      : id === "bda"
        ? "bda"
        : id === "am"
          ? "am"
          : id === "csm"
            ? "csm"
            : null;
    const hit = nextKind
      ? getCached(incentivesCacheKey(nextKind, scope, yearMonth), STALE_MS)
      : null;
    if (hit?.data) {
      setData(hit.data);
      setLoading(false);
    } else {
      setData(null);
      setLoading(true);
    }
  };

  const onScope = (id) => {
    setQuery({ scope: id });
    const hit = fetchKind
      ? getCached(incentivesCacheKey(fetchKind, id, yearMonth), STALE_MS)
      : null;
    if (hit?.data) {
      setData(hit.data);
      setLoading(false);
    } else {
      setData(null);
      setLoading(true);
    }
  };

  const onMonth = (ym) => {
    setQuery({ yearMonth: ym });
    const hit = fetchKind
      ? getCached(incentivesCacheKey(fetchKind, scope, ym), STALE_MS)
      : null;
    if (hit?.data) {
      setData(hit.data);
      setLoading(false);
    } else {
      setData(null);
      setLoading(true);
    }
  };

  if (!allowed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
        <View style={{ padding: 16 }}>
          <Card>
            <Text style={{ fontWeight: "500", color: t.text, fontSize: 18 }}>No access</Text>
            <Button title="Go back" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !data && !(admin && adminTab === "tools")) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
        <ReportsSkeleton />
      </SafeAreaView>
    );
  }

  const showBda = (!admin && (kind === "bda" || (kind === "admin" && roles.isBda))) || (admin && adminTab === "bda");
  const showBdm = (!admin && kind === "bdm") || (admin && (adminTab === "overview" || adminTab === "bdm"));
  const showAm = (!admin && (kind === "am" || (kind === "admin" && roles.isAm && !roles.isBda))) || (admin && adminTab === "am");
  const showCsm = (!admin && kind === "csm") || (admin && adminTab === "csm");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            enabled={!periodLocked}
          />
        )}
      >
        <Text style={{ fontSize: 26, fontWeight: "500", color: t.text }}>Incentive calculation</Text>
        <Text style={{ color: t.subtext, marginBottom: 12, fontWeight: "300" }}>
          {admin
            ? "Admin · all departments"
            : `${roleMeta.code} · shared backend (Android + iOS)`}
          {periodLocked ? " · frozen" : ""}
        </Text>

        {progress && (progress.is_bda || progress.is_bdm || progress.is_team) ? (
          <Card style={{ marginBottom: 12, borderColor: t.accent, borderWidth: 1 }}>
            <Text style={{ color: t.muted, fontSize: 11, fontWeight: "500", textTransform: "uppercase" }}>
              {progress.progress_label || "Daily progress"}
            </Text>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: "500", marginTop: 4 }}>
              {fmtUsd(progress.today_usd)}
              {progress.daily_target_usd ? (
                <Text style={{ color: t.subtext, fontSize: 14, fontWeight: "500" }}>
                  {" "}/ {fmtUsd(progress.daily_target_usd)}
                </Text>
              ) : null}
            </Text>
          </Card>
        ) : null}

        {admin ? (
          <ChipRow items={ADMIN_TABS} value={adminTab} onChange={onAdminTab} t={t} />
        ) : null}

        {(showBda || showBdm || adminTab === "overview") && (
          <ChipRow items={SCOPES} value={scope} onChange={onScope} t={t} />
        )}

        {(showAm || showCsm || showBda || showBdm) && (
          <MonthPicker yearMonth={yearMonth} onChange={onMonth} t={t} />
        )}

        {showAm ? (
          <>
            <LockedPeriodBadge
              snapshotStatus={data?.snapshot_status}
              lockedAt={data?.locked_at}
              t={t}
              department="AM"
            />
            <AmMonthLockControls
              yearMonth={yearMonth}
              snapshotStatus={data?.snapshot_status}
              lockedAt={data?.locked_at}
              onChanged={() => load({ force: true })}
              t={t}
            />
          </>
        ) : null}

        {(showBdm || showBda) ? (
          <>
            <LockedPeriodBadge
              snapshotStatus={salesSnapshot}
              lockedAt={salesLock?.locked_at || data?.locked_at}
              t={t}
              department="Sales"
            />
            <SalesPeriodLockControls
              scope={scope}
              yearMonth={yearMonth}
              snapshotStatus={salesSnapshot}
              lockedAt={salesLock?.locked_at}
              periodId={salesLock?.period_id}
              onChanged={() => load({ force: true })}
              t={t}
            />
          </>
        ) : null}

        {error ? <Text style={{ color: t.danger, marginBottom: 12 }}>{error}</Text> : null}

        {data?.boost_periods?.length ? (
          <BoostLiveBanner periods={data.boost_periods} t={t} />
        ) : null}

        {admin && adminTab === "tools" ? (
          <AdminTools navigation={navigation} t={t} />
        ) : null}

        {showBdm && data ? <BdmView data={data} t={t} /> : null}
        {showAm && data?.summary ? (
          <AmSummaryBlock summary={data.summary} yearMonth={yearMonth} isFutureMonth={Boolean(data.is_future_month)} weightedEnabled={Boolean(data.weighted_month_pct_enabled)} t={t} />
        ) : null}
        {showAm && data && !data.summary && data.view_mode === "admin" ? (
          <Card>
            <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>All AMs</Text>
            {(data.am_rows || []).map((r, i) => (
              <RowLine
                key={i}
                left={r.name || r.user_name}
                sub={`Face ${fmtUsd(r.revenue_usd)} · credited ${fmtUsd(r.credited_revenue_usd ?? r.revenue_usd)}`}
                right={fmtInr(r.incentive_inr ?? r.total_inr)}
                t={t}
              />
            ))}
            <TouchableOpacity onPress={() => navigation.navigate("AmOverview", { yearMonth })} style={{ marginTop: 8 }}>
              <Text style={{ color: t.accent, fontWeight: "500" }}>Open AM overview →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("AmDashboard", { yearMonth })} style={{ marginTop: 8 }}>
              <Text style={{ color: t.accent, fontWeight: "500" }}>Open AM dashboard →</Text>
            </TouchableOpacity>
          </Card>
        ) : null}
        {showCsm && data ? <CsmView data={data} t={t} /> : null}
        {showBda && data ? <BdaView data={data} t={t} /> : null}

        {!loading && !data && adminTab !== "tools" ? (
          <Card>
            <Text style={{ color: t.muted, textAlign: "center" }}>No incentive data for this view</Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
