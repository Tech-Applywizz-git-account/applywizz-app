# Applywizz Mobile

Expo staff app for invoices, billing, clients, reports, incentives, expenses, disputes, and payment push alerts. Also hosts Snackify and Career Associate workspaces when the user is entitled.

**Repository:** [Tech-Applywizz-git-account/applywizz-app](https://github.com/Tech-Applywizz-git-account/applywizz-app)

## Developer documentation (start here)

Open the full handbook in a browser (sidebar navigation, architecture, auth, APIs, EAS, stores):

**[docs/developer-handbook.html](./docs/developer-handbook.html)**

| Doc | Description |
|-----|-------------|
| [docs/developer-handbook.html](./docs/developer-handbook.html) | End-to-end developer handbook |
| [docs/SYSTEM_ARCHITECTURE.md](./docs/SYSTEM_ARCHITECTURE.md) | Mobile system architecture |
| [docs/PUSH_NOTIFICATIONS.md](./docs/PUSH_NOTIFICATIONS.md) | Push banners (Expo Go → stores) |

The Django API and web admin live in the separate invoice monorepo (`backend/`, `frontend/`). Production API: `https://invoice-ge4q.onrender.com/api/v1/`.

## Quick start

```bash
npm install
npx expo start --host lan --clear
```

For a local Django API, create a gitignored `.env`:

```env
EXPO_PUBLIC_API_MODE=local
```

Run Django on `0.0.0.0:8000` so a physical phone can reach it on the same Wi‑Fi.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` / `npm run android` / `npm run ios` | Metro / Expo |
| `npm test` | Unit tests |
| `npm run eas:preview` | Internal preview builds |
| `npm run eas:play:build` / `eas:ios:build` | Store binaries |
| `npm run audit:ios:privacy` | Privacy manifest audit |

## Secrets (never commit)

- `.env`
- `google-services.json`
- `google-service-account.json`
- `credentials/`, keystores
