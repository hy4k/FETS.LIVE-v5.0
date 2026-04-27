// Supabase Edge Function: GBP Proxy
// Handles all Google Business Profile API calls server-side
// Deployed at: /functions/v1/gbp-proxy

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GBP_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1'
const GBP_REVIEWS_BASE = 'https://mybusiness.googleapis.com/v4'
const GBP_POSTS_BASE = 'https://mybusiness.googleapis.com/v4'
const GBP_QA_BASE = 'https://mybusinessqanda.googleapis.com/v1'
const GBP_PERFORMANCE_BASE = 'https://businessprofileperformance.googleapis.com/v1'
const GBP_NOTIFICATIONS_BASE = 'https://mybusinessnotifications.googleapis.com/v1'

// FETS locations - hardcoded for Cochin and Calicut
// These location IDs must be set as Supabase secrets after first OAuth flow
const LOCATIONS: Record<string, string> = {
  cochin: Deno.env.get('GBP_LOCATION_COCHIN') ?? '',
  calicut: Deno.env.get('GBP_LOCATION_CALICUT') ?? '',
}

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
const GOOGLE_REFRESH_TOKEN = Deno.env.get('GOOGLE_REFRESH_TOKEN') ?? ''

cors headers for dev and prod
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

/** Get a fresh access token using the stored refresh token */
async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`)
  }
  return data.access_token
}

/** Make an authenticated GBP API call */
async function gbpFetch(url: string, options: RequestInit = {}) {
  const token = await getAccessToken()
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const data = await res.json()
  return { data, status: res.status }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    const branch = (url.searchParams.get('branch') ?? 'cochin') as 'cochin' | 'calicut'
    const locationName = LOCATIONS[branch]

    if (!locationName && action !== 'get-oauth-url') {
      return new Response(
        JSON.stringify({ error: `Location ID for '${branch}' not configured. Set GBP_LOCATION_${branch.toUpperCase()} secret.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result: { data: unknown; status: number }

    switch (action) {

      // ── LOCATION INFO ────────────────────────────────────────────
      case 'get-location': {
        result = await gbpFetch(`${GBP_BASE}/${locationName}?readMask=name,title,phoneNumbers,regularHours,specialHours,websiteUri,profile,categories`)
        break
      }

      // ── REVIEWS ─────────────────────────────────────────────────
      case 'list-reviews': {
        const pageToken = url.searchParams.get('pageToken') ?? ''
        const pageSize = url.searchParams.get('pageSize') ?? '20'
        let reviewsUrl = `${GBP_REVIEWS_BASE}/${locationName}/reviews?pageSize=${pageSize}`
        if (pageToken) reviewsUrl += `&pageToken=${pageToken}`
        result = await gbpFetch(reviewsUrl)
        break
      }

      case 'reply-to-review': {
        const body = await req.json()
        const { reviewName, comment } = body
        result = await gbpFetch(
          `${GBP_REVIEWS_BASE}/${reviewName}/reply`,
          { method: 'PUT', body: JSON.stringify({ comment }) }
        )
        break
      }

      case 'delete-reply': {
        const body = await req.json()
        const { reviewName } = body
        result = await gbpFetch(
          `${GBP_REVIEWS_BASE}/${reviewName}/reply`,
          { method: 'DELETE' }
        )
        break
      }

      // ── POSTS ────────────────────────────────────────────────────
      case 'list-posts': {
        result = await gbpFetch(`${GBP_POSTS_BASE}/${locationName}/localPosts`)
        break
      }

      case 'create-post': {
        const body = await req.json()
        result = await gbpFetch(
          `${GBP_POSTS_BASE}/${locationName}/localPosts`,
          { method: 'POST', body: JSON.stringify(body.post) }
        )
        break
      }

      case 'delete-post': {
        const body = await req.json()
        result = await gbpFetch(
          `${GBP_POSTS_BASE}/${body.postName}`,
          { method: 'DELETE' }
        )
        break
      }

      // ── Q&A ──────────────────────────────────────────────────────
      case 'list-questions': {
        result = await gbpFetch(`${GBP_QA_BASE}/${locationName}/questions?pageSize=20`)
        break
      }

      case 'answer-question': {
        const body = await req.json()
        const { questionName, text } = body
        result = await gbpFetch(
          `${GBP_QA_BASE}/${questionName}/answers`,
          { method: 'POST', body: JSON.stringify({ text }) }
        )
        break
      }

      // ── INSIGHTS ────────────────────────────────────────────────
      case 'get-insights': {
        const startDate = url.searchParams.get('startDate') ?? getDateDaysAgo(28)
        const endDate = url.searchParams.get('endDate') ?? getTodayDate()
        const metrics = [
          'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
          'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
          'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
          'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
          'CALL_CLICKS',
          'DIRECTION_REQUESTS',
          'WEBSITE_CLICKS',
        ]
        const params = new URLSearchParams({
          'dailyRange.startDate.year': startDate.split('-')[0],
          'dailyRange.startDate.month': startDate.split('-')[1],
          'dailyRange.startDate.day': startDate.split('-')[2],
          'dailyRange.endDate.year': endDate.split('-')[0],
          'dailyRange.endDate.month': endDate.split('-')[1],
          'dailyRange.endDate.day': endDate.split('-')[2],
        })
        metrics.forEach(m => params.append('metrics', m))
        result = await gbpFetch(
          `${GBP_PERFORMANCE_BASE}/${locationName}:getDailyMetricsTimeSeries?${params}`
        )
        break
      }

      // ── NOTIFICATIONS ────────────────────────────────────────────
      case 'get-notifications-settings': {
        const accountName = locationName.split('/locations/')[0]
        result = await gbpFetch(`${GBP_NOTIFICATIONS_BASE}/${accountName}/notificationSetting`)
        break
      }

      // ── OAUTH INITIATION (one-time setup) ────────────────────────
      case 'get-oauth-url': {
        const scopes = [
          'https://www.googleapis.com/auth/business.manage',
        ].join(' ')
        const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${GOOGLE_CLIENT_ID}` +
          `&redirect_uri=${encodeURIComponent('https://fets.live/api/auth/google/callback')}` +
          `&response_type=code` +
          `&scope=${encodeURIComponent(scopes)}` +
          `&access_type=offline` +
          `&prompt=consent`
        return new Response(
          JSON.stringify({ url: oauthUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    return new Response(
      JSON.stringify(result.data),
      {
        status: result.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (err) {
    console.error('[gbp-proxy] error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────
function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

function getDateDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}
