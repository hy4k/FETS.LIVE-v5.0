import React, { useMemo } from 'react'
import { Schedule, StaffProfile } from '../types/shared'
import { User, Clock, Calendar } from 'lucide-react'
import { formatDateForIST } from '../utils/dateUtils'

type Props = {
  staffProfiles: StaffProfile[]
  schedules: Schedule[]
  currentDate: Date
  onCellClick: (profileId: string, date: Date) => void
}

// Premium color palette for shifts
const getShiftStyle = (code: string) => {
  const base = "w-10 h-10 flex items-center justify-center rounded-xl font-black text-xs tracking-wider transition-all duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border"

  switch (code) {
    case 'D':
      return `${base} text-[#0A0A0B] bg-gradient-to-br from-[#f6c810] to-amber-500 border-[#f6c810]/50 shadow-[0_4px_10px_rgba(246,200,16,0.3)] hover:shadow-[0_6px_15px_rgba(246,200,16,0.4)] hover:-translate-y-0.5`
    case 'E':
      return `${base} text-[#0A0A0B] bg-gradient-to-br from-orange-400 to-orange-600 border-orange-400/50 shadow-[0_4px_10px_rgba(251,146,60,0.3)] hover:shadow-[0_6px_15px_rgba(251,146,60,0.4)] hover:-translate-y-0.5`
    case 'HD':
      return `${base} text-white bg-gradient-to-br from-purple-500 to-purple-700 border-purple-500/50 shadow-[0_4px_10px_rgba(168,85,247,0.3)] hover:shadow-[0_6px_15px_rgba(168,85,247,0.4)] hover:-translate-y-0.5`
    case 'RD':
      return `${base} text-white/50 bg-[#1A1A1D] border-white/10 hover:bg-[#2A2A2D] hover:text-white/80`
    case 'L':
      return `${base} text-[#0A0A0B] bg-gradient-to-br from-rose-400 to-rose-600 border-rose-400/50 shadow-[0_4px_10px_rgba(251,113,133,0.3)] hover:shadow-[0_6px_15px_rgba(251,113,133,0.4)] hover:-translate-y-0.5`
    case 'OT':
      return `${base} text-[#0A0A0B] bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-400/50 shadow-[0_4px_10px_rgba(52,211,153,0.3)] hover:shadow-[0_6px_15px_rgba(52,211,153,0.4)] hover:-translate-y-0.5`
    case 'T':
      return `${base} text-[#0A0A0B] bg-gradient-to-br from-cyan-400 to-cyan-600 border-cyan-400/50 shadow-[0_4px_10px_rgba(34,211,238,0.3)] hover:shadow-[0_6px_15px_rgba(34,211,238,0.4)] hover:-translate-y-0.5`
    default:
      return `${base} text-white/30 bg-[#121214] border-white/5 border-dashed hover:border-white/20 hover:text-white/60`
  }
}

const getCodeLabel = (code: string) => {
  if (code === 'OT') return 'OT'
  return code
}

