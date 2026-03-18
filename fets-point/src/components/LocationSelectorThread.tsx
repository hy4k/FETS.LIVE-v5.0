import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LocationSelectorThreadProps {
    activeBranch: string;
    setActiveBranch: (branch: string) => void;
    availableBranches: string[];
    canSwitch: boolean;
}

export function LocationSelectorThread({
    activeBranch,
    setActiveBranch,
    availableBranches,
    canSwitch
}: LocationSelectorThreadProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
                className={`group flex items-center justify-center gap-4 py-2 px-8 relative ${canSwitch ? 'cursor-pointer' : 'cursor-default'}`}
                whileHover={canSwitch ? { scale: 1.02 } : {}}
                whileTap={canSwitch ? { scale: 0.98 } : {}}
            >
                {/* Classic ornamental lines */}
                <div className="w-12 h-[1px] bg-gradient-to-r from-transparent to-[#f6c810]/60" />
                
                {/* Diamond accent */}
                <div className="w-1.5 h-1.5 rotate-45 bg-[#f6c810]" />

                <span className="text-2xl font-serif italic text-[#f6c810] tracking-[0.3em] uppercase drop-shadow-lg">
                    {formatBranchName(activeBranch)}
                </span>

                {/* Diamond accent */}
                <div className="w-1.5 h-1.5 rotate-45 bg-[#f6c810]" />

                {/* Classic ornamental lines */}
                <div className="w-12 h-[1px] bg-gradient-to-l from-transparent to-[#f6c810]/60" />
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
                    >
                        <div className="p-2 space-y-1">
                            {availableBranches.map((branch) => (
                                <button
                                    key={branch}
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
