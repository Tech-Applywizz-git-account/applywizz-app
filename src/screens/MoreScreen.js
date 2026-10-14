import React, { useCallback, useMemo } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Text } from "../components/AppText";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../context/AuthContext";
import { Card, SoftHeader, useTheme } from "../components/ui";
import { BRAND } from "../theme";
import { firstLetter } from "../utils/avatar";
import AssistiveAppSwitch from "../components/AssistiveAppSwitch";
import LegalLinks from "../components/LegalLinks";
import {
  canViewIncentives,
  canManageIncentives,
  canViewDisputes,
  getIncentiveRoleMeta,
  isIncentiveAdmin,
  canManageServices,
  canManageCoupons,
  canManageInvoiceSettings,
  canManageUsers,
  canManageDepartments,
  canManageHierarchy,
  canManageRoles,
  canManageEventThemes,
  canViewNetworkLog,
  canCreateInvoice,
} from "../utils/billing";

function MenuRow({ icon, label, sub, onPress, t, colors }) {
  const bg = colors?.bg || BRAND.tealSoft;
  const fg = colors?.fg || BRAND.teal;
  return (
    <Card onPress={onPress} style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{
          width: 44, height: 44, borderRadius: 14, backgroundColor: bg,
          alignItems: "center", justifyContent: "center", marginRight: 14,
        }}
        >
          <Ionicons name={icon} size={20} color={fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "500", color: t.text, fontSize: 15 }}>{label}</Text>
          {sub ? (
            <Text style={{ color: t.subtext, fontSize: 12, marginTop: 2, fontWeight: "300" }}>
              {sub}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.muted} />
      </View>
    </Card>
  );
}

