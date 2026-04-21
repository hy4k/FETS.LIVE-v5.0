/**
 * One POST per centre per run: mode=ingest + location + bookings array.
 *
 * @param {{
 *   supabaseFunctionUrl: string
 *   supabaseAnonKey: string
 *   paragonSyncSecret: string
 *   startMonth: string
 *   endMonth: string
 *   location: 'cochin' | 'calicut'
 *   bookings: Array<{ id: string; date: string; time: string; testType: string; bookedCount: number; capacity: number }>
 * }} params
 */
export async function postIngest(params) {
  const url = new URL(params.supabaseFunctionUrl)
  const body = {
    mode: 'ingest',
    location: params.location,
    startMonth: params.startMonth,
    endMonth: params.endMonth,
    bookings: params.bookings,
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.supabaseAnonKey}`,
      'x-paragon-sync-secret': params.paragonSyncSecret,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Ingest failed (${params.location}): HTTP ${res.status} — ${text.slice(0, 500)}`)
  }

  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  return json
}
