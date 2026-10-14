import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { FONT } from "../typography";
import { useWorkspace } from "../context/WorkspaceContext";

export const WORKSPACES = [
  {
    id: "invoice",
    name: "Invoice",
    line: "Collections & pay",
    icon: "receipt-outline",
    ink: "#0B3D34",
    wash: "#D8F3EC",
    accent: "#149E81",
  },
  {
    id: "snackify",
    name: "Snackify",
    line: "Inventory & stock",
    icon: "cube-outline",
    ink: "#3B1D0A",
    wash: "#FDE7D4",
    accent: "#E07A2F",
  },
  {
    id: "career",
    name: "Career",
    line: "Associate desk",
    icon: "briefcase-outline",
    ink: "#1B1233",
    wash: "#E8DFF8",
    accent: "#6D28D9",
  },
];

export default function AppWorkspaceSwitcher() {
  const { workspaceId, setWorkspaceId, allowedApps, showSwitcher } = useWorkspace();
  const visible = useMemo(
    () => WORKSPACES.filter((w) => allowedApps.includes(w.id)),
    [allowedApps],
  );
  const [railW, setRailW] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;

  const index = useMemo(
    () => Math.max(0, visible.findIndex((w) => w.id === workspaceId)),
    [visible, workspaceId],
  );
  const cellW = railW > 0 && visible.length ? railW / visible.length : 0;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: index,
      duration: 420,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [index, slide]);

  if (!showSwitcher || visible.length <= 1) {
    return null;
  }

  const outputRange = visible.map((_, i) => (cellW * i) + 4);

  return (
    <View style={styles.wrap}>
      <View style={styles.metaRow}>
        <Text style={styles.kicker}>Workspace</Text>
        <Text style={styles.meta}>
          {visible.length === 3 ? "One login · three apps" : `${visible.length} apps`}
        </Text>
      </View>

      <View style={styles.stage} onLayout={(e) => setRailW(e.nativeEvent.layout.width)}>
        {cellW > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glider,
              {
                width: cellW - 8,
                transform: [{
                  translateX: slide.interpolate({
                    inputRange: visible.map((_, i) => i),
                    outputRange,
                  }),
                }],
              },
            ]}
          />
        ) : null}

        {visible.map((workspace) => {
          const on = workspace.id === workspaceId;
          return (
            <Pressable
              key={workspace.id}
              onPress={() => setWorkspaceId(workspace.id)}
              style={styles.cell}
            >
              <View style={[styles.glyph, { backgroundColor: on ? workspace.wash : "#F1F5F9" }]}>
                <Ionicons
                  name={workspace.icon}
                  size={16}
                  color={on ? workspace.accent : "#64748B"}
                />
              </View>
              <Text style={[styles.name, on && { color: workspace.ink }]} numberOfLines={1}>
                {workspace.name}
              </Text>
              <Text style={[styles.line, on && { color: workspace.accent }]} numberOfLines={1}>
                {on ? "You’re here" : workspace.line}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  kicker: {
    fontFamily: FONT.medium,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#64748B",
  },
  meta: {
    fontFamily: FONT.light,
    fontSize: 11,
    color: "#94A3B8",
  },
  stage: {
    position: "relative",
    flexDirection: "row",
    backgroundColor: "#0B1220",
    borderRadius: 22,
    paddingVertical: 8,
    minHeight: 88,
  },
  glider: {
    position: "absolute",
    top: 6,
    bottom: 6,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
  },
  cell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    zIndex: 1,
  },
  glyph: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  name: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: "#E2E8F0",
  },
  line: {
    fontFamily: FONT.light,
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 1,
  },
});
