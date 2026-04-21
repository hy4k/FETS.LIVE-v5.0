# Paragon portal → Supabase ingest (Playwright sketch)

Automates logging into the Paragon **test centre portal** once per centre (Cochin, Calicut), scrapes Apr–Jun schedule rows (you implement selectors + parsing), then sends **two HTTP POSTs per run** to `paragon-schedule-sync` with `mode: "ingest"`.

## Security

- **Never commit** `.env` or real passwords. Copy `.env.example` → `.env` locally or inject the same variables in CI (GitHub Actions secrets, Azure Key Vault references, etc.).
- The Edge Function still requires `Authorization: Bearer <anon>` and `x-paragon-sync-secret`.

## Setup

```bash
cd scripts/paragon-portal-ingest
pnpm install
pnpm run install:browsers
cp .env.example .env
# edit .env
pnpm start
```

## What you must fill in

1. **`lib/selectors.mjs`** — replace `TODO_*` strings with real locators (prefer `page.getByRole` in `login.mjs` / `extractSchedule.mjs` once you know labels).
2. **`lib/extractSchedule.mjs`** — navigate to the schedule view and map DOM (or captured API JSON) into `{ id, date, time, testType, bookedCount, capacity }[]` for Apr–Jun 2026.
3. **`lib/login.mjs`** — adjust post-login wait if the portal redirects slowly.

Recording tip:

```bash
npx playwright codegen "$PARAGON_PORTAL_URL"
```

## Contract

Each POST body matches the Edge Function ingest handler:

- `mode`: `"ingest"`
- `location`: `"cochin"` | `"calicut"`
- `startMonth` / `endMonth`: e.g. `2026-04` … `2026-06`
- `bookings`: array of slot objects (same shape as bundled snapshots)
