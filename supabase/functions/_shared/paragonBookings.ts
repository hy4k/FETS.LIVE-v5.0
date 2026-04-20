import cochinSnapshot from './paragon-bookings-snapshot-cochin.json' assert { type: 'json' }
import calicutSnapshot from './paragon-bookings-snapshot-calicut.json' assert { type: 'json' }

export interface ParagonBookingSlot {
  id: string
  date: string
  time: string
  testType: string
  bookedCount: number
  capacity: number
  notes?: string
}

export type ParagonCentre = 'cochin' | 'calicut'

/** Canonical snapshot for Apr–Jun 2026 test runs; replace with live scraper output when ready. */
export function getParagonBookingSnapshotForLocation(location: ParagonCentre): ParagonBookingSlot[] {
  if (location === 'calicut') return calicutSnapshot as ParagonBookingSlot[]
  return cochinSnapshot as ParagonBookingSlot[]
}

/** @deprecated prefer getParagonBookingSnapshotForLocation */
export function getParagonBookingSnapshot(): ParagonBookingSlot[] {
  return getParagonBookingSnapshotForLocation('cochin')
}

function monthKeyToInt(month: string): number {
  const [y, m] = month.split('-').map((x) => parseInt(x, 10))
  if (!y || !m) return 0
  return y * 12 + (m - 1)
}

export function filterBookingsByMonthRange(
  bookings: ParagonBookingSlot[],
  startMonth: string,
  endMonth: string
): ParagonBookingSlot[] {
  const startK = monthKeyToInt(startMonth)
  const endK = monthKeyToInt(endMonth)
  if (!startK || !endK) return bookings

  return bookings.filter((b) => {
    const d = b.date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
    const y = parseInt(d.slice(0, 4), 10)
    const m = parseInt(d.slice(5, 7), 10)
    if (!y || !m) return false
    const k = y * 12 + (m - 1)
    return k >= startK && k <= endK
  })
}

export type ParagonDbSlotRow = {
  branch_location: ParagonCentre
  slot_key: string
  exam_date: string
  start_time: string
  test_type: string
  booked_count: number
  capacity: number
  source: string
}

export function bookingsToDbPayload(location: ParagonCentre, bookings: ParagonBookingSlot[]): ParagonDbSlotRow[] {
  return bookings.map((b) => ({
    branch_location: location,
    slot_key: b.id,
    exam_date: b.date,
    start_time: b.time,
    test_type: b.testType,
    booked_count: b.bookedCount,
    capacity: b.capacity,
    source: 'paragon-test-centre-portal',
  }))
}
