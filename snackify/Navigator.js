import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT } from "../src/typography";
import { SnackAuthProvider, useSnackAuth } from "./AuthContext";
import { SnackCartProvider } from "./CartContext";
import { SnackMenuProvider } from "./MenuContext";
import { SnackTokenProvider } from "./TokenContext";
import { getSnackBootstrapMem, hydrateSnackCache } from "./tokenCache";
import { isDashRole } from "./theme";
import { useModuleTheme } from "../src/themes/ThemeContext";
import HomeScreen from "./screens/HomeScreen";
import CategoryScreen from "./screens/CategoryScreen";
import ProductDetailScreen from "./screens/ProductDetailScreen";
import CartScreen from "./screens/CartScreen";
import TrackScreen from "./screens/TrackScreen";
import ReviewScreen from "./screens/ReviewScreen";
import OrdersScreen from "./screens/OrdersScreen";
import SplashScreen, { hasSnackifyOnboarded, markSnackifyOnboarded } from "./screens/SplashScreen";
import OnboardScreen from "./screens/OnboardScreen";
import PantryOnboardScreen from "./screens/PantryOnboardScreen";
import SettingsScreen from "./screens/SettingsScreen";
import MealsScreen from "./screens/MealsScreen";
import MealBoxScreen, { MealHistoryScreen } from "./screens/MealBoxScreen";
import QueueScreen from "./screens/QueueScreen";
import DashboardScreen from "./screens/DashboardScreen";
import DailyUpdateScreen from "./screens/DailyUpdateScreen";
import BillsScreen, { AvailableScreen } from "./screens/BillsScreen";
import MoreScreen, { TokenDashScreen } from "./screens/MoreScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ItemCoinsScreen from "./screens/ItemCoinsScreen";
import OfficeBoyAlertScreen from "./screens/OfficeBoyAlertScreen";
import OfficeBoyAlertsController from "./OfficeBoyAlertsController";
import UsersScreen from "../src/screens/admin/UsersScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const FlowStack = createNativeStackNavigator();

function HomeStack() {
  return (
    <FlowStack.Navigator screenOptions={{ headerShown: false }}>
      <FlowStack.Screen name="SnackifyHome" component={HomeScreen} />
      <FlowStack.Screen name="SnackifyCategory" component={CategoryScreen} />
      <FlowStack.Screen name="SnackifyProduct" component={ProductDetailScreen} />
      <FlowStack.Screen name="SnackifyCart" component={CartScreen} />
      <FlowStack.Screen name="SnackifyTrack" component={TrackScreen} />
      <FlowStack.Screen name="SnackifyReview" component={ReviewScreen} />
      <FlowStack.Screen name="SnackifyProfile" component={ProfileScreen} />
    </FlowStack.Navigator>
  );
}

function OrdersStack() {
  return (
    <FlowStack.Navigator screenOptions={{ headerShown: false }}>
      <FlowStack.Screen name="SnackifyOrdersHome" component={OrdersScreen} />
      <FlowStack.Screen name="SnackifyTrack" component={TrackScreen} />
      <FlowStack.Screen name="SnackifyReview" component={ReviewScreen} />
    </FlowStack.Navigator>
  );
}

function MealsStack() {
  return (
    <FlowStack.Navigator screenOptions={{ headerShown: false }}>
      <FlowStack.Screen name="SnackifyMealsHome" component={MealsScreen} />
      <FlowStack.Screen name="SnackifyMealBox" component={MealBoxScreen} />
      <FlowStack.Screen name="SnackifyMealHistory" component={MealHistoryScreen} />
    </FlowStack.Navigator>
  );
}

function QueueStack() {
  return (
    <FlowStack.Navigator screenOptions={{ headerShown: false }}>
      <FlowStack.Screen name="SnackifyQueueHome" component={QueueScreen} />
      <FlowStack.Screen name="SnackifyTrack" component={TrackScreen} />
    </FlowStack.Navigator>
  );
}

