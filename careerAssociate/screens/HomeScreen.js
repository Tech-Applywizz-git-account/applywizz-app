import React, { useCallback } from "react";
import { Alert, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/components/AppText";
import { Button, SoftHeader } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { useWorkspace, WORKSPACE_IDS } from "../../src/context/WorkspaceContext";
import { FONT } from "../../src/typography";
import AssistiveAppSwitch from "../../src/components/AssistiveAppSwitch";

export default function CareerAssociateHomeScreen({ navigation }) {
  const { user, profile, signOut, signingOut, canImpersonate } = useAuth();
  const { canOpen, setWorkspaceId } = useWorkspace();
  const name = (user?.name || profile?.name || "there").split(" ")[0];

  const onSignOut = useCallback(() => {
    if (signingOut) return;
    Alert.alert("Sign out?", "You’ll be signed out of Applywizz workspaces.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => { signOut(); },
      },
    ]);
  }, [signOut, signingOut]);

  const canGoInvoice = canOpen(WORKSPACE_IDS.invoice);
  const canGoSnackify = canOpen(WORKSPACE_IDS.snackify);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8F5FF" }} edges={["top", "bottom"]}>
      <SoftHeader style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text
            accessibilityRole="header"
            style={{ fontFamily: FONT.medium, fontSize: 13, color: "#6D28D9", textTransform: "uppercase", letterSpacing: 0.6 }}
          >
            Career Associate
          </Text>
          <View
            style={{
              backgroundColor: "#EDE9FE",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontFamily: FONT.medium, fontSize: 11, color: "#6D28D9" }}>
              Upcoming Feature
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: FONT.medium, fontSize: 26, color: "#1E1338", marginTop: 6 }}>
          Hi {name}
        </Text>
      </SoftHeader>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 22,
            padding: 22,
            borderWidth: 1,
            borderColor: "#E9D5FF",
            shadowColor: "#6D28D9",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 3,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: "#EDE9FE",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="briefcase-outline" size={26} color="#6D28D9" />
          </View>

          <Text style={{ fontFamily: FONT.medium, fontSize: 18, color: "#1E1338" }}>
            Scheduled Internal Module
          </Text>
          <Text
            style={{
              fontFamily: FONT.regular,
              fontSize: 14,
              color: "#5B4B7A",
              marginTop: 8,
              lineHeight: 22,
            }}
          >
            Career Associate operations are planned for an upcoming rollout for authorized Applywizz team members. In the meantime, you can navigate between available organizational workspaces below.
          </Text>

          <View style={{ marginTop: 18, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="checkmark-circle" size={18} color="#7C3AED" />
              <Text style={{ fontFamily: FONT.light, fontSize: 13, color: "#4C1D95" }}>
                Candidate & associate pipelines
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="checkmark-circle" size={18} color="#7C3AED" />
              <Text style={{ fontFamily: FONT.light, fontSize: 13, color: "#4C1D95" }}>
                Interview coordination & schedules
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="checkmark-circle" size={18} color="#7C3AED" />
              <Text style={{ fontFamily: FONT.light, fontSize: 13, color: "#4C1D95" }}>
                Internal placement & billing records
              </Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 20, gap: 12 }}>
          {canGoInvoice ? (
            <Button
              title="Open Invoice workspace"
              onPress={() => setWorkspaceId(WORKSPACE_IDS.invoice)}
            />
          ) : null}

          {canGoSnackify ? (
            <Button
              title="Open Snackify workspace"
              variant={canGoInvoice ? "outline" : "solid"}
              onPress={() => setWorkspaceId(WORKSPACE_IDS.snackify)}
            />
          ) : null}

          {canImpersonate ? (
            <Button
              title="View as user"
              variant="outline"
              onPress={() => navigation.navigate("ViewAsUsers")}
            />
          ) : null}

          <Button
            title={signingOut ? "Signing out…" : "Sign out"}
            variant="outline"
            style={{ borderColor: "#FCA5A5" }}
            onPress={onSignOut}
            loading={signingOut}
          />
        </View>
      </ScrollView>

      <AssistiveAppSwitch />
    </SafeAreaView>
  );
}
