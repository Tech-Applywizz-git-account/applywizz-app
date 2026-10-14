import React, { useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { SN } from "../data";
import { snackApi } from "../api";

const SUPPORT_ICON = require("../assets/support-agent.png");

const OPTIONS = [
  { id: "coins", t: "Request for coins", s: "Ask facility manager to add coins to your wallet." },
  { id: "card_missing", t: "Card is not showing", s: "Ask facility manager to assign your Digital Cafeteria Card." },
  { id: "other", t: "Other", s: "Write a short message." },
];

export default function SupportTicketSheet({ visible, onClose }) {
  const [kind, setKind] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!kind) return;
    setBusy(true);
    setErr("");
    try {
      const data = await snackApi.supportTicket({ kind, message });
      setDone(data?.message || "Ticket sent.");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setKind("");
    setMessage("");
    setDone("");
    setErr("");
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.veil}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.h}>Support ticket</Text>
            <Pressable onPress={close} hitSlop={8}>
              <Ionicons name="close" size={22} color={SN.ink} />
            </Pressable>
          </View>
          {done ? (
            <>
              <Ionicons name="checkmark-circle" size={48} color="#1BA672" />
              <Text style={styles.ok}>{done}</Text>
              <Pressable onPress={close} style={styles.send}>
                <Text style={styles.sendT}>Close</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sub}>Facility manager gets this email. Dinesh is CC’d.</Text>
              {OPTIONS.map((o) => (
                <Pressable
                  key={o.id}
                  onPress={() => setKind(o.id)}
                  style={[styles.opt, kind === o.id && styles.optOn]}
                >
                  <Ionicons
                    name={kind === o.id ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={kind === o.id ? "#1BA672" : SN.muted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optT}>{o.t}</Text>
                    <Text style={styles.optS}>{o.s}</Text>
                  </View>
                </Pressable>
              ))}
              {kind === "other" || kind === "coins" || kind === "card_missing" ? (
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder={kind === "other" ? "Describe your request" : "Optional note"}
                  placeholderTextColor={SN.muted}
                  style={styles.input}
                  multiline
                />
              ) : null}
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <Pressable
                onPress={submit}
                disabled={!kind || busy}
                style={[styles.send, (!kind || busy) && { opacity: 0.5 }]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendT}>Send ticket</Text>}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function HeadsetButton({ onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.headset} hitSlop={8} accessibilityLabel="Support">
      <Image source={SUPPORT_ICON} style={styles.supportImg} resizeMode="contain" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headset: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  supportImg: {
    width: 28,
    height: 28,
  },
  veil: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  h: { fontFamily: FONT.medium, fontSize: 18, color: SN.ink },
  sub: { fontFamily: FONT.light, color: SN.muted, fontSize: 12, marginBottom: 12 },
  opt: { flexDirection: "row", gap: 10, alignItems: "center", padding: 12, borderRadius: 14, backgroundColor: "#F4F4F5", marginBottom: 8 },
  optOn: { backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#1BA672" },
  optT: { fontFamily: FONT.medium, color: SN.ink, fontSize: 14 },
  optS: { fontFamily: FONT.light, color: SN.muted, fontSize: 12, marginTop: 2 },
  input: {
    minHeight: 72, borderRadius: 14, backgroundColor: "#F4F4F5", padding: 12,
    fontFamily: FONT.regular, color: SN.ink, marginTop: 4, textAlignVertical: "top",
  },
  err: { fontFamily: FONT.regular, color: "#B42318", marginTop: 8 },
  ok: { fontFamily: FONT.regular, color: SN.ink, marginVertical: 12, textAlign: "center" },
  send: { marginTop: 14, height: 48, borderRadius: 14, backgroundColor: SN.espresso, alignItems: "center", justifyContent: "center" },
  sendT: { fontFamily: FONT.medium, color: "#fff" },
});
