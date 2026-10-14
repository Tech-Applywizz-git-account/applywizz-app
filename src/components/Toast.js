import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { Text } from "./AppText";


const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const [type, setType] = useState("info");
  const opacity = useRef(new Animated.Value(0)).current;

  const show = useCallback((message, t = "info") => {
    setMsg(message);
    setType(t);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(3600),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setMsg(null));
  }, [opacity]);

  const success = useCallback((m) => show(m, "success"), [show]);
  const error = useCallback((m) => show(m, "error"), [show]);
  const info = useCallback((m) => show(m, "info"), [show]);

  const value = useMemo(() => ({ show, success, error, info }), [show, success, error, info]);

  const bg = type === "success" ? "#ecfdf5" : type === "error" ? "#fef2f2" : "#eff6ff";
  const color = type === "success" ? "#166534" : type === "error" ? "#991b1b" : "#1e40af";

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {msg ? (
        <Animated.View style={[styles.wrap, { opacity, backgroundColor: bg }]}>
          <Text style={[styles.text, { color }]}>{msg}</Text>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

const styles = StyleSheet.create({
  wrap: {
    position: "absolute", bottom: 36, left: 20, right: 20, padding: 14, borderRadius: 12,
    zIndex: 9999, elevation: 8, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8,
  },
  text: { fontSize: 14, fontWeight: "500", textAlign: "center" },
});