// Generate consistent refined colors for avatars
const getAvatarColor = (name: string) => {
  const colors = [
    'text-rose-400',
    'text-blue-400',
    'text-amber-400',
    'text-emerald-400',
    'text-purple-400',
    'text-cyan-400',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const MonthlyRosterTimeline: React.FC<Props> = ({ staffProfiles, schedules, currentDate, onCellClick }) => {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month])

  const scheduleMap = useMemo(() => {
    const map = new Map<string, Schedule>()
    for (const s of schedules) {
      map.set(`${s.profile_id}-${s.date}`, s)
    }
    return map
  }, [schedules])

  const days: Date[] = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => new Date(Date.UTC(year, month, i + 1)))
  }, [daysInMonth, month, year])

  const isToday = (d: Date) => new Date().toDateString() === d.toDateString()

  return (
    <>
      <style>{`
      .premium-scrollbar::-webkit-scrollbar {
        height: 8px;
        background-color: #0A0A0B;
        border-radius: 4px;
      }
      .premium-scrollbar::-webkit-scrollbar-track {
        background-color: #0A0A0B;
        border-radius: 4px;
      }
      .premium-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(246, 200, 16, 0.2);
        border-radius: 4px;
      }
      .premium-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: rgba(246, 200, 16, 0.5);
      }
    `}</style>

      <div className="bg-[#0A0A0B] rounded-3xl border border-white/10 overflow-hidden flex flex-col h-full font-sans shadow-2xl">
        <div className="overflow-x-auto flex-1 premium-scrollbar pb-2">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {/* Sticky Staff Column Header */}
                <th className="sticky left-0 z-20 bg-[#0A0A0B] border-b border-r border-white/10 px-8 py-6 w-72 shadow-[4px_0_12px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center gap-3 text-[#f6c810]">
                    <User className="w-5 h-5" />
                    <span className="text-sm font-black tracking-[0.2em] uppercase">Staff Member</span>
                  </div>
                </th>

                {/* Day Columns */}
                {days.map((d, idx) => {
                  const today = isToday(d);
                  return (
                    <th key={idx} className={`relative z-10 border-b border-white/10 px-2 py-4 min-w-[64px] text-center transition-colors hover:bg-white/5 ${today ? 'bg-[#f6c810]/5' : 'bg-[#0A0A0B]'}`}>
                      <div className="flex flex-col items-center gap-2">
                        <span className={`text-[10px] uppercase font-black tracking-[0.2em] ${today ? 'text-[#f6c810]' : 'text-white/40'}`}>
                          {d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                        </span>
                        <div className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-black shadow-sm transition-all ${today
                          ? 'bg-[#f6c810] text-[#0A0A0B] shadow-[0_0_15px_rgba(246,200,16,0.5)]'
                          : 'bg-white/5 border border-white/10 text-white/80'
                          }`}>
                          {d.getDate()}
                        </div>
                      </div>
                      {/* Active Day Indicator Line */}
                      {today && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#f6c810] mx-2 rounded-t-full shadow-[0_-2px_8px_rgba(246,200,16,0.5)]"></div>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {staffProfiles.map((staff, rIdx) => (
                <tr key={staff.id} className="group hover:bg-white/5 transition-colors duration-200">

                  {/* Sticky Name Cell */}
                  <td className="sticky left-0 z-10 bg-[#0A0A0B] group-hover:bg-[#121214] border-b border-r border-white/10 px-8 py-5 transition-colors shadow-[4px_0_12px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-4">
                      {/* Neumorphic Initials Avatar */}
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0b] border border-white/10 flex items-center justify-center font-black shrink-0 text-sm shadow-inner ${getAvatarColor(staff.full_name)}`}>
                        {staff.full_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-white font-black text-sm tracking-wide truncate leading-tight group-hover:text-[#f6c810] transition-colors">
                          {staff.full_name}
                        </span>
                        {staff.department && (
                          <span className="text-[9px] text-[#f6c810]/60 font-bold tracking-[0.2em] uppercase mt-1 truncate">
                            {staff.department}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Shift Cells */}
                  {days.map((d, cIdx) => {
                    const iso = formatDateForIST(d)
                    const key = `${staff.id}-${iso}`
                    const s = scheduleMap.get(key)
                    const code = s?.shift_code || ''
                    const today = isToday(d)

                    return (
                      <td
                        key={cIdx}
                        onClick={() => onCellClick(staff.id, d)}
                        className={`border-b border-white/10 px-1 py-2 text-center align-middle cursor-pointer relative transition-colors ${today ? 'bg-[#f6c810]/5' : ''
                          }`}
                      >
                        {/* Interactive Hover Area */}
                        <div className="w-full h-full flex items-center justify-center p-1">
                          {s ? (
                            <div className={`relative ${getShiftStyle(code)}`}>
                              <span>{getCodeLabel(code)}</span>
                              {(s.overtime_hours || 0) > 0 && (
                                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#0A0A0B] text-[#f6c810] text-[9px] flex items-center justify-center rounded-full border border-[#f6c810]/50 shadow-[0_0_8px_rgba(246,200,16,0.3)] font-black z-10" title={`Overtime: ${s.overtime_hours} hrs`}>
                                  OT
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-transparent border border-transparent hover:border-white/10 hover:bg-white/5 transition-all duration-300 flex items-center justify-center group-hover/cell:scale-110">
                              <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
                            </div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default MonthlyRosterTimeline


