import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users, Activity, CheckCircle, Sparkles,
    Settings, ChevronRight, ChevronDown, Bell, AlertTriangle, Shield, ClipboardList,
    CheckCircle2, AlertCircle, Star, MessageSquare, Search, X,
    ExternalLink, Globe, TrendingUp, Calendar, MapPin,
    Building2, Clock, Zap, Lock, Unlock, Key, Copy,
    Eye, EyeOff, Plus, Trash2, Crown, Database, Briefcase,
    Server, ShieldCheck, ArrowUpRight, BookOpen, Phone,
    Layers, BarChart3, RefreshCw, FileText, Settings2, Brain, PackageSearch, ArrowRight,
    Grid, ChevronUp
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
import { SevenDayExamOutlook } from './SevenDayExamOutlook'
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
    const [isAddingVault, setIsAddingVault] = useState(false)
    const [editForm, setEditForm] = useState({ title: '', category: '', type: '', content: '', username: '', password: '', site_id: '', url: '' })
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
                setStaffPresent(attendance
                    .filter((a: any) => {
                        const loc = (a.branch_location || 'calicut').toLowerCase()
                        return activeBranch === 'global' || loc === activeBranch.toLowerCase()
                    })
                    .map((a: any) => ({
                        name: a.staff_profiles?.full_name || 'Staff',
                        branch: a.branch_location || activeBranch,
                        check_in: a.check_in
                    }))
                )
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
        try {
            const entryData = {
                title: editForm.title,
                category: editForm.category,
                type: editForm.type,
                notes: editForm.content,
                username: editForm.username,
                password: editForm.password,
                site_id: editForm.site_id,
                url: editForm.url,
                user_id: user?.id
            }

            if (isAddingVault) {
                const { error } = await supabase.from('fets_vault').insert([entryData])
                if (error) throw error
                toast.success('Entry secured in vault')
            } else {
                if (!selectedVaultEntry) return
                const { error } = await supabase
                    .from('fets_vault')
                    .update(entryData)
                    .eq('id', selectedVaultEntry.id)
                if (error) throw error
                toast.success('Entry updated')
            }
            setIsEditingVault(false)
            setIsAddingVault(false)
            fetchVault()
            if (!isAddingVault) {
                setSelectedVaultEntry({ ...selectedVaultEntry, ...entryData })
            } else {
                setSelectedVaultEntry(null)
            }
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
            content: item.content || item.notes || '',
            username: item.username || '',
            password: item.password || '',
            site_id: item.site_id || '',
            url: item.url || ''
        })
        setIsEditingVault(false)
        setIsAddingVault(false)
    }

    const openAddVault = () => {
        setIsAddingVault(true)
        setSelectedVaultEntry({ id: 'new', title: 'New Entry' })
        setEditForm({ title: '', category: '', type: '', content: '', username: '', password: '', site_id: '', url: '' })
        setIsEditingVault(true)
        setIsDeletingVault(false)
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

    const filteredTodaysExams = useMemo(() => {
        return (dashboardData?.todaysExams || []).filter((exam: any) => {
            if (activeBranch === 'global') return true;
            // Handle legacy Calicut data with no branch, assume Calicut
            const loc = (exam.branch_location || exam.location || 'calicut').toLowerCase();
            return loc === activeBranch.toLowerCase();
        });
    }, [dashboardData?.todaysExams, activeBranch]);

    const totalCandidates = filteredTodaysExams.reduce((s: number, e: any) => s + (e.candidate_count || 0), 0)
    const totalSessions = filteredTodaysExams.length
    const healthColor = opsMetrics.healthScore >= 80 ? '#10b981' : opsMetrics.healthScore >= 50 ? '#f59e0b' : '#ef4444'

    if (isLoadingStats) {
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
                                                                onClick={() => { onNavigate?.('candidate-tracker'); setShowManagementMenu(false); }}
                                                                className="w-full flex items-center justify-between p-2 rounded-sm transition-all hover:bg-white/5 text-white/80"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <ClipboardList size={12} className="text-cyan-400" />
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider">Fets Register</span>
                                                                </div>
                                                                <ChevronRight size={10} className="opacity-20" />
                                                            </button>
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
                    TODAY'S OPS GLIMPSE & QUICK LAUNCH
                ═══════════════════════════════════════════════════════ */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12">
                    {[
                        { label: 'Sessions Today', value: totalSessions, icon: Calendar, color: '#FACC15', sub: `${activeBranch !== 'global' ? activeBranch : 'all centres'}` },
                        { label: 'Candidates', value: totalCandidates, icon: Users, color: '#BADFE7', sub: 'registered today' },
                        { label: 'Staff Present', value: staffPresent.length, icon: CheckCircle2, color: '#C2EDCE', sub: 'checked in' },
                    ].map((stat, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}
                            className="sov-card group relative overflow-hidden h-[160px] flex flex-col justify-between">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FACC15]/5 to-transparent blur-3xl -mr-16 -mt-16 group-hover:from-[#FACC15]/10 transition-all duration-500" />
                            
                            <div className="relative z-10 flex items-start justify-between">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[#FACC15]/40 transition-all duration-500">
                                    <stat.icon size={18} style={{ color: stat.color }} className="opacity-70 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <ArrowUpRight size={14} className="text-white/10 group-hover:text-[#FACC15] transition-all" />
                            </div>
                            
                            <div className="relative z-10 mt-auto">
                                <div className="text-3xl md:text-4xl font-bold tracking-tighter text-white mb-1 group-hover:text-[#FACC15] transition-colors leading-none">{stat.value}</div>
                                <div className="text-[10px] md:text-sm font-black text-white/60 tracking-wider uppercase group-hover:opacity-100 transition-opacity leading-none mt-2">{stat.label}</div>
                                <div className="text-[8px] md:text-[9px] text-white/20 mt-1.5 uppercase tracking-widest font-bold leading-none">{stat.sub}</div>
                            </div>
                        </motion.div>
                    ))}

                    {/* Quick Launch (4th Box) */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                        className="sov-card group relative overflow-hidden h-[160px] flex flex-col justify-between p-3 border-[#FACC15]/10 hover:border-[#FACC15]/30 transition-all">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <div className="text-[8px] md:text-[9px] font-black text-white/60 tracking-wider uppercase flex items-center gap-1.5">
                                <ExternalLink size={10} className="text-[#FACC15]" />
                                Quick Launch
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1 md:gap-1.5 h-full content-start">
                            {portals.slice(0, 6).map((portal, i) => (
                                <a
                                    key={i}
                                    href={portal.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-col items-center justify-center py-2 px-1 bg-white/5 rounded-lg hover:bg-[#FACC15]/10 group/portal transition-colors aspect-square border border-transparent hover:border-white/10"
                                >
                                    <div className="w-4 h-4 md:w-6 md:h-6 mb-1.5 flex items-center justify-center">
                                        <img src={portal.logo} alt={portal.name} className="max-w-full max-h-full object-contain opacity-60 group-hover/portal:opacity-100 transition-opacity" referrerPolicy="no-referrer" 
                                            onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${portal.name}&background=121214&color=f6c810` }}
                                        />
                                    </div>
                                    <div className="text-[5px] md:text-[6px] font-bold text-white/30 group-hover/portal:text-[#FACC15] uppercase tracking-widest text-center leading-none truncate w-full px-0.5">
                                        {portal.name}
                                    </div>
                                </a>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>

                {/* ═══════════════════════════════════════════════════════
                    7-DAY EXAM OUTLOOK (syncs with centre selector)
                ═══════════════════════════════════════════════════════ */}
                <SevenDayExamOutlook
                    sessions={examSchedule as any}
                    isLoading={isLoadingSchedule}
                    activeBranch={activeBranch}
                />

                {/* ═══════════════════════════════════════════════════════
                    F-VAULT — Secure Document Repository
                ═══════════════════════════════════════════════════════ */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-12"
                >
                    <button
                        type="button"
                        onClick={() => setIsVaultCollapsed((v) => !v)}
                        className="w-full flex items-center justify-between gap-4 border-b border-white/5 pb-4 group text-left rounded-sm hover:bg-white/[0.02] transition-colors -mx-1 px-1"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-sm bg-[#FACC15]/10 flex items-center justify-center border border-[#FACC15]/20 shrink-0">
                                <ShieldCheck size={16} className="text-[#FACC15]" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-xl font-black text-white tracking-tighter uppercase group-hover:text-[#FACC15] transition-colors leading-none">F-Vault</h3>
                                <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold mt-1.5 truncate">
                                    {isVaultCollapsed ? 'Secure document repository — tap to expand' : `Secure Document Repository (${vaultEntries.length})`}
                                </p>
                            </div>
                        </div>
                        <ChevronDown
                            size={20}
                            className={`shrink-0 text-[#FACC15]/60 transition-transform duration-300 ${isVaultCollapsed ? '' : 'rotate-180'}`}
                            aria-hidden
                        />
                    </button>

                    <AnimatePresence initial={false}>
                        {!isVaultCollapsed && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 pb-4 border-b border-white/5">
                                    <div className="relative group/search w-full sm:w-auto">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within/search:text-[#FACC15] transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Search..."
                                            value={vaultSearch}
                                            onChange={(e) => setVaultSearch(e.target.value)}
                                            className="bg-black/40 border border-white/5 rounded-sm pl-8 pr-3 py-1.5 text-[10px] uppercase font-bold text-white focus:outline-none focus:border-[#FACC15]/40 w-full sm:w-48 transition-all"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={openAddVault}
                                        className="px-4 py-2 flex items-center justify-center gap-1.5 bg-[#FACC15]/10 text-[#FACC15] border border-[#FACC15]/20 hover:bg-[#FACC15]/20 hover:border-[#FACC15]/60 rounded-sm text-[9px] uppercase font-bold tracking-widest transition-all shrink-0"
                                    >
                                        <Plus size={12} /> Add Asset
                                    </button>
                                </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-2">
                        {(showAllVault ? filteredVault : filteredVault.slice(0, 8)).map((item: any, i: number) => (
                            <motion.div key={item.id || i}
                                onClick={() => openVaultDetails(item)}
                                className="sov-card h-[160px] flex flex-col justify-between cursor-pointer hover:border-[#FACC15]/40 transition-all duration-300 group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[#FACC15]/20 group-hover:bg-[#FACC15]/5 transition-all">
                                        <FileText size={16} className="text-white/40 group-hover:text-[#FACC15] transition-colors" />
                                    </div>
                                    <div className="px-2 py-0.5 md:py-1 bg-white/5 rounded-sm text-[7px] md:text-[8px] font-bold text-white/40 uppercase tracking-widest">
                                        {item.type || 'DOC'}
                                    </div>
                                </div>
                                <div className="mt-auto">
                                    <div className="text-xs md:text-sm font-bold text-white/80 group-hover:text-white transition-colors leading-tight mb-1 line-clamp-2">{item.title}</div>
                                    <div className="text-[8px] md:text-[9px] text-[#FACC15]/60 uppercase tracking-widest font-bold mb-2">{item.category}</div>
                                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                        <div className="text-[8px] text-white/30 font-bold uppercase tracking-widest">{item.date || 'Asset'}</div>
                                        <ArrowUpRight size={10} className="text-white/10 group-hover:text-[#FACC15] transition-all" />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    
                    {filteredVault.length > 8 && (
                        <button 
                            type="button"
                            onClick={() => setShowAllVault(!showAllVault)}
                            className="w-full mt-2 md:mt-4 py-2 bg-gradient-to-r from-transparent via-white/5 to-transparent hover:via-[#FACC15]/10 border-y border-transparent hover:border-[#FACC15]/20 flex items-center justify-center gap-2 text-[8px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 hover:text-[#FACC15] transition-all cursor-pointer"
                        >
                            {showAllVault ? <ChevronUp size={12} /> : <Grid size={12} />}
                            {showAllVault ? 'Collapse Repository' : `Load Full Secure Repository (${filteredVault.length} Assets)`}
                        </button>
                    )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>



                {/* ═══════════════════════════════════════════════════════
                    FLOATING VAULT ENTRY WIDGET
                ═══════════════════════════════════════════════════════ */}
                <AnimatePresence>
                    {selectedVaultEntry && (
                        <motion.div 
                            drag 
                            dragMomentum={false}
                            initial={{ opacity: 0, scale: 0.9, y: 50, x: 50 }}
                            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 50, x: 50 }}
                            className="fixed bottom-6 right-6 z-[200] w-full max-w-sm md:max-w-md bg-[#121214]/95 backdrop-blur-xl border border-[#FACC15]/30 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                            style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(250, 204, 21, 0.1)' }}
                        >
                            {/* Drag Handle & Header */}
                            <div className="p-4 border-b border-[#FACC15]/20 flex items-center justify-between bg-gradient-to-r from-[#FACC15]/10 to-transparent cursor-grab active:cursor-grabbing">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[#FACC15]/20 flex items-center justify-center">
                                        <FileText className="text-[#FACC15]" size={16} />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-white tracking-tight uppercase">
                                            {isAddingVault ? 'New Entry' : isEditingVault ? 'Edit Entry' : selectedVaultEntry.title || 'Untitled'}
                                        </h2>
                                        <p className="text-[9px] font-bold text-[#FACC15]/60 uppercase tracking-widest mt-0.5">
                                            {selectedVaultEntry.category || 'Vault Asset'} // {selectedVaultEntry.type || 'SECURE'}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => { setSelectedVaultEntry(null); setIsAddingVault(false); setIsEditingVault(false); }}
                                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="p-6 overflow-y-auto no-scrollbar flex-1" onPointerDownCapture={(e) => e.stopPropagation()}>
                                {isEditingVault || isAddingVault ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-[#FACC15]/80 tracking-widest mb-1 block">Title</label>
                                            <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                className="w-full bg-black/40 border border-[#FACC15]/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FACC15]/60 transition-colors" placeholder="e.g. Supabase Admin" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-[#FACC15]/80 tracking-widest mb-1 block">Category</label>
                                                <input type="text" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                                    className="w-full bg-black/40 border border-[#FACC15]/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FACC15]/60 transition-colors" placeholder="Credentials" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-[#FACC15]/80 tracking-widest mb-1 block">Type/Tag</label>
                                                <input type="text" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                                                    className="w-full bg-black/40 border border-[#FACC15]/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FACC15]/60 transition-colors" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-[#FACC15]/80 tracking-widest mb-1 block">Username / Email</label>
                                            <input type="text" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                                className="w-full bg-black/40 border border-[#FACC15]/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FACC15]/60 transition-colors" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-[#FACC15]/80 tracking-widest mb-1 block">Password</label>
                                            <input type="text" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                                className="w-full bg-black/40 border border-[#FACC15]/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FACC15]/60 transition-colors" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-[#FACC15]/80 tracking-widest mb-1 block">URL</label>
                                                <input type="text" value={editForm.url} onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                                                    className="w-full bg-black/40 border border-[#FACC15]/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FACC15]/60 transition-colors" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-[#FACC15]/80 tracking-widest mb-1 block">Site Code / ID</label>
                                                <input type="text" value={editForm.site_id} onChange={(e) => setEditForm({ ...editForm, site_id: e.target.value })}
                                                    className="w-full bg-black/40 border border-[#FACC15]/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FACC15]/60 transition-colors" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-[#FACC15]/80 tracking-widest mb-1 block">Notes</label>
                                            <textarea rows={3} value={editForm.content} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                                                className="w-full bg-black/40 border border-[#FACC15]/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FACC15]/60 transition-colors resize-none" />
                                        </div>
                                    </div>
                                ) : isDeletingVault ? (
                                    <div className="py-8 flex flex-col items-center text-center">
                                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                                            <AlertTriangle className="text-red-500" size={32} />
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-2">Confirm Delete</h3>
                                        <p className="text-xs text-white/50 max-w-[250px] mb-6 leading-relaxed">
                                            Are you sure you want to permanently remove this vault entry?
                                        </p>
                                        <div className="flex gap-3 w-full">
                                            <button onClick={() => deleteVaultEntry(selectedVaultEntry.id)} className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30 font-bold py-3 rounded-xl transition-all uppercase tracking-widest text-[10px]">
                                                Confirm
                                            </button>
                                            <button onClick={() => setIsDeletingVault(false)} className="flex-1 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 font-bold py-3 rounded-xl transition-all uppercase tracking-widest text-[10px]">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {selectedVaultEntry.username && (
                                            <div className="group bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between hover:border-[#FACC15]/20 transition-all">
                                                <div className="overflow-hidden">
                                                    <div className="text-[9px] text-white/40 uppercase tracking-widest font-bold mb-1">Username / Email</div>
                                                    <div className="text-sm font-medium text-white truncate">{selectedVaultEntry.username}</div>
                                                </div>
                                                <button onClick={() => copyToClipboard(selectedVaultEntry.username, 'Username')} className="p-2 bg-white/5 rounded-lg text-white/40 hover:text-[#FACC15] hover:bg-[#FACC15]/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2">
                                                    <Copy size={14} />
                                                </button>
                                            </div>
                                        )}
                                        {selectedVaultEntry.password && (
                                            <div className="group bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between hover:border-[#FACC15]/20 transition-all">
                                                <div className="overflow-hidden">
                                                    <div className="text-[9px] text-white/40 uppercase tracking-widest font-bold mb-1">Password</div>
                                                    <div className="text-sm font-medium text-white truncate font-mono">••••••••••••••••</div>
                                                </div>
                                                <button onClick={() => copyToClipboard(selectedVaultEntry.password, 'Password')} className="p-2 bg-white/5 rounded-lg text-white/40 hover:text-[#FACC15] hover:bg-[#FACC15]/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2">
                                                    <Copy size={14} />
                                                </button>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                            {selectedVaultEntry.url && (
                                                <div className="group bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between hover:border-[#FACC15]/20 transition-all">
                                                    <div className="overflow-hidden">
                                                        <div className="text-[9px] text-white/40 uppercase tracking-widest font-bold mb-1">URL</div>
                                                        <div className="text-xs font-medium text-[#FACC15]/80 truncate">{selectedVaultEntry.url}</div>
                                                    </div>
                                                    <button onClick={() => copyToClipboard(selectedVaultEntry.url, 'URL')} className="p-1.5 bg-white/5 rounded-lg text-white/40 hover:text-[#FACC15] hover:bg-[#FACC15]/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2">
                                                        <Copy size={12} />
                                                    </button>
                                                </div>
                                            )}
                                            {selectedVaultEntry.site_id && (
                                                <div className="group bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between hover:border-[#FACC15]/20 transition-all">
                                                    <div className="overflow-hidden">
                                                        <div className="text-[9px] text-white/40 uppercase tracking-widest font-bold mb-1">Site Code</div>
                                                        <div className="text-sm font-medium text-white truncate">{selectedVaultEntry.site_id}</div>
                                                    </div>
                                                    <button onClick={() => copyToClipboard(selectedVaultEntry.site_id, 'Site Code')} className="p-1.5 bg-white/5 rounded-lg text-white/40 hover:text-[#FACC15] hover:bg-[#FACC15]/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2">
                                                        <Copy size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {(selectedVaultEntry.content || selectedVaultEntry.notes) && (
                                            <div className="bg-black/40 border border-white/5 rounded-xl p-4 mt-2">
                                                <div className="text-[9px] text-white/40 uppercase tracking-widest font-bold mb-2 flex items-center justify-between group">
                                                    Notes / Context
                                                    <button onClick={() => copyToClipboard(selectedVaultEntry.content || selectedVaultEntry.notes, 'Notes')} className="text-white/20 hover:text-[#FACC15] opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Copy size={10} />
                                                    </button>
                                                </div>
                                                <p className="text-white/70 text-xs leading-relaxed whitespace-pre-wrap">
                                                    {selectedVaultEntry.content || selectedVaultEntry.notes}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="p-4 border-t border-[#FACC15]/10 bg-black/60 backdrop-blur-md" onPointerDownCapture={(e) => e.stopPropagation()}>
                                {isEditingVault || isAddingVault ? (
                                    <div className="flex gap-3">
                                        <button onClick={updateVaultEntry} className="flex-1 bg-[#FACC15] text-[#121214] hover:brightness-110 font-bold py-3 rounded-xl transition-all uppercase tracking-widest text-[10px]">
                                            Save Entry
                                        </button>
                                        <button onClick={() => { setIsEditingVault(false); if(isAddingVault) setSelectedVaultEntry(null); setIsAddingVault(false); }} className="flex-1 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 font-bold py-3 rounded-xl transition-all uppercase tracking-widest text-[10px]">
                                            Cancel
                                        </button>
                                    </div>
                                ) : !isDeletingVault ? (
                                    <div className="flex gap-3">
                                        <button onClick={() => setIsEditingVault(true)} className="flex-1 flex items-center justify-center gap-2 bg-[#FACC15] text-[#121214] hover:brightness-110 font-bold py-2.5 rounded-xl transition-all uppercase tracking-widest text-[10px]">
                                            <Settings size={12} /> Edit
                                        </button>
                                        <button onClick={() => setIsDeletingVault(true)} className="px-4 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 font-bold py-2.5 rounded-xl transition-all">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    )
}
