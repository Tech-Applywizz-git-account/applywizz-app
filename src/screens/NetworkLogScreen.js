import React, { useEffect, useMemo, useState } from "react";
import { View, FlatList, TouchableOpacity, Alert } from "react-native";
import { Text } from "../components/AppText";
import { useTheme, EmptyState } from "../components/ui";
import { clearNetworkLog, subscribeNetworkLog } from "../api/networkLog";
import { useScreenQuery } from "../navigation/useScreenQuery";
import { FONT } from "../typography";

function statusColor(ok, status, t) {
  if (!ok || status >= 400) return t.danger || "#DC2626";
  if (status >= 300) return "#B45309";
  return "#059669";
}

export default function NetworkLogScreen() {
  const t = useTheme();
  const [entries, setEntries] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const { query, setQuery } = useScreenQuery({ q: "", status: "all" });

  useEffect(() => subscribeNetworkLog(setEntries), []);

  const filtered = useMemo(() => {
    const q = String(query.q || "").trim().toLowerCase();
    return entries.filter((e) => {
      if (query.status === "err" && e.ok) return false;
      if (query.status === "ok" && !e.ok) return false;
      if (!q) return true;
      return `${e.method} ${e.url} ${e.status}`.toLowerCase().includes(q);
    });
  }, [entries, query.q, query.status]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flexDirection: "row", gap: 8, padding: 12 }}>
        {["all", "ok", "err"].map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setQuery({ status: s })}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: query.status === s ? t.accent : "#fff",
              borderWidth: 1,
              borderColor: t.border,
            }}
          >
            <Text style={{ color: query.status === s ? "#fff" : t.text, fontFamily: FONT.medium, fontSize: 12 }}>
              {s.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => {
            Alert.alert("Clear log?", "Remove all captured requests.", [
              { text: "Cancel", style: "cancel" },
              { text: "Clear", style: "destructive", onPress: () => clearNetworkLog() },
            ]);
          }}
          style={{ marginLeft: "auto", paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Text style={{ color: t.danger, fontFamily: FONT.medium, fontSize: 12 }}>Clear</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 40, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState title="No requests yet" subtitle="API calls will appear here." />}
        renderItem={({ item }) => {
          const open = expanded === item.id;
          return (
            <TouchableOpacity
              onPress={() => setExpanded(open ? null : item.id)}
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: t.border,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontFamily: FONT.medium, color: t.accent, fontSize: 12 }}>{item.method}</Text>
                <Text style={{ fontFamily: FONT.medium, color: statusColor(item.ok, item.status, t), fontSize: 12 }}>
                  {item.status || "ERR"}
                </Text>
                <Text style={{ color: t.muted, fontSize: 11, marginLeft: "auto" }}>{item.ms}ms</Text>
              </View>
              <Text style={{ color: t.text, fontSize: 12, marginTop: 6 }} numberOfLines={open ? 0 : 2}>
                {item.url}
              </Text>
              {open ? (
                <View style={{ marginTop: 10 }}>
                  {item.error ? (
                    <Text style={{ color: t.danger, fontSize: 11, marginBottom: 6 }}>{item.error}</Text>
                  ) : null}
                  {item.requestBody ? (
                    <Text style={{ color: t.subtext, fontSize: 10, fontFamily: FONT.light }} selectable>
                      req: {typeof item.requestBody === "string" ? item.requestBody : JSON.stringify(item.requestBody)}
                    </Text>
                  ) : null}
                  {item.responseBody ? (
                    <Text style={{ color: t.subtext, fontSize: 10, fontFamily: FONT.light, marginTop: 6 }} selectable>
                      res: {typeof item.responseBody === "string" ? item.responseBody : JSON.stringify(item.responseBody)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
