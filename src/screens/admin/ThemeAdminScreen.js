import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, RefreshControl, ScrollView, Switch, TouchableOpacity, View,
} from "react-native";
import { Text } from "../../components/AppText";
import { Button, Card, Field, Screen, useTheme } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { canManageEventThemes, formatApiError, toList } from "../../utils/billing";
import { themeAdminApi } from "../../themes/api";
import { useEventTheme } from "../../themes/ThemeContext";

const PRESETS = {
  corporate: { primary: "#149E81", background: "#F7F8FC", surface: "#FFFFFF", text: "#0F172A" },
  celebration: { primary: "#7C3AED", background: "#FAF5FF", surface: "#FFFFFF", text: "#1E1B4B" },
  seasonal: { primary: "#C2410C", background: "#FFF7ED", surface: "#FFFFFF", text: "#431407" },
};

const emptyDraft = {
  name: "", slug: "", description: "", eventName: "", priority: "0",
  preset: "corporate", primary: "#149E81", background: "#F7F8FC", surface: "#FFFFFF", text: "#0F172A",
  decorations: false, animation: false, animationPreset: "fade", density: "0.15", opacity: "0.25",
  durationMs: "600", intensity: "0.3", minContrast: "4.5", reduceMotion: false,
  maxAssets: "4", animationBudgetMs: "16", startsAt: "", endsAt: "", changelog: "",
  storedObject: "", assetKey: "", assetType: "image", altText: "",
};

function configFromDraft(draft) {
  return {
    metadata: { eventName: draft.eventName || draft.slug || "mobile-event", displayName: draft.name || "Mobile event" },
    tokens: {
      colors: {
        primary: draft.primary, accent: draft.primary, background: draft.background,
        surface: draft.surface, text: draft.text,
      },
      decorations: {
        enabled: draft.decorations, density: Number(draft.density), opacity: Number(draft.opacity),
        items: [{ preset: draft.animationPreset }],
      },
      animations: {
        enabled: draft.animation, durationMs: Number(draft.durationMs), delayMs: 0,
        easing: "ease-in-out", intensity: Number(draft.intensity), reducedMotion: true,
      },
      accessibility: {
        minContrast: Number(draft.minContrast), focusRingWidth: 2,
        reduceMotion: draft.reduceMotion, highContrast: false,
      },
      performance: {
        maxAssets: Number(draft.maxAssets), maxAssetBytes: 1500000,
        animationBudgetMs: Number(draft.animationBudgetMs), preloadAssets: [],
      },
    },
    scopes: {},
  };
}

