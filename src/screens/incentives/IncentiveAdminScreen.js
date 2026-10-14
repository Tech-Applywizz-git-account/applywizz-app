import React, { useCallback, useState } from "react";
import { View, ScrollView, RefreshControl, TouchableOpacity, Switch, Alert } from "react-native";
import { Text, TextInput } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  approveIncentiveRun,
  calculateAmRun,
  fetchAmRetentionRules,
  fetchAmSlabs,
  fetchEditorMe,
  fetchIncentiveRuns,
  fetchPolicySettings,
  fetchBoostPeriods,
  createBoostPeriod,
  deleteBoostPeriod,
  approveBoostPeriod,
  rejectBoostPeriod,
  markIncentiveRunPaid,
  patchAmRetentionRule,
  patchAmSlab,
  patchPolicySettings,
} from "../../api/incentives";
import { Button, Card, useTheme } from "../../components/ui";
import { ReportsSkeleton } from "../../components/Skeleton";
import { fmtInr, formatApiError } from "../../utils/billing";
import { canManageIncentives } from "../../utils/incentives";
import { MonthPicker } from "./shared";
import { useAuth } from "../../context/AuthContext";
import { useScreenQuery } from "../../navigation/useScreenQuery";
import { getCached, setCached } from "../../api/queryCache";

