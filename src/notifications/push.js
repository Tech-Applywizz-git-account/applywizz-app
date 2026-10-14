/**
 * Payment alerts for Expo Go, EAS, and store builds.
 *
 * CRITICAL (SDK 53+): On Android Expo Go, importing the expo-notifications
 * package entry (or getExpoPushTokenAsync) throws — DevicePushTokenAutoRegistration
 * calls addPushTokenListener → warnOfExpoGoPushUsage throws.
 * We therefore never load remote-push modules on Expo Go Android.
 */
import { AppState, Platform, Alert } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { isRunningInExpoGo } from "expo";
import NetInfo from "@react-native-community/netinfo";
import api from "../api/client";
import { switchWorkspaceExternally } from "../context/workspaceBridge";
import "./background";
import {
  startBackgroundAlertPolling,
  stopBackgroundAlertPolling,
} from "./background";

let cachedToken = null;
let cachedFcmToken = null;
let pollTimer = null;
let appStateSub = null;
let netInfoSub = null;
let lastNavRef = null;
let toastHandler = null;
let syncInFlight = false;
let localApi = null; // deep-imported local-notification helpers
let handlerReady = false;

export const isExpoGoAndroid = isRunningInExpoGo() && Platform.OS === "android";
const SNACKIFY_ORDER_CHANNEL = "snackify-orders";

export function setPushToastHandler(fn) {
  toastHandler = typeof fn === "function" ? fn : null;
}

function notifyUser(message, tone = "success") {
  try {
    toastHandler?.(message, tone);
  } catch (_) {
    /* ignore */
  }
}

export function detectRuntime() {
  if (isRunningInExpoGo() || Constants.appOwnership === "expo") return "expo-go";
  if (Constants.appOwnership === "standalone") return "standalone";
  if (Constants.executionEnvironment === "storeClient") return "standalone";
  if (Constants.executionEnvironment === "bare") return "dev-client";
  if (Constants.executionEnvironment === "standalone") return "standalone";
  return "unknown";
}

export function canUseRemotePush() {
  // Remote push APIs crash Expo Go on Android (SDK 53+)
  if (isExpoGoAndroid) return false;
  return true;
}

function resolveProjectId() {
  const id =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    undefined;
  return id && String(id).trim() ? String(id).trim() : undefined;
}

/**
 * Load ONLY local-notification APIs (no TokenEmitter / getDevicePushTokenAsync).
 * Safe on Expo Go Android.
 */
function getLocalNotificationsApi() {
  if (localApi) return localApi;
  // Deep imports avoid DevicePushTokenAutoRegistration.fx side effect
  // eslint-disable-next-line import/no-commonjs, global-require
  const { scheduleNotificationAsync } = require(
    "expo-notifications/build/scheduleNotificationAsync"
  );
  // eslint-disable-next-line import/no-commonjs, global-require
  const Types = require("expo-notifications/build/Notifications.types");
  // eslint-disable-next-line import/no-commonjs, global-require
  const { setNotificationHandler } = require("expo-notifications/build/NotificationsHandler");
  // eslint-disable-next-line import/no-commonjs, global-require
  const {
    getPermissionsAsync,
    requestPermissionsAsync,
  } = require("expo-notifications/build/NotificationPermissions");
  // eslint-disable-next-line import/no-commonjs, global-require
  const { setNotificationChannelAsync } = require(
    "expo-notifications/build/setNotificationChannelAsync"
  );
  // eslint-disable-next-line import/no-commonjs, global-require
  const ChannelTypes = require("expo-notifications/build/NotificationChannelManager.types");
  // eslint-disable-next-line import/no-commonjs, global-require
  const {
    addNotificationReceivedListener,
    addNotificationResponseReceivedListener,
    getLastNotificationResponseAsync,
  } = require("expo-notifications/build/NotificationsEmitter");

  localApi = {
    scheduleNotificationAsync,
    SchedulableTriggerInputTypes: Types.SchedulableTriggerInputTypes,
    setNotificationHandler,
    getPermissionsAsync,
    requestPermissionsAsync,
    setNotificationChannelAsync,
    AndroidImportance: ChannelTypes.AndroidImportance,
    AndroidNotificationVisibility: ChannelTypes.AndroidNotificationVisibility,
    addNotificationReceivedListener,
    addNotificationResponseReceivedListener,
    getLastNotificationResponseAsync,
  };
  return localApi;
}

