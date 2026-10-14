import React from "react";
import { Image, View, StyleSheet, Text } from "react-native";
import * as SplashScreen from "expo-splash-screen";

const LOADING_GIF = require("../../assets/logo-loading.gif");

SplashScreen.preventAutoHideAsync().catch(() => {});

async function hideNativeSplash() {
  try {
    await SplashScreen.hideAsync();
  } catch (_) {
    /* already hidden */
  }
}

/**
 * ApplyWizz loading GIF — used for splash and in-app loaders.
 * Native splash is a still from this GIF; JS plays the animation.
 * Native hide is owned by App.js Gate after fonts + auth + workspace are ready.
 */
export default function BrandLoader({
  variant = "inline",
  size = 128,
  label,
  dark = true,
}) {
  const splash = variant === "splash";
  const dim = splash ? 280 : size;

  return (
    <View style={[styles.wrap, splash && styles.splashWrap, splash && !dark && styles.splashWrapLight, !dark && styles.lightWrap]}>
      <Image
        source={LOADING_GIF}
        style={{ width: dim, height: dim }}
        resizeMode="contain"
      />
      {label ? (
        <Text style={[styles.label, !dark && styles.labelLight]}>{label}</Text>
      ) : null}
    </View>
  );
}

export function BrandSplash({ label = "Loading invoices…", light = false }) {
  return <BrandLoader variant="splash" label={label} dark={!light} />;
}

export { hideNativeSplash };

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  splashWrap: {
    flex: 1,
    width: "100%",
    backgroundColor: "#000000",
  },
  splashWrapLight: {
    backgroundColor: "#F4FBF8",
  },
  lightWrap: {
    backgroundColor: "transparent",
  },
  label: {
    marginTop: 18,
    fontSize: 14,
    color: "#94A3B8",
    letterSpacing: 0.3,
  },
  labelLight: {
    color: "#64748B",
  },
});
