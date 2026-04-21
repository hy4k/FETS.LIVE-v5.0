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
 *
 * Modes:
 * - read: JSON preview from bundled snapshot (no DB write).
 * - sync: DB apply from bundled snapshot (used by pg_cron today).
 * - ingest: DB apply from request body `bookings` (live Paragon extract). Use this when an external
 *   job (Playwright, etc.) pulls the portal and POSTs counts — then FETS.LIVE matches Paragon for Apr–Jun.
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

type SlotShape = {
  slot_key: string
  exam_date: string
  start_time: string
  test_type: string
  booked_count: number
  capacity: number
}

type SnapshotDiff = {
  addedSlots: number
  updatedSlots: number
  removedSlots: number
  bookingDelta: number
  totalBookedBefore: number
  totalBookedAfter: number
}

function toSlotShapeFromPortal(rows: ParagonBookingSlot[]): SlotShape[] {
  return rows.map((r) => ({
    slot_key: r.id,
    exam_date: r.date,
    start_time: r.time,
    test_type: r.testType ?? 'G',
    booked_count: Number(r.bookedCount ?? 0),
    capacity: Number(r.capacity ?? 0),
  }))
}

/** Live push: same row shape as bundled JSON / read API (counts only, no PII). */
function parseIngestBookings(raw: unknown): ParagonBookingSlot[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: ParagonBookingSlot[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null
    const o = row as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : null
    const date = typeof o.date === 'string' ? o.date : null
    const time = typeof o.time === 'string' ? o.time : null
    const testType =
      typeof o.testType === 'string'
        ? o.testType
        : typeof o.test_type === 'string'
          ? o.test_type
          : 'G'
    const bc =
      typeof o.bookedCount === 'number'
        ? o.bookedCount
        : typeof o.booked_count === 'number'
          ? o.booked_count
          : NaN
    const cap = typeof o.capacity === 'number' ? o.capacity : 10
    if (!id || !date || !time || Number.isNaN(bc)) return null
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
    out.push({
      id,
      date,
      time,
      testType,
      bookedCount: Math.max(0, Math.floor(bc)),
      capacity: Math.max(0, Math.floor(cap)),
    })
  }
  return out
}

function computeSnapshotDiff(previousRows: SlotShape[], nextRows: SlotShape[]): SnapshotDiff {
  const prevMap = new Map(previousRows.map((row) => [row.slot_key, row]))
  const nextMap = new Map(nextRows.map((row) => [row.slot_key, row]))

  let addedSlots = 0
  let updatedSlots = 0
  let removedSlots = 0
  let bookingDelta = 0

  for (const [slotKey, nextRow] of nextMap.entries()) {
    const prevRow = prevMap.get(slotKey)
    if (!prevRow) {
      addedSlots += 1
      bookingDelta += nextRow.booked_count
      continue
    }

    const changed =
      prevRow.exam_date !== nextRow.exam_date ||
      prevRow.start_time !== nextRow.start_time ||
      prevRow.test_type !== nextRow.test_type ||
      prevRow.booked_count !== nextRow.booked_count ||
      prevRow.capacity !== nextRow.capacity

    if (changed) {
      updatedSlots += 1
    }

    if (prevRow.booked_count !== nextRow.booked_count) {
      bookingDelta += nextRow.booked_count - prevRow.booked_count
    }
  }

  for (const [slotKey, prevRow] of prevMap.entries()) {
    if (!nextMap.has(slotKey)) {
      removedSlots += 1
      bookingDelta -= prevRow.booked_count
    }
  }

  const totalBookedBefore = previousRows.reduce((sum, row) => sum + row.booked_count, 0)
  const totalBookedAfter = nextRows.reduce((sum, row) => sum + row.booked_count, 0)

  return {
    addedSlots,
    updatedSlots,
    removedSlots,
    bookingDelta,
    totalBookedBefore,
    totalBookedAfter,
  }
}

