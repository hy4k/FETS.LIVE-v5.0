import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface LocationSelectorThreadProps {
    activeBranch: string;
    setActiveBranch: (branch: string) => void;
    availableBranches: string[];
    canSwitch: boolean;
}

function branchAccent(branch: string) {
    switch (branch) {
        case 'calicut':
            return {
                lineL: 'bg-gradient-to-r from-transparent to-sky-400/50',
                lineR: 'bg-gradient-to-l from-transparent to-sky-400/50',
                diamond: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.35)]',
                label: 'text-sky-100',
            };
        case 'cochin':
            return {
                lineL: 'bg-gradient-to-r from-transparent to-emerald-400/50',
                lineR: 'bg-gradient-to-l from-transparent to-emerald-400/50',
                diamond: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.35)]',
                label: 'text-emerald-100',
            };
        default:
            return {
                lineL: 'bg-gradient-to-r from-transparent to-[#f6c810]/60',
                lineR: 'bg-gradient-to-l from-transparent to-[#f6c810]/60',
                diamond: 'bg-[#f6c810]',
                label: 'text-[#f6c810]',
            };
    }
}

export function LocationSelectorThread({
    activeBranch,
    setActiveBranch,
    availableBranches,
    canSwitch
}: LocationSelectorThreadProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const accent = branchAccent(activeBranch);

    const formatBranchName = (branch: string) => {
        if (branch === 'global') return 'Global';
        return branch.charAt(0).toUpperCase() + branch.slice(1).toLowerCase();
    };

    const handleCycleBranch = () => {
        if (!canSwitch) return;
        setIsDropdownOpen(!isDropdownOpen);
    };

    const selectBranch = (branch: string) => {
        setActiveBranch(branch);
        setIsDropdownOpen(false);
    };

    return (
        <div className="relative z-50 flex flex-col items-center justify-center mt-6">
            <motion.div
                onClick={handleCycleBranch}
                role={canSwitch ? 'button' : undefined}
                aria-expanded={canSwitch ? isDropdownOpen : undefined}
                aria-haspopup={canSwitch ? 'listbox' : undefined}
                className={`group flex items-center justify-center gap-3 py-2 px-6 relative rounded-lg border border-transparent ${canSwitch ? 'cursor-pointer hover:border-[#f6c810]/15' : 'cursor-default'}`}
                whileHover={canSwitch ? { scale: 1.02 } : {}}
                whileTap={canSwitch ? { scale: 0.98 } : {}}
            >
                {/* Classic ornamental lines */}
                <div className={`w-12 h-[1px] ${accent.lineL}`} />

                {/* Diamond accent */}
                <div className={`w-1.5 h-1.5 rotate-45 ${accent.diamond}`} />

                <span className={`text-2xl font-serif italic tracking-[0.3em] uppercase drop-shadow-lg ${accent.label}`}>
                    {formatBranchName(activeBranch)}
                </span>

                {canSwitch && (
                    <ChevronDown
                        className={`w-4 h-4 shrink-0 opacity-45 transition-transform duration-200 ${accent.label} ${isDropdownOpen ? 'rotate-180' : ''}`}
                        aria-hidden
                    />
                )}

                {/* Diamond accent */}
                <div className={`w-1.5 h-1.5 rotate-45 ${accent.diamond}`} />

                {/* Classic ornamental lines */}
                <div className={`w-12 h-[1px] ${accent.lineR}`} />
            </motion.div>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isDropdownOpen && canSwitch && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full mt-4 w-64 bg-[#0A0A0B]/95 backdrop-blur-xl border border-[#f6c810]/20 shadow-2xl overflow-hidden z-[100]"
                        role="listbox"
                    >
                        <div className="p-2 space-y-1">
                            {availableBranches.map((branch) => (
                                <button
                                    key={branch}
                                    type="button"
                                    role="option"
                                    aria-selected={activeBranch === branch}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        selectBranch(branch);
                                    }}
                                    className={`
                                        w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-serif italic uppercase tracking-[0.2em] transition-all
                                        ${activeBranch === branch
                                            ? 'bg-[#f6c810]/10 text-[#f6c810] border-y border-[#f6c810]/30'
                                            : 'text-[#f6c810]/50 hover:bg-[#f6c810]/5 hover:text-[#f6c810]'
                                        }
                                    `}
                                >
                                    {activeBranch === branch && <div className="w-1 h-1 rotate-45 bg-[#f6c810]" />}
                                    {formatBranchName(branch)}
                                    {activeBranch === branch && <div className="w-1 h-1 rotate-45 bg-[#f6c810]" />}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
