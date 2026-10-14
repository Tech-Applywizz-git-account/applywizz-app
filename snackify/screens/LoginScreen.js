import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Text } from "../../src/components/AppText";
import { FONT } from "../../src/typography";
import { useAuth } from "../../src/context/AuthContext";
import { useSnackAuth } from "../AuthContext";
import { SN } from "../data";
import { PantryScreen, PrimaryBtn, Err } from "../ui";

export default function LoginScreen() {
  const invoice = useAuth();
  const auth = useSnackAuth();
  const seed = String(invoice?.user?.email || "").toLowerCase();
  const [email, setEmail] = useState(seed);
  const [step, setStep] = useState("email");
  const [code, setCode] = useState("");
  const [tx, setTx] = useState("");
  const [hint, setHint] = useState("");

  const domainOk = useMemo(
    () => email.trim().toLowerCase().endsWith("@applywizz.ai") || email.trim().toLowerCase() === "guest",
    [email],
  );

  const continueEmail = async () => {
    const e = email.trim().toLowerCase();
    if (!e.endsWith("@applywizz.ai")) {
      auth.setError("Use your @applywizz.ai work email");
      return;
    }
    const res = await auth.startLogin(e);
    const next = res?.nextStep || res?.next_step;
    const id = res?.transactionId || res?.transaction_id || res?.enrollmentTransactionId;
    if (next === "otp") {
      const en = await auth.startEnrollment(e);
      setTx(en?.enrollmentTransactionId || en?.transactionId || id || "");
      setStep("otp");
      setHint("We emailed a 6-digit code.");
    } else {
      setTx(id || "");
      setStep("totp");
      setHint("Enter the 6-digit code from Microsoft Authenticator.");
    }
  };

  const submitCode = async () => {
    if (code.length < 6) return;
    if (step === "totp") await auth.verifyTotp(tx, code);
    else {
      const enroll = await auth.verifyEnrollmentOtp(tx, code);
      const id = enroll?.enrollmentTransactionId || enroll?.transactionId || tx;
      setTx(id);
      setStep("enroll");
      setHint("Scan the QR in Authenticator on the web, then enter your first TOTP.");
      setCode("");
    }
  };

  const submitEnroll = async () => {
    if (code.length < 6) return;
    await auth.verifyTotpEnrollment(tx, code);
  };

  return (
    <PantryScreen>
      <View style={{ padding: 22, flex: 1 }}>
        <Text style={styles.kicker}>APPLYWIZZ PANTRY</Text>
        <Text style={styles.h}>Sign in to Snackify</Text>
        <Text style={styles.sub}>Office cafeteria, lunch tokens, and pantry ops. Use your @applywizz.ai email.</Text>

        {step === "email" ? (
          <>
            <Text style={styles.lbl}>Work email</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@applywizz.ai"
              placeholderTextColor={SN.muted}
              style={styles.input}
            />
            <PrimaryBtn title="Continue" onPress={continueEmail} loading={auth.busy} disabled={!domainOk} style={{ marginTop: 14 }} />
            <Pressable onPress={() => auth.guest()} style={{ marginTop: 16 }}>
              <Text style={styles.link}>Entering as a guest? Order here →</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.sub}>{hint}</Text>
            <TextInput
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor={SN.muted}
              style={styles.input}
            />
            <PrimaryBtn
              title={step === "enroll" ? "Finish setup" : "Verify"}
              onPress={step === "enroll" ? submitEnroll : submitCode}
              loading={auth.busy}
              style={{ marginTop: 14 }}
            />
            <Pressable onPress={() => { setStep("email"); setCode(""); }} style={{ marginTop: 14 }}>
              <Text style={styles.link}>Use a different email</Text>
            </Pressable>
          </>
        )}
        <Err text={auth.error} />
        <Text style={styles.foot}>Secured with Microsoft Authenticator (MFA)</Text>
      </View>
    </PantryScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: FONT.medium, color: SN.espresso, letterSpacing: 1.4, fontSize: 12 },
  h: { fontFamily: FONT.medium, fontSize: 28, color: SN.ink, marginTop: 8 },
  sub: { fontFamily: FONT.light, color: SN.muted, marginTop: 8, lineHeight: 20 },
  lbl: { fontFamily: FONT.medium, color: SN.ink, marginTop: 22, marginBottom: 6 },
  input: {
    height: 50, borderRadius: 12, backgroundColor: "#fff",
    paddingHorizontal: 14, fontFamily: FONT.regular, color: SN.ink, fontSize: 16,
  },
  link: { fontFamily: FONT.medium, color: SN.espresso, fontSize: 14 },
  foot: { fontFamily: FONT.light, color: SN.muted, marginTop: 24, fontSize: 12 },
});
