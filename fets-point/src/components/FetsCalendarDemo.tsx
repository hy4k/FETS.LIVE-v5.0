import { useMemo, useState } from 'react'
import { CalendarDays, DownloadCloud, Loader2, RefreshCw, Users } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { formatDateForIST } from '../utils/dateUtils'
import { DemoCalendarSession, fetchParagonDemoSessions } from '../utils/paragonScheduleSync'

const MONTHS = [
  new Date(2026, 3, 1), // April
  new Date(2026, 4, 1), // May
  new Date(2026, 5, 1), // June
]

const formatMonthTitle = (date: Date) =>
  date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })

const formatTime = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayHour = h % 12 === 0 ? 12 : h % 12
  return `${displayHour}:${String(m).padStart(2, '0')} ${ampm}`
}

const getDaysInMonthGrid = (currentMonth: Date) => {
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
  const days: (Date | null)[] = []

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    days.push(null)
  }
  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
  }
  return days
}

export function FetsCalendarDemo() {
  const [monthIndex, setMonthIndex] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [sessions, setSessions] = useState<DemoCalendarSession[]>([])
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const currentMonth = MONTHS[monthIndex]
  const days = useMemo(() => getDaysInMonthGrid(currentMonth), [currentMonth])

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, DemoCalendarSession[]>()
    sessions.forEach(session => {
      if (!map.has(session.date)) map.set(session.date, [])
      map.get(session.date)!.push(session)
    })
    return map
  }, [sessions])

  const currentMonthTotal = useMemo(() => {
    const monthPrefix = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
    return sessions
      .filter(session => session.date.startsWith(monthPrefix))
      .reduce((sum, session) => sum + session.bookedCapacity, 0)
  }, [currentMonth, sessions])

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      const nextSessions = await fetchParagonDemoSessions()
      setSessions(nextSessions)
      setLastSyncedAt(new Date().toISOString())
      toast.success(`Loaded ${nextSessions.length} schedule sessions into demo calendar`)
    } catch (error) {
      console.error(error)
      toast.error('Failed to sync demo sessions')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-screen sovereign-theme" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6 mt-24">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-[1px] w-12 bg-[#FACC15]" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#FACC15]">
                Demo Sync // Paragon Schedule (Apr-Jun 2026)
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-[#FACC15] tracking-tighter leading-none">
              FETS CALENDAR DEMO
            </h1>
            <p className="mt-2 text-[#FACC15]/60 text-xs tracking-[0.14em] uppercase font-semibold">
              Local state only - non persistent
            </p>
          </div>

          <div className="w-full lg:w-auto flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0B] border border-white/10 text-[#f6c810] rounded-lg text-xs font-bold">
              <CalendarDays size={12} />
              {sessions.length} sessions
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0B] border border-white/10 text-[#f6c810] rounded-lg text-xs font-bold">
              <Users size={12} />
              {currentMonthTotal} booked this month
            </div>
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="px-4 py-2.5 bg-gradient-to-r from-[#f6c810] to-[#eab308] hover:brightness-110 text-black rounded-lg text-xs font-black tracking-wide flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <DownloadCloud size={14} />}
              Sync Now
            </button>
          </div>
        </div>

        <div className="mb-5 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setMonthIndex(prev => Math.max(prev - 1, 0))}
            disabled={monthIndex === 0}
            className="px-4 py-2 text-xs font-bold rounded-lg border border-white/15 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <div className="px-4 py-2 bg-[#0A0A0B] border border-white/10 rounded-lg text-sm font-black tracking-wide text-[#FACC15]">
            {formatMonthTitle(currentMonth)}
          </div>
          <button
            onClick={() => setMonthIndex(prev => Math.min(prev + 1, MONTHS.length - 1))}
            disabled={monthIndex === MONTHS.length - 1}
            className="px-4 py-2 text-xs font-bold rounded-lg border border-white/15 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
          {lastSyncedAt && (
            <span className="ml-auto text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <RefreshCw size={12} />
              Last synced {new Date(lastSyncedAt).toLocaleString('en-IN')}
            </span>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-[#121214]">
          <div className="grid grid-cols-7 border-b border-white/10 bg-[#0A0A0B]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-3 text-center text-[11px] font-bold uppercase tracking-widest text-white/60">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((date, idx) => {
              if (!date) {
                return <div key={`empty-${idx}`} className="min-h-[120px] bg-[#0A0A0B]/50 border-b border-r border-white/5" />
              }

              const dateKey = formatDateForIST(date)
              const daySessions = sessionsByDate.get(dateKey) ?? []
              const totalBooked = daySessions.reduce((sum, session) => sum + session.bookedCapacity, 0)

              return (
                <div key={dateKey} className="min-h-[120px] p-2 border-b border-r border-white/5 bg-[#121214]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-white/75">{date.getDate()}</span>
                    {totalBooked > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f6c810] text-black font-black">
                        {totalBooked}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {daySessions.map(session => (
                      <div key={session.id} className="rounded-md border border-[#f6c810]/30 bg-[#f6c810]/10 px-2 py-1 text-[10px]">
                        <div className="font-black text-[#f6c810] tracking-wide">
                          {formatTime(session.startTime)} ({session.testType})
                        </div>
                        <div className="text-[#f6c810]/90 font-semibold">
                          {session.bookedCapacity}/{session.totalCapacity} booked
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FetsCalendarDemo