function ensureHandler() {
  if (handlerReady) return;
  const N = getLocalNotificationsApi();
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  handlerReady = true;
}

async function ensureNotificationPermission() {
  ensureHandler();
  const N = getLocalNotificationsApi();
  const { status: existing } = await N.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await N.requestPermissionsAsync(
    Platform.OS === "ios"
      ? {
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowDisplayInCarPlay: false,
            provideAppNotificationSettings: true,
          },
        }
      : undefined
  );
  return status === "granted";
}

export async function ensureAndroidPaymentChannel() {
  if (Platform.OS !== "android") return;
  try {
    ensureHandler();
    const N = getLocalNotificationsApi();
    const channel = {
      importance: N.AndroidImportance?.MAX ?? N.AndroidImportance?.HIGH ?? 5,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#149E81",
      sound: "default",
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: N.AndroidNotificationVisibility?.PUBLIC,
    };
    // Default FCM channel + payments channel used by Expo payload channelId.
    await N.setNotificationChannelAsync("default", {
      name: "General",
      ...channel,
    });
    await N.setNotificationChannelAsync("payments", {
      name: "Payments",
      ...channel,
    });
    await N.setNotificationChannelAsync(SNACKIFY_ORDER_CHANNEL, {
      name: "Snackify orders",
      ...channel,
    });
  } catch (err) {
    console.log("[push] channel failed", err?.message || err);
  }
}

export async function showLocalBanner({ title, body, data = {}, channelId = "payments" }) {
  const heading = title || "Hurray! Payment received";
  const text = body || "Payment received";

  try {
    const ok = await ensureNotificationPermission();
    if (!ok) {
      notifyUser(`${heading}: ${text}`, "info");
      Alert.alert(heading, text);
      return false;
    }
    await ensureAndroidPaymentChannel();
    const N = getLocalNotificationsApi();
    const content = {
      title: heading,
      body: text,
      sound: true,
      badge: 1,
      color: "#149E81",
      ...(Platform.OS === "android" ? { channelId } : {}),
      data: data || {},
    };
    try {
      await N.scheduleNotificationAsync({ content, trigger: null });
    } catch (err) {
      console.log("[push] null trigger failed", err?.message || err);
      await N.scheduleNotificationAsync({
        content,
        trigger: {
          type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1,
          channelId: Platform.OS === "android" ? channelId : undefined,
        },
      });
    }
    notifyUser(`${heading}\n${text}`, "success");
    return true;
  } catch (err) {
    console.log("[push] showLocalBanner failed", err?.message || err);
    notifyUser(`${heading}: ${text}`, "success");
    Alert.alert(heading, text);
    return false;
  }
}

export async function getNativeFcmToken() {
  if (cachedFcmToken) return cachedFcmToken;
  if (!canUseRemotePush()) {
    console.log("[push] native FCM skipped (Expo Go Android)");
    return null;
  }
  if (!Device.isDevice) return null;
  if (!(await ensureNotificationPermission())) return null;
  await ensureAndroidPaymentChannel();

  // Native FCM (Android) / APNs (iOS) token — Django sends this to FCM HTTP v1.
  // eslint-disable-next-line import/no-commonjs, global-require
  const { getDevicePushTokenAsync } = require(
    "expo-notifications/build/getDevicePushTokenAsync"
  );
  try {
    const tokenResponse = await getDevicePushTokenAsync();
    cachedFcmToken = tokenResponse?.data || null;
    console.log("[push] native device token", {
      type: tokenResponse?.type,
      present: Boolean(cachedFcmToken),
    });
    return cachedFcmToken;
  } catch (err) {
    console.log("[push] getDevicePushTokenAsync failed", err?.message || err);
    return null;
  }
}

export async function getExpoPushToken() {
  if (cachedToken) return cachedToken;
  if (!canUseRemotePush()) {
    console.log("[push] remote push skipped (Expo Go Android)");
    return null;
  }
  if (!Device.isDevice) return null;
  if (!(await ensureNotificationPermission())) return null;
  await ensureAndroidPaymentChannel();

  // Lazy-load ONLY when safe — this module pulls DevicePushTokenAutoRegistration.fx
  // eslint-disable-next-line import/no-commonjs, global-require
  const { getExpoPushTokenAsync } = require("expo-notifications/build/getExpoPushTokenAsync");
  const projectId = resolveProjectId();
  try {
    const tokenResponse = projectId
      ? await getExpoPushTokenAsync({ projectId })
      : await getExpoPushTokenAsync();
    cachedToken = tokenResponse?.data || null;
    return cachedToken;
  } catch (err) {
    console.log("[push] getExpoPushTokenAsync failed", err?.message || err);
    return null;
  }
}