function Choice({ active, label, onPress, t }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8, marginBottom: 8,
        backgroundColor: active ? t.accent : t.card, borderWidth: 1, borderColor: active ? t.accent : t.border,
      }}
    >
      <Text style={{ color: active ? "#FFFFFF" : t.text, fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ThemeAdminScreen() {
  const t = useTheme();
  const { user } = useAuth();
  const { applyPreview, clearPreview, isPreviewing } = useEventTheme();
  const [themes, setThemes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState({ versions: [], schedules: [], history: [], assets: [] });
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const patch = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const config = useMemo(() => configFromDraft(draft), [draft]);

  const load = useCallback(async () => {
    if (!canManageEventThemes(user)) return;
    try {
      const response = await themeAdminApi.list();
      setThemes(toList(response.data));
      setError("");
    } catch (err) {
      setError(formatApiError(err, "Could not load event themes."));
    }
  }, [user]);

  const loadDetails = useCallback(async (theme) => {
    if (!theme) return;
    try {
      const [versions, schedules, history, assets] = await Promise.all([
        themeAdminApi.versions(theme.id), themeAdminApi.schedules(theme.id),
        themeAdminApi.history(theme.id), themeAdminApi.assets(theme.id),
      ]);
      setDetails({
        versions: toList(versions.data), schedules: toList(schedules.data),
        history: toList(history.data), assets: toList(assets.data),
      });
      setError("");
    } catch (err) {
      setError(formatApiError(err, "Could not load theme details."));
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadDetails(selected); }, [selected, loadDetails]);

  const run = async (operation, success) => {
    setBusy(true);
    setError("");
    try {
      await operation();
      await load();
      if (selected) await loadDetails(selected);
      if (success) Alert.alert("Event themes", success);
    } catch (err) {
      setError(formatApiError(err, "Theme operation failed."));
    } finally {
      setBusy(false);
    }
  };

  if (!canManageEventThemes(user)) {
    return <Screen><Card><Text style={{ color: t.danger }}>You do not have permission to manage event themes.</Text></Card></Screen>;
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Text style={{ color: t.text, fontSize: 24, fontWeight: "600" }}>Event themes</Text>
        <Text style={{ color: t.subtext, marginBottom: 14 }}>Safe structured themes for mobile modules.</Text>
        {error ? <Card style={{ borderColor: t.danger }}><Text style={{ color: t.danger }}>{error}</Text></Card> : null}
        {isPreviewing ? (
          <Card style={{ borderColor: t.warning }}>
            <Text style={{ color: t.text, fontWeight: "600", marginBottom: 8 }}>Local preview active</Text>
            <Text style={{ color: t.subtext, marginBottom: 10 }}>Preview only affects this device and never publishes.</Text>
            <Button title="Clear preview" variant="outline" onPress={clearPreview} />
          </Card>
        ) : null}

        <Text style={{ color: t.text, fontSize: 17, fontWeight: "600", marginBottom: 8 }}>Themes</Text>
        {themes.map((theme) => (
          <Card key={theme.id} onPress={() => setSelected(theme)} style={{ borderColor: selected?.id === theme.id ? t.accent : t.border }}>
            <Text style={{ color: t.text, fontWeight: "600" }}>{theme.name}</Text>
            <Text style={{ color: t.subtext, fontSize: 12 }}>{theme.slug} · {theme.status} · priority {theme.priority}</Text>
          </Card>
        ))}

        <Card>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: "600", marginBottom: 12 }}>Create theme</Text>
          <Field label="Name" value={draft.name} onChangeText={(v) => patch("name", v)} />
          <Field label="Slug" autoCapitalize="none" value={draft.slug} onChangeText={(v) => patch("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
          <Field label="Description" value={draft.description} onChangeText={(v) => patch("description", v)} />
          <Field label="Event name" autoCapitalize="none" value={draft.eventName} onChangeText={(v) => patch("eventName", v.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} />
          <Field label="Priority (-1000 to 1000)" keyboardType="numeric" value={draft.priority} onChangeText={(v) => patch("priority", v)} />
          <Button
            title="Create"
            loading={busy}
            disabled={!draft.name || !draft.slug}
            onPress={() => run(() => themeAdminApi.create({
              name: draft.name, slug: draft.slug, description: draft.description,
              event_name: draft.eventName || draft.slug, priority: Number(draft.priority),
            }), "Theme created. Select it to add a version.")}
          />
        </Card>

        {selected ? (
          <>
            <Card>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: "600" }}>{selected.name} editor</Text>
              <Text style={{ color: t.subtext, fontSize: 12, marginBottom: 12 }}>Presets populate structured, validated fields.</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {Object.keys(PRESETS).map((preset) => (
                  <Choice key={preset} label={preset} active={draft.preset === preset} t={t} onPress={() => setDraft((d) => ({ ...d, ...PRESETS[preset], preset }))} />
                ))}
              </View>
              {["primary", "background", "surface", "text"].map((key) => (
                <Field key={key} label={`${key} color (#RRGGBB)`} autoCapitalize="characters" value={draft[key]} onChangeText={(v) => patch(key, v)} />
              ))}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ color: t.text }}>Decorations</Text>
                <Switch value={draft.decorations} onValueChange={(v) => patch("decorations", v)} />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {["fade", "float", "pulse", "rotation", "sparkle", "confetti", "particle"].map((preset) => (
                  <Choice key={preset} label={preset} active={draft.animationPreset === preset} t={t} onPress={() => patch("animationPreset", preset)} />
                ))}
              </View>
              <Field label="Decoration density (0–0.5)" keyboardType="decimal-pad" value={draft.density} onChangeText={(v) => patch("density", v)} />
              <Field label="Decoration opacity (0–0.7)" keyboardType="decimal-pad" value={draft.opacity} onChangeText={(v) => patch("opacity", v)} />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ color: t.text }}>Animation</Text>
                <Switch value={draft.animation} onValueChange={(v) => patch("animation", v)} />
              </View>
              <Field label="Duration ms (100–3000)" keyboardType="numeric" value={draft.durationMs} onChangeText={(v) => patch("durationMs", v)} />
              <Field label="Intensity (0–0.7)" keyboardType="decimal-pad" value={draft.intensity} onChangeText={(v) => patch("intensity", v)} />
              <Field label="Minimum contrast (3–7)" keyboardType="decimal-pad" value={draft.minContrast} onChangeText={(v) => patch("minContrast", v)} />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ color: t.text }}>Force reduced motion</Text>
                <Switch value={draft.reduceMotion} onValueChange={(v) => patch("reduceMotion", v)} />
              </View>
              <Field label="Maximum assets (0–30)" keyboardType="numeric" value={draft.maxAssets} onChangeText={(v) => patch("maxAssets", v)} />
              <Field label="Animation budget ms (0–5000)" keyboardType="numeric" value={draft.animationBudgetMs} onChangeText={(v) => patch("animationBudgetMs", v)} />
              <Field label="Version changelog" value={draft.changelog} onChangeText={(v) => patch("changelog", v)} />
              <View style={{ gap: 8 }}>
                <Button title="Apply local preview" variant="outline" onPress={() => {
                  try { applyPreview(config.tokens); setError(""); } catch (err) { setError(err.message); }
                }} />
                <Button title="Validate with server" variant="outline" loading={busy} onPress={() => run(() => themeAdminApi.preview(config), "Theme configuration is valid.")} />
                <Button title="Create version" loading={busy} onPress={() => run(() => themeAdminApi.createVersion(selected.id, config, draft.changelog), "Version created.")} />
                <Button title="Duplicate theme" variant="outline" loading={busy} onPress={() => run(() => themeAdminApi.duplicate(selected.id, {}), "Theme duplicated.")} />
              </View>
            </Card>

            <Card>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: "600", marginBottom: 10 }}>Versions & publishing</Text>
              <Field label="Schedule starts (ISO, optional)" value={draft.startsAt} onChangeText={(v) => patch("startsAt", v)} />
              <Field label="Schedule ends (ISO, optional)" value={draft.endsAt} onChangeText={(v) => patch("endsAt", v)} />
              {details.versions.map((version) => (
                <View key={version.id} style={{ borderTopWidth: 1, borderColor: t.border, paddingVertical: 10 }}>
                  <Text style={{ color: t.text, fontWeight: "600" }}>Version {version.version}</Text>
                  <Text selectable style={{ color: t.subtext, fontSize: 11 }}>{version.checksum}</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <Button
                      title="Preview"
                      variant="outline"
                      style={{ flex: 1, paddingVertical: 9 }}
                      onPress={() => {
                        try { applyPreview(version.config); setError(""); } catch (err) { setError(err.message); }
                      }}
                    />
                    <Button
                      title="Publish"
                      style={{ flex: 1, paddingVertical: 9 }}
                      onPress={() => Alert.alert("Publish this version?", "This changes the active server theme for eligible users.", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Publish", onPress: () => run(() => themeAdminApi.publish(selected.id, {
                          version_id: version.id,
                          ...(draft.startsAt ? { starts_at: draft.startsAt } : {}),
                          ...(draft.endsAt ? { ends_at: draft.endsAt } : {}),
                        }), "Theme published.") },
                      ])}
                    />
                  </View>
                </View>
              ))}
              <Button title="Rollback" variant="outline" loading={busy} onPress={() => Alert.alert("Rollback theme?", "The server will activate the previous available version.", [
                { text: "Cancel", style: "cancel" },
                { text: "Rollback", style: "destructive", onPress: () => run(() => themeAdminApi.rollback(selected.id), "Theme rolled back.") },
              ])} />
              <View style={{ height: 8 }} />
              <Button title="Deactivate" variant="danger" loading={busy} onPress={() => Alert.alert("Deactivate theme?", "Normal app defaults remain available.", [
                { text: "Cancel", style: "cancel" },
                { text: "Deactivate", style: "destructive", onPress: () => run(() => themeAdminApi.deactivate(selected.id, "Deactivated from mobile admin"), "Theme deactivated.") },
              ])} />
            </Card>

            <Card>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: "600", marginBottom: 10 }}>Link stored asset</Text>
              <Field label="Stored object UUID" autoCapitalize="none" value={draft.storedObject} onChangeText={(v) => patch("storedObject", v)} />
              <Field label="Asset key" autoCapitalize="none" value={draft.assetKey} onChangeText={(v) => patch("assetKey", v.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} />
              <View style={{ flexDirection: "row" }}>
                {["image", "icon", "font"].map((type) => <Choice key={type} label={type} active={draft.assetType === type} t={t} onPress={() => patch("assetType", type)} />)}
              </View>
              <Field label="Alt text" value={draft.altText} onChangeText={(v) => patch("altText", v)} />
              <Button
                title="Link asset"
                loading={busy}
                disabled={!draft.storedObject || !draft.assetKey}
                onPress={() => run(() => themeAdminApi.linkAsset(selected.id, {
                  stored_object: draft.storedObject, key: draft.assetKey,
                  asset_type: draft.assetType, alt_text: draft.altText,
                  ...(details.versions[0]?.id ? { version: details.versions[0].id } : {}),
                }), "Asset linked.")}
              />
              {details.assets.map((asset) => <Text key={asset.id} style={{ color: t.subtext, marginTop: 8 }}>{asset.key} · {asset.asset_type}</Text>)}
            </Card>

            <Card>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: "600" }}>Schedules & history</Text>
              {details.schedules.map((item) => <Text key={item.id} style={{ color: t.subtext, marginTop: 6 }}>v{item.version_number} · {item.status} · {item.starts_at}</Text>)}
              {details.history.map((item) => <Text key={item.id} style={{ color: t.subtext, marginTop: 6 }}>{item.action} · {item.occurred_at}</Text>)}
            </Card>

            <Card>
              <Text style={{ color: t.text, fontWeight: "600", marginBottom: 8 }}>Read-only JSON preview</Text>
              <Text selectable style={{ color: t.subtext, fontFamily: "monospace", fontSize: 10 }}>{JSON.stringify(config, null, 2)}</Text>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
