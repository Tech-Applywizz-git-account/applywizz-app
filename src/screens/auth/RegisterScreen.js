import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from "react-native";
import { Text } from "../../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { Button, Field, useTheme } from "../../components/ui";

export default function RegisterScreen({ navigation }) {
  const t = useTheme();
  const { register } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) return Alert.alert("Missing info", "Email and password are required.");
    setLoading(true);
    try {
      await register(email.trim(), password, businessName.trim());
    } catch (e) {
      const err = e.response?.data;
      const msg = err?.email?.[0] || err?.password?.[0] || err?.detail || "Please try again.";
      Alert.alert("Sign up failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 26, fontWeight: "500", color: t.text, marginBottom: 6 }}>Create account</Text>
        <Text style={{ color: t.subtext, marginBottom: 24, fontWeight: "300"}}>Start invoicing in seconds.</Text>

        <Field label="Business name" value={businessName} onChangeText={setBusinessName} placeholder="Your business" />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@business.com" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" />

        <Button title="Create account" onPress={submit} loading={loading} />

        <TouchableOpacity style={{ marginTop: 20, alignItems: "center" }} onPress={() => navigation.goBack()}>
          <Text style={{ color: t.subtext, fontWeight: "300"}}>
            Already have an account? <Text style={{ color: t.accent, fontWeight: "500" }}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
