import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { Text } from "../../components/AppText";
import { useTheme, EmptyState, Button } from "../../components/ui";
import { useScreenQuery } from "../../navigation/useScreenQuery";
import { formatApiError } from "../../utils/billing";
import { FONT } from "../../typography";
import { BRAND } from "../../theme";
import { getCached, setCached } from "../../api/queryCache";
import {
  ADMIN_TITLE_CATALOG_KEY,
  CATALOG_TTL_MS,
  writeCatalog,
} from "../../api/catalogCache";

export default function AdminListShell({
  title,
  load,
  rowTitle,
  rowSub,
  fields = [],
  initialDraft = {},
  onSave,
  onDelete,
  createLabel = "Add",
  allowCreate = true,
  headerNote,
  extraHeader,
  /** Optional shared catalog key (also dual-written for create-billing forms). */
  catalogKey: catalogKeyProp,
}) {
  const t = useTheme();
  const { query, setQuery } = useScreenQuery({ q: "" });
  const cacheKey = `admin_list:${title || "items"}`;
  const catalogKey = catalogKeyProp || ADMIN_TITLE_CATALOG_KEY[title] || null;
  const initialItems =
    getCached(cacheKey, CATALOG_TTL_MS)?.data
    || (catalogKey ? getCached(catalogKey, CATALOG_TTL_MS)?.data : null)
    || [];
  const [items, setItems] = useState(Array.isArray(initialItems) ? initialItems : []);
  const [loading, setLoading] = useState(!initialItems.length);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(initialDraft);
  const [saving, setSaving] = useState(false);

  const remember = useCallback((arr) => {
    setCached(cacheKey, arr);
    if (catalogKey) writeCatalog(catalogKey, arr);
  }, [cacheKey, catalogKey]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await load("");
      const arr = Array.isArray(data) ? data : [];
      setItems(arr);
      remember(arr);
    } catch (e) {
      if (!items.length) {
        setError(formatApiError(e, "Could not load."));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [load, items.length, remember]);

  useEffect(() => {
    const hit = getCached(cacheKey, CATALOG_TTL_MS)
      || (catalogKey ? getCached(catalogKey, CATALOG_TTL_MS) : null);
    if (hit && !hit.stale && Array.isArray(hit.data) && hit.data.length) {
      setItems(hit.data);
      setLoading(false);
      return undefined;
    }
    if (!items.length) {
      setLoading(true);
    }
    refresh();
    return undefined;
    // Mount-only: skip forced network when local catalog cache is fresh (TTL-only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = String(query.q || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => `${rowTitle(row)} ${rowSub?.(row) || ""}`.toLowerCase().includes(q));
  }, [items, query.q, rowTitle, rowSub]);

  const openCreate = () => {
    if (!onSave) return;
    setEditing(null);
    setDraft({ ...initialDraft });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    if (!onSave) return;
    setEditing(row);
    const next = { ...initialDraft };
    fields.forEach((f) => {
      next[f.key] = row[f.key] ?? next[f.key] ?? "";
    });
    setDraft(next);
    setFormOpen(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 12, gap: 8 }}>
        <TextInput
          value={query.q}
          onChangeText={(v) => setQuery({ q: v })}
          placeholder={`Search ${title.toLowerCase()}…`}
          placeholderTextColor={t.muted}
          style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: t.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontFamily: FONT.regular,
            color: t.text,
          }}
        />
        {headerNote ? (
          <View style={{ backgroundColor: BRAND.tealSoft, borderRadius: 12, padding: 10 }}>
            <Text style={{ fontSize: 12, color: BRAND.tealDark, fontFamily: FONT.light }}>{headerNote}</Text>
          </View>
        ) : null}
        {extraHeader || null}
        {onSave && allowCreate ? <Button title={createLabel} onPress={openCreate} /> : null}
        {error ? <Text style={{ color: t.danger, fontSize: 12 }}>{error}</Text> : null}
      </View>

      {loading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => String(item.id ?? item.code ?? i)}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); refresh(); }}
              tintColor={t.accent}
            />
          )}
          contentContainerStyle={{ padding: 12, paddingBottom: 40, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState title={`No ${title.toLowerCase()}`} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => openEdit(item)}
              onLongPress={() => {
                if (!onDelete) return;
                Alert.alert("Delete?", rowTitle(item), [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await onDelete(item);
                        refresh();
                      } catch (e) {
                        Alert.alert("Error", formatApiError(e, "Delete failed"));
                      }
                    },
                  },
                ]);
              }}
              style={{
                backgroundColor: "#fff",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: t.border,
                padding: 14,
                marginBottom: 8,
              }}
            >
              <Text style={{ fontFamily: FONT.medium, color: t.text, fontSize: 15 }}>{rowTitle(item)}</Text>
              {rowSub ? (
                <Text style={{ color: t.subtext, fontSize: 12, marginTop: 4, fontFamily: FONT.light }}>
                  {rowSub(item)}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={() => setFormOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#0006", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 16,
            maxHeight: "80%",
          }}
          >
            <Text style={{ fontFamily: FONT.medium, fontSize: 18, marginBottom: 12 }}>
              {editing ? "Edit" : createLabel}
            </Text>
            <ScrollView>
              {fields.map((f) => (
                <View key={f.key} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 12, color: t.muted, marginBottom: 4 }}>{f.label}</Text>
                  <TextInput
                    value={draft[f.key] == null ? "" : String(draft[f.key])}
                    onChangeText={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                    multiline={Boolean(f.multiline)}
                    keyboardType={f.keyboardType}
                    style={{
                      borderWidth: 1,
                      borderColor: t.border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontFamily: FONT.regular,
                      minHeight: f.multiline ? 90 : undefined,
                      textAlignVertical: f.multiline ? "top" : "center",
                    }}
                  />
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Button title="Cancel" variant="outline" onPress={() => setFormOpen(false)} style={{ flex: 1 }} />
              <Button
                title="Save"
                loading={saving}
                style={{ flex: 1 }}
                onPress={async () => {
                  setSaving(true);
                  try {
                    await onSave(editing, draft);
                    setFormOpen(false);
                    refresh();
                  } catch (e) {
                    Alert.alert("Save failed", formatApiError(e, "Could not save"));
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