function MoreStack() {
  return (
    <FlowStack.Navigator screenOptions={{ headerShown: false }}>
      <FlowStack.Screen name="SnackifyMoreHome" component={MoreScreen} />
      <FlowStack.Screen name="SnackifyProfile" component={ProfileScreen} />
      <FlowStack.Screen name="SnackifySettings" component={SettingsScreen} />
      <FlowStack.Screen
        name="ViewAsUsers"
        component={UsersScreen}
        options={{ headerShown: true, title: "View as user" }}
      />
    </FlowStack.Navigator>
  );
}

function tabOptions(insets, theme) {
  const bottom = Math.max(insets.bottom, Platform.OS === "android" ? 8 : 4);
  return {
    headerShown: false,
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.textMuted,
    tabBarHideOnKeyboard: true,
    tabBarStyle: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.border,
      height: 52 + bottom,
      paddingBottom: bottom,
      paddingTop: 6,
    },
    tabBarLabelStyle: { fontFamily: FONT.medium, fontSize: 11 },
  };
}

function TabIcon({ name, color, focused }) {
  return (
    <View>
      <Ionicons name={focused ? name : `${name}-outline`} size={22} color={color} />
    </View>
  );
}

function StaffTabs() {
  const insets = useSafeAreaInsets();
  const { tokens } = useModuleTheme("snackify");
  return (
    <Tab.Navigator screenOptions={{ ...tabOptions(insets, tokens) }}>
      <Tab.Screen name="SnackifyHomeTab" component={HomeStack} options={{ title: "Home", tabBarIcon: (p) => <TabIcon name="home" {...p} /> }} />
      <Tab.Screen name="SnackifyMealsTab" component={MealsStack} options={{ title: "Meals", tabBarIcon: (p) => <TabIcon name="restaurant" {...p} /> }} />
      <Tab.Screen name="SnackifyOrdersTab" component={OrdersStack} options={{ title: "Orders", tabBarIcon: (p) => <TabIcon name="receipt" {...p} /> }} />
      <Tab.Screen name="SnackifyMoreTab" component={MoreStack} options={{ title: "More", tabBarIcon: (p) => <TabIcon name="ellipsis-horizontal" {...p} /> }} />
    </Tab.Navigator>
  );
}

function ObTabs() {
  const insets = useSafeAreaInsets();
  const { tokens } = useModuleTheme("snackify");
  return (
    <>
      <OfficeBoyAlertsController />
      <Tab.Navigator screenOptions={{ ...tabOptions(insets, tokens) }}>
        <Tab.Screen name="SnackifyQueueTab" component={QueueStack} options={{ title: "Queue", tabBarIcon: (p) => <TabIcon name="list" {...p} /> }} />
        <Tab.Screen name="SnackifyTokensTab" component={TokenDashScreen} options={{ title: "Tokens", tabBarIcon: (p) => <TabIcon name="print" {...p} /> }} />
        <Tab.Screen name="SnackifyOrdersTab" component={OrdersStack} options={{ title: "Orders", tabBarIcon: (p) => <TabIcon name="receipt" {...p} /> }} />
        <Tab.Screen name="SnackifyMoreTab" component={MoreStack} options={{ title: "More", tabBarIcon: (p) => <TabIcon name="ellipsis-horizontal" {...p} /> }} />
      </Tab.Navigator>
    </>
  );
}

function OpsTabs() {
  const insets = useSafeAreaInsets();
  const { tokens } = useModuleTheme("snackify");
  return (
    <Tab.Navigator screenOptions={{ ...tabOptions(insets, tokens) }}>
      <Tab.Screen name="SnackifyDashTab" component={DashboardScreen} options={{ title: "Home", tabBarIcon: (p) => <TabIcon name="grid" {...p} /> }} />
      <Tab.Screen name="SnackifyHomeTab" component={HomeStack} options={{ title: "Order", tabBarIcon: (p) => <TabIcon name="cafe" {...p} /> }} />
      <Tab.Screen name="SnackifyMealsTab" component={MealsStack} options={{ title: "Meals", tabBarIcon: (p) => <TabIcon name="restaurant" {...p} /> }} />
      <Tab.Screen name="SnackifyMoreTab" component={MoreStack} options={{ title: "More", tabBarIcon: (p) => <TabIcon name="ellipsis-horizontal" {...p} /> }} />
    </Tab.Navigator>
  );
}

