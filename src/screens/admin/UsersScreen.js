import React, { useCallback, useMemo, useState } from "react";
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
  Switch,
} from "react-native";
import { Text } from "../../components/AppText";
import { useTheme, EmptyState, Button } from "../../components/ui";
import { useScreenQuery } from "../../navigation/useScreenQuery";
import { formatApiError } from "../../utils/billing";
import { FONT } from "../../typography";
import { BRAND } from "../../theme";
import { fetchUsers, updateUser, fetchDepartments } from "../../api/admin";
import { useAuth } from "../../context/AuthContext";
import { getCached, setCached } from "../../api/queryCache";
import {
  CATALOG_KEYS,
  CATALOG_TTL_MS,
  LIST_TTL_MS,
  loadCatalog,
  readFreshCatalog,
} from "../../api/catalogCache";

const SNACKIFY_ROLES = [
  { value: "staff", label: "Staff" },
  { value: "office_boy", label: "Office Boy" },
  { value: "facility_manager", label: "Facility Manager" },
  { value: "finance", label: "Finance" },
  { value: "leadership", label: "Leadership" },
];

function appsLabelForDepartment(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return "Snackify only";
  if (n.includes("sales")) return "Snackify + Invoice";
  if (n === "am" || n.includes("am department") || n.includes("account management")) {
    return "Snackify + Invoice";
  }
  if (n === "ca" || n.includes("ca department") || n.includes("career")) {
    return "Snackify + Career";
  }
  return "Snackify only";
}

