import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, Image, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEventTheme } from "./ThemeContext";

const PRESETS = new Set(["fade", "float", "pulse", "rotation", "sparkle", "confetti", "particle"]);

function AnimatedDecoration({ item, index, tokens, assets, running }) {
  const value = useRef(new Animated.Value(0)).current;
  const preset = PRESETS.has(item?.preset) ? item.preset : "fade";
  const duration = tokens.animations.durationMs;
  const animation = useMemo(() => Animated.loop(Animated.sequence([
    Animated.timing(value, { toValue: 1, duration, useNativeDriver: true }),
    Animated.timing(value, { toValue: 0, duration, useNativeDriver: true }),
  ])), [duration, value]);

  useEffect(() => {
    if (running) animation.start();
    else {
      animation.stop();
      value.setValue(0);
    }
    return () => animation.stop();
  }, [animation, running, value]);

  const intensity = tokens.animations.intensity;
  const transforms = [];
  if (["float", "particle", "confetti"].includes(preset)) {
    transforms.push({ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -24 * intensity] }) });
  }
  if (preset === "rotation" || preset === "confetti") {
    transforms.push({ rotate: value.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${180 + (180 * intensity)}deg`] }) });
  }
  if (preset === "pulse" || preset === "sparkle") {
    transforms.push({ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1 + (0.25 * intensity)] }) });
  }
  const asset = assets[item?.assetKey || tokens.decorations.assetKey];
  const left = `${8 + ((index * 23) % 84)}%`;
  const top = `${10 + ((index * 31) % 75)}%`;
  return (
    <Animated.View style={{
      position: "absolute",
      left,
      top,
      opacity: value.interpolate({ inputRange: [0, 1], outputRange: [tokens.decorations.opacity * 0.45, tokens.decorations.opacity] }),
      transform: transforms,
    }}>
      {asset?.type === "image" ? (
        <Image source={{ uri: asset.url }} accessibilityIgnoresInvertColors style={{ width: 28, height: 28 }} />
      ) : (
        <Text style={{ fontSize: 16 + ((index % 3) * 4) }}>{String(item?.symbol || (preset === "confetti" ? "◆" : "✦")).slice(0, 2)}</Text>
      )}
    </Animated.View>
  );
}

export default function ThemeOverlay() {
  const { tokens, assets, activeThemes, reducedMotion } = useEventTheme();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => listener.remove();
  }, []);

  if (!tokens.decorations.enabled || tokens.decorations.opacity <= 0) return null;
  const source = tokens.decorations.items || [];
  const count = Math.min(10, Math.max(1, Math.round(tokens.decorations.density * 20)));
  const items = Array.from({ length: count }, (_, index) => source[index % Math.max(1, source.length)] || {});
  const running = active && tokens.animations.enabled && !reducedMotion;
  const eventName = activeThemes[0]?.eventName;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { top: insets.top, bottom: insets.bottom }]}
    >
      {eventName ? (
        <View style={[styles.banner, { backgroundColor: tokens.colors.primary, opacity: Math.min(tokens.decorations.opacity + 0.25, 0.9) }]}>
          <Text style={styles.bannerText} numberOfLines={1}>{eventName.replace(/[-_]/g, " ")}</Text>
        </View>
      ) : null}
      {items.map((item, index) => (
        <AnimatedDecoration key={`${index}-${item?.assetKey || item?.preset || "item"}`} item={item} index={index} tokens={tokens} assets={assets} running={running} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute", top: 0, left: 0, right: 0, paddingVertical: 4, paddingHorizontal: 16,
  },
  bannerText: { color: "#FFFFFF", textAlign: "center", fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
});
