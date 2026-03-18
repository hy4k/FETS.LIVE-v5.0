import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users, Activity, CheckCircle, Sparkles,
    Settings, ChevronRight, ChevronDown, Bell, AlertTriangle, Shield,
    CheckCircle2, AlertCircle, Star, MessageSquare, Search, X,
    ExternalLink, Globe, TrendingUp, Calendar, MapPin,
    Building2, Clock, Zap, Lock, Unlock, Key, Copy,
    Eye, EyeOff, Plus, Trash2, Crown, Database, Briefcase,
    Server, ShieldCheck, ArrowUpRight, BookOpen, Phone,
    Layers, BarChart3, RefreshCw, FileText, Settings2, Brain, PackageSearch, ArrowRight
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useBranch } from '../hooks/useBranch'
import { toast } from 'react-hot-toast'
import { useDashboardStats, useUpcomingSchedule } from '../hooks/useCommandCentre'
import { useNews } from '../hooks/useNewsManager'
import { AccessHub } from './AccessHub'
import { MobileHome } from './MobileHome'
import { supabase } from '../lib/supabase'
import { NotificationBanner } from './NotificationBanner'
import { FetsChatPopup } from './FetsChatPopup'
import { canSwitchBranches, formatBranchName, getAvailableBranches } from '../utils/authUtils'
import { useAppModules } from '../hooks/useAppModules'
import { LocationSelectorThread } from './LocationSelectorThread'
import { format } from 'date-fns'