export default function UsersScreen() {
  const t = useTheme();
  const { canImpersonate, startImpersonation, user: currentUser, refreshMe } = useAuth();
  const showViewAs = Boolean(canImpersonate);
  const { query, setQuery } = useScreenQuery({ q: "" });
  const initialUsers = getCached("admin_users_list", LIST_TTL_MS)?.data || [];
  const [items, setItems] = useState(initialUsers);
  const [loading, setLoading] = useState(!initialUsers.length);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [viewAsId, setViewAsId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({
    name: "",
    is_active: true,
    snackify_role: "staff",
    department: "",
  });
  const initialDepts =
    readFreshCatalog(CATALOG_KEYS.departments, CATALOG_TTL_MS)
    || getCached("admin_departments_list", CATALOG_TTL_MS)?.data
    || [];
  const [departments, setDepartments] = useState(Array.isArray(initialDepts) ? initialDepts : []);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchUsers({ page_size: 200 });
      const list = Array.isArray(data) ? data : (data?.results || []);
      setItems(list);
      setCached("admin_users_list", list);
    } catch (e) {
      if (!items.length) {
        setError(formatApiError(e, "Could not load."));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [items.length]);

  React.useEffect(() => {
    const usersHit = getCached("admin_users_list", LIST_TTL_MS);
    if (usersHit && !usersHit.stale && Array.isArray(usersHit.data) && usersHit.data.length) {
      setItems(usersHit.data);
      setLoading(false);
    } else {
      if (!items.length) setLoading(true);
      refresh();
    }
    refreshMe?.().catch(() => {});
    loadCatalog(
      CATALOG_KEYS.departments,
      () => fetchDepartments(),
      {
        map: (rows) => (Array.isArray(rows) ? rows : []),
      },
    ).then((list) => {
      setDepartments(list);
      setCached("admin_departments_list", list);
    }).catch(() => {});
    // Mount-only — TTL skip for users/departments catalogs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = String(query.q || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) =>
      `${row.name || ""} ${row.email || ""} ${row.role_name || ""}`.toLowerCase().includes(q),
    );
  }, [items, query.q]);

  const openEdit = (row) => {
    setEditing(row);
    setDraft({
      name: row.name || "",
      is_active: row.is_active !== false,
      snackify_role: row.snackify_role || "staff",
      department: row.department || "",
    });
    setFormOpen(true);
  };

  const appsLocked = Boolean(editing?.apps_locked);

  const save = async () => {
    if (!editing?.id) throw new Error("Select an existing user to edit");
    await updateUser(editing.id, {
      name: draft.name,
      is_active: draft.is_active,
      snackify_role: draft.snackify_role,
      department: draft.department || "",
      ...(appsLocked ? {} : { app_access: [] }),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 12, gap: 8 }}>
        <TextInput
          value={query.q}
          onChangeText={(v) => setQuery({ q: v })}
          placeholder="Search users…"
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
        <View style={{ backgroundColor: BRAND.tealSoft, borderRadius: 12, padding: 10 }}>
          <Text style={{ fontSize: 12, color: BRAND.tealDark, fontFamily: FONT.light }}>
            Tap a user to assign their team. Apps follow department: Sales/AM → Invoice+Snackify, CA → Career+Snackify, others → Snackify only.
          </Text>
        </View>
        {error ? <Text style={{ color: t.danger, fontSize: 12 }}>{error}</Text> : null}
      </View>

      {loading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); refresh(); }}
              tintColor={t.accent}
            />
          )}
          contentContainerStyle={{ padding: 12, paddingBottom: 40, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState title="No users" />}
          renderItem={({ item }) => {
            const apps = (item.apps || item.app_access || []).join(", ");
            const canViewAs = Boolean(
              showViewAs
              && item.id
              && String(item.id) !== String(currentUser?.id || "")
              && item.is_active !== false,
            );
            return (
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: t.border,
                  padding: 14,
                  marginBottom: 8,
                }}
              >
                <TouchableOpacity onPress={() => openEdit(item)}>
                  <Text style={{ fontFamily: FONT.medium, color: t.text, fontSize: 15 }}>
                    {item.name || item.email || "User"}
                  </Text>
                  <Text style={{ color: t.subtext, fontSize: 12, marginTop: 4, fontFamily: FONT.light }}>
                    {item.email || ""} · {item.role_name || "—"} · {item.snackify_role || "staff"}
                  </Text>
                  <Text style={{ color: t.subtext, fontSize: 11, marginTop: 2, fontFamily: FONT.light }}>
                    Apps: {apps || "snackify"}
                  </Text>
                </TouchableOpacity>
                {canViewAs ? (
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        "View as user",
                        `Open the app as ${item.name || item.email}? You will use their permissions until you tap Exit.`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "View as",
                            onPress: async () => {
                              setViewAsId(item.id);
                              try {
                                await startImpersonation(item.id);
                              } catch (e) {
                                Alert.alert(
                                  "View as failed",
                                  e?.message || formatApiError(e, "Could not start view-as"),
                                );
                              } finally {
                                setViewAsId(null);
                              }
                            },
                          },
                        ],
                      );
                    }}
                    disabled={viewAsId === item.id}
                    style={{
                      marginTop: 10,
                      alignSelf: "flex-start",
                      backgroundColor: "#fef3c7",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      opacity: viewAsId === item.id ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: "#92400e", fontFamily: FONT.medium, fontSize: 12 }}>
                      {viewAsId === item.id ? "Starting…" : "View as"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={() => setFormOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#0006", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 16,
            maxHeight: "85%",
          }}
          >
            <Text style={{ fontFamily: FONT.medium, fontSize: 18, marginBottom: 4 }}>
              Edit user
            </Text>
            {editing?.email ? (
              <Text style={{ fontFamily: FONT.light, fontSize: 12, color: t.muted, marginBottom: 12 }}>
                {editing.email}
              </Text>
            ) : null}
            <ScrollView>
              <Text style={{ fontSize: 12, color: t.muted, marginBottom: 4 }}>Name</Text>
              <TextInput
                value={draft.name}
                onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
                style={{
                  borderWidth: 1,
                  borderColor: t.border,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontFamily: FONT.regular,
                  marginBottom: 12,
                }}
              />

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ fontFamily: FONT.medium, fontSize: 14 }}>Active</Text>
                <Switch
                  value={draft.is_active}
                  onValueChange={(v) => setDraft((d) => ({ ...d, is_active: v }))}
                />
              </View>

              <Text style={{ fontFamily: FONT.medium, fontSize: 14, marginBottom: 8 }}>Team / Department</Text>
              <TouchableOpacity
                onPress={() => setDraft((d) => ({ ...d, department: "" }))}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: !draft.department ? BRAND.teal : t.border,
                  backgroundColor: !draft.department ? BRAND.tealSoft : "#fff",
                  marginBottom: 6,
                }}
              >
                <Text style={{ fontFamily: FONT.regular }}>Other (Snackify only)</Text>
              </TouchableOpacity>
              {departments.map((dept) => (
                <TouchableOpacity
                  key={dept.id}
                  onPress={() => setDraft((d) => ({ ...d, department: dept.name }))}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: draft.department === dept.name ? BRAND.teal : t.border,
                    backgroundColor: draft.department === dept.name ? BRAND.tealSoft : "#fff",
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ fontFamily: FONT.regular }}>{dept.name}</Text>
                </TouchableOpacity>
              ))}
              <Text style={{ fontSize: 11, color: t.muted, marginBottom: 12, fontFamily: FONT.light }}>
                {appsLocked
                  ? "Admin / Super Admin accounts always have all three apps."
                  : `This person will get: ${appsLabelForDepartment(draft.department)}`}
              </Text>

              <Text style={{ fontFamily: FONT.medium, fontSize: 14, marginBottom: 8 }}>Snackify role</Text>
              {SNACKIFY_ROLES.map((role) => (
                <TouchableOpacity
                  key={role.value}
                  onPress={() => setDraft((d) => ({ ...d, snackify_role: role.value }))}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: draft.snackify_role === role.value ? BRAND.teal : t.border,
                    backgroundColor: draft.snackify_role === role.value ? BRAND.tealSoft : "#fff",
                    marginBottom: 6,
                  }}
                >
                  <Text style={{
                    fontFamily: draft.snackify_role === role.value ? FONT.medium : FONT.regular,
                    color: draft.snackify_role === role.value ? BRAND.tealDark : t.text,
                  }}
                  >
                    {role.label}
                  </Text>
                </TouchableOpacity>
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
                    await save();
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
