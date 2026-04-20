import { describe, expect, it } from 'vitest'
import {
  buildDemoCalendarSessions,
  PARAGON_APR_JUN_2026_SESSIONS,
} from '../utils/paragonScheduleSync'

describe('buildDemoCalendarSessions', () => {
  it('maps raw session rows into demo calendar sessions', () => {
    const sessions = buildDemoCalendarSessions(PARAGON_APR_JUN_2026_SESSIONS)

    expect(sessions.length).toBe(PARAGON_APR_JUN_2026_SESSIONS.length)
    expect(sessions[0]).toEqual({
      id: 'paragon-2026-04-23-10:00',
      date: '2026-04-23',
      startTime: '10:00',
      endTime: '13:00',
      testType: 'G',
      bookedCapacity: 3,
      totalCapacity: 10,
      availableCapacity: 7,
      source: 'paragon-schedule',
    })
  })

  it('keeps only rows in Apr-Jun 2026 window', () => {
    const sessions = buildDemoCalendarSessions([
      ...PARAGON_APR_JUN_2026_SESSIONS,
      { date: '2026-03-30', startTime: '09:00', testType: 'G', bookedCapacity: 1, totalCapacity: 10 },
      { date: '2026-07-01', startTime: '09:00', testType: 'G', bookedCapacity: 1, totalCapacity: 10 },
    ])

    expect(sessions.every(s => s.date >= '2026-04-01' && s.date <= '2026-06-30')).toBe(true)
  })
})
