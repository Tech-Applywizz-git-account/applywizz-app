import "react-native-gesture-handler";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
} from "@expo-google-fonts/poppins";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { WorkspaceProvider } from "./src/context/WorkspaceContext";
import { ToastProvider, useToast } from "./src/components/Toast";
import { OfflineBanner } from "./src/components/OfflineBanner";
import ImpersonationBanner from "./src/components/ImpersonationBanner";
import StickyAlertsBanner from "./src/components/StickyAlertsBanner";
import DailyTargetLiveActivity from "./src/components/DailyTargetLiveActivity";
import SigningOutOverlay from "./src/components/SigningOutOverlay";
import RootNavigator from "./src/navigation/RootNavigator";
import { linking } from "./src/navigation/linking";
import {
  attachNotificationListeners,
  navigateFromPushData,
  startPushAlertPolling,
  stopPushAlertPolling,
  setPushToastHandler,
  getInitialNotificationData,
  ensureAndroidPaymentChannel,
} from "./src/notifications/push";
import { hydrateQueryCache } from "./src/api/queryCache";
import { startBackendKeepAlive, stopBackendKeepAlive, warmBackend } from "./src/api/warmup";
import { BrandSplash, hideNativeSplash } from "./src/components/BrandLoader";
import { ThemeProvider, useEventTheme } from "./src/themes/ThemeContext";
import ThemeOverlay from "./src/themes/ThemeOverlay";

/** Deepest focused route name, used only to pick the event theme module. */
function focusedRouteName(state) {
  if (!state?.routes?.length) return null;
  const route = state.routes[typeof state.index === "number" ? state.index : state.routes.length - 1];
  return focusedRouteName(route?.state) || route?.name || null;
}

function Gate() {
  const { loading, user, signingOut } = useAuth();
  const toast = useToast();
  const navigationRef = useRef(null);
  const [overlaysReady, setOverlaysReady] = useState(false);
  const [booted, setBooted] = useState(false);
  const { theme, setRouteName } = useEventTheme();

  const syncThemeRoute = useCallback(() => {
    try {
      setRouteName(focusedRouteName(navigationRef.current?.getRootState()));
    } catch (_) {
      setRouteName(null);
    }
  }, [setRouteName]);
  // Only the initial session hydrate should block the tree. Waiting on
  // workspace after login unmounted the navigator and flashed a black splash.
  const bootReady = !loading;

  useEffect(() => {
    warmBackend({ force: false }).catch(() => {});
    startBackendKeepAlive();
    hydrateQueryCache().catch(() => {});
    return () => stopBackendKeepAlive();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    setPushToastHandler((message, tone) => {
      if (tone === "error") toast.error(message);
      else if (tone === "info") toast.info(message);
      else toast.success(message);
    });
    return () => setPushToastHandler(null);
  }, [toast]);

  useEffect(() => {
    if (!user) {
      stopPushAlertPolling();
      setOverlaysReady(false);
      return undefined;
    }
    const detach = attachNotificationListeners(navigationRef);
    // Defer non-critical polling so Home paints first after cold wake.
    const overlayTimer = setTimeout(() => setOverlaysReady(true), 2500);
    const pollTimer = setTimeout(() => {
      startPushAlertPolling(navigationRef);
    }, 4000);
    getInitialNotificationData().then((data) => {
      if (!data) return;
      setTimeout(() => navigateFromPushData(navigationRef.current, data), 400);
    });
    return () => {
      clearTimeout(overlayTimer);
      clearTimeout(pollTimer);
      if (typeof detach === "function") detach();
      stopPushAlertPolling();
    };
  }, [user]);

  useEffect(() => {
    if (!bootReady) return;
    setBooted(true);
    hideNativeSplash();
  }, [bootReady]);

  useEffect(() => () => setRouteName(null), [setRouteName]);

  if (!booted) {
    return <BrandSplash label="Loading…" light />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ImpersonationBanner />
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        onReady={syncThemeRoute}
        onStateChange={syncThemeRoute}
      >
        <OfflineBanner />
        {user && overlaysReady ? <StickyAlertsBanner navigationRef={navigationRef} /> : null}
        {user && overlaysReady ? <DailyTargetLiveActivity navigationRef={navigationRef} /> : null}
        <RootNavigator />
      </NavigationContainer>
      <ThemeOverlay />
      <SigningOutOverlay visible={Boolean(signingOut)} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
  });

  useEffect(() => {
    ensureAndroidPaymentChannel().catch(() => {});
  }, []);

  if (!fontsLoaded) {
    return <BrandSplash />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <WorkspaceProvider>
          <ThemeProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <Gate />
            </ToastProvider>
          </ThemeProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