// Exam type color map
const EXAM_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    PROMETRIC: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', text: '#60a5fa', dot: '#3b82f6' },
    PEARSON:   { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.4)', text: '#a78bfa', dot: '#8b5cf6' },
    PSI:       { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', text: '#34d399', dot: '#10b981' },
    IELTS:     { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', text: '#fbbf24', dot: '#f59e0b' },
    CELPIP:    { bg: 'rgba(20,184,166,0.15)', border: 'rgba(20,184,166,0.4)', text: '#2dd4bf', dot: '#14b8a6' },
    CMA:       { bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.4)', text: '#f472b6', dot: '#ec4899' },
    DEFAULT:   { bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.3)', text: '#94a3b8', dot: '#64748b' },
}

function getExamColor(clientName: string) {
    const upper = (clientName || '').toUpperCase()
    if (upper.includes('PROMETRIC')) return EXAM_COLORS.PROMETRIC
    if (upper.includes('PEARSON'))   return EXAM_COLORS.PEARSON
    if (upper.includes('PSI'))       return EXAM_COLORS.PSI
    if (upper.includes('IELTS'))     return EXAM_COLORS.IELTS
    if (upper.includes('CELPIP'))    return EXAM_COLORS.CELPIP
    if (upper.includes('CMA'))       return EXAM_COLORS.CMA
    return EXAM_COLORS.DEFAULT
}

const BRANCH_LABELS: Record<string, string> = { calicut: 'Calicut', cochin: 'Cochin', global: 'All Centres' }

export default function CommandCentre({ onNavigate, onAiQuery }: { onNavigate?: (tab: string) => void; onAiQuery?: (query: string) => void }) {
    const { profile, user } = useAuth()
    const { activeBranch, setActiveBranch } = useBranch()
    const { modules, toggleModule, isUpdating } = useAppModules()

    const availableBranches = getAvailableBranches(profile?.email, profile?.role)
    const canSwitch = canSwitchBranches(profile?.email, profile?.role)
    const isMithun = profile?.email === 'mithun@fets.in'

    const [showManagementMenu, setShowManagementMenu] = useState(false)
    const managementRef = React.useRef<HTMLDivElement>(null)

    const secondRowItems = [
        { id: 'my-desk', label: 'MY DESK', icon: MessageSquare },
        { id: 'system-manager', label: 'SYSTEM MANAGER', icon: Server },
        { id: 'lost-and-found', label: 'LOST & FOUND', icon: PackageSearch },
        { id: 'fets-intelligence', label: 'FETS AI', icon: Brain },
    ].filter(item => {
        const moduleState = modules.find(m => m.id === item.id);
        if (moduleState && !moduleState.is_enabled) return false;
        return true;
    });

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (managementRef.current && !managementRef.current.contains(event.target as Node)) {
                setShowManagementMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const { data: dashboardData, isLoading: isLoadingStats } = useDashboardStats()
    const { data: examSchedule = [], isLoading: isLoadingSchedule } = useUpcomingSchedule()
    const { data: newsItems = [] } = useNews()

    const [opsMetrics, setOpsMetrics] = useState({ healthScore: 100, critical: 0, open: 0, topIssue: 'Stable' })
    const [staffPresent, setStaffPresent] = useState<Array<{ name: string; branch: string; check_in?: string }>>([])
    const [loadingAnalysis, setLoadingAnalysis] = useState(true)
    const [activeCenter, setActiveCenter] = useState<string>('all')
    const [portals, setPortals] = useState<any[]>([])
    const [portalsLoading, setPortalsLoading] = useState(true)
    const [vaultEntries, setVaultEntries] = useState<any[]>([])
    const [vaultLoading, setVaultLoading] = useState(true)
    const [vaultSearch, setVaultSearch] = useState('')
    const [activeVaultId, setActiveVaultId] = useState<string | null>(null)
    const [revealMap, setRevealMap] = useState<Record<string, boolean>>({})
    const [isVaultCollapsed, setIsVaultCollapsed] = useState(true)
    const [showAllVault, setShowAllVault] = useState(false)
    const [selectedVaultEntry, setSelectedVaultEntry] = useState<any | null>(null)
    const [isEditingVault, setIsEditingVault] = useState(false)
    const [isDeletingVault, setIsDeletingVault] = useState(false)
    const [editForm, setEditForm] = useState({ title: '', category: '', type: '', content: '' })
    const [pendingRequests, setPendingRequests] = useState<any[]>([])

    const notices = useMemo(() => {
        return newsItems
            .filter((item: any) => {
                if (!item.is_active) return false
                return (item.branch_location === 'global' || !item.branch_location) || (item.branch_location === activeBranch)
            })
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5)
    }, [newsItems, activeBranch])

    const fetchPendingRequests = React.useCallback(async () => {
        if (!isMithun) return;
        try {
            const { data } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    requestor:staff_profiles!leave_requests_user_id_fkey(full_name),
                    target:staff_profiles!leave_requests_swap_with_user_id_fkey(full_name)
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
            setPendingRequests(data || [])
        } catch (e) {
            console.error('Pending requests load failed', e)
        }
    }, [isMithun])

    const fetchAnalysis = React.useCallback(async () => {
        try {
            const { data: events } = await (supabase as any).from('incidents').select('*').gte('created_at', new Date(new Date().setDate(1)).toISOString())
            const openEvents = events?.filter((e: any) => e.status !== 'closed') || []
            const critical = openEvents.filter((e: any) => e.severity === 'critical').length
            const major = openEvents.filter((e: any) => e.severity === 'high' || e.severity === 'medium').length
            const health = Math.max(0, 100 - (critical * 15) - (major * 5) - openEvents.length)
            const categories: Record<string, number> = {}
            events?.forEach((e: any) => { categories[e.category || 'Other'] = (categories[e.category || 'Other'] || 0) + 1 })
            const topCat = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]
            setOpsMetrics({ healthScore: health, critical, open: openEvents.length, topIssue: topCat ? topCat[0] : 'Stable' })

            // Staff attendance today
            const today = new Date().toISOString().split('T')[0]
            const { data: attendance } = await (supabase as any)
                .from('staff_attendance')
                .select('staff_id, check_in, branch_location, staff_profiles(full_name)')
                .eq('date', today)
                .not('check_in', 'is', null)
            if (attendance) {
                setStaffPresent(attendance.map((a: any) => ({
                    name: a.staff_profiles?.full_name || 'Staff',
                    branch: a.branch_location || activeBranch,
                    check_in: a.check_in
                })))
            }
        } catch (e) {
            console.error('Analysis load failed', e)
        } finally {
            setLoadingAnalysis(false)
        }
    }, [activeBranch])

    const fetchVault = React.useCallback(async () => {
        try {
            const { data } = await supabase.from('fets_vault').select('*').order('title', { ascending: true })
            setVaultEntries(data || [])
        } catch (e) {
            console.error('Vault load failed', e)
        } finally {
            setVaultLoading(false)
        }
    }, [])

    const fetchPortals = React.useCallback(async () => {
        try {
            const { data } = await supabase.from('clients').select('*').order('name', { ascending: true })
            if (data) {
                // Map clients to portals format
                const mappedPortals = data.map((client: any) => {
                    let url = '#'
                    let logo = client.logo_url || ''
                    
                    // Map known URLs and logos if not present in DB
                    if (client.name.toUpperCase().includes('CELPIP')) {
                        url = 'https://www.celpip.ca'
                        if (!logo) logo = '/client-logos/celpip.jpg'
                    } else if (client.name.toUpperCase().includes('CMA')) {
                        url = 'https://proscheduler.prometric.com/home'
                        if (!logo) logo = '/client-logos/cma_us.png'
                    } else if (client.name.toUpperCase().includes('PEARSON')) {
                        url = 'https://connect.pearsonvue.com/'
                        if (!logo) logo = '/client-logos/pearson_vue.png'
                    } else if (client.name.toUpperCase().includes('PROMETRIC')) {
                        url = 'https://easyserve.prometric.com/my.policy'
                        if (!logo) logo = '/client-logos/prometric.png'
                    } else if (client.name.toUpperCase().includes('PSI')) {
                        url = 'https://gps.psiexams.com/login'
                        if (!logo) logo = '/client-logos/psi.png'
                    } else if (client.name.toUpperCase().includes('ITTS')) {
                        url = 'https://tds.surpass.com/account/login/'
                        if (!logo) logo = '/client-logos/itts.png'
                    }

                    return {
                        name: client.name,
                        url: url,
                        color: client.color || '#f6c810',
                        logo: logo
                    }
                })
                setPortals(mappedPortals)
            }
        } catch (e) {
            console.error('Portals load failed', e)
        } finally {
            setPortalsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (user?.id) { 
            fetchAnalysis(); 
            fetchVault();
            fetchPortals();
            if (isMithun) fetchPendingRequests();
        }
    }, [user?.id, fetchAnalysis, fetchVault, fetchPortals, fetchPendingRequests, isMithun])

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast.success(`${label} copied`, { 
            icon: '✨', 
            style: { 
                background: '#121214', 
                color: '#FACC15', 
                border: '1px solid rgba(250, 204, 21, 0.2)',
                fontSize: '10px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
            } 
        })
    }

    const deleteVaultEntry = async (id: string) => {
        try {
            const { error } = await supabase.from('fets_vault').delete().eq('id', id)
            if (error) throw error
            toast.success('Entry deleted', {
                style: { background: '#121214', color: '#FACC15' }
            })
            setSelectedVaultEntry(null)
            setIsDeletingVault(false)
            fetchVault()
        } catch (err: any) {
            toast.error(err.message)
        }
    }

    const updateVaultEntry = async () => {
        if (!selectedVaultEntry) return
        try {
            const { error } = await supabase
                .from('fets_vault')
                .update(editForm)
                .eq('id', selectedVaultEntry.id)
            
            if (error) throw error
            toast.success('Entry updated')
            setIsEditingVault(false)
            setSelectedVaultEntry({ ...selectedVaultEntry, ...editForm })
            fetchVault()
        } catch (err: any) {
            toast.error(err.message)
        }
    }

    const openVaultDetails = (item: any) => {
        setSelectedVaultEntry(item)
        setEditForm({
            title: item.title || '',
            category: item.category || '',
            type: item.type || '',
            content: item.content || ''
        })
        setIsEditingVault(false)
    }

    // Today's exams grouped by center
    const examsByCenter = useMemo(() => {
        const map: Record<string, any[]> = { calicut: [], cochin: [], global: [] }
        ;(dashboardData?.todaysExams || []).forEach((exam: any) => {
            const loc = exam.branch_location || exam.location || 'global'
            if (map[loc]) map[loc].push(exam)
            else map.global.push(exam)
        })
        return map
    }, [dashboardData])

    const filteredVault = vaultEntries.filter(e =>
        e.title?.toLowerCase().includes(vaultSearch.toLowerCase()) ||
        e.category?.toLowerCase().includes(vaultSearch.toLowerCase())
    )

    const totalCandidates = (dashboardData?.todaysExams || []).reduce((s: number, e: any) => s + (e.candidate_count || 0), 0)
    const totalSessions = dashboardData?.todaysExams?.length || 0
    const healthColor = opsMetrics.healthScore >= 80 ? '#10b981' : opsMetrics.healthScore >= 50 ? '#f59e0b' : '#ef4444'

    if (isLoadingStats || isLoadingSchedule) {
        return (
            <div className="flex items-center justify-center h-screen sovereign-theme">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative w-20 h-20">
                        <div className="absolute inset-0 rounded-full border border-white/5" />
                        <div className="absolute inset-0 rounded-full border-t-2 border-[#FACC15] animate-spin" />
                        <div className="absolute inset-4 rounded-full border border-[#FACC15]/20 animate-pulse" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <span className="sov-label text-[#FACC15]">Initializing FETS.LIVE Deck</span>
                        <span className="text-[8px] text-white/20 uppercase tracking-[0.4em]">Secure Connection Established</span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen sovereign-theme pb-16 overflow-x-hidden">

            <NotificationBanner onNavigate={onNavigate} />

            <div className="max-w-[1800px] mx-auto px-4 md:px-8 pt-8">

                {/* ═══════════════════════════════════════════════════════
                    COMMAND HEADER
                ═══════════════════════════════════════════════════════ */}
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-8 mt-24"
                >
                    {/* Left branding */}
                    <div className="relative">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="h-[1px] w-12 bg-[#FACC15]" />
                            <span className="sov-label text-[#FACC15]">
                                Operational Intelligence {activeBranch !== 'global' && `// ${activeBranch.toUpperCase()}`}
                            </span>
                        </div>
                        <div className="relative inline-flex flex-col items-end">
                            <div className="text-6xl md:text-8xl font-black text-[#FACC15] tracking-tighter leading-none" role="heading" aria-level={1}>
                                FETS LIVE
                            </div>
                            <div className="mt-2 text-[#FACC15]/40 text-[10px] tracking-[0.3em] uppercase font-medium">v5.0</div>
                        </div>
                        <div className="mt-6 flex items-center gap-3">
                            <div className="h-[1px] w-8 bg-[#FACC15]/50" />
                            <span 
                                className="text-[#FACC15] text-xl md:text-2xl tracking-wide" 
                                style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}
                            >
                                {format(new Date(), 'EEEE, MMMM do, yyyy')}
                            </span>
                        </div>
                    </div>

                    {/* Location Selector */}
                    <div className="flex w-full justify-center lg:w-auto lg:flex-1 relative lg:-mt-12 -my-8 lg:my-0 z-50">
                        <LocationSelectorThread
                            activeBranch={activeBranch}
                            setActiveBranch={setActiveBranch as any}
                            availableBranches={availableBranches}
                            canSwitch={canSwitch}
                        />
                    </div>

                    {/* Officer plate */}
                    <div className="flex items-center gap-4 sov-neuromorphic-yellow p-2 pr-6 rounded-2xl border-[#FACC15]/20 shadow-2xl group transition-all duration-500 hover:border-[#FACC15]/50">
                        {/* Avatar */}
                        <div className="relative p-1">
                            <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-[#FACC15]/40 p-0.5 bg-black/40 shadow-inner">
                                <img
                                    src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'User')}&background=121214&color=FACC15&size=128`}
                                    className="w-full h-full object-cover rounded-lg transition-transform duration-700 group-hover:scale-110"
                                    alt="Profile"
                                />
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#121214] shadow-lg" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="text-xl md:text-2xl font-black text-white tracking-tighter transition-all duration-500 leading-none">{profile?.full_name || 'Authorized User'}</div>
                            
                            {/* Controls inside Officer Plate */}
                            <div className="flex items-center gap-2 mt-1">
                                {/* MANAGEMENT DROPDOWN */}
                                <div ref={managementRef} className="relative shrink-0">
                                    <button
                                        onClick={() => setShowManagementMenu(!showManagementMenu)}
                                        className={`
                                            group relative flex items-center gap-1.5 px-2 py-1 transition-all duration-300
                                            rounded-sm border border-white/10 hover:border-[#FACC15]/50
                                            ${showManagementMenu ? 'bg-[#FACC15]/10 border-[#FACC15]/50' : 'bg-white/5'}
                                        `}
                                    >
                                        <Settings2 size={10} className="opacity-40" />
                                        <span className="text-[9px] font-bold text-white uppercase tracking-[0.2em]">MGMT</span>
                                        <ChevronDown size={10} className={`opacity-30 transition-transform duration-300 ${showManagementMenu ? 'rotate-180' : ''}`} />
                                    </button>

                                    <AnimatePresence>
                                        {showManagementMenu && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 8 }}
                                                className="absolute top-full right-0 mt-2 w-56 bg-[#121214] border border-white/10 shadow-2xl z-[80] p-1"
                                            >
                                                <div className="px-3 py-1.5 mb-1 border-b border-white/5">
                                                    <span className="text-[8px] font-bold text-[#FACC15] uppercase tracking-[0.3em]">System Controls</span>
                                                </div>
                                                <div className="p-1.5 space-y-1">
                                                    {/* Raise A Case */}
                                                    <button
                                                        onClick={() => { onNavigate?.('incident-log'); setShowManagementMenu(false); }}
                                                        className="w-full flex items-center justify-between p-2 rounded-sm transition-all hover:bg-white/5 text-white/80"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <AlertCircle size={12} className="text-white/40" />
                                                            <span className="text-[9px] font-bold uppercase tracking-wider">Raise A Case</span>
                                                        </div>
                                                        <ChevronRight size={10} className="opacity-20" />
                                                    </button>

                                                    <div className="h-px bg-white/5 my-1.5" />

                                                    {/* Second Row Items */}
                                                    {secondRowItems.map((item) => (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => { onNavigate?.(item.id); setShowManagementMenu(false); }}
                                                            className="w-full flex items-center justify-between p-2 rounded-sm transition-all hover:bg-white/5 text-white/80"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <item.icon size={12} className="text-white/40" />
                                                                <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
                                                            </div>
                                                            <ChevronRight size={10} className="opacity-20" />
                                                        </button>
                                                    ))}

                                                    <div className="h-px bg-white/5 my-1.5" />
                                                    
                                                    {/* Modules (Mithun Only) */}
                                                    {isMithun && modules.map(mod => (
                                                        <div
                                                            key={mod.id}
                                                            className="flex items-center justify-between p-2 rounded-sm transition-all hover:bg-white/5"
                                                        >
                                                            <button
                                                                onClick={() => { onNavigate?.(mod.id); setShowManagementMenu(false); }}
                                                                className="flex items-center gap-2 flex-1 text-left"
                                                            >
                                                                <div className="p-1 rounded-sm text-white/40">
                                                                    <Layers size={12} />
                                                                </div>
                                                                <div>
                                                                    <div className="text-[9px] font-bold uppercase tracking-wider text-white/80">{mod.name}</div>
                                                                    <div className="text-[7px] text-white/30 uppercase tracking-widest">{mod.id.replace(/-/g, ' ')}</div>
                                                                </div>
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); toggleModule(mod.id, !mod.is_enabled); }}
                                                                disabled={isUpdating}
                                                                className={`px-1.5 py-0.5 rounded-sm text-[7px] font-bold uppercase transition-all ${mod.is_enabled ? 'bg-[#FACC15] text-black' : 'bg-white/10 text-white/40'}`}
                                                            >
                                                                {mod.is_enabled ? 'ON' : 'OFF'}
                                                            </button>
                                                        </div>
                                                    ))}

                                                    {isMithun && (
                                                        <>
                                                            <div className="h-px bg-white/5 my-1.5" />
                                                            <button
                                                                onClick={() => { onNavigate?.('user-management'); setShowManagementMenu(false); }}
                                                                className="w-full flex items-center justify-between p-2 rounded-sm transition-all hover:bg-white/5 text-white/80"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Shield size={12} className="text-white/40" />
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider">User Management</span>
                                                                </div>
                                                                <ChevronRight size={10} className="opacity-20" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ═══════════════════════════════════════════════════════
                    PENDING REQUESTS (MITHUN ONLY)
                ═══════════════════════════════════════════════════════ */}
                {isMithun && pendingRequests.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-12"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-sm bg-[#FACC15]/10 border border-[#FACC15]/30 flex items-center justify-center">
                                <AlertCircle size={14} className="text-[#FACC15]" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Pending Requests</h3>
                                <p className="text-[10px] text-[#FACC15]/60 uppercase tracking-[0.2em]">{pendingRequests.length} actions required</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendingRequests.map(req => (
                                <div key={req.id} className="sov-card relative overflow-hidden group cursor-pointer" onClick={() => onNavigate?.('fets-roster')}>
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        {req.request_type === 'leave' ? <Calendar size={40} className="text-[#FACC15]" /> : <Users size={40} className="text-[#FACC15]" />}
                                    </div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={`px-2 py-1 rounded-sm text-[8px] font-bold uppercase tracking-widest ${req.request_type === 'leave' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                                            {req.request_type === 'leave' ? 'Leave Request' : 'Shift Swap'}
                                        </span>
                                        <span className="text-[10px] text-white/40 font-medium">{new Date(req.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="mb-4">
                                        <div className="text-sm font-bold text-white mb-1">{req.requestor?.full_name || 'Unknown Staff'}</div>
                                        <div className="text-[11px] text-[#FACC15] font-medium">
                                            {req.request_type === 'leave' 
                                                ? `Requested Date: ${new Date(req.requested_date).toLocaleDateString()}`
                                                : `Swap with ${req.target?.full_name || 'Unknown'} on ${new Date(req.requested_date).toLocaleDateString()}`
                                            }
                                        </div>
                                    </div>
                                    {req.reason && (
                                        <div className="text-[10px] text-white/60 italic border-l-2 border-white/10 pl-2 mb-4 line-clamp-2">
                                            "{req.reason}"
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                                        <span className="text-[9px] text-white/40 uppercase tracking-widest">Click to manage in Roster</span>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Using direct delete since window.confirm doesn't work in iframe
                                                    supabase.from('leave_requests').delete().eq('id', req.id).then(() => {
                                                        toast.success('Request deleted');
                                                        fetchPendingRequests();
                                                    });
                                                }}
                                                className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                                title="Delete Request"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                            <ArrowRight size={12} className="text-[#FACC15] group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ═══════════════════════════════════════════════════════
                    TODAY'S OPS GLIMPSE — Stat Cards
                ═══════════════════════════════════════════════════════ */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                    {[
                        { label: 'Sessions Today', value: totalSessions, icon: Calendar, color: '#FACC15', sub: `${activeBranch !== 'global' ? activeBranch : 'all centres'}` },
                        { label: 'Candidates', value: totalCandidates, icon: Users, color: '#BADFE7', sub: 'registered today' },
                        { label: 'Staff Present', value: staffPresent.length, icon: CheckCircle2, color: '#C2EDCE', sub: 'checked in' },
                        { label: 'Ops Health', value: `${opsMetrics.healthScore}%`, icon: Activity, color: healthColor, sub: opsMetrics.topIssue },
                    ].map((stat, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}
                            className="sov-card group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FACC15]/5 to-transparent blur-3xl -mr-16 -mt-16 group-hover:from-[#FACC15]/10 transition-all duration-500" />
                            
                            <div className="relative z-10 flex items-start justify-between mb-6">
                                <div className="w-12 h-12 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[#FACC15]/40 transition-all duration-500">
                                    <stat.icon size={20} style={{ color: stat.color }} className="opacity-70 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <ArrowUpRight size={14} className="text-white/10 group-hover:text-[#FACC15] transition-all" />
                            </div>
                            
                            <div className="relative z-10">
                                <div className="text-4xl font-bold tracking-tighter text-white mb-1 group-hover:text-[#FACC15] transition-colors">{stat.value}</div>
                                <div className="sov-label opacity-60 group-hover:opacity-100 transition-opacity">{stat.label}</div>
                                <div className="text-[9px] text-white/20 mt-2 uppercase tracking-[0.2em] font-medium">{stat.sub}</div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* ═══════════════════════════════════════════════════════
                    QUICK LAUNCH — External Portals
                ═══════════════════════════════════════════════════════ */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="mb-12">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-sm bg-blue-500/10 flex items-center justify-center">
                            <ExternalLink size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Quick Launch</h3>
                            <p className="sov-label opacity-40 mt-1">Direct access to partner nodes</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {portals.map((portal, i) => (
                            <motion.a
                                key={i}
                                href={portal.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.35 + i * 0.05 }}
                                className="sov-card group flex flex-col items-center justify-center text-center p-6 hover:border-[#FACC15]/40 transition-all duration-500"
                            >
                                <div className="w-16 h-16 mb-4 flex items-center justify-center p-2 bg-white/5 rounded-xl group-hover:bg-white/10 transition-all duration-500">
                                    <img src={portal.logo} alt={portal.name} className="max-w-full max-h-full object-contain opacity-80 group-hover:opacity-100 transition-all" referrerPolicy="no-referrer" 
                                        onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${portal.name}&background=121214&color=f6c810` }}
                                    />
                                </div>
                                <div className="text-[10px] font-bold text-white/60 group-hover:text-[#FACC15] uppercase tracking-widest transition-colors">{portal.name}</div>
                            </motion.a>
                        ))}
                    </div>
                </motion.div>

                {/* ═══════════════════════════════════════════════════════
                    F-VAULT — Secure Document Repository
                ═══════════════════════════════════════════════════════ */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="sov-card mb-12 relative overflow-hidden"
                >
                    {/* Background ambient glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-gradient-to-b from-[#FACC15]/5 to-transparent blur-3xl pointer-events-none" />

                    <div 
                        className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer group"
                        onClick={() => setIsVaultCollapsed(!isVaultCollapsed)}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-sm bg-[#FACC15]/10 flex items-center justify-center group-hover:bg-[#FACC15]/20 transition-all">
                                <ShieldCheck size={20} className="text-[#FACC15]" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                                    F-Vault
                                    <ChevronDown size={16} className={`text-white/20 transition-transform duration-500 ${!isVaultCollapsed ? 'rotate-180' : ''}`} />
                                </h3>
                                <p className="sov-label opacity-40 mt-1">Encrypted document repository // {isVaultCollapsed ? 'Collapsed' : 'Expanded'}</p>
                            </div>
                        </div>

                        {!isVaultCollapsed && (
                            <div className="flex flex-wrap items-center gap-4" onClick={(e) => e.stopPropagation()}>
                                {/* Search bar */}
                                <div className="relative group/search">
                                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within/search:text-[#FACC15] transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search vault..."
                                        value={vaultSearch}
                                        onChange={(e) => setVaultSearch(e.target.value)}
                                        className="bg-black/40 border border-white/5 rounded-sm pl-10 pr-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white placeholder:text-white/10 focus:outline-none focus:border-[#FACC15]/40 w-full md:w-64 transition-all"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <AnimatePresence>
                        {!isVaultCollapsed && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.5, ease: "easeInOut" }}
                                className="overflow-hidden"
                            >
                                <div className="pt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {(showAllVault ? filteredVault : filteredVault.slice(0, 4)).map((item: any, i: number) => (
                                        <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                            onClick={() => openVaultDetails(item)}
                                            className="group bg-black/40 border border-white/5 p-5 rounded-sm hover:border-[#FACC15]/40 transition-all duration-500 cursor-pointer">
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="w-10 h-10 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[#FACC15]/20 transition-all">
                                                    <FileText size={18} className="text-[#FACC15] opacity-60 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <div className="px-2 py-1 bg-white/5 rounded-sm text-[8px] font-bold text-white/20 uppercase tracking-widest">
                                                    {item.type || 'DOC'}
                                                </div>
                                            </div>
                                            <div className="text-sm font-bold text-white/80 mb-2 group-hover:text-white transition-colors">{item.title}</div>
                                            <div className="text-[10px] text-white/20 uppercase tracking-widest font-bold mb-4">{item.category}</div>
                                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                                <div className="text-[9px] text-white/30 font-medium">{item.date || '12 MAR 2026'}</div>
                                                <ArrowUpRight size={12} className="text-white/10 group-hover:text-[#FACC15] transition-all" />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                                
                                {filteredVault.length > 4 && (
                                    <div className="mt-8 flex justify-center">
                                        <button 
                                            onClick={() => setShowAllVault(!showAllVault)}
                                            className="flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-[#FACC15]/10 border border-white/10 hover:border-[#FACC15]/40 rounded-full transition-all group"
                                        >
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 group-hover:text-[#FACC15]">
                                                {showAllVault ? 'Show Less' : `Show All (${filteredVault.length})`}
                                            </span>
                                            <ChevronDown size={14} className={`text-white/20 group-hover:text-[#FACC15] transition-transform ${showAllVault ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* ═══════════════════════════════════════════════════════
                    MODALS
                ═══════════════════════════════════════════════════════ */}
                <AnimatePresence>
                    {selectedVaultEntry && (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8">
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setSelectedVaultEntry(null)}
                                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                            />
                            
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="relative w-full max-w-2xl bg-[#121214] border border-[#FACC15]/20 rounded-3xl overflow-hidden shadow-2xl"
                            >
                                <div className="p-8">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-[#FACC15]/10 flex items-center justify-center">
                                                <FileText className="text-[#FACC15]" size={24} />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-white tracking-tight">
                                                    {isEditingVault ? 'Edit Vault Entry' : selectedVaultEntry.title}
                                                </h2>
                                                <p className="sov-label opacity-40 mt-1">
                                                    {selectedVaultEntry.category} // {selectedVaultEntry.type}
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setSelectedVaultEntry(null)}
                                            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {isEditingVault ? (
                                        <div className="space-y-6">
                                            <div>
                                                <label className="sov-label block mb-2 text-[#FACC15]">Title</label>
                                                <input 
                                                    type="text"
                                                    value={editForm.title}
                                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                    className="w-full bg-black/40 border border-[#FACC15]/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FACC15]/40"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="sov-label block mb-2 text-[#FACC15]">Category</label>
                                                    <input 
                                                        type="text"
                                                        value={editForm.category}
                                                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                                        className="w-full bg-black/40 border border-[#FACC15]/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FACC15]/40"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="sov-label block mb-2 text-[#FACC15]">Type</label>
                                                    <input 
                                                        type="text"
                                                        value={editForm.type}
                                                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                                                        className="w-full bg-black/40 border border-[#FACC15]/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FACC15]/40"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="sov-label block mb-2 text-[#FACC15]">Content / Notes</label>
                                                <textarea 
                                                    rows={4}
                                                    value={editForm.content}
                                                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                                                    className="w-full bg-black/40 border border-[#FACC15]/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FACC15]/40 resize-none"
                                                />
                                            </div>
                                            <div className="flex gap-4 pt-4">
                                                <button 
                                                    onClick={updateVaultEntry}
                                                    className="flex-1 bg-[#FACC15] text-[#121214] font-bold py-4 rounded-xl hover:brightness-110 transition-all uppercase tracking-widest text-xs"
                                                >
                                                    Save Changes
                                                </button>
                                                <button 
                                                    onClick={() => setIsEditingVault(false)}
                                                    className="flex-1 bg-white/5 text-white font-bold py-4 rounded-xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : isDeletingVault ? (
                                        <div className="py-12 flex flex-col items-center text-center">
                                            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                                                <AlertTriangle className="text-red-500" size={40} />
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-2">Confirm Deletion</h3>
                                            <p className="text-white/40 max-w-xs mb-8">
                                                Are you sure you want to permanently remove <span className="text-white font-bold">"{selectedVaultEntry.title}"</span>? This action cannot be undone.
                                            </p>
                                            <div className="flex gap-4 w-full max-w-sm">
                                                <button 
                                                    onClick={() => deleteVaultEntry(selectedVaultEntry.id)}
                                                    className="flex-1 bg-red-500 text-white font-bold py-4 rounded-xl hover:bg-red-600 transition-all uppercase tracking-widest text-xs"
                                                >
                                                    Delete Permanently
                                                </button>
                                                <button 
                                                    onClick={() => setIsDeletingVault(false)}
                                                    className="flex-1 bg-white/5 text-white font-bold py-4 rounded-xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-8">
                                            <div className="bg-black/40 border border-[#FACC15]/10 p-6 rounded-2xl">
                                                <p className="text-white/60 leading-relaxed whitespace-pre-wrap">
                                                    {selectedVaultEntry.content || 'No additional content or notes available for this entry.'}
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between pt-8 border-t border-white/5">
                                                <div className="flex gap-4">
                                                    <button 
                                                        onClick={() => setIsEditingVault(true)}
                                                        className="flex items-center gap-2 px-6 py-3 bg-white/5 text-white/60 hover:text-[#FACC15] hover:bg-[#FACC15]/10 rounded-xl transition-all font-bold uppercase tracking-widest text-[10px]"
                                                    >
                                                        <Settings size={14} />
                                                        Edit Entry
                                                    </button>
                                                    <button 
                                                        onClick={() => setIsDeletingVault(true)}
                                                        className="flex items-center gap-2 px-6 py-3 bg-white/5 text-white/60 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all font-bold uppercase tracking-widest text-[10px]"
                                                    >
                                                        <Trash2 size={14} />
                                                        Delete
                                                    </button>
                                                </div>
                                                <div className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
                                                    ID: {selectedVaultEntry.id.slice(0, 8)}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    )
}
