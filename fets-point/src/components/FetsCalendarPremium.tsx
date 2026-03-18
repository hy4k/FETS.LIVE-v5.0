import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Calendar, Plus, ChevronLeft, ChevronRight, Edit, Trash2, X, Check,
  Clock, Users, Eye, MapPin, Building, Filter, TrendingUp, Search,
  Grid3x3, Columns, AlignJustify, Tag, Zap, CheckCircle2, XCircle,
  AlertCircle, Loader2, User, ChevronDown, LayoutGrid
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarAnalysis } from './CalendarAnalysis'
import { useAuth } from '../hooks/useAuth'
import { useBranch } from '../hooks/useBranch'
import { useBranchFilter } from '../hooks/useBranchFilter'
import {
  formatDateForIST, getCurrentISTDateString,
  isToday as isTodayIST, formatDateForDisplay
} from '../utils/dateUtils'
import { validateSessionCapacity } from '../utils/sessionUtils'
import { useCalendarSessions, useSessionMutations } from '../hooks/useCalendarSessions'
import { useClients, useClientExams } from '../hooks/useClients'
import { toast } from 'react-hot-toast'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Session {
  id?: number
  client_name: string
  exam_name: string
  date: string
  candidate_count: number
  start_time: string
  end_time: string
  assigned_staff?: string
  user_id: string
  created_at?: string
  updated_at?: string
  branch_location?: string
  status?: string
}

type CalendarViewMode = 'month' | 'week' | 'day'

