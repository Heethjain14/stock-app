# StockApp

QR-based inventory app for a clothing business, migrated from Google Sheets to Supabase.

Workflow: **create an item** (category, size, color, lot, ...) -> **print its QR code** -> **scan the QR** to receive, add, remove or set stock -> **search records** and see low-stock items and movement history.

## Stack

- Expo SDK 55 / React Native 0.83 / TypeScript
- expo-router (file-based navigation), expo-camera (QR scanning), react-native-qrcode-svg
- Supabase: Postgres (items + stock movements) and Auth

## Quick start

```bash
npm install
cp .env.example .env        # then fill in your Supabase URL and anon key
# create the database and auth users: see docs/SUPABASE_SETUP.md
npx expo start
```

Open the app in Expo Go / a dev build (`a` for Android, `i` for iOS, `w` for web).

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run android` / `ios` / `web` | Start and open on a platform |
| `npm run lint` | ESLint via `expo lint` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest (jest-expo) unit tests |

CI (`.github/workflows/ci.yml`) runs typecheck, lint and tests on every push and PR.

## Project structure

```
app/                 expo-router screens (index, create-qr, scan, records, ...)
src/
  api/               Supabase data access (items, movements)
  auth/              session handling and sign-in
  components/ui/     shared UI components
  domain/            clothing categories, sizes, fabrics, etc.
  lib/               Supabase client and helpers
  theme/             colors, spacing, typography
  types/             shared types (StockItem, stockStatus, ...)
supabase/            SQL schema, policies and migrations
docs/                setup and operational docs
scripts/             maintenance / migration scripts
assets/              icons and splash images
```

## Building with EAS

Build profiles live in `eas.json`:

- `development`: dev client, internal distribution
- `preview`: internal distribution (installable test builds)
- `production`: store build, auto-incremented version

```bash
npm install -g eas-cli
eas login
eas build --profile preview --platform android
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS environment variables/secrets so builds can reach Supabase.
