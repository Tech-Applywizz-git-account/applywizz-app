import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  ScrollView,
  useWindowDimensions,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "../../context/AuthContext";
import { Button, useTheme } from "../../components/ui";
import { BRAND } from "../../theme";
import { FONT } from "../../typography";
import { API_ORIGIN } from "../../api/client";
import { warmBackend, subscribeWarmStatus } from "../../api/warmup";
import LegalLinks from "../../components/LegalLinks";
import { OTP_LEN, normalizeOtpDigits } from "../../utils/authForm";

function OtpDigitGrid({ value, onChange, onComplete, autoFocus }) {
  const inputRef = useRef(null);
  const digits = normalizeOtpDigits(value).split("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 280);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [autoFocus]);

  const setCode = useCallback((raw) => {
    const next = normalizeOtpDigits(raw);
    onChange(next);
    if (next.length === OTP_LEN) onComplete?.(next);
  }, [onChange, onComplete]);

  const activeIndex = Math.min(digits.length, OTP_LEN - 1);

  return (
    <View>
      <Text style={styles.label}>Authenticator code</Text>
      <Pressable onPress={() => inputRef.current?.focus()} style={styles.otpRow}>
        {Array.from({ length: OTP_LEN }).map((_, i) => {
          const filled = Boolean(digits[i]);
          const active = focused && i === activeIndex;
          return (
            <View
              key={i}
              style={[
                styles.otpCell,
                filled && styles.otpCellFilled,
                active && styles.otpCellActive,
              ]}
            >
              {filled ? (
                <Text
                  style={styles.otpDigit}
                  allowFontScaling={false}
                >
                  {digits[i]}
                </Text>
              ) : active ? (
                <View style={styles.otpCaret} />
              ) : null}
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={inputRef}
        value={normalizeOtpDigits(value)}
        onChangeText={setCode}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_LEN}
        caretHidden
        style={styles.hiddenInput}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <Text style={styles.otpHint}>Enter the 6-digit code from your authenticator app</Text>
    </View>
  );
}

function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
  secureTextEntry,
  right,
  keyboardType,
  autoCapitalize,
  autoFocus,
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.fieldShell, !editable && styles.fieldShellLocked]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          editable={editable}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || "none"}
          autoFocus={autoFocus}
          style={styles.fieldInput}
        />
        {right}
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const t = useTheme();
  const { width: W } = useWindowDimensions();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [mfaUri, setMfaUri] = useState("");
  const [qrExpanded, setQrExpanded] = useState(true);
  const [serverNote, setServerNote] = useState("");

  const submittingRef = useRef(false);

  useEffect(() => {
    warmBackend({ force: false }).catch(() => {});
    return subscribeWarmStatus((s) => {
      if (s.state === "warming") setServerNote("Waking secure server…");
      else if (s.state === "cold" || s.state === "ready") {
        setServerNote(s.state === "cold" ? "Server woke up — you’re good to go" : "");
        if (s.state === "cold") setTimeout(() => setServerNote(""), 2000);
      } else if (s.state === "error") setServerNote("Server unreachable — check connection");
      else setServerNote("");
    });
  }, []);

  useEffect(() => {
    const n = email.trim().toLowerCase();
    const isPwd =
      n === "dinesh@applywizz.ai"
      || n === "techapplywizz@gmail.com"
      || n === "admin@gmail.com"
      || n === "ca@applywizz.ai"
      || n.startsWith("admin@")
      || n.startsWith("ca@");
    setIsAdmin(isPwd);
    setShowPasswordInput(false);
    setOtpRequired(false);
    setShowSetup(false);
    setOtp("");
    setQrExpanded(true);
  }, [email]);

  const errText = (e, fallback) => {
    const data = e?.response?.data;
    const payload = data?.error ?? data?.detail ?? data;
    if (typeof payload === "string") return payload;
    if (payload && typeof payload === "object") {
      if (typeof payload.message === "string") return payload.message;
      if (typeof payload.detail === "string") return payload.detail;
    }
    if (e?.message === "Network Error") {
      return `Cannot reach ${API_ORIGIN}. Use the same Wi‑Fi as this PC, and run Django as: py manage.py runserver 0.0.0.0:8000`;
    }
    return fallback;
  };

  const verifyOtp = useCallback(async (code) => {
    const normalizedEmail = email.trim().toLowerCase();
    const token = String(code || otp || "").replace(/\D/g, "");
    if (token.length !== OTP_LEN) {
      Alert.alert("Enter code", "Please enter the 6-digit authenticator code.");
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      await signIn(normalizedEmail, null, token);
    } catch (e) {
      Alert.alert("Login failed", errText(e, "Invalid authenticator code"));
      setLoading(false);
      submittingRef.current = false;
    }
  }, [email, otp, signIn]);

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { Alert.alert("Email is required"); return; }

    if (otpRequired) {
      await verifyOtp(otp);
      return;
    }

    if (isAdmin) {
      if (!showPasswordInput) {
        setShowPasswordInput(true);
        return;
      }
      if (!password) {
        Alert.alert("Password is required");
        return;
      }
      setLoading(true);
      try {
        await signIn(normalizedEmail, password);
        setLoading(false);
      } catch (e) {
        Alert.alert("Login failed", errText(e, "Authentication failed"));
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await signIn(normalizedEmail, null, otp || null);
      if (res?.require_otp) {
        setOtpRequired(true);
        if (res.require_setup) {
          setShowSetup(true);
          setMfaUri(res.mfa_uri ? String(res.mfa_uri) : '');
          setQrExpanded(Boolean(res.mfa_uri));
        } else {
          setShowSetup(false);
          setMfaUri('');
        }
        setLoading(false);
        return;
      }
      setLoading(false);
    } catch (e) {
      Alert.alert("Login failed", errText(e, "Authentication failed"));
      setLoading(false);
    }
  };

  const buttonTitle = otpRequired
    ? "Verify & sign in"
    : showPasswordInput
      ? "Sign in"
      : "Continue";

  const headline = otpRequired
    ? (showSetup ? "Set up authenticator" : "Enter your code")
    : "Welcome back";
  const subtitle = otpRequired
    ? (showSetup
      ? (mfaUri
        ? "Scan the QR with your authenticator app, then enter the 6-digit code."
        : "Contact an admin for MFA setup. After they reset MFA, open login again to see a QR.")
      : "Open your authenticator app and enter the current code.")
    : "Sign in to workspaces your organization assigned — invoices, office pantry (Snackify), career tools, and incentives. Switch apps in-app when you have access.";

  return (
    <View style={{ flex: 1, backgroundColor: "#F4FBF8" }}>
      <View style={{
        position: "absolute", top: -W * 0.25, left: -W * 0.2,
        width: W * 1.1, height: W * 1.1, borderRadius: W * 0.55,
        backgroundColor: "#D1FAE5", opacity: 0.7,
      }}
      />
      <View style={{
        position: "absolute", top: W * 0.15, right: -W * 0.35,
        width: W * 0.9, height: W * 0.9, borderRadius: W * 0.45,
        backgroundColor: "#CFFAFE", opacity: 0.55,
      }}
      />
      <View style={{
        position: "absolute", bottom: -40, left: W * 0.2,
        width: W * 0.7, height: W * 0.7, borderRadius: W * 0.35,
        backgroundColor: "#FCE7F3", opacity: 0.4,
      }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 36 }}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={{
              paddingHorizontal: 22,
              paddingTop: otpRequired && showSetup ? 20 : 36,
            }}
            >
              {otpRequired ? (
                <TouchableOpacity
                  onPress={() => {
                    setOtpRequired(false);
                    setOtp("");
                    setShowSetup(false);
                    setMfaUri("");
                  }}
                  style={styles.backRow}
                  hitSlop={8}
                >
                  <Ionicons name="arrow-back" size={18} color={BRAND.teal} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.logoMark}>
                  <Ionicons name="paper-plane" size={28} color="#fff" />
                </View>
              )}
              <Text style={styles.brand}>Applywizz</Text>

              <Text style={[styles.headline, otpRequired && { fontSize: 28, lineHeight: 34 }]}>
                {headline}
              </Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
              {!otpRequired ? (
                <Text style={styles.accountNotice}>
                  Accounts are provisioned by your organization. Contact your administrator if you need access.
                </Text>
              ) : null}

              {serverNote ? (
                <View style={styles.serverNote}>
                  <ActivityIndicator size="small" color={BRAND.teal} />
                  <Text style={styles.serverNoteText}>{serverNote}</Text>
                </View>
              ) : null}

              <View style={[styles.card, showSetup && qrExpanded && styles.cardCompact]}>
                {otpRequired && showSetup ? (
                  <View style={styles.steps}>
                    <View style={[styles.stepPill, qrExpanded && styles.stepPillActive]}>
                      <Text style={[styles.stepText, qrExpanded && styles.stepTextActive]}>1 · Scan QR</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                    <View style={[styles.stepPill, !qrExpanded && styles.stepPillActive]}>
                      <Text style={[styles.stepText, !qrExpanded && styles.stepTextActive]}>
                        2 · Enter code
                      </Text>
                    </View>
                  </View>
                ) : null}

                {!otpRequired ? (
                  <AuthField
                    label="Work email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@applywizz.ai"
                    keyboardType="email-address"
                    autoFocus
                  />
                ) : (
                  <View style={styles.emailLock}>
                    <Ionicons name="mail-outline" size={16} color={BRAND.teal} />
                    <Text style={styles.emailLockText} numberOfLines={1}>{email.trim().toLowerCase()}</Text>
                  </View>
                )}

                {showPasswordInput && !otpRequired ? (
                  <AuthField
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    placeholder="Enter password"
                    right={(
                      <TouchableOpacity onPress={() => setShowPass((v) => !v)} hitSlop={10}>
                        <Ionicons
                          name={showPass ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color={t.muted}
                        />
                      </TouchableOpacity>
                    )}
                  />
                ) : null}

                {otpRequired && showSetup && !mfaUri ? (
                  <View style={styles.qrBlock}>
                    <Text style={styles.qrTitle}>MFA setup required</Text>
                    <Text style={styles.qrSub}>
                      Ask an admin to reset your MFA. After reset, open login again to scan the QR, then enter the code below.
                    </Text>
                  </View>
                ) : null}

                {otpRequired && showSetup && mfaUri ? (
                  <View style={styles.qrBlock}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setQrExpanded((v) => !v)}
                      style={styles.qrHeader}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.qrTitle}>Scan with authenticator</Text>
                        <Text style={styles.qrSub}>Google Authenticator, Authy, or 1Password</Text>
                      </View>
                      <Ionicons
                        name={qrExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={BRAND.teal}
                      />
                    </TouchableOpacity>

                    {qrExpanded ? (
                      <View style={styles.qrBody}>
                        <View style={styles.qrFrame}>
                          <QRCode value={mfaUri} size={Math.min(168, W - 120)} />
                        </View>
                        <View style={styles.qrTips}>
                          <View style={styles.tipRow}>
                            <View style={styles.tipDot} />
                            <Text style={styles.tipText}>Open your authenticator app</Text>
                          </View>
                          <View style={styles.tipRow}>
                            <View style={styles.tipDot} />
                            <Text style={styles.tipText}>Add account → scan this QR</Text>
                          </View>
                          <View style={styles.tipRow}>
                            <View style={styles.tipDot} />
                            <Text style={styles.tipText}>Then enter the 6-digit code below</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => setQrExpanded(false)}
                          style={styles.scannedBtn}
                        >
                          <Text style={styles.scannedBtnText}>I’ve scanned it — enter code</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {otpRequired ? (
                  <OtpDigitGrid
                    value={otp}
                    onChange={setOtp}
                    onComplete={(code) => verifyOtp(code)}
                    autoFocus={!showSetup || !qrExpanded}
                  />
                ) : null}

                <Button
                  title={buttonTitle}
                  onPress={submit}
                  loading={loading}
                  style={{ marginTop: 8 }}
                  disabled={otpRequired && normalizeOtpDigits(otp).length < OTP_LEN}
                />

                {otpRequired ? (
                  <TouchableOpacity
                    style={{ marginTop: 16, alignItems: "center" }}
                    onPress={() => {
                      setOtpRequired(false);
                      setOtp("");
                      setShowSetup(false);
                      setMfaUri("");
                    }}
                  >
                    <Text style={{ color: "#64748B", fontFamily: FONT.light, fontSize: 13 }}>
                      Use a different email
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.footer}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND.teal }} />
                <Text style={styles.footerText}>Secure staff access · MFA protected</Text>
              </View>
              <LegalLinks style={{ marginTop: 8 }} color="#64748B" />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = {
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: BRAND.teal,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: BRAND.teal,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  brand: {
    fontFamily: FONT.medium,
    fontSize: 28,
    color: BRAND.teal,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
    alignSelf: "flex-start",
  },
  backText: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: BRAND.teal,
  },
  headline: {
    fontFamily: FONT.medium,
    fontSize: 34,
    color: "#0F172A",
    marginTop: 10,
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  subtitle: {
    fontFamily: FONT.light,
    color: "#64748B",
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
  accountNotice: {
    fontFamily: FONT.light,
    color: "#475569",
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 340,
  },
  serverNote: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  serverNoteText: {
    flex: 1,
    fontFamily: FONT.medium,
    fontSize: 12,
    color: BRAND.tealDark || "#0F766E",
  },
  card: {
    marginTop: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5F4EE",
    shadowColor: "#0F172A",
    shadowOpacity: 0.07,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  cardCompact: {
    paddingTop: 16,
  },
  steps: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  stepPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  stepPillActive: {
    backgroundColor: BRAND.tealSoft,
  },
  stepText: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: "#64748B",
  },
  stepTextActive: {
    color: BRAND.tealDark,
  },
  label: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: "#475569",
    marginBottom: 8,
  },
  fieldShell: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  fieldShellLocked: {
    backgroundColor: "#F1F5F9",
  },
  fieldInput: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 15,
    color: "#0F172A",
    paddingVertical: 12,
  },
  emailLock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: BRAND.tealSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  emailLockText: {
    flex: 1,
    fontFamily: FONT.medium,
    fontSize: 13,
    color: BRAND.tealDark,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  otpCell: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  otpCellFilled: {
    borderColor: "#99F6E4",
    backgroundColor: "#F0FDFA",
  },
  otpCellActive: {
    borderColor: BRAND.teal,
    backgroundColor: "#fff",
    shadowColor: BRAND.teal,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  otpDigit: {
    fontFamily: FONT.medium,
    fontSize: 22,
    lineHeight: 28,
    color: "#0F172A",
    textAlign: "center",
    width: "100%",
    includeFontPadding: false,
    textAlignVertical: "center",
    ...(Platform.OS === "android" ? { paddingTop: 2 } : { marginTop: 1 }),
  },
  otpCaret: {
    width: 2,
    height: 22,
    backgroundColor: BRAND.teal,
    borderRadius: 1,
  },
  otpHint: {
    marginTop: 10,
    fontFamily: FONT.light,
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0.02,
    height: 1,
    width: 1,
  },
  qrBlock: {
    backgroundColor: "#F0FDFA",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#99F6E4",
    marginBottom: 16,
    overflow: "hidden",
  },
  qrHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  qrTitle: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: "#0F172A",
  },
  qrSub: {
    fontFamily: FONT.light,
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  qrBody: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  qrFrame: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  qrTips: {
    alignSelf: "stretch",
    marginTop: 14,
    gap: 8,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND.teal,
  },
  tipText: {
    fontFamily: FONT.light,
    fontSize: 12,
    color: "#475569",
    flex: 1,
  },
  scannedBtn: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: BRAND.teal,
    alignSelf: "stretch",
    alignItems: "center",
  },
  scannedBtnText: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: "#fff",
  },
  footer: {
    marginTop: 28,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  footerText: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 12,
    fontFamily: FONT.light,
  },
};