// ─── Dark Theme Exam Colors ───────────────────────────────────────────────────
const EXAM_COLORS: Record<string, {
  bg: string; text: string; border: string; dot: string; badge: string; badgeText: string
}> = {
  'PROMETRIC': {
    bg: 'rgba(246,200,16,0.1)',     text: '#f6c810',
    border: 'rgba(246,200,16,0.3)', dot: '#f6c810',
    badge: 'rgba(246,200,16,0.2)',   badgeText: '#f6c810'
  },
  'PEARSON': {
    bg: 'rgba(246,200,16,0.1)',    text: '#f6c810',
    border: 'rgba(246,200,16,0.3)',dot: '#f6c810',
    badge: 'rgba(246,200,16,0.2)',  badgeText: '#f6c810'
  },
  'PSI': {
    bg: 'rgba(246,200,16,0.1)',     text: '#f6c810',
    border: 'rgba(246,200,16,0.3)', dot: '#f6c810',
    badge: 'rgba(246,200,16,0.2)',   badgeText: '#f6c810'
  },
  'CELPIP': {
    bg: 'rgba(246,200,16,0.1)',    text: '#f6c810',
    border: 'rgba(246,200,16,0.3)',dot: '#f6c810',
    badge: 'rgba(246,200,16,0.2)', badgeText: '#f6c810'
  },
  'CMA': {
    bg: 'rgba(246,200,16,0.1)',     text: '#f6c810',
    border: 'rgba(246,200,16,0.3)', dot: '#f6c810',
    badge: 'rgba(246,200,16,0.2)',   badgeText: '#f6c810'
  },
  'ITTS': {
    bg: 'rgba(246,200,16,0.1)',    text: '#f6c810',
    border: 'rgba(246,200,16,0.3)',dot: '#f6c810',
    badge: 'rgba(246,200,16,0.2)', badgeText: '#f6c810'
  },
  'OTHER': {
    bg: 'rgba(246,200,16,0.1)',       text: '#f6c810',
    border: 'rgba(246,200,16,0.3)',  dot: '#f6c810',
    badge: 'rgba(246,200,16,0.2)',    badgeText: '#f6c810'
  },
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
  'scheduled':   { bg: 'rgba(56,189,248,0.1)',  text: '#38bdf8', label: 'Scheduled',   icon: <Clock size={10} /> },
  'in_progress': { bg: 'rgba(52,211,153,0.1)',  text: '#34d399', label: 'In Progress', icon: <Zap size={10} /> },
  'completed':   { bg: 'rgba(255,255,255,0.05)',text: '#9ca3af', label: 'Completed',   icon: <CheckCircle2 size={10} /> },
  'cancelled':   { bg: 'rgba(251,113,133,0.1)', text: '#fb7185', label: 'Cancelled',   icon: <XCircle size={10} /> },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalizeClientName = (name: string): string => {
  const u = name.toUpperCase()
  if (u.includes('PEARSON') || u.includes('VUE')) return 'PEARSON'
  if (u.includes('CELPIP'))    return 'CELPIP'
  if (u.includes('CMA'))       return 'CMA'
  if (u.includes('PROMETRIC')) return 'PROMETRIC'
  if (u.includes('PSI'))       return 'PSI'
  if (u.includes('ITTS'))      return 'ITTS'
  if (u.includes('IELTS'))     return 'IELTS'
  return 'OTHER'
}

const getExamColor = (clientName: string) =>
  EXAM_COLORS[normalizeClientName(clientName)] ?? EXAM_COLORS['OTHER']

const getShortClient = (name: string) => {
  const n = name.toUpperCase()
  if (n.includes('PEARSON') || n.includes('VUE')) return 'PV'
  if (n.includes('PROMETRIC')) return 'PRO'
  if (n.includes('PSI'))       return 'PSI'
  if (n.includes('ITTS'))      return 'ITTS'
  if (n.includes('CELPIP'))    return 'CEL'
  if (n.includes('CMA'))       return 'CMA'
  if (n.includes('IELTS'))     return 'IELTS'
  return n.slice(0, 4)
}

const formatTime = (time: string) => {
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${m} ${ampm}`
}

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function FetsCalendarPremium() {
  const { user, hasPermission, profile } = useAuth()
  const canEdit = hasPermission('calendar_edit')
  const { activeBranch } = useBranch()
  const { applyFilter, isGlobalView } = useBranchFilter()

  // Date/View state
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Filter/search state
  const [locationFilter, setLocationFilter] = useState(activeBranch || 'all')
  const [searchQuery, setSearchQuery] = useState('')
  const [examTypeFilter, setExamTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)

  const [formData, setFormData] = useState({
    client_name: '', exam_name: '', date: '',
    candidate_count: 1, start_time: '09:00', end_time: '17:00', status: 'scheduled'
  })

  useEffect(() => { setLocationFilter(activeBranch || 'all') }, [activeBranch])

  const sessionBranch = locationFilter === 'all' ? 'global' : locationFilter
  const { data: sessions = [], isLoading: loading, isError, error } = useCalendarSessions(
    currentDate, sessionBranch as any, applyFilter, isGlobalView
  )
  const { data: dbClients = [] } = useClients()
  const { data: dbExams = [] } = useClientExams()
  const { addSession, updateSession, deleteSession, isMutating } = useSessionMutations()

  useEffect(() => {
    if (isError) toast.error(`Failed to load sessions: ${(error as Error).message}`)
  }, [isError, error])

  // ── Computed ──────────────────────────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match = s.client_name.toLowerCase().includes(q) ||
          s.exam_name.toLowerCase().includes(q) ||
          String(s.id || '').includes(q)
        if (!match) return false
      }
      if (examTypeFilter !== 'all' && normalizeClientName(s.client_name) !== examTypeFilter) return false
      if (statusFilter !== 'all' && (s.status || 'scheduled') !== statusFilter) return false
      return true
    })
  }, [sessions, searchQuery, examTypeFilter, statusFilter])

  const getSessionsForDate = useCallback((date: Date) => {
    const dateStr = formatDateForIST(date)
    return filteredSessions.filter(s => s.date === dateStr)
  }, [filteredSessions])

  const getAllSessionsForDate = useCallback((date: Date) => {
    const dateStr = formatDateForIST(date)
    return sessions.filter(s => s.date === dateStr)
  }, [sessions])

  // ── Month navigation ──────────────────────────────────────────────────────
  const getDaysInMonth = useCallback(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (Date | null)[] = []
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
    return days
  }, [currentDate])

  // ── Week helpers ──────────────────────────────────────────────────────────
  const getWeekDays = useCallback(() => {
    const d = new Date(currentDate)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Mon start
    d.setDate(diff)
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(d)
      dd.setDate(d.getDate() + i)
      return dd
    })
  }, [currentDate])

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigate = (dir: 'prev' | 'next') => {
    const d = new Date(currentDate)
    const delta = dir === 'next' ? 1 : -1
    if (viewMode === 'month') d.setMonth(d.getMonth() + delta)
    else if (viewMode === 'week') d.setDate(d.getDate() + delta * 7)
    else d.setDate(d.getDate() + delta)
    setCurrentDate(d)
  }

  const getHeaderTitle = () => {
    if (viewMode === 'month')
      return currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
    if (viewMode === 'week') {
      const wk = getWeekDays()
      const start = wk[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      const end = wk[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      return `${start} – ${end}`
    }
    return currentDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
  }

  // ── Modals ────────────────────────────────────────────────────────────────
  const openModal = (date?: Date, session?: Session) => {
    if (session) {
      setEditingSession(session)
      setFormData({
        client_name: session.client_name, exam_name: session.exam_name,
        date: session.date, candidate_count: session.candidate_count,
        start_time: session.start_time, end_time: session.end_time,
        status: session.status || 'scheduled'
      })
    } else {
      setEditingSession(null)
      const dateStr = date ? formatDateForIST(date) : getCurrentISTDateString()
      setFormData({ client_name: '', exam_name: '', date: dateStr, candidate_count: 1, start_time: '09:00', end_time: '17:00', status: 'scheduled' })
    }
    setShowModal(true)
  }

  const openDetailsModal = (date: Date) => {
    const ds = getSessionsForDate(date)
    if (ds.length > 0) { setSelectedDate(date); setShowDetailsModal(true) }
    else if (canEdit) openModal(date)
  }

  const closeModal = () => {
    setShowModal(false); setShowDetailsModal(false)
    setEditingSession(null); setSelectedDate(null)
    setFormData({ client_name: '', exam_name: '', date: '', candidate_count: 1, start_time: '09:00', end_time: '17:00', status: 'scheduled' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const cap = validateSessionCapacity(formData.candidate_count, activeBranch)
    if (!cap.isValid) { toast.error(cap.error!); return }
    if (cap.warning) toast(cap.warning, { icon: '⚠️' })
    try {
      if (activeBranch === 'global') { toast.error('Select a centre to add/edit sessions.'); return }
      const data: any = { ...formData, user_id: user.id, updated_at: new Date().toISOString(), branch_location: activeBranch }
      if (editingSession?.id) await updateSession({ ...data, id: editingSession.id })
      else await addSession({ ...data, created_at: new Date().toISOString() })
      closeModal()
    } catch (err) { console.error(err) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this session?')) return
    await deleteSession(id)
    if (selectedDate) {
      const rem = sessions.filter(s => s.date === formatDateForIST(selectedDate) && s.id !== id)
      if (rem.length === 0) setShowDetailsModal(false)
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: sessions.reduce((s, x) => s + x.candidate_count, 0),
    totalSessions: sessions.length,
    uniqueClients: new Set(sessions.map(s => normalizeClientName(s.client_name))).size
  }), [sessions])

  const days = useMemo(() => getDaysInMonth(), [getDaysInMonth])
  const isToday = (d: Date | null) => d ? isTodayIST(d) : false
  const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7am–8pm

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  const SessionPill = ({ session }: { session: Session }) => {
    const c = getExamColor(session.client_name)
    const status = session.status || 'scheduled'
    const st = STATUS_CONFIG[status] || STATUS_CONFIG['scheduled']
    return (
      <div
        className="flex items-center gap-1 px-1.5 py-[3px] rounded-md border text-[10px] leading-tight transition-all hover:opacity-80 cursor-pointer"
        style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
        <span className="font-bold truncate flex-1">{getShortClient(session.client_name)}</span>
        <span className="font-extrabold opacity-80">{session.candidate_count}</span>
      </div>
    )
  }

  const StatusBadge = ({ status }: { status?: string }) => {
    const s = STATUS_CONFIG[status || 'scheduled'] || STATUS_CONFIG['scheduled']
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
        style={{ backgroundColor: s.bg, color: s.text }}>
        {s.icon} {s.label}
      </span>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MONTH VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const MonthView = () => (
    <div className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-[#121214]">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-white/10 bg-[#0A0A0B]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
          <div key={day} className={`py-3 text-center text-[11px] font-bold uppercase tracking-widest ${i === 0 || i === 6 ? 'text-white/40' : 'text-white/60'}`}>
            {day}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7">
        {days.map((date, idx) => {
          if (!date) return (
            <div key={idx} className="min-h-[120px] bg-[#0A0A0B]/50 border-b border-r border-white/5" />
          )
          const ds = getSessionsForDate(date)
          const allDs = getAllSessionsForDate(date)
          const total = ds.reduce((s, x) => s + x.candidate_count, 0)
          const isCurrentDay = isToday(date)
          const isWeekend = date.getDay() === 0 || date.getDay() === 6
          // Group by client
          const groups: Record<string, { count: number; name: string }> = {}
          ds.forEach(s => {
            const k = normalizeClientName(s.client_name)
            if (!groups[k]) groups[k] = { count: 0, name: s.client_name }
            groups[k].count += s.candidate_count
          })
          const entries = Object.entries(groups)

          return (
            <div
              key={idx}
              onClick={() => openDetailsModal(date)}
              className={`
                min-h-[120px] p-2 border-b border-r border-white/5 cursor-pointer
                transition-all duration-300 relative group
                ${isCurrentDay
                  ? 'bg-gradient-to-br from-[#f6c810]/10 to-transparent ring-1 ring-inset ring-[#f6c810]/30'
                  : isWeekend
                  ? 'bg-[#0A0A0B]'
                  : 'bg-[#121214] hover:bg-white/5'
                }
              `}
            >
              {/* Date number */}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-bold leading-none flex items-center justify-center
                  ${isCurrentDay
                    ? 'w-7 h-7 rounded-full bg-gradient-to-r from-[#f6c810] to-[#e0b50b] text-black text-xs shadow-[0_0_15px_rgba(246,200,16,0.4)]'
                    : isWeekend
                    ? 'text-white/30'
                    : 'text-white/70'
                  }`}
                >
                  {date.getDate()}
                </span>
                {total > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded
                    ${isCurrentDay ? 'bg-[#f6c810] text-black' : 'bg-white/10 text-white/80'}`}>
                    {total}
                  </span>
                )}
              </div>
              {/* Session pills */}
              <div className="space-y-1.5">
                {entries.slice(0, 3).map(([key, stat]) => {
                  const c = EXAM_COLORS[key] || EXAM_COLORS['OTHER']
                  return (
                    <div key={key} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs leading-tight shadow-sm transition-all hover:brightness-110"
                      style={{ backgroundColor: c.badge, borderColor: c.border, color: c.badgeText }}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_5px_currentColor]" style={{ backgroundColor: c.dot, color: c.dot }} />
                      <span className="font-bold truncate flex-1 tracking-wide">{getShortClient(stat.name)}</span>
                      <span className="font-black">{stat.count}</span>
                    </div>
                  )
                })}
                {entries.length > 3 && (
                  <div className="text-[9px] text-white/50 font-bold pl-1 uppercase tracking-wider">+{entries.length - 3} more</div>
                )}
                {allDs.length > ds.length && (
                  <div className="text-[9px] text-[#f6c810]/60 font-bold pl-1 uppercase tracking-wider">+{allDs.length - ds.length} filtered</div>
                )}
              </div>
              {/* Hover hint */}
              <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Eye size={12} className="text-white/40" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // WEEK VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const WeekView = () => {
    const weekDays = getWeekDays()
    return (
      <div className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-[#121214]">
        {/* Header row */}
        <div className="grid border-b border-white/10 bg-[#0A0A0B]"
          style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
          <div className="py-3 border-r border-white/10" />
          {weekDays.map((d, i) => {
            const isCur = isToday(d)
            const isWknd = d.getDay() === 0 || d.getDay() === 6
            return (
              <div key={i} className={`py-3 text-center border-r border-white/10 last:border-r-0
                ${isWknd ? 'opacity-50' : ''}`}>
                <div className="text-[11px] font-bold text-white/60 uppercase tracking-widest">
                  {d.toLocaleDateString('en', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-black mt-1 mx-auto w-8 h-8 flex items-center justify-center rounded-full
                  ${isCur
                    ? 'bg-gradient-to-r from-[#f6c810] to-[#e0b50b] text-black shadow-[0_0_15px_rgba(246,200,16,0.4)]'
                    : 'text-white/80'}`}>
                  {d.getDate()}
                </div>
              </div>
            )
          })}
        </div>
        {/* Time slots */}
        <div className="overflow-y-auto max-h-[600px] custom-scrollbar">
          {HOURS.map(hour => (
            <div key={hour} className="grid border-b border-white/5"
              style={{ gridTemplateColumns: '60px repeat(7, 1fr)', minHeight: '70px' }}>
              <div className="py-2 px-2 text-right border-r border-white/10 bg-[#0A0A0B]/30">
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">
                  {hour > 12 ? `${hour - 12}` : hour}{hour >= 12 ? 'PM' : 'AM'}
                </span>
              </div>
              {weekDays.map((d, i) => {
                const ds = getSessionsForDate(d).filter(s => {
                  const startH = parseInt(s.start_time.split(':')[0])
                  return startH === hour
                })
                return (
                  <div key={i}
                    className={`p-1.5 border-r border-white/5 last:border-r-0 cursor-pointer
                      ${isToday(d) ? 'bg-[#f6c810]/5' : (d.getDay() === 0 || d.getDay() === 6) ? 'bg-[#0A0A0B]/50' : 'bg-transparent'}
                      hover:bg-white/5 transition-colors duration-300`}
                    onClick={() => canEdit && ds.length === 0 && openModal(d)}
                  >
                    {ds.map(s => {
                      const c = getExamColor(s.client_name)
                      return (
                        <div
                          key={s.id}
                          onClick={e => { e.stopPropagation(); setSelectedDate(d); setShowDetailsModal(true) }}
                          className="px-2.5 py-2 rounded-lg border text-xs mb-1.5 cursor-pointer hover:brightness-110 transition-all shadow-md"
                          style={{ backgroundColor: c.badge, borderColor: c.border, color: c.badgeText }}
                        >
                          <div className="font-bold flex items-center gap-1.5 tracking-wide">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_5px_currentColor]" style={{ backgroundColor: c.dot, color: c.dot }} />
                            {getShortClient(s.client_name)}
                          </div>
                          <div className="text-[10px] opacity-80 mt-1 font-semibold tracking-wider">{formatTime(s.start_time)}</div>
                          <div className="opacity-90 font-black mt-0.5">{s.candidate_count} PAX</div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DAY VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const DayView = () => {
    const dayStr = formatDateForIST(currentDate)
    const daySessions = filteredSessions.filter(s => s.date === dayStr)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
    const DAY_HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 6am–9pm

    return (
      <div className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-[#121214]">
        {/* Day header */}
        <div className="px-6 py-5 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className={`text-2xl font-black tracking-tight ${isToday(currentDate) ? 'text-[#f6c810]' : 'text-white'}`}>
              {currentDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })}
            </h3>
            <p className="text-xs text-white/50 mt-1 font-medium tracking-wide uppercase">
              {daySessions.length} sessions <span className="mx-1.5 text-white/20">•</span> {daySessions.reduce((s, x) => s + x.candidate_count, 0)} candidates
            </p>
          </div>
          {canEdit && (
            <button onClick={() => openModal(currentDate)}
              className="px-4 py-2.5 text-xs font-bold bg-gradient-to-r from-[#f6c810] to-[#e0b50b] text-black rounded-lg hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(246,200,16,0.2)]">
              <Plus size={14} /> ADD SESSION
            </button>
          )}
        </div>
        {/* Timeline */}
        <div className="flex overflow-y-auto max-h-[600px] custom-scrollbar">
          {/* Hour labels */}
          <div className="w-20 flex-shrink-0 border-r border-white/10 bg-[#0A0A0B]/30">
            {DAY_HOURS.map(h => (
              <div key={h} className="h-[70px] flex items-start justify-end pr-4 pt-2 border-b border-white/5">
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                  {h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`}
                </span>
              </div>
            ))}
          </div>
          {/* Sessions column */}
          <div className="flex-1 relative bg-[#121214]">
            {DAY_HOURS.map(h => (
              <div key={h} className="h-[70px] border-b border-white/5 hover:bg-white/5 transition-colors duration-300" />
            ))}
            {/* Session blocks */}
            {daySessions.map(s => {
              const startMins = timeToMinutes(s.start_time)
              const endMins = timeToMinutes(s.end_time)
              const topOffset = (startMins - 6 * 60) * (70 / 60) // px per hour = 70
              const height = Math.max((endMins - startMins) * (70 / 60), 45)
              const c = getExamColor(s.client_name)
              const status = s.status || 'scheduled'
              const st = STATUS_CONFIG[status] || STATUS_CONFIG['scheduled']
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="absolute left-3 right-3 rounded-xl border overflow-hidden cursor-pointer hover:brightness-110 transition-all shadow-lg"
                  style={{
                    top: `${topOffset}px`,
                    height: `${height}px`,
                    backgroundColor: c.badge,
                    borderColor: c.border
                  }}
                  onClick={() => { setSelectedDate(currentDate); setShowDetailsModal(true) }}
                >
                  {/* Color bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl shadow-[0_0_8px_currentColor]" style={{ backgroundColor: c.dot, color: c.dot }} />
                  <div className="pl-5 pr-3 pt-2 h-full flex flex-col">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-sm font-black tracking-wide" style={{ color: c.badgeText }}>{s.client_name}</span>
                        <p className="text-xs mt-0.5 line-clamp-1 font-semibold opacity-80" style={{ color: c.badgeText }}>{s.exam_name}</p>
                      </div>
                      <StatusBadge status={status} />
                    </div>
                    <div className="flex items-center gap-4 mt-auto pb-2">
                      <span className="text-[10px] flex items-center gap-1.5 font-bold tracking-wider opacity-70" style={{ color: c.badgeText }}>
                        <Clock size={10} />{formatTime(s.start_time)} – {formatTime(s.end_time)}
                      </span>
                      <span className="text-[10px] flex items-center gap-1.5 font-bold tracking-wider opacity-70" style={{ color: c.badgeText }}>
                        <Users size={10} />{s.candidate_count} PAX
                      </span>
                      {(s as any).assigned_staff && (
                        <span className="text-[10px] flex items-center gap-1.5 font-bold tracking-wider opacity-70" style={{ color: c.badgeText }}>
                          <User size={10} />{(s as any).assigned_staff}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#0A0A0B] via-[#121214] to-[#0A0A0B]">
      <div className="bg-[#121214] p-8 rounded-2xl border border-[rgba(255, 255, 255, 0.1)] flex flex-col items-center gap-4 shadow-2xl">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-[rgba(255, 255, 255, 0.1)]" />
          <div className="absolute inset-0 rounded-full border-2 border-t-[#f6c810] animate-spin" />
        </div>
        <p className="text-slate-300 text-sm font-medium">Loading calendar…</p>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen sovereign-theme" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">

        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12 mt-8">
          <div className="relative">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-[1px] w-12 bg-[#FACC15]" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#FACC15]">
                Calendar Operations {activeBranch !== 'global' && `// ${activeBranch.toUpperCase()}`}
              </span>
            </div>
            <div className="text-6xl md:text-8xl font-black text-[#FACC15] tracking-tighter leading-none" role="heading" aria-level={1}>
              FETS CALENDAR
            </div>
            <div className="mt-2 text-[#FACC15]/40 text-[10px] tracking-[0.3em] uppercase font-medium">
              {getHeaderTitle()}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A0A0B] border border-[rgba(255, 255, 255, 0.1)] text-[#f6c810] rounded-lg text-xs font-bold">
              <Users size={12} />{stats.total} candidates
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A0A0B] border border-[rgba(255, 255, 255, 0.1)] text-[#f6c810] rounded-lg text-xs font-bold">
              <Calendar size={12} />{stats.totalSessions} sessions
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A0A0B] border border-[rgba(255, 255, 255, 0.1)] text-[#f6c810] rounded-lg text-xs font-bold">
              <Building size={12} />{stats.uniqueClients} clients
            </div>
          </div>
        </div>

        {/* ── TOOLBAR ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 bg-[#121214] rounded-xl border border-[rgba(255, 255, 255, 0.1)] px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#0A0A0B] rounded-lg border border-[rgba(255, 255, 255, 0.1)] p-0.5">
              {([
                { mode: 'month' as CalendarViewMode, icon: <LayoutGrid size={14} />, label: 'Month' },
                { mode: 'week'  as CalendarViewMode, icon: <Columns size={14} />,   label: 'Week' },
                { mode: 'day'   as CalendarViewMode, icon: <AlignJustify size={14} />, label: 'Day' },
              ]).map(({ mode, icon, label }) => (
                <button key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === mode
                    ? 'bg-[#f6c810] text-black shadow'
                    : 'text-slate-400 hover:text-slate-200'}`}>
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* Month/Week/Day Navigation */}
            <div className="flex items-center bg-[#0A0A0B] rounded-lg border border-[rgba(255, 255, 255, 0.1)]">
              <button onClick={() => navigate('prev')} className="p-2.5 hover:bg-[rgba(255, 255, 255, 0.1)] rounded-l-lg transition-colors">
                <ChevronLeft size={16} className="text-slate-400" />
              </button>
              <span className="px-4 text-sm font-bold text-slate-200 min-w-[160px] text-center">{getHeaderTitle()}</span>
              <button onClick={() => navigate('next')} className="p-2.5 hover:bg-[rgba(255, 255, 255, 0.1)] rounded-r-lg transition-colors">
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            </div>
            <button onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2.5 text-sm font-bold text-slate-300 bg-[#0A0A0B] border border-[rgba(255, 255, 255, 0.1)] rounded-lg hover:border-[#f6c810]/50 hover:text-[#f6c810] transition-colors">
              Today
            </button>

            {/* Location filter */}
            <div className="flex items-center px-3 py-2 bg-[#0A0A0B] border border-[rgba(255, 255, 255, 0.1)] rounded-lg">
              <MapPin size={13} className="text-[#f6c810] mr-2" />
              <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-bold text-slate-300 cursor-pointer">
                <option value="all">All Locations</option>
                <option value="calicut">Calicut</option>
                <option value="cochin">Cochin</option>
                <option value="kannur">Kannur</option>
                <option value="global">Global</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search sessions…"
                className="pl-9 pr-3 py-2.5 bg-[#0A0A0B] border border-[rgba(255, 255, 255, 0.1)] rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#f6c810]/50 w-40 md:w-48 transition-all"
              />
            </div>

            {/* Exam Type Dropdown */}
            <div className="relative hidden md:block">
              <select 
                value={examTypeFilter} 
                onChange={e => setExamTypeFilter(e.target.value)}
                className="pl-3 pr-8 py-2.5 bg-[#0A0A0B] border border-[rgba(255, 255, 255, 0.1)] rounded-lg text-sm font-bold text-slate-200 focus:outline-none focus:border-[#f6c810]/50 transition-all appearance-none"
              >
                <option value="all">All Clients</option>
                {Object.keys(EXAM_COLORS).filter(k => k !== 'OTHER').map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>

            {/* Advanced Filters */}
            <div className="relative">
              <button onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg border transition-colors ${showFilters ? 'bg-[#f6c810]/10 border-[#f6c810]/40 text-[#f6c810]' : 'bg-[#0A0A0B] border-[rgba(255, 255, 255, 0.1)] text-slate-400 hover:text-slate-200'}`}>
                <Filter size={14} />
              </button>
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.97 }}
                    className="absolute right-0 mt-2 w-64 bg-[#121214] border border-[rgba(255, 255, 255, 0.1)] rounded-xl shadow-2xl z-30 p-4"
                  >
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Filters</p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Exam Type</label>
                        <select value={examTypeFilter} onChange={e => setExamTypeFilter(e.target.value)}
                          className="mt-1 w-full px-2 py-1.5 bg-[#0A0A0B] border border-[rgba(255, 255, 255, 0.1)] rounded-lg text-xs text-slate-200 focus:outline-none">
                          <option value="all">All Types</option>
                          {Object.keys(EXAM_COLORS).filter(k => k !== 'OTHER').map(k => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                          className="mt-1 w-full px-2 py-1.5 bg-[#0A0A0B] border border-[rgba(255, 255, 255, 0.1)] rounded-lg text-xs text-slate-200 focus:outline-none">
                          <option value="all">All Status</option>
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <button onClick={() => { setExamTypeFilter('all'); setStatusFilter('all'); setSearchQuery('') }}
                        className="w-full py-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 border border-[rgba(255, 255, 255, 0.1)] rounded-lg transition-colors">
                        Clear Filters
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Analysis */}
            <button onClick={() => setShowAnalysis(true)}
              className="px-4 py-2.5 text-sm font-bold text-slate-300 bg-[#0A0A0B] border border-[rgba(255, 255, 255, 0.1)] rounded-lg hover:border-[#f6c810]/50 hover:text-[#f6c810] transition-colors flex items-center gap-1.5">
              <TrendingUp size={13} /> Analysis
            </button>

            {/* Add Session */}
            <button onClick={() => openModal()}
              disabled={!canEdit}
              className="px-4 py-2 text-xs font-bold text-black bg-[#f6c810] hover:bg-[#eab308] rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
              <Plus size={13} /> Add Session
            </button>
          </div>
        </div>

        {/* ── ACTIVE FILTERS CHIPS ── */}
        {(searchQuery || examTypeFilter !== 'all' || statusFilter !== 'all') && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-[11px] text-slate-500 font-medium">Active filters:</span>
            {searchQuery && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-[#27575b] border border-[#f6c810]/30 text-[#f6c810] rounded-full text-[10px] font-bold">
                "{searchQuery}" <button onClick={() => setSearchQuery('')}><X size={10} /></button>
              </span>
            )}
            {examTypeFilter !== 'all' && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-[rgba(255, 255, 255, 0.1)] border border-zinc-700 text-slate-200 rounded-full text-[10px] font-bold">
                {examTypeFilter} <button onClick={() => setExamTypeFilter('all')}><X size={10} /></button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-[rgba(255, 255, 255, 0.1)] border border-zinc-700 text-slate-200 rounded-full text-[10px] font-bold">
                {STATUS_CONFIG[statusFilter]?.label} <button onClick={() => setStatusFilter('all')}><X size={10} /></button>
              </span>
            )}
          </div>
        )}

        {/* ── CALENDAR VIEWS ── */}
        {viewMode === 'month' && <MonthView />}
        {viewMode === 'week' && <WeekView />}
        {viewMode === 'day' && <DayView />}
      </div>

      {/* ════════════════════ DAILY DETAILS MODAL ════════════════════ */}
      <AnimatePresence>
        {showDetailsModal && selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-3xl bg-[#121214] rounded-2xl shadow-2xl border border-white/10 overflow-hidden max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#0A0A0B]">
                <div>
                  <h3 className="text-lg font-extrabold text-white">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-bold text-slate-400">{getSessionsForDate(selectedDate).length} sessions</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-700" />
                    <span className="text-xs font-bold text-slate-400">
                      {getSessionsForDate(selectedDate).reduce((s, x) => s + x.candidate_count, 0)} candidates
                    </span>
                  </div>
                </div>
                <button onClick={closeModal}
                  className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Sessions */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {getSessionsForDate(selectedDate).length > 0 ? (
                  getSessionsForDate(selectedDate)
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((session, idx) => {
                      const c = getExamColor(session.client_name)
                      const status = session.status || 'scheduled'
                      return (
                        <div key={session.id || idx}
                          className="rounded-xl border overflow-hidden transition-all hover:border-opacity-80"
                          style={{ borderColor: c.border, backgroundColor: c.bg }}>
                          <div className="flex items-stretch">
                            <div className="w-1.5 shrink-0" style={{ backgroundColor: c.dot }} />
                            <div className="flex-1 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                                      style={{ backgroundColor: c.badge, color: c.badgeText }}>
                                      {session.client_name}
                                    </span>
                                    <StatusBadge status={status} />
                                  </div>
                                  <h4 className="text-sm font-bold text-white leading-snug">{session.exam_name}</h4>
                                  {(session as any).assigned_staff && (
                                    <p className="text-xs text-slate-300 mt-1 flex items-center gap-1">
                                      <User size={11} className="text-slate-500" /> {(session as any).assigned_staff}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-2xl font-extrabold" style={{ color: c.text }}>
                                    {session.candidate_count}
                                  </div>
                                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">candidates</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
                                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                                  <Clock size={12} className="text-[#f6c810]" />
                                  <span className="font-semibold">{formatTime(session.start_time)} – {formatTime(session.end_time)}</span>
                                </div>
                                {session.branch_location && (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                    <MapPin size={12} className="text-slate-500" />
                                    <span className="font-semibold capitalize">{session.branch_location}</span>
                                  </div>
                                )}
                                {canEdit && (
                                  <div className="ml-auto flex items-center gap-1">
                                    <button onClick={() => openModal(selectedDate!, session as Session)}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-[#f6c810] hover:bg-[#f6c810]/10 transition-colors">
                                      <Edit size={13} />
                                    </button>
                                    <button onClick={() => session.id && handleDelete(session.id)}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-700">
                    <Calendar size={40} className="mb-3" />
                    <p className="text-sm font-bold">No sessions for this day</p>
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="p-4 border-t border-white/10 bg-[#0A0A0B] flex justify-center">
                  <button onClick={() => openModal(selectedDate!)}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#f6c810] to-[#eab308] hover:brightness-110 text-black text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2">
                    <Plus size={13} /> Add Session
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════════════════════ ADD / EDIT SESSION MODAL ════════════════════ */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-xl bg-[#121214] rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#0A0A0B]">
                <div>
                  <h3 className="text-lg font-extrabold text-white">{editingSession ? 'Edit Session' : 'New Session'}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{editingSession ? 'Update session details' : 'Schedule a new exam session'}</p>
                </div>
                <button onClick={closeModal}
                  className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Client</label>
                      <select value={formData.client_name}
                        onChange={e => setFormData({ ...formData, client_name: e.target.value, exam_name: '' })}
                        className="w-full px-3 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-lg text-sm font-medium text-zinc-200 focus:ring-1 focus:ring-[#f6c810]/50 focus:border-[#f6c810]/50 outline-none"
                        required>
                        <option value="">Select Client</option>
                        {dbClients.length > 0 ? (
                          dbClients.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)
                        ) : (
                          Object.keys(EXAM_COLORS).filter(k => k !== 'OTHER').map(k => <option key={k} value={k}>{k}</option>)
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Exam</label>
                      {(() => {
                        const sel = dbClients.find((c: any) => c.name === formData.client_name)
                        const exams = sel ? dbExams.filter((e: any) => e.client_id === sel.id) : []
                        return exams.length > 0 ? (
                          <select value={formData.exam_name}
                            onChange={e => setFormData({ ...formData, exam_name: e.target.value })}
                            className="w-full px-3 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-lg text-sm font-medium text-zinc-200 focus:ring-1 focus:ring-[#f6c810]/50 focus:border-[#f6c810]/50 outline-none" required>
                            <option value="">Select Exam</option>
                            {exams.map((e: any) => <option key={e.id} value={e.name}>{e.name}</option>)}
                          </select>
                        ) : (
                          <input type="text" value={formData.exam_name}
                            onChange={e => setFormData({ ...formData, exam_name: e.target.value })}
                            className="w-full px-3 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-lg text-sm font-medium text-zinc-200 focus:ring-1 focus:ring-[#f6c810]/50 focus:border-[#f6c810]/50 outline-none placeholder-zinc-700"
                            placeholder="e.g. CMA US Exam" required />
                        )
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date</label>
                      <input type="date" value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-lg text-sm font-medium text-zinc-200 focus:ring-1 focus:ring-[#f6c810]/50 focus:border-[#f6c810]/50 outline-none" required />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Candidates</label>
                      <input type="number" value={formData.candidate_count}
                        onChange={e => setFormData({ ...formData, candidate_count: parseInt(e.target.value) })}
                        className="w-full px-3 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-lg text-sm font-medium text-zinc-200 focus:ring-1 focus:ring-[#f6c810]/50 focus:border-[#f6c810]/50 outline-none"
                        min="1" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Start Time</label>
                      <input type="time" value={formData.start_time}
                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                        className="w-full px-3 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-lg text-sm font-medium text-zinc-200 focus:ring-1 focus:ring-[#f6c810]/50 focus:border-[#f6c810]/50 outline-none" required />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">End Time</label>
                      <input type="time" value={formData.end_time}
                        onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                        className="w-full px-3 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-lg text-sm font-medium text-zinc-200 focus:ring-1 focus:ring-[#f6c810]/50 focus:border-[#f6c810]/50 outline-none" required />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <button key={k} type="button"
                          onClick={() => setFormData({ ...formData, status: k })}
                          className={`px-2 py-2 rounded-lg border text-[10px] font-bold flex items-center gap-1 justify-center transition-all
                            ${formData.status === k
                              ? 'ring-1 ring-[#f6c810] border-[#f6c810]/50 text-[#f6c810] bg-[#f6c810]/10'
                              : 'border-white/10 text-slate-400 bg-[#0A0A0B] hover:border-white/20'}`}>
                          {v.icon} {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6 pt-5 border-t border-white/10">
                  <button type="button" onClick={closeModal}
                    className="flex-1 px-4 py-2.5 bg-[#0A0A0B] border border-white/10 text-slate-300 font-bold text-sm rounded-lg hover:border-white/20 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={isMutating}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#f6c810] to-[#eab308] hover:brightness-110 text-black font-bold text-sm rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isMutating
                      ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                      : editingSession ? 'Update Session' : 'Create Session'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Analysis Modal */}
      <AnimatePresence>
        {showAnalysis && (
          <CalendarAnalysis onClose={() => setShowAnalysis(false)} activeBranch={activeBranch} />
        )}
      </AnimatePresence>

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0A0A0B; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `}</style>
    </div>
  )
}

export default FetsCalendarPremium