export default function MoreScreen({ navigation }) {
  const t = useTheme();
  const { profile, user, signOut, avatarUri, setAvatarUri, signingOut } = useAuth();
  const letter = firstLetter(user, profile);
  const canSeeConfigurationNote = Boolean(
    user?.is_owner
    || user?.is_superuser
    || user?.role === "Super Admin"
    || user?.role === "Admin",
  );

  const welcome = (() => {
    const name = (user?.name || "").trim();
    if (name && !name.includes("@")) return name;
    const email = (user?.email || "").trim();
    if (email.includes("@")) return email.split("@")[0];
    return profile?.business_name || "Account";
  })();

  const incentiveItems = useMemo(() => {
    if (!canViewIncentives(user)) return [];
    const meta = getIncentiveRoleMeta(user);
    const admin = isIncentiveAdmin(user);
    const manage = canManageIncentives(user);
    const items = [];

    // Primary role dashboard
    if (meta.kind === "am") {
      items.push({
        key: "am-dash",
        label: "AM dashboard",
        sub: "Monthly credited revenue, gate & payout",
        icon: "stats-chart-outline",
        screen: "AmDashboard",
        colors: { bg: "#ECFDF5", fg: "#047857" },
      });
    } else if (meta.kind === "admin") {
      items.push({
        key: "inc-hub",
        label: "Incentives overview",
        sub: "BDA / BDM / AM / CSM org dashboards",
        icon: "calculator-outline",
        screen: "Incentives",
        colors: { bg: BRAND.tealSoft, fg: BRAND.teal },
      });
    } else {
      items.push({
        key: "inc-mine",
        label: meta.title || "My incentives",
        sub: meta.formula || "Your incentive calculation",
        icon: "calculator-outline",
        screen: "Incentives",
        colors: { bg: BRAND.tealSoft, fg: BRAND.teal },
      });
    }

    if (admin || meta.kind === "csm") {
      items.push({
        key: "am-overview",
        label: "AM overview",
        sub: "Team AM summaries by month",
        icon: "people-outline",
        screen: "AmOverview",
        colors: { bg: "#EEF2FF", fg: "#4338CA" },
      });
    }

    if (admin) {
      items.push({
        key: "am-dash-admin",
        label: "AM live dashboard",
        sub: "Drill into any AM with live recalc",
        icon: "pulse-outline",
        screen: "AmDashboard",
        colors: { bg: "#ECFDF5", fg: "#047857" },
      });
      items.push({
        key: "unattrib",
        label: "Unattributed payments",
        sub: "Review payments missing attribution",
        icon: "alert-circle-outline",
        screen: "UnattributedPayments",
        colors: { bg: "#FEF3C7", fg: "#B45309" },
      });
    }

    if (manage || admin) {
      items.push({
        key: "inc-admin",
        label: "Incentive admin",
        sub: "Policy, slabs, retention, payroll runs",
        icon: "shield-checkmark-outline",
        screen: "IncentiveAdmin",
        colors: { bg: "#FCE7F3", fg: "#BE185D" },
      });
    }

    return items;
  }, [user]);

  const pickAvatar = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo library access to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await setAvatarUri(result.assets[0].uri);
  }, [setAvatarUri]);

  const clearAvatar = useCallback(() => {
    Alert.alert("Remove photo?", "Your profile will show the letter initial again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await setAvatarUri(null);
        },
      },
    ]);
  }, [setAvatarUri]);

  const onSignOut = useCallback(() => {
    if (signingOut) return;
    Alert.alert("Sign out?", "You’ll be signed out of Invoice, Snackify, and Career.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => { signOut(); },
      },
    ]);
  }, [signOut, signingOut]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <SoftHeader style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
          <Text style={{ fontSize: 28, fontWeight: "500", color: t.text, letterSpacing: -0.5 }}>Profile</Text>
          <Text style={{ color: t.subtext, marginTop: 2, fontWeight: "300" }}>Account & incentives</Text>
        </SoftHeader>

        <View style={{ paddingHorizontal: 16, marginTop: -8 }}>
          <Card style={{ marginBottom: 12, overflow: "hidden", padding: 0 }}>
            <View style={{ padding: 20, backgroundColor: BRAND.teal, alignItems: "center" }}>
              <TouchableOpacity onPress={pickAvatar} onLongPress={avatarUri ? clearAvatar : undefined} activeOpacity={0.85}>
                <View style={{
                  width: 88, height: 88, borderRadius: 28, backgroundColor: "#ffffff33",
                  alignItems: "center", justifyContent: "center",
                  borderWidth: 2, borderColor: "#ffffff66", overflow: "hidden",
                }}
                >
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={{ width: 88, height: 88 }} />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "500", fontSize: 36 }}>{letter}</Text>
                  )}
                </View>
                <View style={{
                  position: "absolute", right: -2, bottom: -2,
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
                  borderWidth: 1, borderColor: BRAND.tealSoft,
                }}
                >
                  <Ionicons name="camera" size={16} color={BRAND.teal} />
                </View>
              </TouchableOpacity>
              <Text style={{ color: "#ffffffcc", fontSize: 12, marginTop: 12, fontWeight: "300" }}>
                Tap to upload · long-press to remove
              </Text>
              <Text style={{ color: "#fff", fontWeight: "500", fontSize: 20, marginTop: 10 }} numberOfLines={1}>
                {welcome}
              </Text>
              <Text style={{ color: "#ffffffcc", fontSize: 13, marginTop: 4 }} numberOfLines={1}>
                {user?.email || "Signed in"}
              </Text>
              {user?.role ? (
                <View style={{ backgroundColor: "#ffffff22", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginTop: 14 }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "500" }}>{user.role}</Text>
                </View>
              ) : null}
            </View>
          </Card>

          {(() => {
            const paymentItems = [];
            if (canViewDisputes(user)) {
              paymentItems.push({
                key: "disputes",
                icon: "shield-outline",
                label: "Disputes",
                sub: "PayPal / Razorpay / Cashfree chargebacks · 24h SLA",
                colors: { bg: "#FEF2F2", fg: "#B91C1C" },
                screen: "Disputes",
              });
            }
            if (canManageServices(user)) {
              paymentItems.push({
                key: "services",
                icon: "briefcase-outline",
                label: "Services",
                sub: "Catalog & pricing",
                colors: { bg: "#EEF2FF", fg: "#4338CA" },
                screen: "Services",
              });
            }
            if (canManageCoupons(user) || canCreateInvoice(user)) {
              paymentItems.push({
                key: "coupons",
                icon: "pricetags-outline",
                label: "Coupons",
                sub: "Discount codes",
                colors: { bg: "#ECFDF5", fg: "#047857" },
                screen: "Coupons",
              });
            }
            paymentItems.push({
              key: "coupon-requests",
              icon: "pricetag-outline",
              label: "Coupon requests",
              sub: "Approvals, rejections & pending requests",
              colors: { bg: "#FFFBEB", fg: "#B45309" },
              screen: "CouponRequests",
            });
            if (canCreateInvoice(user) || canViewDisputes(user)) {
              paymentItems.push({
                key: "invoice-requests",
                icon: "document-text-outline",
                label: "Invoice requests",
                sub: "Below-minimum approvals",
                colors: { bg: "#F8FAFC", fg: "#334155" },
                screen: "InvoiceRequests",
              });
              paymentItems.push({
                key: "external-paid",
                icon: "checkmark-done-outline",
                label: "External paid",
                sub: "Record paid · approvals for payments older than 24h",
                colors: { bg: "#ECFDF5", fg: "#047857" },
                screen: "ExternalPaidRequests",
              });
            }
            if (canManageInvoiceSettings(user)) {
              paymentItems.push({
                key: "terms",
                icon: "document-text-outline",
                label: "Invoice terms",
                sub: "Footer, T&Cs, privacy notices",
                colors: { bg: "#F1F5F9", fg: "#334155" },
                screen: "InvoiceTerms",
              });
            }
            return (
              <View style={{ marginBottom: 8 }}>
                <Text style={{
                  color: t.muted, fontSize: 12, fontWeight: "500",
                  textTransform: "uppercase", letterSpacing: 0.6,
                  marginBottom: 8, marginLeft: 4,
                }}
                >
                  Payments
                </Text>
                {paymentItems.map((item) => (
                  <MenuRow
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    sub={item.sub}
                    colors={item.colors}
                    t={t}
                    onPress={() => navigation.navigate(item.screen)}
                  />
                ))}
              </View>
            );
          })()}

          {(() => {
            const adminItems = [];
            if (canManageUsers(user) || (user?.can_impersonate || user?.is_owner)) {
              adminItems.push({
                key: "users",
                icon: "people-outline",
                label: (user?.can_impersonate || user?.is_owner) ? "Users / View as" : "Users",
                sub: (user?.can_impersonate || user?.is_owner)
                  ? "Accounts, access & view as another user"
                  : "Accounts & access",
                colors: { bg: "#EEF2FF", fg: "#4338CA" },
                screen: "Users",
              });
            }
            if (canManageDepartments(user)) {
              adminItems.push({
                key: "departments",
                icon: "business-outline",
                label: "Departments",
                sub: "Org departments",
                colors: { bg: "#ECFDF5", fg: "#047857" },
                screen: "Departments",
              });
            }
            if (canManageHierarchy(user)) {
              adminItems.push({
                key: "hierarchy",
                icon: "git-network-outline",
                label: "Hierarchy",
                sub: "Levels & reporting lines",
                colors: { bg: "#FFF7ED", fg: "#C2410C" },
                screen: "Hierarchy",
              });
            }
            if (canManageRoles(user)) {
              adminItems.push({
                key: "roles",
                icon: "key-outline",
                label: "Roles",
                sub: "Permissions by role",
                colors: { bg: "#FCE7F3", fg: "#BE185D" },
                screen: "Roles",
              });
            }
            if (canManageEventThemes(user)) {
              adminItems.push({
                key: "event-themes",
                icon: "color-palette-outline",
                label: "Event themes",
                sub: "Preview, schedule & publish visual events",
                colors: { bg: "#F3E8FF", fg: "#7C3AED" },
                screen: "ThemeAdmin",
              });
            }
            if (canViewNetworkLog(user)) {
              adminItems.push({
                key: "netlog",
                icon: "pulse-outline",
                label: "Network log",
                sub: "API request inspector",
                colors: { bg: "#F1F5F9", fg: "#0F172A" },
                screen: "NetworkLog",
              });
            }
            if (!adminItems.length) return null;
            return (
              <View style={{ marginBottom: 8 }}>
                <Text style={{
                  color: t.muted, fontSize: 12, fontWeight: "500",
                  textTransform: "uppercase", letterSpacing: 0.6,
                  marginBottom: 8, marginLeft: 4,
                }}
                >
                  Organization
                </Text>
                {adminItems.map((item) => (
                  <MenuRow
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    sub={item.sub}
                    colors={item.colors}
                    t={t}
                    onPress={() => navigation.navigate(item.screen)}
                  />
                ))}
              </View>
            );
          })()}

          {incentiveItems.length > 0 ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={{
                color: t.muted, fontSize: 12, fontWeight: "500",
                textTransform: "uppercase", letterSpacing: 0.6,
                marginBottom: 8, marginLeft: 4,
              }}
              >
                Incentives
              </Text>
              {incentiveItems.map((item) => (
                <MenuRow
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  sub={item.sub}
                  colors={item.colors}
                  t={t}
                  onPress={() => navigation.navigate(item.screen)}
                />
              ))}
            </View>
          ) : null}

          <LegalLinks
            showConfigurationNote={canSeeConfigurationNote}
            color={t.subtext}
          />

          <TouchableOpacity
            onPress={onSignOut}
            disabled={signingOut}
            style={{
              marginTop: 16,
              paddingVertical: 14,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: `${t.danger}44`,
              backgroundColor: "#fff",
              opacity: signingOut ? 0.7 : 1,
              flexDirection: "row",
              gap: 8,
            }}
          >
            {signingOut ? (
              <ActivityIndicator size="small" color={t.danger} />
            ) : null}
            <Text style={{ color: t.danger, fontWeight: "500" }}>
              {signingOut ? "Signing out…" : "Sign out"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <AssistiveAppSwitch />
    </SafeAreaView>
  );
}
