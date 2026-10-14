# Mobile — payment push notifications

Client-side guide for the Expo app. Backend sender lives in `backend/apps/notifications/`.

Related: [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)

---

## Architecture

```
React Native (EAS / Play Store build)
       ↑  Android system tray (app can be killed)
      FCM  HTTP v1
       ↑  firebase-admin
Django Backend
```

Django sends a **notification** payload to FCM. Google Play Services on the phone shows it even when the app is backgrounded or force-killed. No Expo Push relay and no OneSignal.

FCM is Google's OS push channel (same as WhatsApp/Gmail). It is not optional for killed-app delivery. Polling and foreground services cannot wake a force-killed Android app.

---

## What staff see

When a payment is marked paid for invoices they own:

- **Title:** `Hurray! Payment received`
- **Body:** `Payment of $X.XX received from {client}.`
- **Tap:** Invoices tab

---

## Delivery matrix

| Environment | Delivery |
|-------------|----------|
| Expo Go (iOS) | Expo remote push token (legacy fallback) |
| Expo Go (Android) | **No remote push** (SDK 53+) — local banners + poll while the app is open |
| EAS / Play Store | **FCM HTTP v1** from Django → Android system tray (works backgrounded, killed, and after the phone comes back online) |

Backend always creates `StaffPushAlert`, then sends FCM when the device registered a native token.

---

## One-time setup (required for background / killed)

### 1. Firebase Android app + `google-services.json`

1. Firebase Console → create/select a project
2. Add an Android app with package `com.invoices.app`
3. Download `google-services.json` into `app/mobile/google-services.json` (gitignored)
4. Rebuild the Android app (`eas build`). A JS reload is not enough.

Without this file, `getDevicePushTokenAsync()` fails and FCM never reaches the phone.

### 2. Service account on Django (no Expo, no third-party relay)

1. Firebase Console → Project settings → Service accounts → **Generate new private key**
2. On Render (or local `.env`) set one of:

```env
FIREBASE_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}
# or
FIREBASE_CREDENTIALS_FILE=/path/to/firebase-service-account.json
FIREBASE_PROJECT_ID=your-firebase-project-id
```

3. Install backend dep and migrate:

```bash
cd backend
pip install firebase-admin==6.9.0
python manage.py migrate notifications
```

### 3. Rebuild + log in

Log in on a physical Android device (not Expo Go). The app registers `fcm_token` with Django. Then mark an invoice paid with the app backgrounded or killed.

---

## Mobile code

| Piece | Path |
|-------|------|
| Native FCM token + register | `src/notifications/push.js` (`getDevicePushTokenAsync`) |
| FCM HTTP v1 sender | `backend/apps/notifications/fcm.py` (`firebase-admin`) |
| Login / logout hooks | `src/context/AuthContext.js` |
| Config | `app.config.js` (auto-includes `google-services.json` when present) |

---

## Device APIs used by the app

```http
POST /api/v1/notifications/devices/register/
POST /api/v1/notifications/devices/unregister/
GET  /api/v1/notifications/devices/
GET  /api/v1/notifications/alerts/pending/
POST /api/v1/notifications/alerts/acknowledge/
```

Register (EAS / store Android):

```json
{
  "fcm_token": "<native FCM registration token>",
  "expo_push_token": "",
  "platform": "android",
  "runtime": "standalone",
  "supports_remote_push": true
}
```

---

## Store builds (EAS)

```bash
cd app/mobile
# google-services.json must exist in this folder
eas build -p android --profile production
```

---

## Who gets notified

Revenue owner (`created_by` on billing intent / order / pay link / NAS invoice) — staff, not the paying client.
