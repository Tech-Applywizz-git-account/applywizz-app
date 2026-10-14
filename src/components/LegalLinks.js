import React from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { Text } from "./AppText";
import { FONT } from "../typography";
import runtimeConfig from "../config/runtimeConfig";

const { validatedHttpsUrl } = runtimeConfig;

function resolveHttps(val, fallback) {
  return validatedHttpsUrl(val) || validatedHttpsUrl(fallback);
}

export default function LegalLinks({
  showConfigurationNote = false,
  color = "#64748B",
  style,
}) {
  const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};
  const links = [
    {
      label: "Privacy Policy",
      url: resolveHttps(extra.privacyPolicyUrl, "https://applywizz.com/privacy"),
    },
    {
      label: "Support",
      url: resolveHttps(extra.supportUrl, "https://applywizz.com/support"),
    },
  ];
  const available = links.filter((item) => Boolean(item.url));

  if (!available.length && !showConfigurationNote) return null;

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="toolbar"
      accessibilityLabel="Legal and support links"
    >
      {available.length ? (
        <View style={styles.row}>
          {available.map((item, index) => (
            <React.Fragment key={item.label}>
              {index > 0 ? <Text style={[styles.bullet, { color }]}>·</Text> : null}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Open ${item.label}`}
                accessibilityHint="Opens external web link"
                hitSlop={12}
                onPress={() => Linking.openURL(item.url).catch(() => {})}
              >
                <Text style={[styles.linkText, { color }]}>{item.label}</Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      ) : null}
      {showConfigurationNote && available.length < links.length ? (
        <Text
          accessibilityRole="text"
          style={[styles.note, { color, marginTop: available.length ? 10 : 0 }]}
        >
          Privacy/support URLs need configuration before App Store submission.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  bullet: {
    fontSize: 12,
    opacity: 0.6,
  },
  linkText: {
    fontFamily: FONT.regular,
    fontSize: 12,
    textDecorationLine: "underline",
  },
  note: {
    fontFamily: FONT.light,
    fontSize: 12,
    textAlign: "center",
  },
});
