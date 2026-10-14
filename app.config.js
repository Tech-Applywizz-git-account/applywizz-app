const fs = require("fs");
const path = require("path");
const { buildRuntimeExtra } = require("./src/config/runtimeConfig");

function readEnvFile(filePath) {
  const out = {};
  try {
    if (!fs.existsSync(filePath)) return out;
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
  } catch (_) { /* ignore */ }
  return out;
}

const localEnv = readEnvFile(path.join(__dirname, ".env"));
const env = { ...localEnv, ...process.env };
const APP_ENV = String(env.APP_ENV || "development").trim().toLowerCase();
const runtimeExtra = buildRuntimeExtra(env, APP_ENV);

const SNACKIFY_SUPABASE_URL =
  env.EXPO_PUBLIC_SNACKIFY_SUPABASE_URL
  || env.VITE_SUPABASE_URL
  || env.SUPABASE_URL
  || "";

const SNACKIFY_SUPABASE_ANON_KEY =
  env.EXPO_PUBLIC_SNACKIFY_SUPABASE_ANON_KEY
  || env.VITE_SUPABASE_ANON_KEY
  || env.SUPABASE_ANON_KEY
  || "";

/**
 * Dynamic Expo config so the same codebase works for:
 * - Expo Go (local)
 * - EAS development builds
 * - Play Store / App Store / other store production builds
 *
 * Place google-services.json in the project root for Android FCM (store / EAS builds).
 * Django sends directly to FCM HTTP v1 — Android shows the tray even when
 * the app is backgrounded or killed. Without this file, only in-app poll works.
 */
const googleServicesPath = path.join(__dirname, "google-services.json");
const hasGoogleServices = fs.existsSync(googleServicesPath);
if (!hasGoogleServices) {
  console.warn(
    "[invoices-mobile] Missing google-services.json. Android cannot receive FCM while backgrounded/killed. Copy it from Firebase Console into this project root."
  );
}

// Linked to Expo account applywizz
const EAS_PROJECT_ID = "4a050837-9498-43d7-b3d4-8fb63faf3550";
const PRODUCTION_API_URL = "https://invoice-ge4q.onrender.com";

module.exports = {
  expo: {
    name: "Applywizz",
    slug: "invoices-mobile",
    version: "1.1.1",
    orientation: "portrait",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    scheme: "invoices",
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash-icon.png",
      backgroundColor: "#000000",
      resizeMode: "contain",
    },
    androidStatusBar: {
      backgroundColor: "#000000",
      barStyle: "light-content",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.applywizz.app",
      buildNumber: "20",
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
            NSPrivacyAccessedAPITypeReasons: ["C617.1", "0A2A.1", "3B52.1"],
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
            NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
            NSPrivacyAccessedAPITypeReasons: ["E174.1", "85F4.1"],
          },
        ],
        NSPrivacyCollectedDataTypes: [
          "NSPrivacyCollectedDataTypeName",
          "NSPrivacyCollectedDataTypeEmailAddress",
          "NSPrivacyCollectedDataTypePhoneNumber",
          "NSPrivacyCollectedDataTypePhysicalAddress",
          "NSPrivacyCollectedDataTypeUserID",
          "NSPrivacyCollectedDataTypeDeviceID",
          "NSPrivacyCollectedDataTypePhotosorVideos",
          "NSPrivacyCollectedDataTypePaymentInfo",
          "NSPrivacyCollectedDataTypeOtherFinancialInfo",
          "NSPrivacyCollectedDataTypeOtherUserContent",
        ].map((dataType) => ({
          NSPrivacyCollectedDataType: dataType,
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        })),
      },
      infoPlist: {
        UIBackgroundModes: ["remote-notification", "fetch", "processing"],
        BGTaskSchedulerPermittedIdentifiers: [
          "$(PRODUCT_BUNDLE_IDENTIFIER).expo.background-task",
          "INVOICES_ALERT_POLL",
        ],
        ITSAppUsesNonExemptEncryption: false,
        NSPhotoLibraryUsageDescription:
          "Allow Applywizz to choose an existing photo for your profile or payment proof.",
        NSCameraUsageDescription:
          "Capture payment proof photos or take a profile picture.",
      },
    },
    android: {
      package: "com.invoices.app",
      versionCode: 19,
      adaptiveIcon: {
        foregroundImage: "./assets/splash-icon.png",
        backgroundColor: "#000000",
      },
      ...(hasGoogleServices
        ? { googleServicesFile: "./google-services.json" }
        : {}),
      permissions: [
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "POST_NOTIFICATIONS",
        "WAKE_LOCK",
        "FOREGROUND_SERVICE",
      ],
    },
    plugins: [
      "expo-asset",
      "expo-font",
      "expo-background-task",
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "16.4",
            privacyManifestAggregationEnabled: true,
          },
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "Allow Applywizz to choose an existing photo for your profile or payment proof.",
          cameraPermission: false,
          microphonePermission: false,
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          backgroundColor: "#000000",
          resizeMode: "contain",
          imageWidth: 220,
          android: {
            image: "./assets/splash-icon.png",
            backgroundColor: "#000000",
            imageWidth: 168,
          },
          ios: {
            image: "./assets/splash-icon.png",
            backgroundColor: "#000000",
          },
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/splash-icon.png",
          color: "#2E7DFF",
          defaultChannel: "payments",
          mode: "production",
          enableBackgroundRemoteNotifications: true,
        },
      ],
    ],
    notification: {
      icon: "./assets/splash-icon.png",
      color: "#2E7DFF",
      iosDisplayInForeground: true,
      androidMode: "default",
      androidCollapsedTitle: "Applywizz",
    },
    extra: {
      // Prefer EXPO_PUBLIC_API_URL; else apiMode=local → :8000, otherwise Render.
      ...runtimeExtra,
      apiUrl: env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL,
      apiMode: env.EXPO_PUBLIC_API_MODE || "production",
      apiHost: env.EXPO_PUBLIC_API_HOST || "",
      privacyPolicyUrl: env.EXPO_PUBLIC_PRIVACY_POLICY_URL || "https://applywizz.com/privacy",
      supportUrl: env.EXPO_PUBLIC_SUPPORT_URL || "https://applywizz.com/support",
      snackifyApiUrl: env.EXPO_PUBLIC_SNACKIFY_API_URL || "https://snackify-inventory-tool.onrender.com",
      snackifySupabaseUrl: SNACKIFY_SUPABASE_URL,
      snackifySupabaseAnonKey: SNACKIFY_SUPABASE_ANON_KEY,
      eas: {
        projectId:
          env.EXPO_PUBLIC_EAS_PROJECT_ID
          || env.EAS_PROJECT_ID
          || EAS_PROJECT_ID,
      },
    },
    owner: env.EXPO_OWNER || "applywizz",
  },
};
