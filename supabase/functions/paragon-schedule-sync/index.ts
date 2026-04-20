/**
 * paragon-schedule-sync — Supabase Edge Function
 *
 * Returns the Paragon test-centre schedule snapshot (booking counts per slot) in JSON.
 * Intended for scheduled jobs: invoke via HTTP on a cron (Supabase Scheduled Functions or pg_cron + net.http_post).
 *
 * Security:
 * - Set PARAGON_SYNC_SECRET in function secrets.
 * - Callers must send header: x-paragon-sync-secret: <PARAGON_SYNC_SECRET>
 *
 * Cron (outline): schedule POST to
 *   https://<project-ref>.supabase.co/functions/v1/paragon-schedule-sync
 * with Authorization: Bearer <anon or service role> per Supabase docs, plus x-paragon-sync-secret.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { corsHeaders } from '../_shared/cors.ts'
import {
  bookingsToDbPayload,
  filterBookingsByMonthRange,
  getParagonBookingSnapshotForLocation,
  type ParagonBookingSlot,
  type ParagonCentre,
} from '../_shared/paragonBookings.ts'

function unauthorized() {
  return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!auth) return null
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() ?? null
}

async function isAuthorized(req: Request): Promise<boolean> {
  const secret = Deno.env.get('PARAGON_SYNC_SECRET')
  const headerSecret = req.headers.get('x-paragon-sync-secret')
  if (secret && headerSecret === secret) return true

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return false

  const token = getBearerToken(req)
  if (!token) return false

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user?.id) return false

  const email = (userData.user.email ?? '').toLowerCase()

  const { data: row } = await admin
    .from('staff_profiles')
    .select('role,email')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  const role = String(row?.role ?? '').toLowerCase()

  // Tight-but-practical defaults for internal ops + cron compatibility above.
  if (email === 'mithun@fets.in') return true
  if (role.includes('admin') || role.includes('supervisor')) return true

  return false
}

function parseMonthParams(url: URL): { start: string; end: string } {
  const start = url.searchParams.get('startMonth') ?? '2026-04'
  const end = url.searchParams.get('endMonth') ?? '2026-06'
  return { start, end }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function applySnapshotToDatabase(location: ParagonCentre, bookings: ParagonBookingSlot[]) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const payload = bookingsToDbPayload(location, bookings)

  let lastErr: Error | null = null
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const { error } = await admin.rpc('apply_paragon_snapshot', {
      p_branch_location: location,
      p_slots: payload,
    } as any)

    if (!error) return

    lastErr = new Error(error.message)
    await sleep(Math.min(30_000, 250 * 2 ** attempt))
  }

  throw lastErr ?? new Error('apply_paragon_snapshot failed')
}

function parseLocation(url: URL, body: Record<string, unknown>): ParagonCentre {
  const q = (url.searchParams.get('location') ?? '').toLowerCase().trim()
  const b = typeof body.location === 'string' ? body.location.toLowerCase().trim() : ''
  const v = (b || q || 'cochin').toLowerCase().trim()
  if (v === 'calicut') return 'calicut'
  return 'cochin'
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!(await isAuthorized(req))) {
    return unauthorized()
  }

  const url = new URL(req.url)
  const { start, end } = parseMonthParams(url)

  let body: Record<string, unknown> = {}
  if (req.method === 'POST') {
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      body = {}
    }
  }

  const startMonth = typeof body.startMonth === 'string' ? body.startMonth : start
  const endMonth = typeof body.endMonth === 'string' ? body.endMonth : end
  const mode = typeof body.mode === 'string' ? body.mode : 'read'
  const location = parseLocation(url, body)

  const all: ParagonBookingSlot[] = getParagonBookingSnapshotForLocation(location)
  const bookings = filterBookingsByMonthRange(all, startMonth, endMonth)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const admin =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null

  if (mode === 'sync') {
    try {
      if (bookings.length === 0) {
        const msg = 'No bookings returned for requested range/location; refusing DB apply to avoid wiping last good snapshot.'
        if (admin) {
          await admin.from('paragon_schedule_sync_runs').insert({
            branch_location: location,
            ok: false,
            message: msg,
            slot_count: 0,
          })
        }
        return new Response(
          JSON.stringify({
            ok: false,
            source: 'paragon-test-centre-portal',
            generatedAt: new Date().toISOString(),
            range: { startMonth, endMonth },
            location,
            bookings,
            error: msg,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      await applySnapshotToDatabase(location, bookings)
      if (admin) {
        await admin.from('paragon_schedule_sync_runs').insert({
          branch_location: location,
          ok: true,
          message: 'apply_paragon_snapshot ok',
          slot_count: bookings.length,
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (admin) {
        await admin.from('paragon_schedule_sync_runs').insert({
          branch_location: location,
          ok: false,
          message: msg,
          slot_count: bookings.length,
        })
      }

      // Cron callers: return 200 so the job doesn't look "failed" while DB stays on last good snapshot.
      return new Response(
        JSON.stringify({
          ok: false,
          source: 'paragon-test-centre-portal',
          generatedAt: new Date().toISOString(),
          range: { startMonth, endMonth },
          location,
          bookings,
          error: msg,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  }

  const payload = {
    ok: true,
    source: 'paragon-test-centre-portal',
    generatedAt: new Date().toISOString(),
    range: { startMonth, endMonth },
    location,
    bookings,
    meta: {
      note:
        'Slot-level counts from schedule UI; per-candidate PII is not in this snapshot. Live scraping should replace getParagonBookingSnapshotForLocation(location).',
    },
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
