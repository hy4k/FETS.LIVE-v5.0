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

## Azure VM (recommended for always-on)

Use this on your Azure Linux VM so runs continue even when your local PC is off.

1) Ensure repo + env are present on VM:

```bash
cd /path/to/FETS.LIVE-v5.0
cp env scripts/paragon-portal-ingest/.env
```

2) Run one-time systemd setup (as root):

```bash
cd /path/to/FETS.LIVE-v5.0
sudo bash scripts/paragon-portal-ingest/setup-azure-vm-systemd.sh <vm-username>
```

This creates:

- `fets-paragon-ingest.service` (oneshot ingest run)
- `fets-paragon-ingest.timer` (hourly trigger + run on boot + catch-up after downtime)

3) Verify:

```bash
systemctl status fets-paragon-ingest.timer --no-pager
systemctl status fets-paragon-ingest.service --no-pager
journalctl -u fets-paragon-ingest.service -n 100 --no-pager
```

## Daily health-check (under 2 minutes)

Run these from the VM:

```bash
cd /path/to/FETS.LIVE-v5.0
bash scripts/paragon-portal-ingest/check-hourly-health.sh
systemctl list-timers --all | grep fets-paragon-ingest.timer
journalctl -u fets-paragon-ingest.service -n 40 --no-pager
```

If the second command prints `OK: ... healthy`, hourly automation is working from the VM side.

## Implementation notes

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