export default function IncentiveAdminScreen() {
  const t = useTheme();
  const { user } = useAuth();
  const canManage = canManageIncentives(user);
  const defaultMonth = new Date().toISOString().slice(0, 7);
  const { query, setQuery } = useScreenQuery({ tab: "policy", yearMonth: defaultMonth });
  const tab = query.tab || "policy";
  const yearMonth = query.yearMonth || defaultMonth;
  const initialSettings = getCached("incentive_admin_settings", 300000)?.data || null;
  const [policy, setPolicy] = useState(initialSettings?.policy || null);
  const [editor, setEditor] = useState(initialSettings?.editor || null);
  const [slabs, setSlabs] = useState(initialSettings?.slabs || []);
  const [rules, setRules] = useState(initialSettings?.rules || []);
  const [runs, setRuns] = useState(initialSettings?.runs || []);
  const [loading, setLoading] = useState(!initialSettings);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [boosts, setBoosts] = useState(initialSettings?.boosts || []);
  const [boostDay, setBoostDay] = useState("");
  const [boostMult, setBoostMult] = useState("1.50");
  const [boostNotes, setBoostNotes] = useState("");
  const [boostAudience, setBoostAudience] = useState("sales");
  const [canApproveBoosts, setCanApproveBoosts] = useState(Boolean(initialSettings?.canApproveBoosts));
  const [canEditSales, setCanEditSales] = useState(Boolean(initialSettings?.canEditSales));
  const [canEditAccounts, setCanEditAccounts] = useState(Boolean(initialSettings?.canEditAccounts));

  const load = useCallback(async ({ force = false } = {}) => {
    if (!force) {
      const hit = getCached("incentive_admin_settings", 300000);
      if (hit && !hit.stale) {
        setLoading(false);
        return;
      }
    }
    setError(null);
    try {
      const [p, e, s, r, runList, b] = await Promise.all([
        fetchPolicySettings(),
        fetchEditorMe().catch(() => ({ is_editor: false })),
        fetchAmSlabs(),
        fetchAmRetentionRules(),
        fetchIncentiveRuns(),
        fetchBoostPeriods().catch(() => ({ results: [] })),
      ]);
      const sList = Array.isArray(s) ? s : s?.results || [];
      const rList = Array.isArray(r) ? r : r?.results || [];
      const runArr = Array.isArray(runList) ? runList : runList?.results || [];
      const bList = Array.isArray(b) ? b : b?.results || [];
      const canApp = Boolean(b?.can_approve);
      const canES = Boolean(b?.can_edit_sales);
      const canEA = Boolean(b?.can_edit_accounts);

      setPolicy(p);
      setEditor(e);
      setSlabs(sList);
      setRules(rList);
      setRuns(runArr);
      setBoosts(bList);
      setCanApproveBoosts(canApp);
      setCanEditSales(canES);
      setCanEditAccounts(canEA);

      setCached("incentive_admin_settings", {
        policy: p,
        editor: e,
        slabs: sList,
        rules: rList,
        runs: runArr,
        boosts: bList,
        canApproveBoosts: canApp,
        canEditSales: canES,
        canEditAccounts: canEA,
      });
    } catch (e) {
      setError(formatApiError(e, "Could not load admin settings."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load({ force: false });
  }, [load]));

  const toggleDualCredit = async (enabled) => {
    if (!canManage) return;
    setBusy(true);
    try {
      const data = await patchPolicySettings({
        id: policy?.id || 1,
        simulation_dual_credit_enabled: enabled,
      });
      setPolicy(data);
    } catch (e) {
      Alert.alert("Error", formatApiError(e, "Failed to update policy"));
    } finally {
      setBusy(false);
    }
  };

  const saveSlab = async (slab, field, value) => {
    if (!canManage || !editor?.is_editor) return;
    setBusy(true);
    try {
      await patchAmSlab(slab.id, { [field]: value });
      await load();
    } catch (e) {
      Alert.alert("Error", formatApiError(e, "Failed to save slab"));
    } finally {
      setBusy(false);
    }
  };

  const saveRule = async (rule, value) => {
    if (!canManage || !editor?.is_editor) return;
    setBusy(true);
    try {
      await patchAmRetentionRule(rule.id, { retention_percent: value });
      await load();
    } catch (e) {
      Alert.alert("Error", formatApiError(e, "Failed to save rule"));
    } finally {
      setBusy(false);
    }
  };

  const runCalculate = async () => {
    if (!canManage) return;
    setBusy(true);
    try {
      await calculateAmRun(yearMonth);
      await load();
      Alert.alert("Done", `AM payroll draft calculated for ${yearMonth}`);
    } catch (e) {
      Alert.alert("Error", formatApiError(e, "Calculate failed"));
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (runId, action) => {
    if (!canManage || !editor?.is_editor) return;
    setBusy(true);
    try {
      if (action === "approve") await approveIncentiveRun(runId);
      else await markIncentiveRunPaid(runId);
      await load();
    } catch (e) {
      Alert.alert("Error", formatApiError(e, "Run action failed"));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !policy) return <ReportsSkeleton />;

  const tabs = [
    { id: "policy", label: "Policy" },
    { id: "boosts", label: "Boosts" },
    { id: "slabs", label: "Slabs" },
    { id: "retention", label: "Retention" },
    { id: "runs", label: "Runs" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {tabs.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setQuery({ tab: item.id })}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: tab === item.id ? t.accent : t.card,
                borderWidth: 1,
                borderColor: tab === item.id ? t.accent : t.border,
              }}
            >
              <Text style={{ color: tab === item.id ? "#fff" : t.subtext, fontWeight: "500", fontSize: 12 }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text style={{ color: t.danger, marginBottom: 12 }}>{error}</Text> : null}

        {tab === "policy" ? (
          <>
          <Card>
            <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>Simulation dual credit</Text>
            <Text style={{ color: t.subtext, fontSize: 12, lineHeight: 18, marginBottom: 12, fontWeight: "300"}}>
              On: AM gets 100% of every simulation line — simulation-only and mixed carts. Sales keeps credit.
              Off: seller keeps credit; sim/github-only add-ons need SME call within 7 days.
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: t.text, fontWeight: "500" }}>Enabled</Text>
              <Switch
                value={Boolean(policy?.simulation_dual_credit_enabled)}
                onValueChange={toggleDualCredit}
                disabled={!canManage || busy}
              />
            </View>
            {!canManage ? (
              <Text style={{ color: t.muted, fontSize: 11, marginTop: 8, fontWeight: "300"}}>Requires manage_incentives</Text>
            ) : null}
          </Card>
          </>
        ) : null}

        {tab === "boosts" ? (
          <BoostAdminPanel
            t={t}
            busy={busy}
            setBusy={setBusy}
            boosts={boosts}
            boostDay={boostDay}
            setBoostDay={setBoostDay}
            boostMult={boostMult}
            setBoostMult={setBoostMult}
            boostNotes={boostNotes}
            setBoostNotes={setBoostNotes}
            boostAudience={boostAudience}
            setBoostAudience={setBoostAudience}
            canApproveBoosts={canApproveBoosts}
            canEditSales={canEditSales}
            canEditAccounts={canEditAccounts}
            load={load}
          />
        ) : null}

        {tab === "slabs" ? (
          <View>
            {!editor?.is_editor ? (
              <Text style={{ color: t.warning, marginBottom: 8 }}>Policy editor access required to edit slabs.</Text>
            ) : null}
            {slabs.map((slab) => (
              <SlabEditor key={slab.id} slab={slab} t={t} disabled={!canManage || !editor?.is_editor || busy} onSave={saveSlab} />
            ))}
          </View>
        ) : null}

        {tab === "retention" ? (
          <View>
            {!editor?.is_editor ? (
              <Text style={{ color: t.warning, marginBottom: 8 }}>Policy editor access required to edit retention.</Text>
            ) : null}
            {rules.map((rule) => (
              <RuleEditor key={rule.id} rule={rule} t={t} disabled={!canManage || !editor?.is_editor || busy} onSave={saveRule} />
            ))}
          </View>
        ) : null}

        {tab === "runs" ? (
          <View>
            <MonthPicker yearMonth={yearMonth} onChange={(ym) => setQuery({ yearMonth: ym })} t={t} />
            <Button title={busy ? "Working…" : "Calculate AM run"} onPress={runCalculate} disabled={!canManage || busy} style={{ marginBottom: 12 }} />
            {runs.slice(0, 20).map((run) => (
              <Card key={run.id} style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: "500", color: t.text }}>{run.period_label || run.year_month}</Text>
                <Text style={{ color: t.subtext, fontSize: 12, fontWeight: "300"}}>
                  {run.policy} · {run.status} · {fmtInr(run.total_incentive_inr ?? run.total_incentive)}
                </Text>
                {run.status === "draft" && editor?.is_editor ? (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <Button title="Approve" onPress={() => runAction(run.id, "approve")} disabled={busy} />
                  </View>
                ) : null}
                {run.status === "approved" && editor?.is_editor ? (
                  <View style={{ marginTop: 8 }}>
                    <Button title="Mark paid" onPress={() => runAction(run.id, "paid")} disabled={busy} />
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function BoostAdminPanel({
  t, busy, setBusy, boosts, boostDay, setBoostDay, boostMult, setBoostMult,
  boostNotes, setBoostNotes, boostAudience, setBoostAudience,
  canApproveBoosts, canEditSales, canEditAccounts, load,
}) {
  const canEdit = boostAudience === "sales" ? canEditSales : canEditAccounts;
  const pending = boosts.filter((row) => row.status === "pending");
  const visible = boosts.filter((row) => row.status !== "rejected");
  const inputStyle = {
    borderWidth: 1, borderColor: t.border, borderRadius: 8, padding: 8, color: t.text, marginBottom: 8,
  };

  const submit = async () => {
    if (!boostDay) {
      Alert.alert("Date required", "Enter the start date as YYYY-MM-DD (8:00 PM IST).");
      return;
    }
    const n = Number(boostMult);
    if (!n || n < 1 || n > 3) {
      Alert.alert("Invalid multiplier", "Use a value like 1.5 or 1.75.");
      return;
    }
    setBusy(true);
    try {
      await createBoostPeriod({
        starts_on: boostDay,
        audience: boostAudience,
        multiplier: boostMult,
        notes: boostNotes,
      });
      await load();
    } catch (err) {
      Alert.alert("Error", formatApiError(err, "Failed to save boost period"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Card>
        <Text style={{ fontWeight: "700", color: t.text, fontSize: 16, marginBottom: 6 }}>Boost periods</Text>
        <Text style={{ color: t.subtext, fontSize: 12, lineHeight: 18, marginBottom: 12, fontWeight: "300" }}>
          Pick the evening the boost starts. 14-07-2026 covers paid invoices 14-07-2026 8:00 PM to 15-07-2026 7:59 PM IST.
          {canApproveBoosts
            ? " Admins grant immediately. A grant mail is sent from your mailbox to the manager and team."
            : " Managers request approval. One email goes to all Admins and Super Admins from your mailbox."}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          {[{ id: "sales", label: "BDA / BDM" }, { id: "accounts", label: "AM / CSM" }].map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setBoostAudience(item.id)}
              style={{
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                backgroundColor: boostAudience === item.id ? "#EA580C" : t.card,
                borderWidth: 1, borderColor: boostAudience === item.id ? "#EA580C" : t.border,
              }}
            >
              <Text style={{ color: boostAudience === item.id ? "#fff" : t.subtext, fontWeight: "600", fontSize: 12 }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {canEdit ? (
          <View>
            <TextInput value={boostDay} onChangeText={setBoostDay} placeholder="Starts 8:00 PM IST on YYYY-MM-DD" style={inputStyle} />
            <TextInput value={boostMult} onChangeText={setBoostMult} placeholder="1.50" keyboardType="decimal-pad" style={inputStyle} />
            <TextInput value={boostNotes} onChangeText={setBoostNotes} placeholder="Why this window?" style={inputStyle} />
            <Button
              title={busy ? "Sending…" : (canApproveBoosts ? "Grant boost" : "Request approval")}
              disabled={busy}
              onPress={submit}
            />
          </View>
        ) : (
          <Text style={{ color: t.warning, fontSize: 12 }}>
            {boostAudience === "sales" ? "A BDM, Admin, or Super Admin can request this track." : "A CSM, Admin, or Super Admin can request this track."}
          </Text>
        )}
      </Card>

      {canApproveBoosts && pending.length > 0 ? (
        <Card style={{ marginTop: 12, backgroundColor: "#FFF7ED", borderColor: "#FDBA74" }}>
          <Text style={{ fontWeight: "700", color: "#9A3412", marginBottom: 8 }}>
            Pending your approval · {pending.length}
          </Text>
          {pending.map((row) => (
            <View key={row.id} style={{ marginBottom: 12 }}>
              <Text style={{ color: t.text, fontWeight: "600" }}>
                {row.window_text || row.business_day} × {row.multiplier}
              </Text>
              <Text style={{ color: t.subtext, fontSize: 12, marginTop: 2 }}>
                {row.created_by_name || row.created_by_email || "Manager"}
                {row.notes ? ` · ${row.notes}` : ""}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Button
                  title="Grant"
                  disabled={busy}
                  onPress={async () => {
                    setBusy(true);
                    try {
                      await approveBoostPeriod(row.id);
                      await load();
                    } catch (err) {
                      Alert.alert("Error", formatApiError(err, "Approve failed"));
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                <Button
                  title="Reject"
                  disabled={busy}
                  onPress={async () => {
                    setBusy(true);
                    try {
                      await rejectBoostPeriod(row.id);
                      await load();
                    } catch (err) {
                      Alert.alert("Error", formatApiError(err, "Reject failed"));
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={{ marginTop: 12 }}>
        {visible.length === 0 ? (
          <Text style={{ color: t.muted, fontWeight: "300" }}>No boosted days yet.</Text>
        ) : visible.map((row) => (
          <View key={row.id} style={{ marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ color: t.text, fontWeight: "600" }}>
                {row.window_text || row.business_day} × {row.multiplier}
              </Text>
              <Text style={{ color: t.subtext, fontSize: 11, marginTop: 2 }}>
                {row.status === "pending" ? "Awaiting admin" : row.status}
                {" · "}
                {row.audience === "accounts" ? "AM / CSM" : "BDA / BDM"}
                {row.created_by_name ? ` · ${row.created_by_name}` : ""}
              </Text>
            </View>
            {(canApproveBoosts || row.status === "pending") ? (
              <TouchableOpacity
                onPress={async () => {
                  setBusy(true);
                  try {
                    await deleteBoostPeriod(row.id);
                    await load();
                  } catch (err) {
                    Alert.alert("Error", formatApiError(err, "Failed to delete"));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Text style={{ color: "#BE123C", fontSize: 12 }}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </Card>
    </View>
  );
}

function SlabEditor({ slab, t, disabled, onSave }) {
  const [inr, setInr] = useState(String(slab.incentive_inr ?? ""));
  return (
    <Card style={{ marginBottom: 8 }}>
      <Text style={{ fontWeight: "500", color: t.text }}>{slab.label || `Slab ${slab.sort_order}`}</Text>
      <Text style={{ color: t.subtext, fontSize: 12, fontWeight: "300"}}>
        ${slab.min_revenue_usd} – {slab.max_revenue_usd ? `$${slab.max_revenue_usd}` : "+"}
      </Text>
      <TextInput
        value={inr}
        onChangeText={setInr}
        keyboardType="decimal-pad"
        editable={!disabled}
        style={{
          marginTop: 8,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 8,
          padding: 8,
          color: t.text,
        }}
      />
      {!disabled ? (
        <Button title="Save INR" onPress={() => onSave(slab, "incentive_inr", inr)} style={{ marginTop: 8 }} />
      ) : null}
    </Card>
  );
}

function RuleEditor({ rule, t, disabled, onSave }) {
  const [pct, setPct] = useState(String(rule.retention_percent ?? ""));
  return (
    <Card style={{ marginBottom: 8 }}>
      <Text style={{ fontWeight: "500", color: t.text }}>{rule.label || rule.code}</Text>
      <TextInput
        value={pct}
        onChangeText={setPct}
        keyboardType="decimal-pad"
        editable={!disabled}
        style={{
          marginTop: 8,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 8,
          padding: 8,
          color: t.text,
        }}
      />
      {!disabled ? (
        <Button title="Save %" onPress={() => onSave(rule, pct)} style={{ marginTop: 8 }} />
      ) : null}
    </Card>
  );
}
