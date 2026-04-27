# GBP Integration Setup Guide

This guide explains how to complete the Google Business Profile (GBP) integration for FETS.LIVE.

## Architecture Overview

```
Browser (React) --> Supabase Edge Function (gbp-proxy) --> Google Business Profile API
```

All GBP API calls go through a Supabase Edge Function to protect credentials.

## Files Created

| File | Purpose |
|------|---------|
| `fets-point/supabase/functions/gbp-proxy/index.ts` | Edge Function - server-side GBP API proxy |
| `fets-point/src/types/gbp.types.ts` | TypeScript types for all GBP data |
| `fets-point/src/lib/gbpService.ts` | Client-side service layer |
| `fets-point/src/hooks/useGBP.ts` | React hooks for GBP data |
| `fets-point/src/components/GBP/GBPReviewPanel.tsx` | Review management UI |
| `fets-point/src/components/GBP/GBPInsightsPanel.tsx` | Analytics/insights UI |
| `fets-point/src/components/GBP/GBPPostPublisher.tsx` | Google Posts UI |
| `fets-point/src/components/GBP/GBPQandA.tsx` | Q&A management UI |
| `fets-point/src/components/GBP/index.ts` | Barrel exports |
| `fets-point/src/pages/GBPDashboard.tsx` | Full dashboard page |

## Step 1: Get Your GBP Location IDs

1. Go to https://mybusiness.googleapis.com/v4/accounts
2. Note your `accountId` (format: `accounts/123456789`)
3. Go to https://mybusiness.googleapis.com/v4/{accountId}/locations
4. Note each `name` field - this is your location ID

## Step 2: Set Supabase Secrets

Run these commands in your terminal (Supabase CLI):

```bash
# GBP OAuth credentials (from GCP Console > APIs & Services > Credentials)
supabase secrets set GBP_CLIENT_ID=your-client-id.apps.googleusercontent.com
supabase secrets set GBP_CLIENT_SECRET=your-client-secret

# GBP Location IDs for each branch
supabase secrets set GBP_LOCATION_COCHIN="accounts/YOUR_ACCOUNT_ID/locations/YOUR_COCHIN_LOCATION_ID"
supabase secrets set GBP_LOCATION_CALICUT="accounts/YOUR_ACCOUNT_ID/locations/YOUR_CALICUT_LOCATION_ID"
```

## Step 3: Deploy the Edge Function

```bash
cd fets-point
supabase functions deploy gbp-proxy --no-verify-jwt
```

## Step 4: Set Frontend Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GBP_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GBP_LOCATION_COCHIN=accounts/YOUR_ACCOUNT_ID/locations/YOUR_COCHIN_ID
VITE_GBP_LOCATION_CALICUT=accounts/YOUR_ACCOUNT_ID/locations/YOUR_CALICUT_ID
```

## Step 5: Add Route to App Router

In your main router file (e.g., `App.tsx` or `routes.tsx`), add:

```tsx
import GBPDashboard from './pages/GBPDashboard';

// Inside your routes:
<Route path="/gbp" element={<GBPDashboard />} />
```

## Step 6: OAuth Flow

The first time a user opens the GBP dashboard, they will be prompted to authorize with Google.
Make sure these URLs are in your GCP OAuth client's authorized redirect URIs:
- `https://fets.live/gbp`
- `http://localhost:5173/gbp` (for local dev)

## GCP Project: fets-cloud

Service account: `fets-live-gbp-service@fets-cloud.iam.gserviceaccount.com`

APIs enabled:
- Business Information API
- My Business Account Management API
- My Business Q&A API
- My Business Notifications API
- My Business Place Actions API
- My Business Verifications API
- My Business Business Calls API

## Branches Supported

- **Cochin** - Primary location
- **Calicut** - Secondary location

To add more branches, update:
1. `GBPBranch` type in `src/types/gbp.types.ts`
2. `LOCATION_IDS` map in `src/lib/gbpService.ts`
3. Add corresponding Supabase secret
