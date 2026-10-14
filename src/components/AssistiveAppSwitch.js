import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { FONT } from "../typography";
import { useWorkspace } from "../context/WorkspaceContext";

const SIZE = 48;
const GAP = 10;
const MENU_W = 148;
const PAD = 8;
const TAP_SLOP = 10;
const POS_KEY = "applywizz.fab.pos.v2";
const ALL_APPS = [
  { id: "invoice", label: "Invoice", icon: "receipt-outline" },
  { id: "snackify", label: "Snackify", icon: "cafe-outline" },
  { id: "career", label: "Career", icon: "briefcase-outline" },
];

function boxOf(W, H, insets) {
  return {
    w: Math.max(SIZE + PAD * 2, W),
    h: Math.max(SIZE + PAD * 2, H - (insets.top || 0) - 58),
  };
}

function clamp(x, y, box) {
  return {
    x: Math.min(Math.max(PAD, box.w - SIZE - PAD), Math.max(PAD, x)),
    y: Math.min(Math.max(PAD, box.h - SIZE - PAD), Math.max(PAD, y)),
  };
}

function pickSide(pos, box) {
  const distLeft = pos.x;
  const distRight = box.w - pos.x - SIZE;
  const distTop = pos.y;
  const distBottom = box.h - pos.y - SIZE;
  const nearestSide = distLeft <= distRight ? distLeft : distRight;
  const nearestEnd = distTop <= distBottom ? distTop : distBottom;
  if (nearestSide <= nearestEnd) {
    return distLeft <= distRight ? "right" : "left";
  }
  return distTop <= distBottom ? "bottom" : "top";
}

function menuOrigin(side, pos, box, menuH) {
  let x = pos.x;
  let y = pos.y;
  if (side === "left") {
    x = pos.x - MENU_W - GAP;
    y = pos.y + SIZE / 2 - menuH / 2;
  } else if (side === "right") {
    x = pos.x + SIZE + GAP;
    y = pos.y + SIZE / 2 - menuH / 2;
  } else if (side === "top") {
    x = pos.x + SIZE / 2 - MENU_W / 2;
    y = pos.y - menuH - GAP;
  } else {
    x = pos.x + SIZE / 2 - MENU_W / 2;
    y = pos.y + SIZE + GAP;
  }
  x = Math.min(box.w - MENU_W - PAD, Math.max(PAD, x));
  y = Math.min(box.h - menuH - PAD, Math.max(PAD, y));
  return { x, y };
}

export default function AssistiveAppSwitch() {
  const { workspaceId, setWorkspaceId, allowedApps, showSwitcher } = useWorkspace();
  const apps = useMemo(
    () => ALL_APPS.filter((app) => allowedApps.includes(app.id)),
    [allowedApps],
  );
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const box = boxOf(W, H, insets);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(() => ({ x: Math.max(PAD, box.w - SIZE - 16), y: 72 }));
  const panXY = useRef(new Animated.ValueXY({ x: pos.x, y: pos.y })).current;
  const boxRef = useRef(box);
  const moved = useRef(false);
  boxRef.current = box;

  const sync = (next) => {
    panXY.setOffset({ x: 0, y: 0 });
    panXY.setValue(next);
    setPos(next);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next = { x: box.w - SIZE - 16, y: 72 };
      try {
        const raw = await AsyncStorage.getItem(POS_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (typeof saved.fx === "number") next = { x: saved.fx * box.w, y: saved.fy * box.h };
        }
      } catch (_) {
        /* default */
      }
      if (!cancelled) sync(clamp(next.x, next.y, box));
    })();
    return () => { cancelled = true; };
  }, [box.w, box.h]);

  const finish = (_, g) => {
    panXY.flattenOffset();
    const raw = {
      x: panXY.x.__getValue ? panXY.x.__getValue() : panXY.x._value,
      y: panXY.y.__getValue ? panXY.y.__getValue() : panXY.y._value,
    };
    const next = clamp(raw.x, raw.y, boxRef.current);
    panXY.setValue(next);
    setPos(next);
    const b = boxRef.current;
    AsyncStorage.setItem(POS_KEY, JSON.stringify({
      fx: b.w ? next.x / b.w : 0.85,
      fy: b.h ? next.y / b.h : 0.12,
    })).catch(() => {});
    const tapped = !moved.current && Math.hypot(g.dx, g.dy) < TAP_SLOP;
    moved.current = false;
    if (tapped) setOpen((v) => !v);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          moved.current = false;
          panXY.extractOffset();
          panXY.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: (_, g) => {
          if (Math.hypot(g.dx, g.dy) > TAP_SLOP) {
            moved.current = true;
            setOpen(false);
          }
          panXY.setValue({ x: g.dx, y: g.dy });
        },
        onPanResponderRelease: finish,
        onPanResponderTerminate: finish,
      }),
    [panXY],
  );

  const switchTo = (id) => {
    setOpen(false);
    if (id !== workspaceId) setWorkspaceId(id);
  };

  const menuHeight = Math.max(44, apps.length * 40 + 8);
  const side = pickSide(pos, box);
  const menuAt = menuOrigin(side, pos, box, menuHeight);

  if (!showSwitcher || apps.length <= 1) {
    return null;
  }

  return (
    <>
      {open ? (
        <View style={[styles.menu, { left: menuAt.x, top: menuAt.y, height: menuHeight }]}>
          {apps.map((app) => {
            const on = app.id === workspaceId;
            return (
              <Pressable
                key={app.id}
                onPress={() => switchTo(app.id)}
                style={[styles.item, on && styles.itemOn]}
              >
                <Ionicons name={app.icon} size={15} color={on ? "#fff" : "#222"} />
                <Text style={[styles.itemTxt, on && styles.itemTxtOn]}>{app.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Animated.View
        collapsable={false}
        {...pan.panHandlers}
        style={[styles.fabHit, { left: panXY.x, top: panXY.y }]}
      >
        <View style={[styles.fab, open && styles.fabOn]} pointerEvents="none">
          <Ionicons name="apps" size={20} color="#fff" />
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fabHit: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    zIndex: 200,
    elevation: 24,
  },
  menu: {
    position: "absolute",
    width: MENU_W,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 4,
    zIndex: 201,
    elevation: 26,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  itemOn: {
    backgroundColor: "#1C1C1E",
  },
  itemTxt: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: "#222",
  },
  itemTxtOn: {
    color: "#fff",
  },
  fab: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: "rgba(28,28,30,0.88)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.4)",
  },
  fabOn: {
    backgroundColor: "#111",
    borderColor: "#fff",
  },
});
