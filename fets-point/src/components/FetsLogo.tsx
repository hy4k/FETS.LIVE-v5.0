import React from 'react';
import './FetsLogoAnimated.css';

export function FetsLogo() {
    return (
        <div className="flex items-center gap-4 group cursor-pointer p-2 px-4 sov-neuromorphic-yellow rounded-2xl">
            <div className="relative w-10 h-10 flex items-center justify-center">
                {/* Geometric Icon */}
                <div className="absolute inset-0 border-2 border-[#FACC15] rotate-45 transition-transform duration-700 group-hover:rotate-[225deg]" />
                <div className="absolute inset-2 border border-[#FACC15]/40 -rotate-12 transition-transform duration-1000 group-hover:rotate-12" />
                <span className="relative z-10 font-serif text-xl font-bold text-[#FACC15] tracking-tighter">F</span>
            </div>
            <div className="flex flex-col leading-none">
                <span className="text-xl font-black tracking-[0.2em] text-white">FETS</span>
                <span className="text-[10px] font-medium tracking-[0.5em] text-[#FACC15] ml-0.5">.LIVE</span>
            </div>
        </div>
    );
}
