# FETS.Live API - Supabase Edge Functions

API endpoints for external integrations with FETS.Live (FETS AI broadcasting, mobile apps, etc.)

## 🚀 Deployment

### Prerequisites
1. Supabase CLI installed: `npm install -g supabase`
2. Logged into Supabase: `supabase login`
3. Project linked: `supabase link --project-ref qqewusetilxxfvfkmsed`

### Deploy
```bash
cd supabase
supabase functions deploy fets-api --no-verify-jwt
supabase functions deploy paragon-schedule-sync --no-verify-jwt
```

### Set Secrets (API Keys)
```bash
# Set your API keys (comma-separated for multiple)
supabase secrets set FETS_API_KEYS="fets-ai-2026-secure-key,another-key-if-needed"

# Verify secrets are set
supabase secrets list
```

### Paragon schedule sync (hourly)

This repo includes `paragon-schedule-sync`, which writes slot-level **counts** (no candidate PII) into Postgres via `public.apply_paragon_snapshot(...)`.

**1) Apply DB migration**

Run your normal migration workflow so these objects exist:

- `public.paragon_celpip_bookings`
- `public.paragon_schedule_sync_runs`
- `public.apply_paragon_snapshot(jsonb)`
- `cron.schedule(...)` job named `paragon-schedule-sync-hourly`

**2) Enable extensions (Dashboard)**

Enable:

- `pg_cron`
- `pg_net`

**3) Create Vault secrets (SQL editor)**

Follow the Supabase guide: `https://supabase.com/docs/guides/functions/schedule-functions.md`

Minimum secrets used by the migration job:

- `project_url` → `https://<project-ref>.supabase.co`
- `anon_key` → your Supabase anon key (or a dedicated restricted key)
- `paragon_sync_secret` → a random shared secret

**4) Set function secret**

The Edge Function validates `x-paragon-sync-secret` against:

```bash
supabase secrets set PARAGON_SYNC_SECRET="same-value-as-paragon_sync_secret-vault-secret"
```

**5) Manual smoke test**

```bash
curl -X POST "https://qqewusetilxxfvfkmsed.supabase.co/functions/v1/paragon-schedule-sync" ^
  -H "Authorization: Bearer <anon_key>" ^
  -H "x-paragon-sync-secret: <PARAGON_SYNC_SECRET>" ^
  -H "Content-Type: application/json" ^
  -d "{\"mode\":\"sync\",\"location\":\"cochin\",\"startMonth\":\"2026-04\",\"endMonth\":\"2026-06\"}"

curl -X POST "https://qqewusetilxxfvfkmsed.supabase.co/functions/v1/paragon-schedule-sync" ^
  -H "Authorization: Bearer <anon_key>" ^
  -H "x-paragon-sync-secret: <PARAGON_SYNC_SECRET>" ^
  -H "Content-Type: application/json" ^
  -d "{\"mode\":\"sync\",\"location\":\"calicut\",\"startMonth\":\"2026-04\",\"endMonth\":\"2026-06\"}"
```

## 📡 API Endpoints

**Base URL:** `https://qqewusetilxxfvfkmsed.supabase.co/functions/v1/fets-api`

### Authentication
All endpoints (except `/fets-api`) require an API key in the header:
```
X-API-Key: your-api-key-here
```

### Endpoints

#### GET `/fets-api`
API information (no auth required)

**Response:**
```json
{
  "name": "FETS.Live API",
  "version": "1.0.0",
  "endpoints": { ... }
}
```

---

#### GET `/fets-api/today`
Today's exam summary with candidates by location

**Response:**
```json
{
  "date": "2026-02-01",
  "day_of_week": "Sunday",
  "summary": {
    "total_candidates": 42,
    "calicut_candidates": 24,
    "cochin_candidates": 18
  },
  "locations": {
    "calicut": {
      "total_candidates": 24,
      "session_count": 3,
      "exams": [
        { "client": "PEARSON", "exam": "IELTS", "candidates": 15, "time": "09:00" },
        { "client": "ETS", "exam": "GRE", "candidates": 9, "time": "14:00" }
      ]
    },
    "cochin": {
      "total_candidates": 18,
      "session_count": 2,
      "exams": [...]
    }
  }
}
```

---

#### GET `/fets-api/date/:date`
Exam data for a specific date (format: YYYY-MM-DD)

**Example:** `/fets-api/date/2026-02-15`

---

#### GET `/fets-api/checklists/status`
Pre/Post exam checklist completion status for today

**Response:**
```json
{
  "date": "2026-02-01",
  "deadlines": {
    "pre_exam": "12:00 PM IST",
    "post_exam": "After 3:00 PM IST"
  },
  "summary": {
    "pre_exam": { "submitted": true, "completion": 85, "completed": 17, "total": 20 },
    "post_exam": { "submitted": false, "completion": 0, "completed": 0, "total": 0 }
  },
  "by_location": {
    "calicut": { ... },
    "cochin": { ... }
  }
}
```

---

#### GET `/fets-api/upcoming`
Next 7 days overview

**Response:**
```json
{
  "days": [
    {
      "date": "2026-02-01",
      "day_of_week": "Sunday",
      "total_candidates": 42,
      "calicut_candidates": 24,
      "cochin_candidates": 18,
      "session_count": 5
    },
    ...
  ]
}
```

---

#### GET `/fets-api/staff`
Staff list with base centre assignments

---

## 🔑 API Keys

Default development key: `fets-ai-2026-secure-key`

**Production:** Generate a secure key and set it via Supabase secrets:
```bash
# Generate a secure key
openssl rand -base64 32

# Set it in Supabase
supabase secrets set FETS_API_KEYS="your-secure-key-here"
```

## 📱 Usage Example (cURL)

```bash
# Get today's exam summary
curl -X GET "https://qqewusetilxxfvfkmsed.supabase.co/functions/v1/fets-api/today" \
  -H "X-API-Key: fets-ai-2026-secure-key"

# Get specific date
curl -X GET "https://qqewusetilxxfvfkmsed.supabase.co/functions/v1/fets-api/date/2026-02-15" \
  -H "X-API-Key: fets-ai-2026-secure-key"
```

## 🤖 FETS AI Integration

The API is designed for FETS AI to broadcast daily updates:

**Morning Message (around 8-9 AM):**
1. Call `/fets-api/today` to get candidate counts
2. Format: "Good morning! Today at FETS: Calicut {n} candidates, Cochin {m} candidates. Exams: {list}"
3. Reminder: "Pre-exam checklist due by 12 PM"

**Evening Message (around 4-5 PM):**
1. Call `/fets-api/checklists/status` to check completion
2. Reminder: "Post-exam checklist pending" or "Checklists complete ✓"

---

## 🛠 Development

### Local Testing
```bash
# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve fets-api --no-verify-jwt

# Test locally (different port)
curl http://localhost:54321/functions/v1/fets-api/today -H "X-API-Key: fets-ai-2026-secure-key"
```

### Environment Variables
- `SUPABASE_URL` - Auto-set by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-set by Supabase
- `FETS_API_KEYS` - Comma-separated list of valid API keys

---

© 2026 Forun Educational Testing Services
