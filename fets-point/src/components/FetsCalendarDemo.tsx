import { useMemo, useState } from 'react'
import { CalendarDays, RefreshCw, Users, Info } from 'lucide-react'
import { formatDateForIST } from '../utils/dateUtils'
import { useParagonCelpipBookings } from '../hooks/useParagonCelpipBookings'
import { useParagonSyncRuns, type ParagonSyncDetails, type ParagonSyncRunRow } from '../hooks/useParagonSyncRuns'
import { useBranch } from '../hooks/useBranch'
import { useAuth } from '../hooks/useAuth'
import { LocationSelectorThread } from './LocationSelectorThread'
import { canSwitchBranches, getAvailableBranches } from '../utils/authUtils'

const MONTHS = [
  new Date(2026, 3, 1),
  new Date(2026, 4, 1),
  new Date(2026, 5, 1),
]

const formatMonthTitle = (date: Date) =>
  date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })

const formatTime = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayHour = h % 12 === 0 ? 12 : h % 12
  return `${displayHour}:${String(m).padStart(2, '0')} ${ampm}`
}

const formatHumanDate = (isoDate: string) => {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
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

/** Fallback when sync_details column is empty (older rows). */
const parseFallbackFromMessage = (message: string | null) => {
  const safe = message ?? ''
  const bookingDelta = Number((safe.match(/bookings delta ([+-]?\d+)/)?.[1] ?? '0'))
  const bookedTotal = Number((safe.match(/booked total (\d+)/)?.[1] ?? '0'))
  return { bookingDelta, bookedTotal }
}

const normalizeSyncDetails = (run: ParagonSyncRunRow | null): ParagonSyncDetails | null => {
  if (!run?.sync_details) return null
  const raw = run.sync_details as Record<string, unknown>
  if (typeof raw !== 'object' || raw === null) return null
  return {
    total_candidates_after: typeof raw.total_candidates_after === 'number' ? raw.total_candidates_after : undefined,
    additional_candidates_since_last_update:
      typeof raw.additional_candidates_since_last_update === 'number'
        ? raw.additional_candidates_since_last_update
        : undefined,
    test_days_with_changes: Array.isArray(raw.test_days_with_changes)
      ? (raw.test_days_with_changes as { date: string; change: number }[])
      : undefined,
  }
}

const branchLabel = (branch: string | null | undefined) => {
  if (!branch) return 'Unknown'
  if (branch === 'global') return 'All centres'
  return branch.charAt(0).toUpperCase() + branch.slice(1)
}

export function FetsCalendarDemo() {
  const { profile } = useAuth()
  const { activeBranch, setActiveBranch } = useBranch()
  const canSwitch = canSwitchBranches(profile?.email, profile?.role)
  const availableBranches = getAvailableBranches(profile?.email, profile?.role)

  const [monthIndex, setMonthIndex] = useState(0)

  const currentMonth = MONTHS[monthIndex]
  const days = useMemo(() => getDaysInMonthGrid(currentMonth), [currentMonth])
  const bookingsQuery = useParagonCelpipBookings(true, activeBranch === 'global', activeBranch)
  const syncRunsQuery = useParagonSyncRuns(true, activeBranch === 'global', activeBranch)
  const sessions = bookingsQuery.data ?? []
  const syncRuns = syncRunsQuery.data ?? []

  const totalCandidatesNow = useMemo(
    () => sessions.reduce((sum, row) => sum + row.booked_count, 0),
    [sessions],
  )

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, typeof sessions>()
    sessions.forEach(session => {
      const dateKey = String(session.exam_date).slice(0, 10)
      if (!map.has(dateKey)) map.set(dateKey, [])
      map.get(dateKey)!.push(session)
    })
    return map
  }, [sessions])

  const currentMonthTotal = useMemo(() => {
    const monthPrefix = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
    return sessions
      .filter(session => String(session.exam_date).startsWith(monthPrefix))
      .reduce((sum, session) => sum + session.booked_count, 0)
  }, [currentMonth, sessions])

  const latestRun = useMemo(() => syncRuns[0] ?? null, [syncRuns])

  const latestByBranch = useMemo(() => {
    if (activeBranch !== 'global') return []
    const map = new Map<string, ParagonSyncRunRow>()
    for (const run of syncRuns) {
      const key = run.branch_location ?? 'unknown'
      if (!map.has(key)) map.set(key, run)
    }
    return Array.from(map.values())
      .filter((run) => run.branch_location === 'cochin' || run.branch_location === 'calicut')
      .sort((a, b) => (a.branch_location ?? '').localeCompare(b.branch_location ?? ''))
  }, [activeBranch, syncRuns])

  const details = useMemo(() => normalizeSyncDetails(latestRun), [latestRun])
  const fallback = useMemo(() => parseFallbackFromMessage(latestRun?.message ?? null), [latestRun?.message])

  const totalAtLastUpdate = details?.total_candidates_after ?? fallback.bookedTotal
  const changeSinceLastRefresh =
    details?.additional_candidates_since_last_update ?? fallback.bookingDelta

  const daysChanged = details?.test_days_with_changes ?? []

  const changeLine = () => {
    if (changeSinceLastRefresh === undefined || Number.isNaN(changeSinceLastRefresh)) {
      return '—'
    }
    if (changeSinceLastRefresh === 0) {
      return 'No change in candidate numbers since the previous update.'
    }
    if (changeSinceLastRefresh > 0) {
      return `${changeSinceLastRefresh} more candidate${changeSinceLastRefresh === 1 ? '' : 's'} booked since the previous update.`
    }
    return `${Math.abs(changeSinceLastRefresh)} fewer candidate${changeSinceLastRefresh === -1 ? '' : 's'} since the previous update.`
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-[#0c0c0e] via-[#12121a] to-[#0a0a0c] text-zinc-100"
      style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
    >
      <div className="max-w-[1680px] mx-auto px-4 md:px-10 py-8 md:py-10">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8 mb-10 mt-20 md:mt-24">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="h-px w-14 bg-amber-400/80" />
              <span className="text-sm md:text-base font-semibold uppercase tracking-[0.18em] text-amber-300/90">
                CELPIP · Apr–Jun 2026
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.05]">
              CELPIP calendar
            </h1>
            <p className="text-base md:text-lg text-zinc-300 leading-relaxed max-w-2xl">
              Candidate counts from the test centre schedule. Numbers refresh automatically; use Refresh if you need the latest view right away.
            </p>
          </div>

          <div className="w-full xl:w-auto flex flex-wrap gap-3 items-stretch">
            <div className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-amber-300 min-w-[10rem]">
              <CalendarDays className="shrink-0 opacity-90" size={22} strokeWidth={2} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Test times shown</p>
                <p className="text-xl font-bold tabular-nums text-white">{sessions.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-amber-300 min-w-[10rem]">
              <Users className="shrink-0 opacity-90" size={22} strokeWidth={2} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">This month (candidates)</p>
                <p className="text-xl font-bold tabular-nums text-white">{currentMonthTotal}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                bookingsQuery.refetch()
                syncRunsQuery.refetch()
              }}
              disabled={bookingsQuery.isFetching || syncRunsQuery.isFetching}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black text-base font-bold shadow-lg shadow-amber-900/30 hover:brightness-105 disabled:opacity-55 disabled:cursor-not-allowed min-h-[3.25rem]"
            >
              <RefreshCw size={20} className={bookingsQuery.isFetching || syncRunsQuery.isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-8">
          <LocationSelectorThread
            activeBranch={activeBranch}
            setActiveBranch={setActiveBranch}
            availableBranches={availableBranches}
            canSwitch={canSwitch}
          />
        </div>

        {/* Update summary — plain language */}
        <section className="mb-8 rounded-2xl border border-white/12 bg-white/[0.04] backdrop-blur-sm p-6 md:p-8 shadow-xl shadow-black/20">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Latest update</h2>
              <p className="text-sm md:text-base text-zinc-400 mt-1">
                What changed since the last time the schedule was refreshed from the test centre.
              </p>
            </div>
            {latestRun?.created_at && (
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Updated</p>
                <p className="text-base md:text-lg font-semibold text-zinc-200">
                  {new Date(latestRun.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                <p className="text-sm text-zinc-500 mt-0.5">{branchLabel(latestRun.branch_location)}</p>
              </div>
            )}
          </div>

          {!latestRun && (
            <p className="text-base text-zinc-400">Waiting for the first schedule refresh to complete.</p>
          )}

          {latestRun && !latestRun.ok && (
            <p className="text-base text-rose-300">
              Something went wrong while refreshing: {latestRun.message ?? 'Unknown issue'}
            </p>
          )}

          {latestRun && latestRun.ok && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-black/25 p-5 md:p-6">
                <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">At last update</p>
                <p className="text-3xl md:text-4xl font-black tabular-nums text-white">
                  {totalAtLastUpdate ?? '—'}
                </p>
                <p className="text-sm text-zinc-400 mt-2">Total candidates (all listed test times)</p>
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-5 md:p-6">
                <p className="text-sm font-semibold text-amber-200/90 uppercase tracking-wide mb-2">Since previous update</p>
                <p className="text-base md:text-lg text-zinc-100 leading-snug">{changeLine()}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 md:p-6 md:col-span-2 lg:col-span-1">
                <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">Right now</p>
                <p className="text-3xl md:text-4xl font-black tabular-nums text-emerald-300">{totalCandidatesNow}</p>
                <p className="text-sm text-zinc-400 mt-2">Total candidates in this view (live)</p>
              </div>
            </div>
          )}

          {latestRun && latestRun.ok && daysChanged.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <Info size={18} className="text-amber-400/90 shrink-0" />
                Test days where candidate numbers moved in the last refresh
              </p>
              <ul className="flex flex-wrap gap-2.5">
                {daysChanged.map((row) => (
                  <li
                    key={row.date}
                    className="px-4 py-2 rounded-lg bg-white/[0.07] border border-white/10 text-sm md:text-base text-zinc-100"
                  >
                    <span className="font-semibold">{formatHumanDate(row.date)}</span>
                    <span className="text-zinc-500 mx-2">·</span>
                    <span className={row.change > 0 ? 'text-emerald-400' : row.change < 0 ? 'text-rose-300' : 'text-zinc-400'}>
                      {row.change > 0 ? `+${row.change}` : row.change}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {latestRun && latestRun.ok && daysChanged.length === 0 && changeSinceLastRefresh === 0 && (
            <p className="mt-6 text-sm text-zinc-500 border-t border-white/10 pt-5">
              No test days had a change in candidate numbers in the last refresh.
            </p>
          )}
        </section>

        {activeBranch === 'global' && latestByBranch.length > 0 && (
          <div className="mb-8 grid md:grid-cols-2 gap-4">
            {latestByBranch.map((run) => {
              const d = normalizeSyncDetails(run) ?? ({} as ParagonSyncDetails)
              const fb = parseFallbackFromMessage(run.message)
              const total = d.total_candidates_after ?? fb.bookedTotal
              const delta = d.additional_candidates_since_last_update ?? fb.bookingDelta
              const deltaText =
                delta === 0
                  ? 'No change since previous update'
                  : delta > 0
                    ? `+${delta} candidates vs previous update`
                    : `${delta} candidates vs previous update`
              return (
                <div
                  key={`${run.branch_location}-${run.id}`}
                  className="rounded-xl border border-white/10 bg-white/[0.05] p-5 md:p-6"
                >
                  <p className="text-lg font-bold text-amber-300">{branchLabel(run.branch_location)}</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    {new Date(run.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                  <p className="text-2xl font-black text-white mt-3 tabular-nums">{total ?? '—'} total</p>
                  <p className="text-base text-zinc-300 mt-2">{deltaText}</p>
                </div>
              )
            })}
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setMonthIndex(prev => Math.max(prev - 1, 0))}
            disabled={monthIndex === 0}
            className="px-5 py-2.5 text-sm md:text-base font-semibold rounded-xl border border-white/15 text-zinc-200 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <div className="px-6 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-lg md:text-xl font-bold text-amber-300">
            {formatMonthTitle(currentMonth)}
          </div>
          <button
            type="button"
            onClick={() => setMonthIndex(prev => Math.min(prev + 1, MONTHS.length - 1))}
            disabled={monthIndex === MONTHS.length - 1}
            className="px-5 py-2.5 text-sm md:text-base font-semibold rounded-xl border border-white/15 text-zinc-200 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <span className="ml-auto text-sm text-zinc-500 flex items-center gap-2">
            <RefreshCw size={16} className={bookingsQuery.isFetching || syncRunsQuery.isFetching ? 'animate-spin text-amber-400' : ''} />
            {bookingsQuery.dataUpdatedAt
              ? `Data loaded ${new Date(bookingsQuery.dataUpdatedAt).toLocaleString('en-IN')}`
              : 'Loading…'}
          </span>
        </div>

        <div className="rounded-2xl border border-white/12 overflow-hidden shadow-2xl bg-[#14141a]/80">
          <div className="grid grid-cols-7 border-b border-white/10 bg-[#1a1a22]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div
                key={day}
                className="py-4 md:py-5 text-center text-sm md:text-base font-bold uppercase tracking-[0.12em] text-zinc-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((date, idx) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[148px] md:min-h-[200px] lg:min-h-[220px] bg-black/20 border-b border-r border-white/[0.06]"
                  />
                )
              }

              const dateKey = formatDateForIST(date)
              const daySessions = sessionsByDate.get(dateKey) ?? []
              const totalBooked = daySessions.reduce((sum, session) => sum + session.booked_count, 0)

              return (
                <div
                  key={dateKey}
                  className="min-h-[148px] md:min-h-[200px] lg:min-h-[220px] p-2.5 md:p-3 border-b border-r border-white/[0.06] bg-[#16161e]/90"
                >
                  <div className="flex items-center justify-between mb-2 md:mb-3">
                    <span className="text-lg md:text-xl font-bold text-white">{date.getDate()}</span>
                    {totalBooked > 0 && (
                      <span className="text-xs md:text-sm px-2 py-1 rounded-md bg-amber-400 text-black font-bold tabular-nums">
                        {totalBooked}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {daySessions.map(session => (
                      <div
                        key={`${session.branch_location}|${session.slot_key}`}
                        className="rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-2.5 py-2 md:px-3 md:py-2.5"
                      >
                        <div className="text-sm md:text-base font-bold text-amber-200">
                          {formatTime(session.start_time)} · {session.test_type || 'G'}
                        </div>
                        <div className="text-sm md:text-base text-zinc-200 font-medium mt-0.5">
                          {session.booked_count} / {session.capacity} candidates
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
