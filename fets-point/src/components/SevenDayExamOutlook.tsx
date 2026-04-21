import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Users, Clock, UserCircle2 } from 'lucide-react'
import { formatBranchName } from '../utils/authUtils'
import { createISTDate, formatDateForIST, getCurrentISTDateString } from '../utils/dateUtils'

type SessionRow = {
  id?: number
  date: string
  client_name: string
  exam_name: string
  candidate_count?: number
  start_time?: string
  end_time?: string
  branch_location?: string | null
}

function formatTime12(t?: string) {
  if (!t) return '—'
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr ?? '00'
  if (Number.isNaN(h)) return t
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${m.padStart(2, '0')} ${ampm}`
}

function buildSevenDayKeys(): string[] {
  const today = getCurrentISTDateString()
  const base = createISTDate(today)
  const keys: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    keys.push(formatDateForIST(d))
  }
  return keys
}

function dayHeaderLabel(ymd: string, todayYmd: string) {
  const d = createISTDate(ymd)
  const wd = d.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' })
  const dayNum = d.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })
  const mon = d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })
  const isToday = ymd === todayYmd
  return { weekday: wd, dayNum, mon, isToday }
}

function clientAccentClass(client: string) {
  const u = client.toUpperCase()
  if (u.includes('PEARSON') || u.includes('VUE')) return 'border-l-sky-400 bg-sky-500/10'
  if (u.includes('PROMETRIC')) return 'border-l-amber-400 bg-amber-500/10'
  if (u.includes('CELPIP')) return 'border-l-teal-400 bg-teal-500/10'
  if (u.includes('CMA')) return 'border-l-pink-400 bg-pink-500/10'
  if (u.includes('PSI')) return 'border-l-violet-400 bg-violet-500/10'
  if (u.includes('IELTS')) return 'border-l-indigo-400 bg-indigo-500/10'
  return 'border-l-zinc-500 bg-white/[0.04]'
}

export function SevenDayExamOutlook({
  sessions,
  isLoading,
  activeBranch,
  staffByDate,
  staffLoading,
}: {
  sessions: SessionRow[]
  isLoading: boolean
  activeBranch: string
  staffByDate: Record<string, string[]>
  staffLoading: boolean
}) {
  const todayYmd = getCurrentISTDateString()
  const dayKeys = useMemo(() => buildSevenDayKeys(), [todayYmd])

  const byDate = useMemo(() => {
    const map = new Map<string, SessionRow[]>()
    dayKeys.forEach((k) => map.set(k, []))
    for (const s of sessions) {
      const d = s.date
      if (!map.has(d)) continue
      map.get(d)!.push(s)
    }
    return map
  }, [sessions, dayKeys])

  const subtitle =
    activeBranch === 'global'
      ? 'All centres · next seven days (India time)'
      : `${formatBranchName(activeBranch)} · next seven days (India time)`

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="relative overflow-hidden rounded-[28px] border border-white/[0.1] bg-gradient-to-b from-[#16161c] via-[#121218] to-[#0e0e12] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
      aria-label="Seven day exam outlook"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(250,204,21,0.12),transparent_55%)]" />

      <div className="relative px-5 pt-7 pb-5 md:px-8 md:pt-8 md:pb-6 border-b border-white/[0.07]">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#FACC15]/12 border border-[#FACC15]/25 flex items-center justify-center shrink-0 shadow-inner">
              <Calendar size={24} className="text-[#FACC15]" aria-hidden />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight leading-tight">
                This week at a glance
              </h2>
              <p className="text-sm md:text-base text-zinc-400 font-medium mt-2 max-w-2xl leading-relaxed">
                {subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile / tablet: stacked cards · Desktop: single 7-column row */}
      <div className="relative grid grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-7 lg:gap-0 lg:p-0 lg:divide-x lg:divide-white/[0.08]">
        {dayKeys.map((ymd) => {
          const { weekday, dayNum, mon, isToday } = dayHeaderLabel(ymd, todayYmd)
          const daySessions = byDate.get(ymd) || []
          const rosterNames = staffByDate[ymd] || []

          const byClient = new Map<string, SessionRow[]>()
          for (const s of daySessions) {
            const key = (s.client_name || 'Other').trim() || 'Other'
            if (!byClient.has(key)) byClient.set(key, [])
            byClient.get(key)!.push(s)
          }
          const clients = Array.from(byClient.keys()).sort((a, b) => a.localeCompare(b))
          for (const c of clients) {
            byClient.get(c)!.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
          }

          const dayCandidateTotal = daySessions.reduce((s, r) => s + (r.candidate_count ?? 0), 0)

          return (
            <div
              key={ymd}
              className={`
                flex flex-col min-h-0 rounded-2xl border border-white/[0.1] bg-white/[0.03] shadow-[0_8px_32px_rgba(0,0,0,0.35)]
                lg:rounded-none lg:border-0 lg:border-r lg:border-white/[0.08] lg:shadow-none lg:bg-transparent lg:last:border-r-0
                lg:min-h-[480px] xl:min-h-[520px]
              `}
            >
              <div
                className={`
                  shrink-0 px-5 py-4 md:px-5 md:py-4 border-b border-white/[0.08]
                  ${isToday ? 'bg-[#FACC15]/[0.1]' : 'bg-black/25 lg:bg-black/20'}
                `}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">{weekday}</p>
                    <p className="text-2xl md:text-3xl font-black text-white tabular-nums leading-none mt-1">
                      {dayNum}{' '}
                      <span className="text-lg md:text-xl font-bold text-zinc-400">{mon}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isToday && (
                      <span className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full bg-[#FACC15]/20 text-[#FECC2F] border border-[#FACC15]/35">
                        Today
                      </span>
                    )}
                    {dayCandidateTotal > 0 && (
                      <span className="text-xs md:text-sm font-bold tabular-nums px-3 py-1.5 rounded-full bg-white/10 text-zinc-200 border border-white/10">
                        {dayCandidateTotal} candidates
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-[200px] max-h-[52vh] lg:max-h-none lg:min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4 md:px-5 md:py-5 space-y-4 touch-pan-y [-webkit-overflow-scrolling:touch]">
                {isLoading ? (
                  <p className="text-base text-zinc-500 font-medium text-center py-12">Loading schedule…</p>
                ) : clients.length === 0 ? (
                  <p className="text-base text-zinc-500 font-medium text-center py-12">No exams scheduled</p>
                ) : (
                  clients.map((client) => {
                    const rows = byClient.get(client)!
                    return (
                      <div
                        key={client}
                        className={`rounded-xl border border-white/[0.08] pl-4 pr-3 py-3 md:py-4 border-l-4 ${clientAccentClass(client)}`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm md:text-base font-bold uppercase tracking-wide text-[#FACC15]/95">
                            {client}
                          </span>
                        </div>
                        <ul className="space-y-4">
                          {rows.map((row) => (
                            <li
                              key={row.id ?? `${row.date}-${row.start_time}-${row.exam_name}`}
                              className="border-t border-white/[0.06] pt-4 first:border-t-0 first:pt-0"
                            >
                              <div className="text-base md:text-[17px] font-semibold text-white leading-snug">
                                {row.exam_name || 'Exam'}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm md:text-base text-zinc-400">
                                <span className="inline-flex items-center gap-2 font-medium">
                                  <Users size={18} className="text-[#FACC15]/80 shrink-0" />
                                  <span className="text-zinc-200">{row.candidate_count ?? 0} candidates</span>
                                </span>
                                <span className="inline-flex items-center gap-2 font-medium">
                                  <Clock size={18} className="text-[#FACC15]/80 shrink-0" />
                                  {formatTime12(row.start_time)}
                                  {row.end_time ? ` – ${formatTime12(row.end_time)}` : ''}
                                </span>
                              </div>
                              {activeBranch === 'global' && row.branch_location && (
                                <div className="text-xs md:text-sm font-semibold uppercase tracking-wider text-zinc-500 mt-2">
                                  {formatBranchName(String(row.branch_location))}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="shrink-0 border-t border-white/[0.1] bg-black/35 px-4 py-4 md:px-5 md:py-5 mt-auto">
                <div className="flex items-center gap-2.5 mb-3">
                  <UserCircle2 size={20} className="text-[#FACC15]/90 shrink-0" aria-hidden />
                  <span className="text-sm md:text-base font-bold text-white tracking-tight">People on roster</span>
                </div>
                <p className="text-xs md:text-sm text-zinc-500 font-medium mb-3">
                  {activeBranch === 'global' ? 'All centres' : formatBranchName(activeBranch)}
                </p>
                {staffLoading ? (
                  <div className="text-sm text-zinc-500 font-medium py-1">Loading roster…</div>
                ) : rosterNames.length === 0 ? (
                  <div className="text-sm md:text-base text-zinc-500 font-medium py-1">No one rostered for duty</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {rosterNames.map((name) => (
                      <span
                        key={`${ymd}-${name}`}
                        className="inline-flex items-center px-3.5 py-2 rounded-full text-sm md:text-[15px] font-semibold text-zinc-100 bg-white/[0.08] border border-white/[0.12]"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </motion.section>
  )
}