function Tabs() {
  const { role, isOwner } = useSnackAuth();
  // Owner always gets More (daily stock) even with snackify_role=staff.
  if (isOwner) return <StaffTabs />;
  if (role === "office_boy") return <ObTabs />;
  if (isDashRole(role)) return <OpsTabs />;
  return <StaffTabs />;
}

function SnackifyStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="SnackifyTabs">
      <Stack.Screen name="SnackifyTabs" component={Tabs} />
      <Stack.Screen name="SnackifySplash" component={SplashScreen} />
      <Stack.Screen name="SnackifyOnboard" component={OnboardScreen} />
      <Stack.Screen
        name="SnackifyOfficeBoyAlert"
        component={OfficeBoyAlertScreen}
        options={{ presentation: "fullScreenModal" }}
      />
      <Stack.Screen name="SnackifyQueue" component={QueueScreen} />
      <Stack.Screen name="SnackifyDashboard" component={DashboardScreen} />
      <Stack.Screen name="SnackifyDaily" component={DailyUpdateScreen} />
      <Stack.Screen name="SnackifyBills" component={BillsScreen} />
      <Stack.Screen name="SnackifyAvailable" component={AvailableScreen} />
      <Stack.Screen name="SnackifyTokens" component={TokenDashScreen} />
      <Stack.Screen name="SnackifyItemCoins" component={ItemCoinsScreen} />
      <Stack.Screen name="SnackifySettings" component={SettingsScreen} />
      <Stack.Screen name="SnackifyProfile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

function Gate() {
  const auth = useSnackAuth();
  const [onboardChecked, setOnboardChecked] = useState(false);
  const [skipOnboard, setSkipOnboard] = useState(false);
  const email = auth.profile?.email || auth.session?.profile?.email || "";

  useEffect(() => {
    let cancelled = false;
    hasSnackifyOnboarded(email).then((done) => {
      if (!cancelled) {
        setSkipOnboard(!!done);
        setOnboardChecked(true);
      }
    }).catch(() => {
      if (!cancelled) setOnboardChecked(true);
    });
    return () => { cancelled = true; };
  }, [email]);

  useEffect(() => {
    if (auth.onboarded) {
      setSkipOnboard(true);
      markSnackifyOnboarded(email).catch(() => {});
    }
  }, [auth.onboarded, email]);

  const finishOnboard = async () => {
    await markSnackifyOnboarded(email);
    setSkipOnboard(true);
  };

  if (!auth.ready || !onboardChecked) {
    return <View style={{ flex: 1, backgroundColor: "#000000" }} />;
  }
  if (!auth.session) {
    return <View style={{ flex: 1, backgroundColor: "#000000" }} />;
  }
  if (!skipOnboard && !auth.onboarded) {
    return <PantryOnboardScreen onDone={finishOnboard} />;
  }
  return <SnackifyStack />;
}

export default function SnackifyNavigator() {
  const [cacheReady, setCacheReady] = useState(() => Boolean(getSnackBootstrapMem()));
  useEffect(() => {
    hydrateSnackCache().finally(() => setCacheReady(true));
  }, []);
  if (!cacheReady) {
    return <View style={{ flex: 1, backgroundColor: "#000000" }} />;
  }
  return (
    <SnackAuthProvider>
      <SnackTokenProvider>
        <SnackCartProvider>
          <SnackMenuProvider>
            <Gate />
          </SnackMenuProvider>
        </SnackCartProvider>
      </SnackTokenProvider>
    </SnackAuthProvider>
  );
}
