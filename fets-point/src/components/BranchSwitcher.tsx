import { useState, useRef, useEffect } from 'react'
import { MapPin, ChevronDown } from 'lucide-react'
import { useBranch } from '../hooks/useBranch'
import { useAuth } from '../hooks/useAuth'
import { canSwitchBranches, formatBranchName, getAvailableBranches } from '../utils/authUtils'

export function BranchSwitcher() {
  const { activeBranch, setActiveBranch } = useBranch()
  const { profile } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  if (!canSwitchBranches(profile?.email, profile?.role)) {
    return null
  }

  const availableBranches = getAvailableBranches(profile?.email, profile?.role)

  const handleBranchChange = (branch: string) => {
    setActiveBranch(branch as any)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative z-[100]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0b] hover:from-[#2a2a2a] hover:to-[#121214] transition-all duration-300 shadow-[0_0_20px_rgba(246,200,16,0.1)] hover:shadow-[0_0_25px_rgba(246,200,16,0.2)] border border-[#f6c810]/30"
        title="Change centre / location"
      >
        <MapPin className="h-5 w-5 text-[#f6c810] drop-shadow-[0_0_8px_rgba(246,200,16,0.5)]" />
        <span className="text-sm font-black text-[#f6c810] tracking-[0.2em] uppercase drop-shadow-[0_0_8px_rgba(246,200,16,0.5)]">
          {formatBranchName(activeBranch)}
        </span>
        <ChevronDown className={`h-4 w-4 text-[#f6c810]/70 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 mt-4 w-64 bg-[#0A0A0B]/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] border border-[#f6c810]/20 overflow-hidden z-50">
          <div className="py-2">
            {availableBranches.map((branch) => (
              <button
                key={branch}
                onClick={() => handleBranchChange(branch)}
                className={`w-full px-5 py-4 text-left text-sm font-bold transition-all duration-200 flex items-center gap-4 ${
                  activeBranch === branch
                    ? 'bg-[#f6c810]/10 text-[#f6c810] border-l-4 border-[#f6c810]'
                    : 'text-white/40 hover:bg-white/5 hover:text-white/80 border-l-4 border-transparent'
                }`}
              >
                <MapPin className={`h-4 w-4 ${activeBranch === branch ? 'text-[#f6c810]' : 'text-white/20'}`} />
                <span className="uppercase tracking-[0.2em]">{formatBranchName(branch)}</span>
              </button>
            ))}
          </div>
          <div className="px-5 py-3 bg-white/5 border-t border-white/10 text-center">
            <p className="text-[9px] text-white/30 font-black uppercase tracking-[0.3em]">Location Selector</p>
          </div>
        </div>
      )}
    </div>
  )
}
