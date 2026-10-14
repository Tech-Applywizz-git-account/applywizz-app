import React, { useCallback, useState } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Text } from "../../components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchWhatsAppUser,
  fetchWhatsAppChats,
  fetchWhatsAppCalls,
  sendWhatsAppChat,
  logWhatsAppCall,
  markWhatsAppRead,
  fetchWhatsAppTeams,
  assignWhatsAppUser,
  linkWhatsAppClient,
  searchClients,
} from "../../api/whatsapp";
import { fetchUsers } from "../../api/admin";
import { useTheme } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { formatApiError, toList, hasPermission } from "../../utils/billing";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../incentives/shared";
import {
  CATALOG_KEYS,
  CATALOG_TTL_MS,
  asList,
  loadCatalog,
} from "../../api/catalogCache";

function fmtWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

export default function WhatsAppThreadScreen({ route }) {
  const t = useTheme();
  const { user } = useAuth();
  const id = route.params?.id;
  const canReply = hasPermission(user, "reply_whatsapp") || user?.role === "Super Admin" || user?.is_superuser;
  const canCall = hasPermission(user, "log_whatsapp_call") || user?.role === "Super Admin" || user?.is_superuser;
  const canAssign = hasPermission(user, "assign_whatsapp") || user?.role === "Super Admin" || user?.is_superuser;
  const [contact, setContact] = useState(null);
  const [chats, setChats] = useState([]);
  const [calls, setCalls] = useState([]);
  const [draft, setDraft] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [assignUser, setAssignUser] = useState("");
  const [assignTeam, setAssignTeam] = useState("");
  const [agents, setAgents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [clientQ, setClientQ] = useState("");
  const [clientHits, setClientHits] = useState([]);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [u, c, k] = await Promise.all([
        fetchWhatsAppUser(id),
        fetchWhatsAppChats(id),
        fetchWhatsAppCalls(id),
      ]);
      setContact(u);
      setChats(toList(c));
      setCalls(toList(k));
      setAssignUser(u?.assigned_to || "");
      setAssignTeam(u?.team || "");
      markWhatsAppRead(id).catch(() => {});
      if (canAssign) {
        const [staffList, teamList] = await Promise.all([
          loadCatalog(
            CATALOG_KEYS.usersActive,
            async () => fetchUsers({ is_active: true, page_size: 100 }),
            { ttlMs: CATALOG_TTL_MS, map: asList },
          ),
          loadCatalog(
            CATALOG_KEYS.whatsappTeams,
            () => fetchWhatsAppTeams(),
            {
              ttlMs: CATALOG_TTL_MS,
              map: (teamData) => (Array.isArray(teamData) ? teamData : []),
            },
          ),
        ]);
        setAgents(staffList);
        setTeams(teamList);
      }
    } catch (e) {
      setError(formatApiError(e, "Could not load conversation."));
    } finally {
      setLoading(false);
    }
  }, [id, canAssign]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onSend = async () => {
    const body = draft.trim();
    if (!body || !canReply) return;
    setSending(true);
    try {
      await sendWhatsAppChat(id, body, noteMode ? "note" : "outbound");
      setDraft("");
      await load();
    } catch (e) {
      Alert.alert("Send failed", formatApiError(e, "Could not send."));
    } finally {
      setSending(false);
    }
  };

  const onAssign = async () => {
    try {
      await assignWhatsAppUser(id, { assigned_to: assignUser || null, team: assignTeam });
      await load();
    } catch (e) {
      Alert.alert("Assign failed", formatApiError(e, "Could not assign."));
    }
  };

  const onSearchClients = async (q) => {
    setClientQ(q);
    if (q.trim().length < 2) {
      setClientHits([]);
      return;
    }
    try {
      setClientHits(toList(await searchClients(q.trim())));
    } catch {
      setClientHits([]);
    }
  };

  const onLink = async (clientId) => {
    try {
      await linkWhatsAppClient(id, clientId);
      setClientQ("");
      setClientHits([]);
      await load();
    } catch (e) {
      Alert.alert("Link failed", formatApiError(e, "Could not link client."));
    }
  };

  const onCall = async () => {
    const tel = contact?.phone_e164;
    if (tel) Linking.openURL(`tel:${tel}`).catch(() => {});
    if (canCall) {
      try {
        await logWhatsAppCall(id, { direction: "outbound" });
        await load();
      } catch (e) {
        Alert.alert("Call log", formatApiError(e, "Could not log call."));
      }
    }
  };

  if (loading && !contact) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
        <ListSkeleton rows={6} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: t.border }}>
          <Text style={{ fontWeight: "500", color: t.text, fontSize: 16 }}>{contact?.name || contact?.phone_e164}</Text>
          <Text style={{ color: t.subtext, fontSize: 12, marginTop: 2 }}>{contact?.phone_e164}</Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 8, alignItems: "center" }}>
            <Badge text={contact?.status || "open"} tone="slate" />
            {contact?.is_unidentified ? <Badge text="unknown" tone="amber" /> : null}
            <TouchableOpacity onPress={onCall} style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="call-outline" size={16} color={t.accent} />
              <Text style={{ color: t.accent, fontWeight: "500" }}>Call</Text>
            </TouchableOpacity>
          </View>
          {contact?.client_name ? (
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 6 }}>
              Linked: {contact.client_name}{contact.client_awl_id ? ` · ${contact.client_awl_id}` : ""}
            </Text>
          ) : (
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 6 }}>Unidentified contact</Text>
          )}
        </View>
        {canAssign ? (
          <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: t.border, gap: 8 }}>
            <TextInput
              value={assignTeam}
              onChangeText={setAssignTeam}
              placeholder={teams.length ? `Team (${teams.map((x) => x.name).filter(Boolean).join(", ")})` : "Team"}
              placeholderTextColor={t.muted}
              style={{
                backgroundColor: t.card, borderWidth: 1, borderColor: t.border,
                borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: t.text,
              }}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity onPress={() => setAssignUser("")} style={{ marginRight: 8 }}>
                <Badge text="Unassigned" tone={!assignUser ? "amber" : "slate"} />
              </TouchableOpacity>
              {agents.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => setAssignUser(a.id)}
                  style={{ marginRight: 8 }}
                >
                  <Badge
                    text={a.name || a.email || "Staff"}
                    tone={String(assignUser) === String(a.id) ? "indigo" : "slate"}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={onAssign} style={{ alignSelf: "flex-start" }}>
              <Text style={{ color: t.accent, fontWeight: "500" }}>Assign</Text>
            </TouchableOpacity>
            <TextInput
              value={clientQ}
              onChangeText={onSearchClients}
              placeholder="Link existing client"
              placeholderTextColor={t.muted}
              style={{
                backgroundColor: t.card, borderWidth: 1, borderColor: t.border,
                borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: t.text,
              }}
            />
            {contact?.client ? (
              <TouchableOpacity onPress={() => onLink(null)}>
                <Text style={{ color: t.danger, fontSize: 12 }}>Unlink client</Text>
              </TouchableOpacity>
            ) : null}
            {clientHits.slice(0, 5).map((c) => (
              <TouchableOpacity key={c.id} onPress={() => onLink(c.id)}>
                <Text style={{ color: t.text, fontSize: 13 }}>
                  {c.name}{c.awl_id ? ` · ${c.awl_id}` : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        {error ? <Text style={{ color: t.danger, padding: 12 }}>{error}</Text> : null}
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        >
          {chats.map((m) => {
            const mine = m.direction === "outbound" || m.direction === "note";
            const note = m.direction === "note";
            return (
              <View key={m.id} style={{ alignItems: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
                <View style={{
                  maxWidth: "80%",
                  backgroundColor: note ? "#FEF3C7" : mine ? t.accent : t.card,
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: mine && !note ? 0 : 1,
                  borderColor: t.border,
                }}
                >
                  {note ? <Text style={{ fontSize: 10, color: "#92400E", marginBottom: 2 }}>NOTE</Text> : null}
                  <Text style={{ color: mine && !note ? "#fff" : t.text }}>{m.body}</Text>
                  <Text style={{ fontSize: 10, marginTop: 4, color: mine && !note ? "#ffffff99" : t.muted }}>
                    {fmtWhen(m.created_at)} · {m.status}
                  </Text>
                </View>
              </View>
            );
          })}
          {calls.slice(0, 8).map((c) => (
            <Text key={c.id} style={{ color: t.muted, fontSize: 11, marginBottom: 4 }}>
              Call · {c.direction} · {c.status} · {fmtWhen(c.started_at || c.created_at)}
            </Text>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", alignItems: "flex-end", padding: 12, gap: 8, borderTopWidth: 1, borderColor: t.border }}>
          <TouchableOpacity onPress={() => setNoteMode((n) => !n)} style={{ padding: 8 }}>
            <Ionicons name="document-text-outline" size={20} color={noteMode ? "#D97706" : t.muted} />
          </TouchableOpacity>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={noteMode ? "Internal note" : "Message"}
            placeholderTextColor={t.muted}
            editable={canReply}
            multiline
            style={{
              flex: 1, minHeight: 40, maxHeight: 100, borderWidth: 1, borderColor: t.border,
              borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: t.text, backgroundColor: t.card,
            }}
          />
          <TouchableOpacity onPress={onSend} disabled={!canReply || sending || !draft.trim()} style={{ padding: 8, opacity: !canReply || sending ? 0.4 : 1 }}>
            <Ionicons name="send" size={20} color={t.accent} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
