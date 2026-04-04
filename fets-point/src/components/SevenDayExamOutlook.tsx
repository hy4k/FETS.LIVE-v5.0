import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Users, Clock } from 'lucide-react'
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

const EXAM_COLORS: Record<string, { border: string; text: string; dot: string; bg: string }> = {
  PROMETRIC: { border: 'rgba(59,130,246,0.45)', text: '#93c5fd', dot: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  PEARSON: { border: 'rgba(139,92,246,0.45)', text: '#c4b5fd', dot: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  PSI: { border: 'rgba(16,185,129,0.45)', text: '#6ee7b7', dot: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  IELTS: { border: 'rgba(245,158,11,0.45)', text: '#fcd34d', dot: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  CELPIP: { border: 'rgba(20,184,166,0.45)', text: '#5eead4', dot: '#14b8a6', bg: 'rgba(20,184,166,0.08)' },
  CMA: { border: 'rgba(236,72,153,0.45)', text: '#f9a8d4', dot: '#ec4899', bg: 'rgba(236,72,153,0.08)' },
  DEFAULT: { border: 'rgba(148,163,184,0.35)', text: '#cbd5e1', dot: '#64748b', bg: 'rgba(100,116,139,0.08)' },
}

function clientAccent(clientName: string) {
  const u = (clientName || '').toUpperCase()
  if (u.includes('PROMETRIC')) return EXAM_COLORS.PROMETRIC
  if (u.includes('PEARSON') || u.includes('VUE')) return EXAM_COLORS.PEARSON
  if (u.includes('PSI')) return EXAM_COLORS.PSI
  if (u.includes('IELTS')) return EXAM_COLORS.IELTS
  if (u.includes('CELPIP')) return EXAM_COLORS.CELPIP
  if (u.includes('CMA')) return EXAM_COLORS.CMA
  return EXAM_COLORS.DEFAULT
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
}: {
  sessions: SessionRow[]
  isLoading: boolean
  activeBranch: string
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
          <div className="w-9 h-9 rounded-sm bg-[#FACC15]/10 border border-[#FACC15]/25 flex items-center justify-center">
            <Calendar size={16} className="text-[#FACC15]" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] leading-none">7-Day Exam Outlook</h2>
            <p className="text-[9px] text-[#FACC15]/55 uppercase tracking-widest font-bold mt-1.5">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-white/[0.08] bg-gradient-to-b from-[#141416] to-[#0c0c0d] overflow-hidden shadow-[0_0_0_1px_rgba(250,204,21,0.04)]">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center gap-3 text-white/40 text-xs font-bold uppercase tracking-widest">
            <div className="w-5 h-5 border-2 border-white/10 border-t-[#FACC15] rounded-full animate-spin" />
            Loading schedule…
          </div>
        ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory md:snap-none scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pb-1">
            {dayKeys.map((ymd) => {
              const { line1, line2, isToday } = dayHeaderLabel(ymd, todayYmd)
              const daySessions = byDate.get(ymd) || []

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
                  className="snap-start shrink-0 w-[min(100%,200px)] md:flex-1 md:min-w-0 border-r border-white/[0.06] last:border-r-0 flex flex-col min-h-[280px] md:min-h-[320px]"
                >
                  <div
                    className={`px-3 py-2.5 border-b border-white/[0.06] ${
                      isToday ? 'bg-[#FACC15]/[0.07]' : 'bg-black/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black text-white/90 uppercase tracking-wider leading-tight">{line1}</span>
                      {isToday && (
                        <span className="text-[7px] font-black uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-sm bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/35">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="text-[8px] font-bold text-white/35 uppercase tracking-[0.2em] mt-0.5">{line2}</div>
                  </div>

                  <div className="flex-1 p-2 space-y-3 overflow-y-auto max-h-[340px]">
                    {clients.length === 0 ? (
                      <p className="text-[9px] text-white/25 font-bold uppercase tracking-widest text-center pt-6 px-1">No exams</p>
                    ) : (
                      clients.map((client) => {
                        const accent = clientAccent(client)
                        const rows = byClient.get(client)!
                        return (
                          <div key={client} className="rounded-sm border p-2" style={{ borderColor: accent.border, background: accent.bg }}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent.dot }} />
                              <span className="text-[9px] font-black uppercase tracking-wide leading-tight" style={{ color: accent.text }}>
                                {client}
                              </span>
                            </div>
                            <ul className="space-y-2">
                              {rows.map((row) => (
                                <li key={row.id ?? `${row.date}-${row.start_time}-${row.exam_name}`} className="text-[8px] leading-snug border-t border-white/[0.06] pt-2 first:border-t-0 first:pt-0">
                                  <div className="font-bold text-white/85 line-clamp-2">{row.exam_name || 'Exam'}</div>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-white/45">
                                    <span className="inline-flex items-center gap-0.5 font-bold">
                                      <Users size={9} className="opacity-50 shrink-0" />
                                      {row.candidate_count ?? 0} pax
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 font-bold">
                                      <Clock size={9} className="opacity-50 shrink-0" />
                                      {formatTime12(row.start_time)}
                                      {row.end_time ? ` – ${formatTime12(row.end_time)}` : ''}
                                    </span>
                                  </div>
                                  {activeBranch === 'global' && row.branch_location && (
                                    <div className="text-[7px] font-bold uppercase tracking-widest text-[#FACC15]/50 mt-1">
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.section>
  )
}
