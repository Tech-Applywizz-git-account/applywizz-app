import React from "react";
import { View, Image, Platform } from "react-native";
import { Text } from "../src/components/AppText";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/context/AuthContext";
import { FONT } from "../src/typography";
import { useEventTheme } from "../src/themes/ThemeContext";
import { firstLetter } from "../src/utils/avatar";
import { canViewWhatsApp } from "../src/utils/billing";

import DashboardScreen from "../src/screens/DashboardScreen";
import InvoiceListScreen from "../src/screens/invoices/InvoiceListScreen";
import InvoiceDetailScreen from "../src/screens/invoices/InvoiceDetailScreen";
import InvoiceEditorScreen from "../src/screens/invoices/InvoiceEditorScreen";
import ClientListScreen from "../src/screens/clients/ClientListScreen";
import ClientDetailScreen from "../src/screens/clients/ClientDetailScreen";
import ClientEditorScreen from "../src/screens/clients/ClientEditorScreen";
import ExpenseListScreen from "../src/screens/expenses/ExpenseListScreen";
import ExpenseEditorScreen from "../src/screens/expenses/ExpenseEditorScreen";
import ReportsScreen from "../src/screens/ReportsScreen";
import ReportTransactionsScreen from "../src/screens/ReportTransactionsScreen";
import CalendarScreen from "../src/screens/CalendarScreen";
import MoreScreen from "../src/screens/MoreScreen";
import PriceBookScreen from "../src/screens/misc/PriceBookScreen";
import ProjectListScreen from "../src/screens/misc/ProjectListScreen";
import TimeEntriesScreen from "../src/screens/misc/TimeEntriesScreen";
import ContractsScreen from "../src/screens/misc/ContractsScreen";
import CreateBillingScreen from "../src/screens/billing/CreateBillingScreen";
import IncentivesScreen from "../src/screens/incentives/IncentivesScreen";
import AmDashboardScreen from "../src/screens/incentives/AmDashboardScreen";
import AmOverviewScreen from "../src/screens/incentives/AmOverviewScreen";
import IncentiveAdminScreen from "../src/screens/incentives/IncentiveAdminScreen";
import UnattributedPaymentsScreen from "../src/screens/incentives/UnattributedPaymentsScreen";
import DisputeListScreen from "../src/screens/disputes/DisputeListScreen";
import DisputeDetailScreen from "../src/screens/disputes/DisputeDetailScreen";
import WhatsAppInboxScreen from "../src/screens/whatsapp/WhatsAppInboxScreen";
import WhatsAppThreadScreen from "../src/screens/whatsapp/WhatsAppThreadScreen";
import CouponRequestsScreen from "../src/screens/CouponRequestsScreen";
import InvoiceRequestsScreen from "../src/screens/billing/InvoiceRequestsScreen";
import ExternalPaidRequestsScreen from "../src/screens/billing/ExternalPaidRequestsScreen";
import CreateExternalPaidScreen from "../src/screens/billing/CreateExternalPaidScreen";
import NetworkLogScreen from "../src/screens/NetworkLogScreen";
import ServicesScreen from "../src/screens/admin/ServicesScreen";
import CouponsScreen from "../src/screens/admin/CouponsScreen";
import InvoiceTermsScreen from "../src/screens/admin/InvoiceTermsScreen";
import UsersScreen from "../src/screens/admin/UsersScreen";
import DepartmentsScreen from "../src/screens/admin/DepartmentsScreen";
import HierarchyScreen from "../src/screens/admin/HierarchyScreen";
import RolesScreen from "../src/screens/admin/RolesScreen";
import ThemeAdminScreen from "../src/screens/admin/ThemeAdminScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ICONS = {
  Home: "home",
  Invoices: "receipt",
  Clients: "people",
  WhatsApp: "logo-whatsapp",
  Settings: "person",
};

function ProfileTabIcon({ focused, accent, avatarUri, letter }) {
  return (
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: focused ? 2 : 1,
        borderColor: focused ? accent : "#D1D5DB",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: avatarUri ? "#fff" : `${accent}22`,
      }}
    >
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={{ width: 28, height: 28 }} />
      ) : (
        <Text style={{ fontSize: 12, fontFamily: FONT.medium, color: accent }}>{letter}</Text>
      )}
    </View>
  );
}

function TabIcon({ routeName, color, focused, accent, avatarUri, letter }) {
  if (routeName === "Settings") {
    return (
      <View style={{ width: 44, height: 28, alignItems: "center", justifyContent: "center" }}>
        <ProfileTabIcon focused={focused} accent={accent} avatarUri={avatarUri} letter={letter} />
      </View>
    );
  }
  return (
    <View
      style={{
        width: 44,
        height: 28,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? `${accent}18` : "transparent",
      }}
    >
      <Ionicons
        name={
          routeName === "WhatsApp"
            ? "logo-whatsapp"
            : focused
              ? ICONS[routeName]
              : `${ICONS[routeName]}-outline`
        }
        size={22}
        color={color}
      />
    </View>
  );
}

