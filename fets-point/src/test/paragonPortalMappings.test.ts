import { describe, expect, it } from 'vitest'
import { bookingsToDbPayload, type ParagonPortalSlot } from '../utils/paragonPortalMappings'

describe('bookingsToDbPayload', () => {
  it('maps portal slots to DB RPC payload rows', () => {
    const bookings: ParagonPortalSlot[] = [
      { id: '2026-04-23-10-00', date: '2026-04-23', time: '10:00', testType: 'G', bookedCount: 3, capacity: 10 },
    ]

    expect(bookingsToDbPayload('cochin', bookings)).toEqual([
      {
        branch_location: 'cochin',
        slot_key: '2026-04-23-10-00',
        exam_date: '2026-04-23',
        start_time: '10:00',
        test_type: 'G',
        booked_count: 3,
        capacity: 10,
        source: 'paragon-test-centre-portal',
      },
    ])
  })
})
