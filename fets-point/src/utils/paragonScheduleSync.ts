export interface ParagonScheduleRow {
  date: string
  startTime: string
  testType: string
  bookedCapacity: number
  totalCapacity: number
}

export interface DemoCalendarSession {
  id: string
  date: string
  startTime: string
  endTime: string
  testType: string
  bookedCapacity: number
  totalCapacity: number
  availableCapacity: number
  source: 'paragon-schedule'
}

export const PARAGON_APR_JUN_2026_SESSIONS: ParagonScheduleRow[] = [
  { date: '2026-04-23', startTime: '10:00', testType: 'G', bookedCapacity: 3, totalCapacity: 10 },
  { date: '2026-04-23', startTime: '14:00', testType: 'G', bookedCapacity: 1, totalCapacity: 10 },
  { date: '2026-04-24', startTime: '10:00', testType: 'G', bookedCapacity: 2, totalCapacity: 10 },
  { date: '2026-04-25', startTime: '10:00', testType: 'G', bookedCapacity: 1, totalCapacity: 10 },
  { date: '2026-04-28', startTime: '14:00', testType: 'G', bookedCapacity: 1, totalCapacity: 10 },
  { date: '2026-05-02', startTime: '10:00', testType: 'G', bookedCapacity: 1, totalCapacity: 10 },
  { date: '2026-05-03', startTime: '10:00', testType: 'G', bookedCapacity: 1, totalCapacity: 10 },
  { date: '2026-05-09', startTime: '14:00', testType: 'G', bookedCapacity: 1, totalCapacity: 10 },
  { date: '2026-05-10', startTime: '10:00', testType: 'G', bookedCapacity: 1, totalCapacity: 10 },
  { date: '2026-05-11', startTime: '10:00', testType: 'G', bookedCapacity: 1, totalCapacity: 10 },
  { date: '2026-05-16', startTime: '14:00', testType: 'G', bookedCapacity: 1, totalCapacity: 10 },
  { date: '2026-05-21', startTime: '14:00', testType: 'G', bookedCapacity: 1, totalCapacity: 5 },
  { date: '2026-05-23', startTime: '10:00', testType: 'G', bookedCapacity: 1, totalCapacity: 5 },
]

const WINDOW_START = '2026-04-01'
const WINDOW_END = '2026-06-30'

const addHours = (startTime: string, hours: number) => {
  const [h, m] = startTime.split(':').map(Number)
  const endHour = String((h + hours) % 24).padStart(2, '0')
  return `${endHour}:${String(m).padStart(2, '0')}`
}

export const buildDemoCalendarSessions = (rows: ParagonScheduleRow[]): DemoCalendarSession[] => {
  return rows
    .filter(row => row.date >= WINDOW_START && row.date <= WINDOW_END)
    .map(row => ({
      id: `paragon-${row.date}-${row.startTime}`,
      date: row.date,
      startTime: row.startTime,
      endTime: addHours(row.startTime, 3),
      testType: row.testType,
      bookedCapacity: row.bookedCapacity,
      totalCapacity: row.totalCapacity,
      availableCapacity: Math.max(row.totalCapacity - row.bookedCapacity, 0),
      source: 'paragon-schedule',
    }))
}

export const fetchParagonDemoSessions = async (): Promise<DemoCalendarSession[]> => {
  await new Promise(resolve => setTimeout(resolve, 450))
  return buildDemoCalendarSessions(PARAGON_APR_JUN_2026_SESSIONS)
}
