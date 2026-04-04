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
  const wd = d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })
  const dayNum = d.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })
  const mon = d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })
  const isToday = ymd === todayYmd
  return { line1: `${wd} ${dayNum}`, line2: mon, isToday }
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
      ? 'All centres · next 7 days (IST)'
      : `${formatBranchName(activeBranch)} · next 7 days (IST)`

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mb-12 w-full"
      aria-label="Seven day exam outlook"
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5 px-0.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-[#FACC15]/10 border border-[#FACC15]/30 flex items-center justify-center">
            <Calendar size={18} className="text-[#FACC15]" aria-hidden />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-black text-white uppercase tracking-[0.18em] leading-tight">
              7-Day Exam Outlook
            </h2>
            <p className="text-xs md:text-sm text-[#FACC15]/65 uppercase tracking-widest font-bold mt-1.5">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#FACC15]/15 bg-gradient-to-b from-[#161618] via-[#121214] to-[#0a0a0b] overflow-hidden shadow-[inset_0_1px_0_rgba(250,204,21,0.06)]">
        <div className="flex overflow-x-auto snap-x snap-mandatory md:snap-none scrollbar-thin scrollbar-thumb-[#FACC15]/20 scrollbar-track-transparent">
            {dayKeys.map((ymd) => {
              const { line1, line2, isToday } = dayHeaderLabel(ymd, todayYmd)
              const daySessions = byDate.get(ymd) || []
              const staffFirstNames = staffByDate[ymd] || []

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

              return (
                <div
                  key={ymd}
                  className="snap-start shrink-0 w-[min(100%,240px)] md:flex-1 md:min-w-0 border-r border-[#FACC15]/10 last:border-r-0 flex flex-col min-h-[400px] md:min-h-[440px]"
                >
                  <div
                    className={`shrink-0 px-3 py-3 border-b border-[#FACC15]/10 ${
                      isToday ? 'bg-[#FACC15]/[0.09]' : 'bg-black/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-white uppercase tracking-wide leading-tight">{line1}</span>
                      {isToday && (
                        <span className="text-[10px] font-black uppercase tracking-[0.12em] px-2 py-0.5 rounded-md bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/40">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-white/45 uppercase tracking-[0.15em] mt-1">{line2}</div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                    {isLoading ? (
                      <p className="text-sm text-white/35 font-semibold text-center pt-8 px-1">Loading exams…</p>
                    ) : clients.length === 0 ? (
                      <p className="text-sm text-white/35 font-semibold text-center pt-8 px-1">No exams scheduled</p>
                    ) : (
                      clients.map((client) => {
                        const rows = byClient.get(client)!
                        return (
                          <div
                            key={client}
                            className="rounded-md border border-white/[0.08] bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                          >
                            <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-white/[0.06]">
                              <span className="w-2 h-2 rounded-full bg-[#FACC15] shrink-0 shadow-[0_0_8px_rgba(250,204,21,0.35)]" />
                              <span className="text-xs md:text-sm font-black uppercase tracking-wide text-[#FACC15] leading-tight">
                                {client}
                              </span>
                            </div>
                            <ul className="space-y-3">
                              {rows.map((row) => (
                                <li
                                  key={row.id ?? `${row.date}-${row.start_time}-${row.exam_name}`}
                                  className="border-t border-white/[0.05] pt-3 first:border-t-0 first:pt-0"
                                >
                                  <div className="text-sm md:text-[15px] font-bold text-white leading-snug">
                                    {row.exam_name || 'Exam'}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs md:text-sm text-white/55 font-semibold">
                                    <span className="inline-flex items-center gap-1">
                                      <Users size={14} className="text-[#FACC15]/70 shrink-0" />
                                      {row.candidate_count ?? 0} candidates
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <Clock size={14} className="text-[#FACC15]/70 shrink-0" />
                                      {formatTime12(row.start_time)}
                                      {row.end_time ? ` – ${formatTime12(row.end_time)}` : ''}
                                    </span>
                                  </div>
                                  {activeBranch === 'global' && row.branch_location && (
                                    <div className="text-[11px] font-bold uppercase tracking-widest text-[#FACC15]/45 mt-2">
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

                  <div className="shrink-0 border-t border-[#FACC15]/15 bg-black/35 p-3 mt-auto">
                    <div className="flex items-center gap-2 mb-2 text-[#FACC15]/75">
                      <UserCircle2 size={15} className="shrink-0" aria-hidden />
                      <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em]">Staff on site</span>
                    </div>
                    {staffLoading ? (
                      <div className="text-xs text-white/40 font-medium">Loading…</div>
                    ) : staffFirstNames.length === 0 ? (
                      <div className="text-xs md:text-sm text-white/40 font-medium">No check-ins</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {staffFirstNames.map((name) => (
                          <span
                            key={`${ymd}-${name}`}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs md:text-sm font-semibold text-white/90 bg-[#FACC15]/[0.08] border border-[#FACC15]/20"
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
      </div>
    </motion.section>
  )
}