export async function registerPushTokenWithBackend() {
  try {
    await ensureNotificationPermission();
    const runtime = detectRuntime();
    const fcmToken = canUseRemotePush() ? await getNativeFcmToken() : null;
    const token = canUseRemotePush() ? await getExpoPushToken() : null;

    await api.post("/notifications/devices/register/", {
      expo_push_token: token || "",
      fcm_token: fcmToken || "",
      platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "unknown",
      runtime,
      device_name: Device.modelName || Device.deviceName || "",
      supports_remote_push: Boolean(fcmToken || token),
    });
    console.log("[push] device registered", {
      runtime,
      remote: Boolean(fcmToken || token),
      fcm: Boolean(fcmToken),
      expoGoAndroid: isExpoGoAndroid,
    });

    startPushAlertPolling(lastNavRef);
    startBackgroundAlertPolling().catch(() => {});
    await syncPendingPushAlerts({ force: true });
    return token;
  } catch (err) {
    console.log("[push] register failed", err?.response?.data || err?.message || err);
    startPushAlertPolling(lastNavRef);
    startBackgroundAlertPolling().catch(() => {});
    await syncPendingPushAlerts({ force: true });
    return null;
  }
}

export async function unregisterPushTokenFromBackend() {
  stopPushAlertPolling();
  stopBackgroundAlertPolling().catch(() => {});
  try {
    await api.post("/notifications/devices/unregister/", {
      expo_push_token: cachedToken || "",
      fcm_token: cachedFcmToken || "",
    });
  } catch (_) {
    /* ignore */
  } finally {
    cachedToken = null;
    cachedFcmToken = null;
  }
}

export async function syncPendingPushAlerts({ force = false } = {}) {
  if (syncInFlight) return;
  // FCM already shows the OS tray. Polling the same alert paints a second banner.
  if (cachedFcmToken && !isExpoGoAndroid) return;
  syncInFlight = true;
  try {
    const { data } = await api.get("/notifications/alerts/pending/");
    const alerts = Array.isArray(data) ? data : [];
    console.log("[push] pending alerts", alerts.length);
    if (!alerts.length) return;

    const ids = [];
    for (const alert of alerts) {
      ids.push(alert.id);
      await showLocalBanner({
        title: alert.title || "Hurray! Payment received",
        body: alert.body || "Payment received",
        data: {
          ...(alert.data || {}),
          alertId: alert.id,
          type: (alert.data && alert.data.type) || "payment_received",
        },
      });
    }
    if (ids.length) {
      await api.post("/notifications/alerts/acknowledge/", { ids });
    }
  } catch (err) {
    console.log(
      "[push] syncPendingPushAlerts failed",
      err?.response?.status,
      err?.response?.data || err?.message || err
    );
  } finally {
    syncInFlight = false;
  }
}

export async function sendTestLocalNotification() {
  const shown = await showLocalBanner({
    title: "Hurray! Payment received",
    body: isExpoGoAndroid
      ? "Payment of $99.00 received from Sample Client. (Expo Go local test)"
      : "Payment of $99.00 received from Sample Client. (test)",
    data: { type: "payment_received", screen: "Invoices", test: true },
  });
  await syncPendingPushAlerts({ force: true });
  return shown;
}

export async function showSnackifyOrderNotification({ title, body, data = {} }) {
  return showLocalBanner({
    title: title || "New pantry order",
    body: body || "A new Snackify order is waiting.",
    data: {
      workspace: "snackify",
      screen: "SnackifyOfficeBoyAlert",
      type: "snackify_order",
      ...data,
    },
    channelId: SNACKIFY_ORDER_CHANNEL,
  });
}

export async function showSnackifyWalletNotification({ title, body, data = {} }) {
  return showLocalBanner({
    title: title || "Snackify wallet",
    body: body || "Your coin balance changed.",
    data: {
      workspace: "snackify",
      screen: data?.request_id ? "SnackifyTrack" : "SnackifyHomeTab",
      type: "snackify_wallet",
      ...data,
    },
    channelId: SNACKIFY_ORDER_CHANNEL,
  });
}

