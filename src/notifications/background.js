/**
 * Load this from index.js BEFORE App.
 *
 * Without Firebase FCM, Android cannot receive instant remote push.
 * We poll pending alerts via expo-background-task when the OS wakes us
 * (~15 min) and show local notifications.
 *
 * Expo Go Android cannot import the expo-notifications package root (SDK 53+).
 */
import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";

export const BACKGROUND_NOTIFICATION_TASK = "INVOICES_BACKGROUND_NOTIFICATION";
export const BACKGROUND_ALERT_POLL_TASK = "INVOICES_ALERT_POLL";

function isExpoGo() {
  return isRunningInExpoGo();
}

function apiOrigin() {
  return "https://invoice-ge4q.onrender.com";
}

function setHandlerSafe() {
  try {
    // eslint-disable-next-line import/no-commonjs, global-require
    const { setNotificationHandler } = require("expo-notifications/build/NotificationsHandler");
    setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.log("[push] handler setup failed", err?.message || err);
  }
}

async function presentLocal({ title, body, data }) {
  try {
    // eslint-disable-next-line import/no-commonjs, global-require
    const { scheduleNotificationAsync } = require("expo-notifications/build/scheduleNotificationAsync");
    await scheduleNotificationAsync({
      content: {
        title: title || "Notification",
        body: body || "",
        sound: true,
        badge: 1,
        ...(Platform.OS === "android" ? { channelId: "payments" } : {}),
        data: data || {},
      },
      trigger: null,
    });
  } catch (err) {
    console.log("[push] local present failed", err?.message || err);
  }
}

async function presentFromBackground(payload) {
  const content = payload?.notification?.request?.content
    || payload?.notification
    || payload
    || {};
  const title = content.title || payload?.title || "";
  const body = content.body || payload?.body || "";
  if (payload?.notification?.request?.content?.title) return;
  if (!title && !body) return;
  await presentLocal({
    title,
    body,
    data: content.data || payload.data || {},
  });
}

/**
 * Headless poll — no axios/React. Uses stored JWT.
 * Returns true if work completed without a hard failure.
 */
export async function pollPendingAlertsHeadless() {
  try {
    // eslint-disable-next-line import/no-commonjs, global-require
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    const access = await AsyncStorage.getItem("access");
    if (!access) {
      console.log("[push] background poll skipped (no session)");
      return false;
    }
    const base = `${apiOrigin()}/api/v1`;
    const headers = {
      Authorization: `Bearer ${access}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    const res = await fetch(`${base}/notifications/alerts/pending/`, { headers });
    if (res.status === 401 || res.status === 403) {
      console.log("[push] background poll unauthorized");
      return false;
    }
    if (!res.ok) {
      console.log("[push] background poll HTTP", res.status);
      return false;
    }
    const alerts = await res.json();
    const list = Array.isArray(alerts) ? alerts : [];
    console.log("[push] background poll pending", list.length);
    if (!list.length) return true;

    const ids = [];
    for (const alert of list) {
      ids.push(alert.id);
      await presentLocal({
        title: alert.title || "Hurray! Payment received",
        body: alert.body || "Payment received",
        data: {
          ...(alert.data || {}),
          alertId: alert.id,
          type: (alert.data && alert.data.type) || "payment_received",
        },
      });
    }
    await fetch(`${base}/notifications/alerts/acknowledge/`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ids }),
    });
    return true;
  } catch (err) {
    console.log("[push] background poll failed", err?.message || err);
    return false;
  }
}

function registerNotificationListenerTask() {
  if (isExpoGo()) return;
  try {
    // eslint-disable-next-line import/no-commonjs, global-require
    const TaskManager = require("expo-task-manager");
    // eslint-disable-next-line import/no-commonjs, global-require
    const Notifications = require("expo-notifications");

    if (!TaskManager.isTaskDefined(BACKGROUND_NOTIFICATION_TASK)) {
      TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, ({ data, error }) => {
        if (error) {
          console.log("[push] background task error", error);
          return;
        }
        return presentFromBackground(data);
      });
    }

    Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch((err) => {
      console.log("[push] registerTaskAsync", err?.message || err);
    });
  } catch (err) {
    console.log("[push] notification task skipped", err?.message || err);
  }
}

function defineAlertPollTask() {
  try {
    // eslint-disable-next-line import/no-commonjs, global-require
    const TaskManager = require("expo-task-manager");
    if (TaskManager.isTaskDefined(BACKGROUND_ALERT_POLL_TASK)) return;
    TaskManager.defineTask(BACKGROUND_ALERT_POLL_TASK, async () => {
      const ok = await pollPendingAlertsHeadless();
      try {
        // eslint-disable-next-line import/no-commonjs, global-require
        const BackgroundTask = require("expo-background-task");
        return ok
          ? BackgroundTask.BackgroundTaskResult.Success
          : BackgroundTask.BackgroundTaskResult.Failed;
      } catch (_) {
        return ok ? 1 : 2;
      }
    });
  } catch (err) {
    console.log("[push] define poll task failed", err?.message || err);
  }
}

export async function startBackgroundAlertPolling() {
  if (isExpoGo()) {
    console.log("[push] background poll skipped (Expo Go)");
    return;
  }
  defineAlertPollTask();
  try {
    // eslint-disable-next-line import/no-commonjs, global-require
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    const access = await AsyncStorage.getItem("access");
    if (!access) {
      console.log("[push] background poll not registered (no session)");
      return;
    }
    // eslint-disable-next-line import/no-commonjs, global-require
    const BackgroundTask = require("expo-background-task");
    const status = await BackgroundTask.getStatusAsync();
    console.log("[push] background task status", status);
    await BackgroundTask.registerTaskAsync(BACKGROUND_ALERT_POLL_TASK, {
      minimumInterval: 15,
    });
    console.log("[push] background alert poll registered");
  } catch (err) {
    console.log("[push] background poll register failed", err?.message || err);
  }
}

export async function stopBackgroundAlertPolling() {
  try {
    // eslint-disable-next-line import/no-commonjs, global-require
    const BackgroundTask = require("expo-background-task");
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_ALERT_POLL_TASK);
  } catch (_) {
    /* not registered */
  }
}

setHandlerSafe();
registerNotificationListenerTask();
defineAlertPollTask();
