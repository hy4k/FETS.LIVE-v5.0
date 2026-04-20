export type ParagonPortalSlot = {
  id: string
  date: string
  time: string
  testType: string
  bookedCount: number
  capacity: number
}

export type ParagonDbSlotRow = {
  branch_location: 'cochin' | 'calicut'
  slot_key: string
  exam_date: string
  start_time: string
  test_type: string
  booked_count: number
  capacity: number
  source: string
}

export const bookingsToDbPayload = (branch_location: 'cochin' | 'calicut', bookings: ParagonPortalSlot[]): ParagonDbSlotRow[] => {
  return bookings.map((b) => ({
    branch_location,
    slot_key: b.id,
    exam_date: b.date,
    start_time: b.time,
    test_type: b.testType,
    booked_count: b.bookedCount,
    capacity: b.capacity,
    source: 'paragon-test-centre-portal',
  }))
}
