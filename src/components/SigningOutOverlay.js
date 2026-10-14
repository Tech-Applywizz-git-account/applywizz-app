import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Modal,
  Dimensions,
} from "react-native";
import { Text } from "./AppText";
import { FONT } from "../typography";
import BrandLoader from "./BrandLoader";

const { height: SCREEN_H } = Dimensions.get("window");

/** Full-screen centered overlay while session cleanup finishes. */
export default function SigningOutOverlay({ visible }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      scale.setValue(0.92);
      return undefined;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
    return undefined;
  }, [visible, opacity, scale]);

  return (
    <Modal
      visible={Boolean(visible)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop} pointerEvents="auto">
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <View style={styles.logoWrap}>
            <BrandLoader size={88} />
          </View>
          <Text style={styles.title}>Signing out</Text>
          <Text style={styles.sub}>Almost done…</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    minHeight: SCREEN_H,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  title: {
    marginTop: 16,
    fontFamily: FONT.medium,
    fontSize: 18,
    color: "#0F172A",
  },
  sub: {
    marginTop: 6,
    fontFamily: FONT.light,
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
  },
});