export function startPushAlertPolling(navigationRef) {
  lastNavRef = navigationRef || lastNavRef;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  syncPendingPushAlerts({ force: true });
  pollTimer = setInterval(() => syncPendingPushAlerts(), 20000);
  if (!appStateSub) {
    appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") syncPendingPushAlerts({ force: true });
    });
  }
  if (!netInfoSub) {
    netInfoSub = NetInfo.addEventListener((state) => {
      if (state?.isConnected) syncPendingPushAlerts({ force: true });
    });
  }
  startBackgroundAlertPolling().catch(() => {});
}

export function stopPushAlertPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
  if (netInfoSub) {
    netInfoSub();
    netInfoSub = null;
  }
}

export function attachNotificationListeners(navigationRef) {
  lastNavRef = navigationRef;
  try {
    ensureHandler();
    const N = getLocalNotificationsApi();
    const subReceived = N.addNotificationReceivedListener(() => {});
    const subResponse = N.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      const nav = navigationRef?.current || navigationRef;
      navigateFromPushData(nav, data);
    });
    return () => {
      subReceived?.remove?.();
      subResponse?.remove?.();
    };
  } catch (err) {
    console.log("[push] listeners skipped", err?.message || err);
    return () => {};
  }
}

export async function getInitialNotificationData() {
  try {
    const N = getLocalNotificationsApi();
    const response = await N.getLastNotificationResponseAsync?.();
    return response?.notification?.request?.content?.data || null;
  } catch (_) {
    return null;
  }
}

export function navigateFromPushData(navigationRef, data) {
  if (!navigationRef?.isReady?.()) return;
  try {
    const screen = String(data?.screen || "").trim();
    const type = String(data?.type || "").toLowerCase();

    if (screen === "SnackifyOfficeBoyAlert" || screen === "SnackifyTrack" || type.includes("snackify_order") || type.includes("snackify_wallet")) {
      switchWorkspaceExternally("snackify").catch(() => {});
      const target = screen === "SnackifyTrack" ? "SnackifyTrack" : (type.includes("snackify_wallet") ? "SnackifyTrack" : "SnackifyOfficeBoyAlert");
      const params = data?.request_id ? { id: data.request_id } : {};
      const openSnackify = () => {
        try {
          navigationRef.navigate(target, params);
        } catch (_) {
          /* nav tree may still be switching */
        }
      };
      setTimeout(openSnackify, 200);
      setTimeout(openSnackify, 700);
      setTimeout(openSnackify, 1400);
      return;
    }

    if (screen === "InvoiceDetail" && data?.attempt_id) {
      navigationRef.navigate("InvoiceDetail", { id: data.attempt_id });
      return;
    }
    if (screen === "DisputeDetail" && data?.dispute_id) {
      navigationRef.navigate("DisputeDetail", { id: data.dispute_id });
      return;
    }
    if (screen === "WhatsAppThread" && data?.whatsappUserId) {
      navigationRef.navigate("WhatsAppThread", { id: data.whatsappUserId });
      return;
    }
    if (screen === "WhatsAppInbox" || type.includes("whatsapp")) {
      navigationRef.navigate("Tabs", { screen: "WhatsApp" });
      return;
    }
    if (screen === "InvoiceRequests" || type.includes("invoice_request")) {
      navigationRef.navigate("InvoiceRequests");
      return;
    }
    if (screen === "CouponRequests" || type.includes("coupon")) {
      navigationRef.navigate("CouponRequests");
      return;
    }
    if (screen === "Incentives" || type.includes("daily_target")) {
      navigationRef.navigate("Tabs", { screen: "Incentives" });
      return;
    }
    if (screen === "Home") {
      navigationRef.navigate("Tabs", { screen: "Home" });
      return;
    }
    if (screen === "Invoices") {
      navigationRef.navigate("Tabs", { screen: "Invoices" });
      return;
    }
    if (type === "admin_broadcast") {
      navigationRef.navigate("Tabs", { screen: "Home" });
      return;
    }
    navigationRef.navigate("Tabs", { screen: "Invoices" });
  } catch (_) {
    /* nav not ready */
  }
}
