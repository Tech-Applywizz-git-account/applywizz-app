import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { useTheme } from "./ui";

function ShimmerBlock({ width = "100%", height = 16, borderRadius = 8, style }) {
  const t = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: t.border, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <ShimmerBlock width="40%" height={14} />
      <ShimmerBlock width="70%" height={28} style={{ marginTop: 10 }} />
      <ShimmerBlock width="55%" height={12} style={{ marginTop: 10 }} />
    </View>
  );
}

export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <ShimmerBlock width={40} height={40} borderRadius={20} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <ShimmerBlock width="60%" height={14} />
        <ShimmerBlock width="40%" height={12} style={{ marginTop: 6 }} />
      </View>
      <ShimmerBlock width={60} height={16} />
    </View>
  );
}

export function SkeletonKPI() {
  const t = useTheme();
  return (
    <View style={[styles.kpi, { backgroundColor: t.card, borderColor: t.border }]}>
      <ShimmerBlock width={20} height={20} borderRadius={4} />
      <ShimmerBlock width="80%" height={22} style={{ marginTop: 8 }} />
      <ShimmerBlock width="50%" height={10} style={{ marginTop: 6 }} />
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <View style={{ padding: 16 }}>
      <ShimmerBlock width="30%" height={14} />
      <ShimmerBlock width="50%" height={28} style={{ marginTop: 8 }} />
      <View style={{ marginTop: 16 }} />
      <SkeletonCard />
      <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
        <SkeletonKPI />
        <SkeletonKPI />
      </View>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        <SkeletonKPI />
        <SkeletonKPI />
      </View>
      <View style={{ marginTop: 16 }} />
      <SkeletonCard />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
}

export function ReportsSkeleton() {
  return (
    <View style={{ padding: 16 }}>
      <SkeletonCard />
      <SkeletonCard />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
      </View>
      <View style={{ marginTop: 12 }} />
      <SkeletonCard />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
}

export function ListSkeleton({ rows = 6 }) {
  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

export { ShimmerBlock };

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  kpi: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 16 },
});