function buildSyncSummaryMessage(diff: SnapshotDiff): string {
  const delta = diff.bookingDelta >= 0 ? `+${diff.bookingDelta}` : `${diff.bookingDelta}`
  return [
    'apply_paragon_snapshot ok',
    `slots +${diff.addedSlots} ~${diff.updatedSlots} -${diff.removedSlots}`,
    `bookings delta ${delta}`,
    `booked total ${diff.totalBookedAfter}`,
  ].join(' | ')
}

function computeDayBookingDeltas(prev: SlotShape[], next: SlotShape[]): { date: string; change: number }[] {
  const map = new Map<string, number>()
  const prevKey = new Map(prev.map((r) => [r.slot_key, r]))
  const nextKey = new Map(next.map((r) => [r.slot_key, r]))

  for (const [, nRow] of nextKey) {
    const pRow = prevKey.get(nRow.slot_key)
    const d = String(nRow.exam_date).slice(0, 10)
    if (!pRow) {
      map.set(d, (map.get(d) ?? 0) + nRow.booked_count)
    } else if (pRow.booked_count !== nRow.booked_count) {
      map.set(d, (map.get(d) ?? 0) + (nRow.booked_count - pRow.booked_count))
    }
  }
  for (const [, pRow] of prevKey) {
    if (!nextKey.has(pRow.slot_key)) {
      const d = String(pRow.exam_date).slice(0, 10)
      map.set(d, (map.get(d) ?? 0) - pRow.booked_count)
    }
  }

  return Array.from(map.entries())
    .filter(([, c]) => c !== 0)
    .map(([date, change]) => ({ date, change }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

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

  let bookings: ParagonBookingSlot[]
  let bookingSource: 'bundled_snapshot' | 'live_ingest' = 'bundled_snapshot'

  if (mode === 'ingest') {
    const ingested = parseIngestBookings(body.bookings)
    if (!ingested) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            'Invalid ingest body: bookings must be a non-empty JSON array of { id, date, time, testType?, bookedCount, capacity? }',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    bookings = filterBookingsByMonthRange(ingested, startMonth, endMonth)
    bookingSource = 'live_ingest'
    if (bookings.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'After month filter, no bookings remained. Check startMonth/endMonth and each row date.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  } else {
    const all: ParagonBookingSlot[] = getParagonBookingSnapshotForLocation(location)
    bookings = filterBookingsByMonthRange(all, startMonth, endMonth)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const admin =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null

  if (mode === 'sync' || mode === 'ingest') {
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

      let syncSummaryMessage = 'apply_paragon_snapshot ok'
      let syncDetails: Record<string, unknown> | null = null
      const nextShapes = toSlotShapeFromPortal(bookings)

      if (admin) {
        const { data: previousRows, error: previousRowsError } = await admin
          .from('paragon_celpip_bookings')
          .select('slot_key,exam_date,start_time,test_type,booked_count,capacity')
          .eq('branch_location', location)

        const prevShapes = (!previousRowsError ? (previousRows ?? []) : []) as SlotShape[]
        const diff = computeSnapshotDiff(prevShapes, nextShapes)
        syncSummaryMessage = buildSyncSummaryMessage(diff)
        const dayDeltas = computeDayBookingDeltas(prevShapes, nextShapes)
        syncDetails = {
          total_candidates_after: diff.totalBookedAfter,
          additional_candidates_since_last_update: diff.bookingDelta,
          test_days_with_changes: dayDeltas,
          data_source: bookingSource,
        }
      }

      await applySnapshotToDatabase(location, bookings)
      if (admin) {
        await admin.from('paragon_schedule_sync_runs').insert({
          branch_location: location,
          ok: true,
          message: syncSummaryMessage,
          slot_count: bookings.length,
          ...(syncDetails ? { sync_details: syncDetails } : {}),
        } as any)
      }

      return new Response(
        JSON.stringify({
          ok: true,
          mode,
          source: bookingSource === 'live_ingest' ? 'paragon-live-ingest' : 'paragon-test-centre-portal',
          generatedAt: new Date().toISOString(),
          range: { startMonth, endMonth },
          location,
          slotCount: bookings.length,
          summary: syncSummaryMessage,
          syncDetails,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
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
