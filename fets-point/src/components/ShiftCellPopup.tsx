import React, { useState, useEffect } from 'react'
import { X, Trash2, Save, ChevronLeft, Zap, Clock } from 'lucide-react'
import { SHIFT_CODES } from '../types/shared'
import { useIsMobile } from '../hooks/use-mobile'

interface ShiftCellPopupProps {
  isOpen: boolean
  onClose: () => void
  onSave: (shiftData: { shift_code: string; overtime_hours: number }) => void
  onDelete: () => void
  currentShift?: string
  currentOvertimeHours?: number
  staffName: string
  date: string
}

// Apple-inspired shift color scheme - all options including OT
const SHIFT_OPTIONS = {
  'D': SHIFT_CODES.D,
  'E': SHIFT_CODES.E, 
  'HD': SHIFT_CODES.HD,
  'RD': SHIFT_CODES.RD,
  'L': SHIFT_CODES.L,
  'OT': SHIFT_CODES.OT,
  'T': SHIFT_CODES.T,
  'TOIL': SHIFT_CODES.TOIL
}

export const ShiftCellPopup: React.FC<ShiftCellPopupProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  currentShift = '',
  currentOvertimeHours = 0,
  staffName,
  date
}) => {
  const isMobile = useIsMobile()
  const [selectedShift, setSelectedShift] = useState(currentShift)
  const [overtimeHours, setOvertimeHours] = useState(currentOvertimeHours)

  useEffect(() => {
    setSelectedShift(currentShift)
    setOvertimeHours(currentOvertimeHours)
  }, [currentShift, currentOvertimeHours])

  const handleSave = () => {
    onSave({
      shift_code: selectedShift,
      overtime_hours: overtimeHours
    })
    onClose()
  }

  const handleDelete = () => {
    onDelete()
    onClose()
  }

  const getCellPreview = () => {
    if (!selectedShift) return { bg: '#f3f4f6', text: '#9ca3af', display: '' }
    
    const shiftInfo = SHIFT_OPTIONS[selectedShift as keyof typeof SHIFT_OPTIONS]
    if (!shiftInfo) return { bg: '#f3f4f6', text: '#9ca3af', display: selectedShift }
    
    // Handle D+OT and E+OT combinations
    if (overtimeHours > 0 && (selectedShift === 'D' || selectedShift === 'E')) {
      return {
        bg: SHIFT_CODES.OT.bgColor,
        text: SHIFT_CODES.OT.textColor,
        display: `${selectedShift}+OT`
      }
    }
    
    return {
      bg: shiftInfo.bgColor,
      text: shiftInfo.textColor,
      display: shiftInfo.letter
    }
  }

  if (!isOpen) return null

  const preview = getCellPreview()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Glassmorphic backdrop */}
      {!isMobile && (
        <div 
          className="absolute inset-0 backdrop-blur-xl bg-black/30"
          onClick={onClose}
        />
      )}
      
      {/* Popup container - Apple-style */}
      <div className={`relative w-full overflow-hidden transform transition-all duration-300 scale-100 ${
        isMobile 
        ? 'h-full bg-[#0A0A0B] flex flex-col pt-safe' 
        : 'max-w-3xl bg-[#0A0A0B] rounded-3xl shadow-2xl border border-white/10'
      }`}>
        {/* Header */}
        <div className={`${isMobile ? 'px-6 pt-12 pb-6' : 'px-8 py-6'} bg-[#121214] border-b border-white/10 flex-none`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
               {isMobile && (
                 <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white shadow-sm flex items-center justify-center hover:bg-white/10 transition-colors">
                    <ChevronLeft size={24} />
                 </button>
               )}
               <div>
                  <h3 className="text-xl font-black text-white tracking-wide uppercase">{staffName}</h3>
                  <p className="text-xs text-[#f6c810]/70 font-bold uppercase tracking-widest mt-1">
                    {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
               </div>
            </div>
            {!isMobile && (
              <button
                onClick={onClose}
                className="p-3 hover:bg-white/10 rounded-full transition-all duration-200 hover:scale-110"
              >
                <X className="h-6 w-6 text-white/60" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className={`${isMobile ? 'px-6 py-8' : 'px-8 py-6'} space-y-8 flex-1 overflow-y-auto no-scrollbar`}>
          {/* Shift Selector Grid */}
          <div>
            <label className="block text-[10px] font-black text-white/40 mb-6 tracking-[0.3em] uppercase">Personnel Allocation</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(SHIFT_OPTIONS).map(([code, option]) => (
                <button
                  key={code}
                  onClick={() => setSelectedShift(code)}
                  className={`
                    p-6 rounded-2xl border transition-all duration-300
                    ${
                      selectedShift === code
                        ? 'border-[#f6c810] bg-[#f6c810]/10 shadow-[0_0_15px_rgba(246,200,16,0.2)] text-[#f6c810]'
                        : 'border-white/10 bg-[#121214] text-white/60 hover:border-white/30 hover:bg-white/5'
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="font-black text-2xl tracking-tighter">{option.letter}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-60">{option.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* Overtime Hours */}
            <div>
              <label className="block text-[10px] font-black text-white/40 mb-4 tracking-[0.3em] uppercase">Extra Operational Hours</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="12"
                  step="0.5"
                  value={overtimeHours}
                  onChange={(e) => setOvertimeHours(parseFloat(e.target.value) || 0)}
                  className="w-full px-8 py-6 bg-[#121214] border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#f6c810]/50 focus:border-[#f6c810]/50 outline-none transition-all duration-200 text-2xl font-black text-white shadow-inner"
                  placeholder="0"
                />
                <div className="absolute right-8 top-1/2 -translate-y-1/2 text-sm text-white/40 font-black uppercase tracking-widest">hours</div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="bg-[#121214] border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                 <Zap size={100} className="text-white" />
              </div>
              <div className="text-[9px] font-black text-[#f6c810]/50 mb-6 tracking-[0.4em] uppercase text-center">Protocol Preview</div>
              <div className="flex flex-col items-center gap-4">
                <div 
                  className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-2xl shadow-2xl border border-white/10"
                  style={{ 
                    background: preview.bg, 
                    color: preview.text,
                  }}
                >
                  {preview.display || '?'}
                </div>
                {selectedShift && (
                  <p className="text-center text-sm text-white font-black uppercase tracking-widest">
                    {SHIFT_OPTIONS[selectedShift as keyof typeof SHIFT_OPTIONS]?.name}
                    {overtimeHours > 0 && <span className="text-[#f6c810] block mt-1">+{overtimeHours}H OVERTIME</span>}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`${isMobile ? 'px-6 py-8 pb-12' : 'px-8 py-6'} bg-[#0A0A0B] border-t border-white/10 flex-none`}>
          <div className="flex gap-4">
            <button
              onClick={handleDelete}
              className="w-14 h-14 flex items-center justify-center bg-rose-500/10 text-rose-400 rounded-2xl active:scale-90 transition-all shadow-sm border border-rose-500/30 hover:bg-rose-500/20"
            >
              <Trash2 size={24} />
            </button>
            
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-3 px-6 h-14 bg-[#f6c810] hover:bg-[#ffe55a] text-[#0A0A0B] font-black uppercase tracking-[0.2em] rounded-2xl active:scale-95 transition-all shadow-[0_0_20px_rgba(246,200,16,0.3)]"
            >
              <Save size={20} />
              <span>Deploy Shift</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