function Tabs() {
  const { user, profile, avatarUri } = useAuth();
  const { theme: t } = useEventTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === "android" ? 8 : 4);
  const tabHeight = 52 + bottomPad;
  const showWhatsApp = canViewWhatsApp(user);
  const letter = firstLetter(user, profile);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: t.border,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomPad,
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: FONT.medium,
          marginTop: 2,
        },
        tabBarIcon: ({ color, focused }) => (
          <TabIcon
            routeName={route.name}
            color={color}
            focused={focused}
            accent={t.accent}
            avatarUri={avatarUri}
            letter={letter}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: "Home" }} />
      <Tab.Screen name="Invoices" component={InvoiceListScreen} />
      <Tab.Screen name="Clients" component={ClientListScreen} options={{ title: "Clients" }} />
      {showWhatsApp ? (
        <Tab.Screen name="WhatsApp" component={WhatsAppInboxScreen} options={{ title: "WhatsApp" }} />
      ) : null}
      <Tab.Screen name="Settings" component={MoreScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

const slideOptions = {
  animation: "slide_from_right",
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
};

export default function InvoiceNavigator() {
  const { theme: t } = useEventTheme();
  const screenOptions = {
    ...slideOptions,
    headerStyle: { backgroundColor: t.card },
    headerTintColor: t.accent,
    headerTitleStyle: { color: t.text, fontFamily: FONT.medium },
    contentStyle: { backgroundColor: t.bg },
  };

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} options={{ title: "Invoice" }} />
      <Stack.Screen name="InvoiceEditor" component={InvoiceEditorScreen} options={{ title: "New" }} />
      <Stack.Screen name="CreateBilling" component={CreateBillingScreen} options={{ title: "New invoice" }} />
      <Stack.Screen name="IncentivesHub" component={IncentivesScreen} options={{ title: "Incentive calculation" }} />
      <Stack.Screen name="AmDashboard" component={AmDashboardScreen} options={{ title: "AM dashboard" }} />
      <Stack.Screen name="AmOverview" component={AmOverviewScreen} options={{ title: "AM overview" }} />
      <Stack.Screen name="IncentiveAdmin" component={IncentiveAdminScreen} options={{ title: "Incentive admin" }} />
      <Stack.Screen name="UnattributedPayments" component={UnattributedPaymentsScreen} options={{ title: "Unattributed" }} />
      <Stack.Screen name="Disputes" component={DisputeListScreen} options={{ title: "Disputes" }} />
      <Stack.Screen name="DisputeDetail" component={DisputeDetailScreen} options={{ title: "Dispute" }} />
      <Stack.Screen name="WhatsAppThread" component={WhatsAppThreadScreen} options={{ title: "Chat" }} />
      <Stack.Screen name="CouponRequests" component={CouponRequestsScreen} options={{ title: "Coupon requests" }} />
      <Stack.Screen name="InvoiceRequests" component={InvoiceRequestsScreen} options={{ title: "Invoice requests" }} />
      <Stack.Screen name="ExternalPaidRequests" component={ExternalPaidRequestsScreen} options={{ title: "External paid" }} />
      <Stack.Screen name="CreateExternalPaid" component={CreateExternalPaidScreen} options={{ title: "Record paid" }} />
      <Stack.Screen name="Coupons" component={CouponsScreen} options={{ title: "Coupons" }} />
      <Stack.Screen name="Services" component={ServicesScreen} options={{ title: "Services" }} />
      <Stack.Screen name="InvoiceTerms" component={InvoiceTermsScreen} options={{ title: "Invoice terms" }} />
      <Stack.Screen name="Users" component={UsersScreen} options={{ title: "Users" }} />
      <Stack.Screen name="Departments" component={DepartmentsScreen} options={{ title: "Departments" }} />
      <Stack.Screen name="Hierarchy" component={HierarchyScreen} options={{ title: "Hierarchy" }} />
      <Stack.Screen name="Roles" component={RolesScreen} options={{ title: "Roles" }} />
      <Stack.Screen name="ThemeAdmin" component={ThemeAdminScreen} options={{ title: "Event themes" }} />
      <Stack.Screen name="NetworkLog" component={NetworkLogScreen} options={{ title: "Network log" }} />
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: "Reports" }} />
      <Stack.Screen name="Clients" component={ClientListScreen} options={{ title: "Customers" }} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} options={{ title: "Client" }} />
      <Stack.Screen name="ClientEditor" component={ClientEditorScreen} options={{ title: "Client" }} />
      <Stack.Screen name="Expenses" component={ExpenseListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ExpenseEditor" component={ExpenseEditorScreen} options={{ title: "Expense" }} />
      <Stack.Screen name="Projects" component={ProjectListScreen} options={{ title: "Projects" }} />
      <Stack.Screen name="TimeEntries" component={TimeEntriesScreen} options={{ title: "Time tracking" }} />
      <Stack.Screen name="PriceBook" component={PriceBookScreen} options={{ title: "Price book" }} />
      <Stack.Screen name="Contracts" component={ContractsScreen} options={{ title: "Contracts" }} />
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      <Stack.Screen name="ReportTransactions" component={ReportTransactionsScreen} options={{ title: "Paid records" }} />
    </Stack.Navigator>
  );
}
