import React, { useEffect, useRef, useState } from "react";
import { Animated, View } from "react-native";
import { Text } from "./AppText";

import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const slideAnim = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: online ? -50 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [online, slideAnim]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <View style={{ backgroundColor: "#ef4444", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 8 }}>
        <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "500", fontSize: 13 }}>No internet connection</Text>
      </View>
    </Animated.View>
  );
}
