import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
} from "react-native";
import { Text } from "./AppText";
import { FONT } from "../typography";
import BrandLoader from "./BrandLoader";

const AI_SENTENCES = [
  "Reading your payment screenshot…",
  "Matching proof to the invoice amount…",
  "Checking transfer details for consistency…",
  "Confirming the payment method looks right…",
  "Securing the screenshot in cloud storage…",
  "Updating billing status to paid…",
  "Generating the paid invoice record…",
  "Almost done — finalizing confirmation…",
];

/**
 * Full-screen overlay while Mark as Paid uploads payment proof.
 */
export default function MarkPaidLoadingOverlay({ open, invoiceLabel = "" }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      return undefined;
    }
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % AI_SENTENCES.length);
    }, 2200);
    return () => clearInterval(id);
  }, [open]);

  return (
    <Modal visible={Boolean(open)} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.spinnerWrap}>
            <BrandLoader size={96} />
          </View>
          <Text style={styles.eyebrow}>Uploading proof</Text>
          <Text style={styles.title}>Marking payment as paid</Text>
          {invoiceLabel ? (
            <Text style={styles.invoice}>{invoiceLabel}</Text>
          ) : null}
          <Text style={styles.sentence}>{AI_SENTENCES[index]}</Text>
          <View style={styles.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.dot, index % 4 === i ? styles.dotActive : null]}
              />
            ))}
          </View>
          <Text style={styles.hint}>Please keep the app open until upload completes.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#0F172A",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 28,
    paddingVertical: 32,
    alignItems: "center",
  },
  spinnerWrap: {
    width: 112,
    height: 112,
    borderRadius: 20,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    overflow: "hidden",
  },
  eyebrow: {
    fontFamily: FONT.medium,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#6EE7B7",
  },
  title: {
    fontFamily: FONT.medium,
    fontSize: 18,
    color: "#FFFFFF",
    marginTop: 8,
    textAlign: "center",
  },
  invoice: {
    fontFamily: FONT.regular,
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 4,
  },
  sentence: {
    fontFamily: FONT.regular,
    fontSize: 15,
    color: "#E2E8F0",
    textAlign: "center",
    marginTop: 22,
    minHeight: 44,
    lineHeight: 22,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginTop: 18,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#475569",
  },
  dotActive: {
    backgroundColor: "#34D399",
  },
  hint: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: "#64748B",
    marginTop: 16,
    textAlign: "center",
  },
});
